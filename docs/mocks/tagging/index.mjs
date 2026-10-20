/**
 * A photogravure with its printed words tagged: Northwestern University Libraries' record
 * of Edward S. Curtis's "The Vanishing Race - Navaho" (1904), plate 1 of _The North
 * American Indian_, as its Digital Collections API published it on October 14, 2026
 * (`source.json`, kept as fetched), with three changes:
 *
 * - the Manifest and its Canvas take ids under the mock's own address;
 * - each bit of text printed on the plate (its number, the copyright line, the
 *   engraver's credit and the title) is tagged where it sits, as Cookbook recipe 0021
 *   tags a fountain: an Annotation whose motivation is `tagging`, its body the words,
 *   its target a box on the Canvas (`xywh`, in the image's own pixels);
 * - the record's Caption leaves the Manifest's `metadata` and becomes the Canvas's
 *   `summary`, so a viewer shows it with the plate rather than among the record's fields.
 *
 * Static only (it answers no query): `scripts/build-mocks.mjs` writes it to
 * `public/mocks/tagging/`, published at
 * https://nulib-ds.github.io/clover/mocks/tagging/. The image is served by
 * Northwestern's IIIF Image API (level 2, CORS open). Documented at /docs/mocks.
 */
import source from "./source.json";

export const PUBLIC_BASE = "https://nulib-ds.github.io/clover/mocks/tagging";

/**
 * The words printed on the plate, top to bottom and left to right, each with the box
 * round it on the Canvas: x, y, width, height.
 */
export const TAGS = [
  ["Plate 1", [210, 121, 134, 45]],
  ["From Copyright Photograph 1904 by E. S. Curtis", [1858, 3148, 578, 47]],
  ["Photogravure John Andrew & Son", [3702, 3144, 424, 44]],
  ["The Vanishing Race - Navaho", [219, 3257, 779, 44]],
];

/** The metadata entry that becomes the Canvas's summary. */
const CAPTION = "Caption";

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
  const [plate] = record.items;
  const caption = record.metadata.find(
    (entry) => entry.label.none?.[0] === CAPTION,
  );
  const canvas = `${base}/canvas/1`;
  const placeholder = `${canvas}/placeholder`;

  return {
    ...record,
    id: `${base}/manifest.json`,
    metadata: record.metadata.filter((entry) => entry !== caption),
    items: [
      {
        id: canvas,
        type: "Canvas",
        label: plate.label,
        summary: caption.value,
        width: plate.width,
        height: plate.height,
        thumbnail: plate.thumbnail,
        placeholderCanvas: {
          ...plate.placeholderCanvas,
          id: placeholder,
          items: plate.placeholderCanvas.items.map((page) =>
            painting(placeholder, page),
          ),
        },
        items: plate.items.map((page) => painting(canvas, page)),
        annotations: [
          {
            id: `${canvas}/tags`,
            type: "AnnotationPage",
            items: TAGS.map(([value, [x, y, w, h]], index) => ({
              id: `${canvas}/tags/${index + 1}`,
              type: "Annotation",
              motivation: "tagging",
              body: {
                type: "TextualBody",
                value,
                language: "en",
                format: "text/plain",
              },
              target: `${canvas}#xywh=${x},${y},${w},${h}`,
            })),
          },
        ],
      },
    ],
  };
}
