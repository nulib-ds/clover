/**
 * A newspaper issue with OCR and a IIIF Content Search 2.0 service, as plain JSON.
 *
 * One generator, three ways out, so every copy of the mock says the same thing:
 *
 * - `scripts/build-mocks.mjs` writes the static files to `public/mocks/content-search/`,
 *   published with the docs at https://nulib-ds.github.io/clover/mocks/content-search/
 *   (the manifest, OCR annotation pages by line and by word, and example search answers).
 * - `pages/api/mocks/content-search/[...path].ts` answers any query in `npm run dev`, at
 *   http://localhost:3000/api/mocks/content-search/.
 * - The docs' demo answers searches in the browser (`mockFetch` below), since a static host
 *   cannot read `?q=`.
 *
 * The OCR (`ocr.json`) is word level, in reading order: `[text, x, y, w, h]` in the
 * Canvas's own pixels. Lines are words grouped while they run left to right on one
 * baseline. Documented at /docs/mocks.
 */

import { PAGE_SIZE, ocrSearch, union } from "../ocr-search.mjs";
import ocr from "./ocr.json";

/** Where the static files are published. */
export const PUBLIC_BASE =
  "https://nulib-ds.github.io/clover/mocks/content-search";

export { PAGE_SIZE };

const PRESENTATION = "http://iiif.io/api/presentation/3/context.json";

const IMAGE_SERVICE =
  "https://iiif.io/api/image/3.0/example/reference/4ce82cef49fb16798f4c2440307c3d6f-newspaper-p";

/** The issue's two pages: their size and the image service that draws each. */
const PAGES = [
  { n: 1, width: 3602, height: 5000 },
  { n: 2, width: 3536, height: 4999 },
];

/** Every URL a copy of the mock answers, under one base. */
export function urls(base) {
  return {
    manifest: `${base}/manifest.json`,
    canvas: (n) => `${base}/canvas/p${n}`,
    lines: (n) => `${base}/ocr/p${n}-lines.json`,
    words: (n) => `${base}/ocr/p${n}-words.json`,
    ocr: (n, granularity) => `${base}/ocr/p${n}-${granularity}s.json`,
    search: `${base}/search`,
    hit: (n, first) => `${base}/search/hit/p${n}-w${first}`,
  };
}

/** The OCR as words in reading order, per page. */
export function pagesOfWords() {
  return ocr.pages.map(({ page, words }) => ({
    n: page,
    words: words.map(([text, x, y, w, h], index) => ({
      index,
      text,
      x,
      y,
      w,
      h,
    })),
  }));
}

/** Words grouped into lines: a line breaks where the next word does not follow on. */
export function linesOf(words) {
  const lines = [];
  let line = null;
  for (const word of words) {
    const last = line?.words[line.words.length - 1];
    const follows =
      last &&
      word.x >= last.x &&
      Math.abs(word.y + word.h / 2 - (last.y + last.h / 2)) <
        Math.max(word.h, last.h) * 0.6;
    if (!follows) {
      line = { words: [] };
      lines.push(line);
    }
    line.words.push(word);
  }
  return lines.map(({ words: run }, index) => ({
    index,
    text: run.map((word) => word.text).join(" "),
    ...union(run),
  }));
}

/** The Manifest: two Canvases, each with its OCR lines as a referenced page. */
export function manifest(base) {
  const at = urls(base);
  return {
    "@context": PRESENTATION,
    id: at.manifest,
    type: "Manifest",
    label: { de: ["Berliner Tageblatt - 1925-02-16"] },
    summary: {
      en: [
        "A mock for IIIF Content Search 2.0: a newspaper issue with line and word OCR, and a search service. Published by Clover IIIF for testing viewers.",
      ],
    },
    metadata: [
      { label: { en: ["Language"] }, value: { en: ["German"] } },
      {
        label: { en: ["Mock"] },
        value: {
          en: [
            '<a href="https://nulib-ds.github.io/clover/docs/mocks">About this mock</a>',
          ],
        },
      },
    ],
    requiredStatement: {
      label: { en: ["Attribution"] },
      value: {
        en: [
          "Berliner Tageblatt - Staatsbibliothek zu Berlin - Preußischer Kulturbesitz, via Europeana. Public Domain Mark.",
        ],
      },
    },
    rights: "http://creativecommons.org/publicdomain/mark/1.0/",
    navDate: "1925-02-16T00:00:00Z",
    service: [{ id: at.search, type: "SearchService2" }],
    items: PAGES.map(({ n, width, height }) => ({
      id: at.canvas(n),
      type: "Canvas",
      label: { none: [`p. ${n}`] },
      width,
      height,
      items: [
        {
          id: `${at.canvas(n)}/page`,
          type: "AnnotationPage",
          items: [
            {
              id: `${at.canvas(n)}/page/image`,
              type: "Annotation",
              motivation: "painting",
              body: {
                id: `${IMAGE_SERVICE}${n}/full/max/0/default.jpg`,
                type: "Image",
                format: "image/jpeg",
                width,
                height,
                service: [
                  {
                    id: `${IMAGE_SERVICE}${n}`,
                    type: "ImageService3",
                    profile: "level1",
                  },
                ],
              },
              target: at.canvas(n),
            },
          ],
        },
      ],
      annotations: [
        {
          id: at.lines(n),
          type: "AnnotationPage",
          label: { en: ["OCR (lines)"] },
        },
      ],
    })),
  };
}

/** Its OCR and search, by the engine both OCR mocks share (`../ocr-search.mjs`). */
const engine = ocrSearch({
  publicBase: PUBLIC_BASE,
  pages: () =>
    pagesOfWords().map(({ n, words }) => ({
      key: n,
      words,
      lines: linesOf(words),
    })),
  urls,
  manifest,
  ocrPath: (path) => {
    const found = /^ocr\/p(\d+)-(lines|words)\.json$/.exec(path);
    return found
      ? {
          key: Number(found[1]),
          granularity: found[2] === "words" ? "word" : "line",
        }
      : null;
  },
  language: "de",
});

export const { ocrPage, matches, searchResponse, respond, mockFetch } = engine;
