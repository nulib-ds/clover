/*
 * Contrast for the site's accent, as `tokens.css` mixes its steps (WCAG 2.2, 1.4.3). An
 * accent that cannot carry white text at 4.5:1, at rest or under the pointer, takes the
 * higher-contrast mode (`page-theme.ts`): the accent kept off what carries words.
 */

/** `--accent-10`, the step under the pointer: the accent's share mixed with black. */
export const HOVER_SHARE = 0.88;

export type Rgb = number[];

export const rgb = (hex: string): Rgb =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

const linear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const gamma = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

const luminance = (color: Rgb) =>
  color
    .map(linear)
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);

/** WCAG's contrast ratio between two colors. */
export const ratio = (a: Rgb, b: Rgb) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

const toOklab = (color: Rgb) => {
  const [r, g, b] = color.map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

/** `color-mix(in oklab, a p, b)`, as a browser mixes it. */
export const mix = (a: Rgb, p: number, b: Rgb): Rgb => {
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

export const WHITE = rgb("#ffffff");
export const BLACK = rgb("#000000");

/** Whether white text keeps 4.5:1 on the accent, and on its step under the pointer. */
export const carriesWhite = (hex: string) => {
  const accent = rgb(hex);
  return (
    ratio(WHITE, accent) >= 4.5 &&
    ratio(WHITE, mix(accent, HOVER_SHARE, BLACK)) >= 4.5
  );
};
