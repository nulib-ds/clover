import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { act, render, waitFor } from "@testing-library/react";
import React from "react";

import bookJson from "../fixtures/iiif-cookbook/0009-book-1.json";
import * as Clover from "../index";

/*
 * The higher-contrast mode (`contrast.css`; Mat, 2026-10-29): where the accent fills what
 * carries a glyph or words, the part gives the mode's dark fill beside it, so an accent
 * that cannot carry white text still serves. Every stylesheet in the package is read. A
 * fill that is decoration alone, a line or a mark with nothing on it, is named here.
 */
const SRC = resolve(__dirname, "..");

/** Fills of the accent that carry nothing: they keep the accent in the mode. */
const DECORATION = [
  "clover-loading", // the loading line
  "clover-sections-label", // the line under an accordion's heading
  "clover-split-handle", // the bar between two panes, and its grip
  "clover-canvas-annotation-point", // a point's dot, ringed light and dark
];

function stylesheets(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return stylesheets(path);
    return name.endsWith(".css") ? [path] : [];
  });
}

/** Each rule as written: its selector and its declarations (innermost blocks). */
const rules = (css: string) =>
  [
    ...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g),
  ].map(([, selector, body]) => ({ selector: selector.trim(), body }));

const classes = (selector: string) =>
  new Set(selector.match(/\.clover-[\w-]+/g)?.map((name) => name.slice(1)));

const FILLED = /background(?:-color)?:\s*var\(--clover-color-accent, #0065c3\)/;

describe("the higher-contrast mode", () => {
  it.each(stylesheets(SRC).map((path) => [relative(SRC, path), path]))(
    "%s gives every accent fill under a glyph or words the mode's fill",
    (_, path) => {
      const all = rules(readFileSync(path, "utf8"));
      const modes = all.filter((rule) =>
        rule.selector.includes("[data-high-contrast]"),
      );
      const missing = all
        .filter(
          (rule) =>
            FILLED.test(rule.body) &&
            !rule.selector.includes("[data-high-contrast]") &&
            !DECORATION.some((name) => classes(rule.selector).has(name)),
        )
        .filter(
          (rule) =>
            !modes.some(
              (mode) =>
                /var\(--clover-accent-fill\)/.test(mode.body) &&
                [...classes(rule.selector)].every((name) =>
                  classes(mode.selector).has(name),
                ),
            ),
        )
        .map((rule) => rule.selector.replace(/\s+/g, " "));
      expect(missing).toEqual([]);
    },
  );

  it("is written on a Root where it is asked for, and only then", async () => {
    const { container, rerender } = render(
      <Clover.Root iiifContent={bookJson}>
        <Clover.Label />
      </Clover.Root>,
    );
    const root = container.querySelector(".clover-root")!;
    expect(root).not.toHaveAttribute("data-high-contrast");
    rerender(
      <Clover.Root iiifContent={bookJson} highContrast>
        <Clover.Label />
      </Clover.Root>,
    );
    expect(root).toHaveAttribute("data-high-contrast", "");
  });

  it("follows the reader's system, where it asks for more contrast, as it changes", async () => {
    const listeners = new Set<() => void>();
    let more = true;
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      get matches() {
        return query === "(prefers-contrast: more)" && more;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) =>
        listeners.delete(listener),
    })) as unknown as typeof window.matchMedia;
    try {
      const { container } = render(
        <Clover.Items iiifContent={bookJson} layout="list" />,
      );
      const items = () => container.querySelector(".clover-items");
      await waitFor(() =>
        expect(items()).toHaveAttribute("data-high-contrast", ""),
      );
      more = false;
      act(() => listeners.forEach((listener) => listener()));
      expect(items()).not.toHaveAttribute("data-high-contrast");
    } finally {
      window.matchMedia = original;
    }
  });
});
