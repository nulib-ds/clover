import sizes from "../../packages/clover/build/sizes.json";

/*
 * The package's sizes as its build measures them (`packages/clover/build/sizes.json`,
 * from `build/sizes.mjs`), in bytes gzipped: light enough for the parts' client code,
 * which `figures.ts`, holding the Cookbook's records too, would weigh down.
 */
export { sizes };

/* A size in kB, to the tenth (Mat, 2026-10-20), as `npm run test:build` reports it. */
export const kB = (bytes: number) => (bytes / 1000).toFixed(1);

/**
 * What each part of the homepage's example viewer adds to a page that has a `Root`, in
 * kB, by its name (`Label`), for the Lightweight story's tags (Mat, 2026-10-22).
 */
export const partLoads = Object.fromEntries(
  Object.entries(sizes.parts).map(([part, bytes]) => [part, kB(bytes)]),
) as Record<keyof typeof sizes.parts, string>;
