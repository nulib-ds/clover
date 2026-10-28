/**
 * A photograph placed on the map: Northwestern University Libraries' record of a Ronald
 * J. Sullivan slide, Chicago bus 516 on route 151 at Michigan Avenue and Washington Street
 * (taken July 3, 1955), as its Digital Collections API published it on October 14, 2026
 * (`source.json`, kept as fetched), with two changes:
 *
 * - the Manifest and its Canvas take ids under the mock's own address;
 * - a navPlace (the IIIF navPlace Extension) puts the Manifest at that corner, a point the
 *   record does not carry. It is read from the record's summary, "at Michigan Avenue and
 *   Washington Street in Chicago, Illinois", and the photograph agrees: it looks north up
 *   Michigan Avenue from Washington Street, the new Prudential Building (1955) on the right
 *   beyond the Illinois Central yards, the Coca-Cola clock and the Blatz sign on the left.
 *
 * Static only (it answers no query): `scripts/build-mocks.mjs` writes it to
 * `public/mocks/navplace/`, published at
 * https://clover.iiif.library.northwestern.edu/mocks/navplace/. The image is served by
 * Northwestern's IIIF Image API (level 2, CORS open). Documented at /docs/mocks.
 */
import source from "./source.json";

export const PUBLIC_BASE =
  "https://clover.iiif.library.northwestern.edu/mocks/navplace";

/** The corner of Michigan Avenue and Washington Street, Chicago: [longitude, latitude]. */
export const PLACE = {
  label: "Michigan Avenue and Washington Street, Chicago, Illinois",
  coordinates: [-87.6245, 41.8833],
};

/** One painting annotation page, its ids under `canvas`, its body as published. */
const painting = (canvas, page) => ({
  id: `${canvas}/page`,
  type: "AnnotationPage",
  items: page.items.map((annotation, index) => ({
    id: `${canvas}/page/${index + 1}`,
    type: "Annotation",
    motivation: annotation.motivation,
    body: annotation.body,
    target: canvas,
  })),
});

export function manifest(base = PUBLIC_BASE) {
  // A copy, so the imported source is never changed.
  const record = JSON.parse(JSON.stringify(source));
  const [slide] = record.items;
  const canvas = `${base}/canvas/1`;
  const placeholder = `${canvas}/placeholder`;
  const { "@context": context, ...rest } = record;

  return {
    // The extension's context comes before the Presentation API's.
    "@context": ["http://iiif.io/api/extension/navplace/context.json", context],
    ...rest,
    id: `${base}/manifest.json`,
    navPlace: {
      id: `${base}/feature-collection/1`,
      type: "FeatureCollection",
      features: [
        {
          id: `${base}/feature/1`,
          type: "Feature",
          properties: { label: { en: [PLACE.label] } },
          geometry: { type: "Point", coordinates: PLACE.coordinates },
        },
      ],
    },
    items: [
      {
        ...slide,
        id: canvas,
        placeholderCanvas: {
          ...slide.placeholderCanvas,
          id: placeholder,
          items: slide.placeholderCanvas.items.map((page) =>
            painting(placeholder, page),
          ),
        },
        items: slide.items.map((page) => painting(canvas, page)),
      },
    ],
  };
}
