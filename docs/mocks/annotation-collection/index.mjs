/**
 * A catalog's lines of text as one AnnotationCollection, as Cookbook recipe 0309 groups a
 * newspaper's layout markup: the White bicycle catalog of the `paged` mock (its 31
 * Canvases, their images, spreads and sections, as that mock gives them), with, for each
 * page that has words, one AnnotationPage of its lines, referenced from its Canvas.
 *
 * - Each line the machine read (`../paged/ocr.json`, Apple's Vision framework, not
 *   corrected by hand) is a `tagging` annotation on the box it was read from, its words
 *   as its body: 569 annotations on 28 pages.
 * - Every page is `partOf` the one AnnotationCollection (`collection.json`, its `label`,
 *   `total`, `first` and `last`), and gives its `next` and `prev`. The Manifest's
 *   references carry the Collection's `label`, `total`, `first` and `last` too, as the
 *   recipe advises, so a viewer can name it, and count it, before fetching a page.
 * - The paged mock's own annotations (its tags, its OCR by line and by word) and its
 *   Content Search service are left out, so the lines are the only annotations here.
 *
 * For trying a viewer on a large AnnotationCollection whose pages load as the reader
 * reaches them (Mat, 2026-10-29). `scripts/build-mocks.mjs` writes it to
 * `public/mocks/annotation-collection/`; `npm run dev` answers it live under
 * `/api/mocks/annotation-collection/`. Documented at /docs/mocks.
 */
import { manifest as pagedManifest, pagesOfWords } from "../paged/index.mjs";

export const PUBLIC_BASE =
  "https://clover.iiif.library.northwestern.edu/mocks/annotation-collection";

/** What the Collection is called: what it holds, and how it was made. */
export const LABEL = { en: ["Lines of text, read by machine"] };

const CONTEXT = "http://iiif.io/api/presentation/3/context.json";

/** Every URL a copy of the mock answers, under one base; a page by its Canvas's place. */
export function urls(base) {
  return {
    manifest: `${base}/manifest.json`,
    collection: `${base}/collection.json`,
    page: (n) => `${base}/lines/${n}.json`,
    line: (n, index) => `${base}/lines/${n}/${index + 1}`,
  };
}

/** The pages that have lines, by their Canvas's place, from 1, with their lines. */
const pagesWithLines = () => pagesOfWords().filter((page) => page.lines.length);

/** The Collection as the Manifest's references and its own document describe it. */
function described(base) {
  const at = urls(base);
  const pages = pagesWithLines();
  return {
    id: at.collection,
    type: "AnnotationCollection",
    label: LABEL,
    total: pages.reduce((sum, page) => sum + page.lines.length, 0),
    first: at.page(pages[0].key),
    last: at.page(pages.at(-1).key),
  };
}

/** The pages before and after a page in the Collection, by place. */
function neighbors(key) {
  const keys = pagesWithLines().map((page) => page.key);
  const at = keys.indexOf(key);
  return { prev: keys[at - 1], next: keys[at + 1] };
}

export function manifest(base = PUBLIC_BASE) {
  const record = pagedManifest(base);
  const at = urls(base);
  const read = new Set(pagesWithLines().map((page) => page.key));
  const collection = described(base);
  // The paged mock's search answers there, not here.
  const service = (record.service ?? []).filter(
    (each) => each.type !== "SearchService2",
  );
  const { service: _, ...rest } = record;
  return {
    ...rest,
    id: at.manifest,
    ...(service.length && { service }),
    items: record.items.map((canvas, index) => {
      const key = index + 1;
      // Its lines alone: the paged mock's tags and OCR are left out.
      const { annotations: _own, ...page } = canvas;
      if (!read.has(key)) return page;
      const { prev, next } = neighbors(key);
      return {
        ...page,
        annotations: [
          {
            id: at.page(key),
            type: "AnnotationPage",
            partOf: [collection],
            ...(next && { next: at.page(next) }),
            ...(prev && { prev: at.page(prev) }),
          },
        ],
      };
    }),
  };
}

/** The AnnotationCollection's own document. */
export function collection(base = PUBLIC_BASE) {
  return { "@context": CONTEXT, ...described(base) };
}

/** A page of its lines, by its Canvas's place; none for a page without words. */
export function linesPage(base = PUBLIC_BASE, key) {
  const page = pagesWithLines().find((each) => each.key === key);
  if (!page) return null;
  const at = urls(base);
  const canvas = `${base}/canvas/${key}`;
  const { prev, next } = neighbors(key);
  return {
    "@context": CONTEXT,
    id: at.page(key),
    type: "AnnotationPage",
    partOf: [{ id: at.collection, type: "AnnotationCollection" }],
    ...(next && { next: at.page(next) }),
    ...(prev && { prev: at.page(prev) }),
    items: page.lines.map((line, index) => ({
      id: at.line(key, index),
      type: "Annotation",
      motivation: "tagging",
      body: {
        type: "TextualBody",
        value: line.text,
        format: "text/plain",
        language: "en",
      },
      target: {
        type: "SpecificResource",
        source: {
          id: canvas,
          type: "Canvas",
          partOf: [{ id: at.manifest, type: "Manifest" }],
        },
        selector: {
          type: "FragmentSelector",
          conformsTo: "http://www.w3.org/TR/media-frags/",
          value: `xywh=${line.x},${line.y},${line.w},${line.h}`,
        },
      },
    })),
  };
}

/** The places of the pages that have lines, for writing them all. */
export const pageKeys = () => pagesWithLines().map((page) => page.key);

/** What the live copy answers for a path under its base, or null. */
export function respond(base, path) {
  if (path === "manifest.json") return manifest(base);
  if (path === "collection.json") return collection(base);
  const found = /^lines\/(\d+)\.json$/.exec(path);
  return found ? linesPage(base, Number(found[1])) : null;
}
