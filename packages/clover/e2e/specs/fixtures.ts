import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Page, Request } from "@playwright/test";

/** The package's Cookbook fixtures, as `https://fixtures.test/<name>.json`. */
const FIXTURES = resolve(__dirname, "../../src/fixtures/iiif-cookbook");

/** Copies of the docs' published mocks, served at their own addresses. */
const MOCKS = resolve(__dirname, "../../src/fixtures/mocks");
const MOCKS_URL = "https://nulib-ds.github.io/clover/mocks/";

/** A 64 × 64 gray PNG, for every image any part asks for. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAQUlEQVR42u3PMQ0AAAgDIN8/9K3hHFQgFzNlQISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhIS8XfRqRCG36lFQAAAAAElFTkSuQmCC",
  "base64",
);

/** A Manifest of `count` image Canvases, each with its own (routed) image service. */
export function manifestOf(count: number) {
  const base = `https://fixtures.test/generated/${count}`;
  return {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: `${base}.json`,
    type: "Manifest",
    label: { en: [`${count} Canvases`] },
    items: Array.from({ length: count }, (_, index) => {
      const canvas = `${base}/canvas/${index + 1}`;
      const service = `https://images.test/iiif/${count}/${index + 1}`;
      return {
        id: canvas,
        type: "Canvas",
        label: { en: [`Page ${index + 1}`] },
        width: 1000,
        height: 1400,
        items: [
          {
            id: `${canvas}/page`,
            type: "AnnotationPage",
            items: [
              {
                id: `${canvas}/page/image`,
                type: "Annotation",
                motivation: "painting",
                body: {
                  id: `${service}/full/max/0/default.jpg`,
                  type: "Image",
                  format: "image/jpeg",
                  width: 1000,
                  height: 1400,
                  service: [
                    { id: service, type: "ImageService3", profile: "level1" },
                  ],
                },
                target: canvas,
              },
            ],
          },
        ],
      };
    }),
  };
}

/**
 * Serve the page's IIIF entirely from disk: fixtures by name, any image service's
 * `info.json` as a tiled level 0 service of 4096 × 4096 (so there is room to zoom, as
 * with a real image), and every image and tile as a small PNG. Returns the requests
 * made, to look at their headers.
 */
export async function serveIIIF(page: Page): Promise<Request[]> {
  const requests: Request[] = [];
  await page.route("https://fixtures.test/**", async (route) => {
    requests.push(route.request());
    const name = new URL(route.request().url()).pathname.slice(1);
    const generated = /^generated\/(\d+)\.json$/.exec(name);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        // The harness's own origin (React 18 and 19 run on different ports).
        "Access-Control-Allow-Origin":
          (await route.request().headerValue("origin")) ?? "*",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "x-clover",
      },
      body: generated
        ? JSON.stringify(manifestOf(Number(generated[1])))
        : readFileSync(resolve(FIXTURES, name), "utf8"),
    });
  });
  await page.route(/^https?:\/\/(?!localhost)[^/]+\/.*/, async (route) => {
    const url = route.request().url();
    if (url.startsWith("https://fixtures.test/")) return route.fallback();
    requests.push(route.request());
    const cors = { "Access-Control-Allow-Origin": "*" };
    // A mock, from its copy: its Manifest, and any text it publishes.
    const mock = url.startsWith(MOCKS_URL)
      ? resolve(MOCKS, url.slice(MOCKS_URL.length).split(/[?#]/)[0])
      : null;
    if (mock && existsSync(mock)) {
      return route.fulfill({
        status: 200,
        contentType: mock.endsWith(".json") ? "application/json" : "text/plain",
        headers: cors,
        body: readFileSync(mock),
      });
    }
    // A plain-text file by its name among the fixtures, as served: no charset.
    const text = /\/([^/]+\.txt)$/.exec(new URL(url).pathname)?.[1];
    if (text && existsSync(resolve(FIXTURES, text))) {
      return route.fulfill({
        status: 200,
        contentType: "text/plain",
        headers: cors,
        body: readFileSync(resolve(FIXTURES, text)),
      });
    }
    if (url.endsWith("/info.json")) {
      const id = url.slice(0, -"/info.json".length);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: cors,
        body: JSON.stringify({
          "@context": "http://iiif.io/api/image/3/context.json",
          id,
          type: "ImageService3",
          protocol: "http://iiif.io/api/image",
          profile: "level0",
          width: 4096,
          height: 4096,
          sizes: [{ width: 64, height: 64 }],
          tiles: [{ width: 512, scaleFactors: [1, 2, 4, 8] }],
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: cors,
      body: PNG,
    });
  });
  return requests;
}

/**
 * On a phone (the `iphone` and `android` projects) the Viewer's information panel floats,
 * closed until it is asked for: open it there, as a reader would, before its sections.
 */
export async function openPanel(page: Page, isMobile: boolean) {
  if (!isMobile) return;
  await page.getByRole("button", { name: "More information" }).click();
}

/** A content state as a link carries it: base64url of the URI-encoded JSON. */
export function encodeContentState(json: unknown): string {
  return Buffer.from(encodeURIComponent(JSON.stringify(json)))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const book = JSON.parse(
  readFileSync(resolve(FIXTURES, "0009-book-1.json"), "utf8"),
);
