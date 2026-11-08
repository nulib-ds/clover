/**
 * A landscape catalog: Northwestern University Libraries' record of The Special Racycle
 * 1898 Narrow Tread, the Miami Cycle & Mfg. Co.'s catalog (Middletown, Ohio), from the
 * Transportation Library's bicycle catalogs, as its Digital Collections API published it
 * on November 6, 2026 (`source.json`, kept as fetched). Its 26 Canvases are the front and
 * interior of its envelope and 24 pages, in two shapes: the cover and the bicycle plates
 * landscape, the text pages scanned upright as portrait images. Each Canvas has one
 * painting annotation and no others.
 *
 * Unchanged for now, its ids too (Mat, 2026-11-06: rebuilt on `/test/racycle`, its
 * changes decided there, one at a time). Static only (it answers no query):
 * `scripts/build-mocks.mjs` writes it to `public/mocks/racycle/`, published at
 * https://clover.iiif.library.northwestern.edu/mocks/racycle/. The images are served by
 * Northwestern's IIIF Image API (level 2, CORS open), linked and never copied: the
 * record's attribution permits no further distribution. Documented at /docs/mocks.
 */
import source from "./source.json";

export const PUBLIC_BASE =
  "https://clover.iiif.library.northwestern.edu/mocks/racycle";

/** The work in Northwestern's Digital Collections API, which `source.json` was fetched from. */
export const SOURCE =
  "https://api.dc.library.northwestern.edu/api/v2/works/ea3cbfc6-2c58-4d98-9c95-8cf90e876f71?as=iiif";

/** The Manifest, as fetched; `base` is taken as every mock's is, for when its ids move. */
export function manifest(base = PUBLIC_BASE) {
  void base;
  // A copy, so the imported source is never changed.
  return JSON.parse(JSON.stringify(source));
}
