import type { Affine } from "./affine";

/*
 * Apart from `affine.ts`, which every Canvas loads: only the DOM layer and the world layer,
 * each loaded as it is first needed, write a transform as CSS. Beside the rest, a lazy
 * chunk importing it kept it on every first view.
 */

/** A CSS `matrix()` value. Rounded so the DOM does not carry 17-digit noise. */
export function toCssMatrix(m: Affine): string {
  return `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map(roundCss).join(",")})`;
}

function roundCss(value: number): string {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}
