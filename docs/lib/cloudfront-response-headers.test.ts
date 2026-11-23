// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * The function as CloudFront runs it: Terraform puts the site's address before its code
 * (`terraform/main.tf`), as here.
 */
const SITE = "https://clover.iiif.library.northwestern.edu";
const source = readFileSync(
  new URL("../../terraform/response-headers.js", import.meta.url),
  "utf8",
);
type Headers = Record<string, { value: string }>;
const handler = new Function(
  `var SITE = ${JSON.stringify(SITE)};\n${source}\nreturn handler;`,
)() as (event: {
  request: { uri: string };
  response: { statusCode: number; headers: Headers };
}) => { statusCode: number; headers: Headers };

/** The headers CloudFront sends for `uri` (as `rewrite.js` left it), answered `status`. */
const headersFor = (uri: string, status = 200) =>
  handler({
    request: { uri },
    response: {
      statusCode: status,
      headers: { "content-type": { value: "text/plain" } },
    },
  }).headers;

describe("CloudFront's headers for the copies agents read", () => {
  it.each([
    ["/docs/items.md", `${SITE}/docs/items`],
    ["/docs/composing/glossary.md", `${SITE}/docs/composing/glossary`],
    [
      "/docs/deprecated-versions/viewer/demo.md",
      `${SITE}/docs/deprecated-versions/viewer/demo`,
    ],
  ])("names %s's HTML page as canonical", (uri, page) => {
    const headers = headersFor(uri);
    expect(headers.link).toEqual({ value: `<${page}>; rel="canonical"` });
    expect(headers["x-robots-tag"]).toBeUndefined();
    expect(headers["content-type"]).toEqual({ value: "text/plain" });
  });

  it.each(["/llms.txt", "/llms-full.txt"])(
    "keeps %s out of search results, as no page mirrors it",
    (uri) => {
      const headers = headersFor(uri);
      expect(headers["x-robots-tag"]).toEqual({ value: "noindex" });
      expect(headers.link).toBeUndefined();
    },
  );

  it.each([
    // A page, as `rewrite.js` hands it on, and the rest the site serves.
    "/docs/items.html",
    "/index.html",
    "/robots.txt",
    "/sitemap.xml",
    "/mocks/paged/manifest.json",
    "/mocks/page-transcript/page-1.txt",
  ])("leaves %s as it was", (uri) => {
    expect(Object.keys(headersFor(uri))).toEqual(["content-type"]);
  });

  it("adds nothing to what is not served whole", () => {
    expect(Object.keys(headersFor("/docs/missing.md", 404))).toEqual([
      "content-type",
    ]);
    expect(Object.keys(headersFor("/llms.txt", 304))).toEqual(["content-type"]);
  });
});
