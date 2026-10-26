import { describe, expect, it, vi } from "vitest";

import { addressOf, readResource } from "./read-resource";
import { encodeContentState } from "../../../packages/clover/src/core/content-state";

const ADDRESS = "https://example.org/iiif/manifest.json";

const MANIFEST = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: ADDRESS,
  type: "Manifest",
  label: { en: ["A label"] },
  items: [{ id: `${ADDRESS}/canvas/1`, type: "Canvas" }],
};

/** A fetch that answers with this body, and remembers how it was asked. */
const answering = (body: string, init?: ResponseInit) =>
  vi.fn(async () => new Response(body, init));

describe("readResource", () => {
  it("reads a resource's structure, without the reader's cookies or the page's address", async () => {
    const fetch = answering(JSON.stringify(MANIFEST));
    const read = await readResource(ADDRESS, { fetch });
    expect(read).toMatchObject({
      ok: true,
      address: ADDRESS,
      structure: { type: "Manifest", containers: { Canvas: 1 } },
    });
    expect(fetch).toHaveBeenCalledWith(
      ADDRESS,
      expect.objectContaining({
        credentials: "omit",
        referrerPolicy: "no-referrer",
      }),
    );
  });

  it("reads what a content state opens", () => {
    const state = encodeContentState({
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/state",
      type: "Annotation",
      motivation: ["contentState"],
      target: {
        id: `${ADDRESS}/canvas/1`,
        type: "Canvas",
        partOf: [{ id: ADDRESS, type: "Manifest" }],
      },
    });
    expect(addressOf(state)).toBe(ADDRESS);
  });

  it("reads only an address on the web", async () => {
    const fetch = answering("{}");
    for (const given of [
      "javascript:alert(1)",
      "/mocks/paged.json",
      "file:///etc/x",
    ])
      expect(await readResource(given, { fetch })).toMatchObject({
        ok: false,
        says: expect.stringMatching(/address on the web/),
      });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("says why a resource could not be read", async () => {
    expect(
      await readResource(ADDRESS, { fetch: answering("", { status: 404 }) }),
    ).toEqual({ ok: false, says: "The resource answered 404." });
    expect(await readResource(ADDRESS, { fetch: answering("<html>") })).toEqual(
      { ok: false, says: "The resource is not JSON." },
    );
    expect(
      await readResource(ADDRESS, {
        fetch: answering(JSON.stringify({ type: "Annotation" })),
      }),
    ).toMatchObject({ ok: false, says: expect.stringMatching(/not a IIIF/) });
    expect(
      await readResource(ADDRESS, {
        fetch: vi.fn(async () => {
          throw new TypeError("Failed to fetch");
        }),
      }),
    ).toMatchObject({ ok: false, says: expect.stringMatching(/CORS/) });
  });

  it("reads so many bytes, by the header or as they come", async () => {
    const big = JSON.stringify({ ...MANIFEST, padding: "x".repeat(2000) });
    expect(
      await readResource(ADDRESS, {
        most: 1000,
        fetch: answering(big, { headers: { "content-length": "5000" } }),
      }),
    ).toMatchObject({ ok: false, says: expect.stringMatching(/larger than/) });
    expect(
      await readResource(ADDRESS, { most: 1000, fetch: answering(big) }),
    ).toMatchObject({ ok: false, says: expect.stringMatching(/larger than/) });
  });

  it("waits so long, and no longer", async () => {
    const hangs = vi.fn(
      (_: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          ),
        ),
    );
    expect(await readResource(ADDRESS, { fetch: hangs, wait: 10 })).toEqual({
      ok: false,
      says: "The resource did not answer within 0.01 seconds.",
    });
  });

  it("leaves the caller's own cancel to the caller", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      readResource(ADDRESS, {
        fetch: answering(JSON.stringify(MANIFEST)),
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });
});
