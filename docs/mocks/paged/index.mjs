/**
 * A catalog that turns as a book does: Northwestern University Libraries' record of the
 * White Sewing Machine Company's _Portfolio of illustrations showing the White bicycles :
 * then and now_ (1896), from its Transportation Library, as its Digital Collections API
 * published it on 14 October 2026 (`source.json`, kept as fetched), with two changes:
 *
 * - the Manifest and its Canvases take ids under the mock's own address;
 * - Page 15 is `facing-pages`. It is one image of a whole opening, a colour plate across
 *   both pages (9423 × 4694, twice a page's width), so it is shown alone, and the pages
 *   after it pair as the book's openings do: Page 16 with Page 17, and the Back Cover
 *   alone. The record is `paged` but says nothing of the plate, so a viewer pairs it with
 *   Page 16, and every opening after it is split.
 *
 * Static only (it answers no query): `scripts/build-mocks.mjs` writes it to
 * `public/mocks/paged/`, published at
 * https://nulib-ds.github.io/clover/mocks/paged/. The images are served by
 * Northwestern's IIIF Image API (level 2, CORS open). Documented at /docs/mocks.
 */
import source from "./source.json";

export const PUBLIC_BASE = "https://nulib-ds.github.io/clover/mocks/paged";

/** The Canvas that is a whole opening, by its label, and the behavior that says so. */
export const OPENING = { label: "Page 15", behavior: ["facing-pages"] };

const labelOf = (canvas) =>
  Object.values(canvas.label ?? {})
    .flat()
    .join(" ");

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
  const { items, ...record } = JSON.parse(JSON.stringify(source));

  return {
    ...record,
    id: `${base}/manifest.json`,
    items: items.map((page, index) => {
      const canvas = `${base}/canvas/${index + 1}`;
      const placeholder = `${canvas}/placeholder`;
      return {
        ...page,
        id: canvas,
        ...(labelOf(page) === OPENING.label && { behavior: OPENING.behavior }),
        ...(page.placeholderCanvas && {
          placeholderCanvas: {
            ...page.placeholderCanvas,
            id: placeholder,
            items: page.placeholderCanvas.items.map((annotations) =>
              painting(placeholder, annotations),
            ),
          },
        }),
        items: page.items.map((annotations) => painting(canvas, annotations)),
      };
    }),
  };
}
