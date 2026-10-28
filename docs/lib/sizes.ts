import sizes from "../../packages/clover/build/sizes.json";

/*
 * The package's sizes as its build measures them (`packages/clover/build/sizes.json`,
 * from `build/sizes.mjs`), in bytes gzipped: light enough for the parts' client code,
 * which `figures.ts`, holding the Cookbook's records too, would weigh down.
 */
export { sizes };

/*
 * A size in kB, rounded (Mat, 2026-10-27: "no more decimals"): a whole number, or, under
 * 1 kB, its tenth, never "0"; `npm run test:build` reports the tenths.
 */
export const kB = (bytes: number) => {
  const size = bytes / 1000;
  return size < 0.95
    ? Math.max(size, 0.1).toFixed(1)
    : String(Math.round(size));
};

/** Each size by the part's name, in kB. */
const inKB = <T extends Record<string, number>>(bytes: T) =>
  Object.fromEntries(
    Object.entries(bytes).map(([part, size]) => [part, kB(size)]),
  ) as Record<keyof T, string>;

/**
 * What each part adds to a page that has a `Root`, in kB, by its name (`Label`), for the
 * Lightweight story's tags and each part's page (Mat, 2026-10-22); and, for a part its
 * page shows with no `Root` (`Canvas`, `Map`, `Value`), what a page with it alone loads.
 */
export const partLoads = {
  ...inKB(sizes.parts),
  ...inKB(sizes.partsAlone),
};

/**
 * The same parts as web components: what each element adds to a page that has a
 * `<clover-root>`, its styles with it (they come with its code), or, alone, what a page
 * with it alone loads, in kB, by the part's name, for when the reader chose web components
 * (Mat, 2026-10-22).
 */
export const elementLoads = {
  ...inKB(sizes.elementParts),
  ...inKB(sizes.elementPartsAlone),
};

/** The parts measured alone, with no `Root` around them. */
export const aloneParts = new Set(Object.keys(sizes.partsAlone));

/** The homepage's example viewer's parts, whose sizes its Lightweight story names. */
export const viewerParts = [
  "Thumbnail",
  "Label",
  "Body",
  "Items",
  "Summary",
  "Metadata",
] as const;
