import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LanguagesGlyph } from "./LanguagesGlyph";

describe("LanguagesGlyph", () => {
  it("cuts 文's 丿 with an outline of the A it draws, an id to each glyph", () => {
    const { container } = render(
      <>
        <LanguagesGlyph />
        <LanguagesGlyph />
      </>,
    );
    const ids = [...container.querySelectorAll("svg")].map((svg) => {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      const mask = svg.querySelector("mask")!;
      expect(svg.querySelector("path[mask]")!.getAttribute("mask")).toBe(
        `url(#${mask.id})`,
      );
      // The outline is the A's own path, so the two never drift apart.
      const outline = mask.querySelector("path")!.getAttribute("d")!;
      const drawn = [...svg.querySelectorAll("path")].find(
        (path) => !path.closest("mask") && !path.hasAttribute("mask"),
      )!;
      expect(drawn.getAttribute("d")!.startsWith(outline)).toBe(true);
      return mask.id;
    });
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
