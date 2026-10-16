import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";

import { Thumbnail } from "./Primitives";

const manifest = {
  id: "https://example.org/manifest",
  type: "Manifest",
  label: { fr: ["Carte d'Evanston"] },
  thumbnail: [{ id: "https://example.org/thumb.jpg", type: "Image" }],
};

describe("Thumbnail", () => {
  it("marks its default alt, the label, with the label's language", () => {
    render(<Thumbnail value={manifest} />);
    expect(
      screen.getByRole("img", { name: "Carte d'Evanston" }),
    ).toHaveAttribute("lang", "fr");
  });

  it("leaves a consumer's own alt unmarked", () => {
    render(<Thumbnail value={manifest} alt="" />);
    const img = document.querySelector("img.clover-thumbnail");
    expect(img).toHaveAttribute("alt", "");
    expect(img).not.toHaveAttribute("lang");
  });
});

// JSDOM lays nothing out, so the stylesheet is read (WCAG 1.4.10, C33).
describe("Primitives.css", () => {
  it("wraps long unbroken values in Summary, Metadata and RequiredStatement", () => {
    const css = readFileSync(resolve(__dirname, "Primitives.css"), "utf8");
    expect(css).toMatch(
      /\.clover-summary,\s*:is\(\.clover-metadata, \.clover-required-statement\) :is\(dt, dd\) \{\s*overflow-wrap: anywhere;/,
    );
  });
});
