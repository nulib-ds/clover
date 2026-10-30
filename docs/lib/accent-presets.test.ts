import { readFileSync } from "node:fs";
import { join } from "node:path";

import { accentPresets } from "docs/components/Playground/playground-config";
import {
  BLACK,
  HOVER_SHARE,
  WHITE,
  carriesWhite,
  mix,
  ratio,
  rgb,
} from "docs/lib/accent-contrast";

/*
 * Every accent the homepage offers keeps WCAG 2.2's 4.5:1 (1.4.3) as `tokens.css` mixes
 * its steps: white on its fill and its hover, or, where it cannot carry white text
 * (Princeton's orange), in the higher-contrast mode the site then takes, which keeps the
 * accent off what carries words and needs it at 3:1 as an edge (1.4.11). Its text step is
 * 4.5:1 on the page in either mode. A preset that fails names itself; a very dark one may
 * take a `darkText` share.
 */

const tokens = readFileSync(join(__dirname, "../styles/tokens.css"), "utf8");

const share = (pattern: RegExp) => {
  const match = tokens.match(pattern);
  if (!match) throw new Error(`tokens.css no longer has ${pattern}`);
  return Number(match[1]) / 100;
};
const CLOVER_BLUE = tokens.match(/--accent-9:\s*(#[0-9a-f]{6})/i)![1];
const LIGHT_TEXT = share(
  /--accent-11: color-mix\(in oklab, var\(--accent-9\) (\d+)%, #000\)/,
);
const DARK_TEXT = share(/var\(--accent-text-share, (\d+)%\)/);
/** The pages: light (`--gray-1`'s white) and dark (`--gray-1`). */
const LIGHT_GROUND = WHITE;
const DARK_GROUNDS = ["#111113"];
/** The mode's fill and glyph: Clover's controls' (`--clover-color-control`). */
const CONTROL = rgb("#1a1d1e");

it("mixes the accent's hover step as tokens.css does", () => {
  expect(
    share(/--accent-10: color-mix\(in oklab, var\(--accent-9\) (\d+)%, #000\)/),
  ).toBe(HOVER_SHARE);
});

describe.each(
  accentPresets.map((preset) => ({
    ...preset,
    hex: preset.value || CLOVER_BLUE,
  })),
)("$name ($hex)", ({ hex, darkText }) => {
  const accent = rgb(hex);

  it("carries white text at 4.5:1, at rest and under the pointer, or takes the higher-contrast mode", () => {
    if (carriesWhite(hex)) {
      expect(ratio(WHITE, accent)).toBeGreaterThanOrEqual(4.5);
      expect(
        ratio(WHITE, mix(accent, HOVER_SHARE, BLACK)),
      ).toBeGreaterThanOrEqual(4.5);
      return;
    }
    // The mode: white on the controls' dark fill, and the accent its edge, 3:1 on the page.
    expect(ratio(WHITE, CONTROL)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(accent, LIGHT_GROUND)).toBeGreaterThanOrEqual(3);
    for (const ground of DARK_GROUNDS)
      expect(ratio(accent, rgb(ground))).toBeGreaterThanOrEqual(3);
  });

  it("is text at 4.5:1 on the page in light and dark", () => {
    expect(
      ratio(mix(accent, LIGHT_TEXT, BLACK), LIGHT_GROUND),
    ).toBeGreaterThanOrEqual(4.5);
    const text = mix(
      accent,
      darkText ? Number.parseFloat(darkText) / 100 : DARK_TEXT,
      WHITE,
    );
    for (const ground of DARK_GROUNDS)
      expect(ratio(text, rgb(ground))).toBeGreaterThanOrEqual(4.5);
  });
});

it("puts Princeton's orange, alone of the presets, in the higher-contrast mode", () => {
  expect(
    accentPresets
      .filter((preset) => preset.value && !carriesWhite(preset.value))
      .map((preset) => preset.name),
  ).toEqual(["Princeton orange"]);
});
