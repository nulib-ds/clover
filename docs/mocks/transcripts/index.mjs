/**
 * A film with its captions and its transcript: IIIF Cookbook recipe 0219's Manifest of
 * _Lunchroom Manners_ (`source.json`, kept as fetched), its English WebVTT captions as
 * the recipe publishes them, with one change and one addition:
 *
 * - the Manifest, its Canvas and their annotations take ids under the mock's own address;
 * - the film's plain-text transcript sits beside the captions, as the Canvas's
 *   `rendering`, which is how recipe 0017 gives a transcript. The file is the one recipe
 *   0253 (Presentation 4) provides for the same film, with that recipe's own label and
 *   language.
 *
 * So a viewer has both kinds to offer: the timed captions and the untimed text. The
 * video, the captions and the transcript are the Cookbook's own fixtures, served by
 * fixtures.iiif.io (CORS open). Static only (it answers no query):
 * `scripts/build-mocks.mjs` writes it to `public/mocks/transcripts/`, published at
 * https://clover.iiif.library.northwestern.edu/mocks/transcripts/. Documented at /docs/mocks.
 */
import source from "./source.json";

export const PUBLIC_BASE =
  "https://clover.iiif.library.northwestern.edu/mocks/transcripts";

/** The film's transcript as plain text, as Cookbook recipe 0253 provides it. */
export const TRANSCRIPT = {
  id: "https://fixtures.iiif.io/video/indiana/lunchroom_manners/lunchroom_manners.txt",
  type: "Text",
  format: "text/plain",
  label: { en: ["Transcript in plain text format"] },
  language: "en",
};

/** An annotation page's annotations, their ids under `page`, each targeting `canvas`. */
const page = (id, canvas, published) => ({
  id,
  type: "AnnotationPage",
  items: published.items.map((annotation, index) => ({
    id: `${id}/${index + 1}`,
    type: "Annotation",
    motivation: annotation.motivation,
    body: annotation.body,
    target: canvas,
  })),
});

export function manifest(base = PUBLIC_BASE) {
  // A copy, so the imported source is never changed.
  const recipe = JSON.parse(JSON.stringify(source));
  const [film] = recipe.items;
  const canvas = `${base}/canvas/1`;

  return {
    ...recipe,
    id: `${base}/manifest.json`,
    items: [
      {
        ...film,
        id: canvas,
        items: film.items.map((published, index) =>
          page(`${canvas}/page/${index + 1}`, canvas, published),
        ),
        annotations: film.annotations.map((published, index) =>
          page(`${canvas}/annotations/${index + 1}`, canvas, published),
        ),
        rendering: [TRANSCRIPT],
      },
    ],
  };
}
