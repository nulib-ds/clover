/**
 * A Canvas on its own: the one Canvas of Northwestern University Libraries' record of
 * Bartolomeo Borghi's map of the British Isles, L'Isole Britanniche, as Clover 3.x's site
 * publishes it at https://samvera-labs.github.io/clover-iiif/canvas/standalone-canvas.json
 * (`source.json`, kept as fetched on October 19, 2026), with these changes:
 *
 * - the Canvas, its painting page and annotation take ids under the mock's own address;
 *   its `partOf` still names the record's Manifest, from which a viewer can open it;
 * - its `context` key, a slip for `@context`, is `@context`;
 * - a `metadata` line it does not carry, its Contributor, as the record's Manifest
 *   publishes it;
 * - an annotation page of its own, tagging Ireland where the map draws it, by the name it
 *   prints there, IRLANDA (Italian, as the map is): its bounds read from the image.
 *
 * Static only (it answers no query): `scripts/build-mocks.mjs` writes it to
 * `public/mocks/standalone-canvas/`, published at
 * https://clover.iiif.library.northwestern.edu/mocks/standalone-canvas/. The image is served by
 * Northwestern's IIIF Image API (level 2, CORS open). Documented at /docs/mocks.
 */
import source from "./source.json";

export const PUBLIC_BASE =
  "https://clover.iiif.library.northwestern.edu/mocks/standalone-canvas";

/** Ireland on the map, in the Canvas's own coordinates (6262 × 8582). */
export const IRELAND = { x: 600, y: 4160, w: 2180, h: 2800 };

export function canvas(base = PUBLIC_BASE) {
  // A copy, so the imported source is never changed.
  const { context, ...published } = JSON.parse(JSON.stringify(source));
  const id = `${base}/canvas.json`;
  const [page] = published.items;
  return {
    "@context": context,
    ...published,
    id,
    metadata: [
      {
        label: { en: ["Contributor"] },
        value: {
          en: [
            "Borghi, Bartolomeo, 1750-1821 (Cartographer)",
            "Costa, Agostino (Engraver)",
            "Borghi, Bartolomeo, 1750-1821 (Contributor)",
          ],
        },
      },
    ],
    items: [
      {
        ...page,
        id: `${id}/page`,
        items: page.items.map((annotation, index) => ({
          ...annotation,
          id: `${id}/page/${index + 1}`,
          target: id,
        })),
      },
    ],
    annotations: [
      {
        id: `${id}/tags`,
        type: "AnnotationPage",
        items: [
          {
            id: `${id}/tags/1`,
            type: "Annotation",
            motivation: "tagging",
            body: {
              type: "TextualBody",
              value: "Irlanda",
              language: "it",
              format: "text/plain",
            },
            target: `${id}#xywh=${IRELAND.x},${IRELAND.y},${IRELAND.w},${IRELAND.h}`,
          },
        ],
      },
    ],
  };
}
