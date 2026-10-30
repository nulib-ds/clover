// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../terraform/rewrite.js", import.meta.url),
  "utf8",
);
const handler = new Function(`${source}\nreturn handler;`)() as (event: {
  request: { uri: string; querystring?: object };
}) => { uri: string; querystring?: object };

describe("CloudFront's static page addresses", () => {
  it.each([
    ["/", "/index.html"],
    ["/docs", "/docs.html"],
    ["/docs/", "/docs.html"],
    ["/docs/deprecated-versions", "/docs/deprecated-versions.html"],
    ["/docs/deprecated-versions/", "/docs/deprecated-versions.html"],
    [
      "/docs/deprecated-versions/viewer",
      "/docs/deprecated-versions/viewer.html",
    ],
    // The earlier versions' old address is no file: the 404 page sends it on.
    ["/docs/3.x", "/docs/3.x"],
    ["/sitemap.xml", "/sitemap.xml"],
    ["/robots.txt", "/robots.txt"],
    ["/docs/viewer.md", "/docs/viewer.md"],
    ["/mocks/paged/manifest.json", "/mocks/paged/manifest.json"],
    ["/_next/static/chunks/example.js", "/_next/static/chunks/example.js"],
  ])("serves %s as %s", (uri, expected) => {
    expect(handler({ request: { uri } }).uri).toBe(expected);
  });

  it("preserves query parameters when it rewrites a page", () => {
    const querystring = { code: { value: "web-components" } };
    const request = { uri: "/docs/deprecated-versions/", querystring };
    expect(handler({ request })).toEqual({
      uri: "/docs/deprecated-versions.html",
      querystring,
    });
  });
});
