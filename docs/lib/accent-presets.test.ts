import { readFileSync } from "node:fs";
import { join } from "node:path";

import { accentPresets } from "docs/components/Playground/playground-config";

/*
 * Every accent the homepage offers keeps WCAG 2.2's 4.5:1 (1.4.3) as `tokens.css` mixes
 * its steps: white on its fill and its hover, and its text step on the page in either
 * mode. A preset that fails names itself; a very dark one may take a `darkText` share.
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
const LIGHT_HOVER = share(
  /--accent-10: color-mix\(in oklab, var\(--accent-9\) (\d+)%, #000\)/,
);
const DARK_TEXT = share(/var\(--accent-text-share, (\d+)%\)/);
/** The dark page (`--gray-1`). */
const DARK_GROUNDS = ["#111113"];

const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const linear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const gamma = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
const luminance = (color: number[]) =>
  color
    .map(linear)
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a: number[], b: number[]) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/** `color-mix(in oklab, a p, b)`, as a browser mixes it. */
const mix = (a: number[], p: number, b: number[]) => {
  const toOklab = (color: number[]) => {
    const [r, g, bl] = color.map(linear);
    const l = Math.cbrt(
      0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl,
    );
    const m = Math.cbrt(
      0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl,
    );
    const s = Math.cbrt(
      0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl,
    );
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };
  const [L, A, B] = toOklab(a).map((v, i) => v * p + toOklab(b)[i] * (1 - p));
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, gamma(c))));
};

const WHITE = rgb("#ffffff");
const BLACK = rgb("#000000");

describe.each(
  accentPresets.map((preset) => ({
    ...preset,
    hex: preset.value || CLOVER_BLUE,
  })),
)("$name ($hex)", ({ hex, darkText }) => {
  const accent = rgb(hex);

  it("carries white text at 4.5:1, at rest and under the pointer", () => {
    expect(ratio(WHITE, accent)).toBeGreaterThanOrEqual(4.5);
    expect(
      ratio(WHITE, mix(accent, LIGHT_HOVER, BLACK)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("is text at 4.5:1 on the page in light and dark", () => {
    expect(ratio(mix(accent, LIGHT_TEXT, BLACK), WHITE)).toBeGreaterThanOrEqual(
      4.5,
    );
    const text = mix(
      accent,
      darkText ? Number.parseFloat(darkText) / 100 : DARK_TEXT,
      WHITE,
    );
    for (const ground of DARK_GROUNDS)
      expect(ratio(text, rgb(ground))).toBeGreaterThanOrEqual(4.5);
  });
});
