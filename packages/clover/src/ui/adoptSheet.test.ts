import { afterEach, describe, expect, it } from "vitest";

import { adoptSheet } from "./adoptSheet";

const sheets = () =>
  [
    ...document.head.querySelectorAll<HTMLStyleElement>("style[data-clover]"),
  ].map((style) => style.dataset.clover);

describe("adoptSheet", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--clover-stylesheet");
    for (const style of document.head.querySelectorAll("style[data-clover]"))
      style.remove();
  });

  it("brings a part sheet once", () => {
    adoptSheet("media", ".clover-canvas-transport{display:flex}");
    adoptSheet("media", ".clover-canvas-transport{display:flex}");
    expect(sheets()).toEqual(["media"]);
  });

  it("gives its <style> the nonce the page names, as the elements' are", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("property", "csp-nonce");
    meta.nonce = "n0nce";
    document.head.append(meta);
    try {
      adoptSheet("sections", ".clover-content-search{display:block}");
      const style = document.head.querySelector<HTMLStyleElement>(
        'style[data-clover="sections"]',
      );
      expect(style?.nonce).toBe("n0nce");
    } finally {
      meta.remove();
    }
  });

  it("brings none of Clover's part sheets on a page with base.css, but MapLibre's", () => {
    // What base.css sets on the page's root (`build/tiers.mjs`).
    document.documentElement.style.setProperty("--clover-stylesheet", "base");
    adoptSheet("scene", ".clover-scene{position:relative}");
    adoptSheet("maplibre", ".maplibregl-map{position:relative}");
    expect(sheets()).toEqual(["maplibre"]);
  });
});
