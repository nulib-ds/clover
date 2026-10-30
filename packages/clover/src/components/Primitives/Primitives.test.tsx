import { render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";

import CaptionDetails from "../Body/CaptionDetails";
import { Summary, Thumbnail } from "./Primitives";

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

/*
 * A Canvas's information box draws its summary with a copy of Summary's, in the Canvas's
 * `language` (`Body/CaptionDetails.tsx`): a shared component cost more than the copy
 * (2026-10-29), so this holds the two to the same markup.
 */
describe("Summary and a Canvas's information box", () => {
  const shape = (root: HTMLElement) => {
    const summary = root.querySelector(".clover-summary")!;
    return {
      element: summary.tagName,
      lang: summary.getAttribute("lang"),
      dir: summary.getAttribute("dir"),
      html: summary.innerHTML,
      around: summary.parentElement?.className,
    };
  };

  it("draw a summary alike: its element, language, markup and Read more", async () => {
    // Paragraphs of its own (Cookbook 0007), in a language written right to left.
    const summary = { ar: ["<p>الأول</p><p>الثاني</p>"] };
    const part = render(<Summary value={summary} />).container;
    const box = render(<CaptionDetails summary={summary} />).container;
    await waitFor(() =>
      expect(part.querySelector(".clover-summary")?.tagName).toBe("DIV"),
    );
    await waitFor(() =>
      expect(box.querySelector(".clover-summary")?.tagName).toBe("DIV"),
    );
    expect(shape(box)).toEqual(shape(part));
    expect(shape(part)).toMatchObject({ lang: "ar", dir: "rtl" });
  });

  it("draw nothing at all without one", () => {
    expect(
      render(<Summary value={{ en: [""] }} />).container,
    ).toBeEmptyDOMElement();
    expect(
      render(<CaptionDetails summary={{ en: [""] }} />).container.querySelector(
        ".clover-read-more",
      ),
    ).toBeNull();
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
