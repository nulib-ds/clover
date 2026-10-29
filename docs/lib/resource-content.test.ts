import { describe, expect, it } from "vitest";
import { loadable, rootAddress } from "docs/lib/resource-content";

const encode = (state: unknown) =>
  btoa(encodeURIComponent(JSON.stringify(state)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

describe("homepage resource addresses", () => {
  it("accepts web addresses and encoded content states, rejecting other input", () => {
    const url = "https://example.org/manifest.json?as=iiif";
    expect(loadable(` ${url} `)).toBe(url);
    expect(rootAddress(url)).toBe(url);
    const state = encode({ target: url });
    expect(loadable(state)).toBe(state);
    expect(rootAddress(state)).toBe(url);
    for (const value of [
      "javascript:alert(1)",
      "/manifest.json",
      "not-a-state",
      encode(null),
    ]) {
      expect(loadable(value)).toBeUndefined();
      expect(rootAddress(value)).toBeUndefined();
    }
  });

  it("reads Collections and a target's parent Manifest, with no selected fragment", () => {
    expect(
      rootAddress(
        encode({
          target: { id: "https://example.org/collection", type: "Collection" },
        }),
      ),
    ).toBe("https://example.org/collection");
    expect(
      rootAddress(
        encode({
          target: {
            type: "Canvas",
            partOf: {
              type: "Manifest",
              id: "https://example.org/manifest#selection",
            },
          },
        }),
      ),
    ).toBe("https://example.org/manifest");
    expect(
      rootAddress(encode({ target: "https://example.org/manifest#selection" })),
    ).toBe("https://example.org/manifest");
  });

  it("ignores unknown or malformed targets without throwing", () => {
    for (const target of [
      null,
      {},
      { type: "Canvas", partOf: "unexpected" },
      { type: "Canvas", partOf: [null] },
    ]) {
      expect(rootAddress(encode({ target }))).toBeUndefined();
    }
  });
});
