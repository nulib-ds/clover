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

import ocr from "./ocr.json";

/** Where the static files are published. */
export const PUBLIC_BASE =
  "https://nulib-ds.github.io/clover/mocks/content-search";

/** Hits per page of results. */
export const PAGE_SIZE = 25;

/** Words of context either side of a match. */
const CONTEXT_WORDS = 6;

const PRESENTATION = "http://iiif.io/api/presentation/3/context.json";
const SEARCH = "http://iiif.io/api/search/2/context.json";
const TEXT_GRANULARITY =
  "http://iiif.io/api/extension/text-granularity/context.json";

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
    search: `${base}/search`,
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

function union(boxes) {
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));
  return { x, y, w: right - x, h: bottom - y };
}

const xywh = ({ x, y, w, h }) => `xywh=${x},${y},${w},${h}`;

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

/**
 * One page's OCR as an AnnotationPage of `supplementing` TextualBodies, each targeting
 * the Canvas region it was read from (`#xywh=`), at a `textGranularity` of `line` or
 * `word`.
 */
export function ocrPage(base, n, granularity) {
  const at = urls(base);
  const page = pagesOfWords().find((item) => item.n === n);
  if (!page) return null;
  const units = granularity === "word" ? page.words : linesOf(page.words);
  const id = granularity === "word" ? at.words(n) : at.lines(n);
  return {
    "@context": [TEXT_GRANULARITY, PRESENTATION],
    id,
    type: "AnnotationPage",
    label: { en: [`OCR (${granularity}s)`] },
    items: units.map((unit) => ({
      id: `${id}#${granularity}-${unit.index}`,
      type: "Annotation",
      motivation: "supplementing",
      textGranularity: granularity,
      body: {
        type: "TextualBody",
        value: unit.text,
        format: "text/plain",
        language: "de",
      },
      target: `${at.canvas(n)}#${xywh(unit)}`,
    })),
  };
}

/**
 * Case and accents aside, punctuation stripped, and the long s (ſ) of the Fraktur read as
 * s: how words and queries are compared, so `sich` finds "ſich".
 */
const fold = (text) =>
  text
    .replace(/ſ/g, "s")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();

/**
 * Every match of `q` (one word or a phrase), in reading order: a match is consecutive
 * words each containing the query's word at its place, so `berlin` finds "Berliner".
 */
export function matches(q) {
  const terms = String(q ?? "")
    .split(/\s+/)
    .map(fold)
    .filter(Boolean);
  if (!terms.length) return [];
  const found = [];
  for (const { n, words } of pagesOfWords()) {
    const folded = words.map((word) => fold(word.text));
    for (let i = 0; i + terms.length <= words.length; i++) {
      if (!terms.every((term, j) => folded[i + j].includes(term))) continue;
      const run = words.slice(i, i + terms.length);
      found.push({
        n,
        first: i,
        exact: run.map((word) => word.text).join(" "),
        prefix: words
          .slice(Math.max(0, i - CONTEXT_WORDS), i)
          .map((word) => `${word.text} `)
          .join(""),
        suffix: words
          .slice(i + terms.length, i + terms.length + CONTEXT_WORDS)
          .map((word) => ` ${word.text}`)
          .join(""),
        box: union(run),
      });
    }
  }
  return found;
}

/**
 * A page of Content Search 2.0 results for `q`: `highlighting` annotations on each match's
 * OCR region, `contextualizing` annotations quoting the words around it
 * (TextQuoteSelector), and paging through an AnnotationCollection (`partOf`, `next`,
 * `prev`, `startIndex`). `pageUrl(q, page)` spells a page's URL: the live services use
 * `?q=…&page=…`, the static examples a file per page.
 */
export function searchResponse({
  base,
  q,
  page = 1,
  pageSize = PAGE_SIZE,
  pageUrl = (query, number) =>
    `${urls(base).search}?q=${encodeURIComponent(query)}${
      number > 1 ? `&page=${number}` : ""
    }`,
}) {
  const at = urls(base);
  const all = matches(q);
  const pages = Math.max(1, Math.ceil(all.length / pageSize));
  const number = Math.min(Math.max(1, Number(page) || 1), pages);
  const start = (number - 1) * pageSize;
  const shown = all.slice(start, start + pageSize);
  const link = (n) => ({ id: pageUrl(q, n), type: "AnnotationPage" });
  const hitId = (hit) => `${at.search}/hit/p${hit.n}-w${hit.first}`;
  return {
    "@context": SEARCH,
    id: pageUrl(q, number),
    type: "AnnotationPage",
    partOf: {
      id: `${at.search}?q=${encodeURIComponent(q)}`,
      type: "AnnotationCollection",
      total: all.length,
      first: link(1),
      last: link(pages),
    },
    startIndex: start,
    ...(number > 1 ? { prev: link(number - 1) } : {}),
    ...(number < pages ? { next: link(number + 1) } : {}),
    items: shown.map((hit) => ({
      id: hitId(hit),
      type: "Annotation",
      motivation: "highlighting",
      target: {
        type: "SpecificResource",
        source: {
          id: at.canvas(hit.n),
          type: "Canvas",
          partOf: [{ id: at.manifest, type: "Manifest" }],
        },
        selector: {
          type: "FragmentSelector",
          conformsTo: "http://www.w3.org/TR/media-frags/",
          value: xywh(hit.box),
        },
      },
    })),
    annotations: shown.length
      ? [
          {
            type: "AnnotationPage",
            items: shown.map((hit) => ({
              id: `${hitId(hit)}/context`,
              type: "Annotation",
              motivation: "contextualizing",
              target: {
                type: "SpecificResource",
                source: hitId(hit),
                selector: [
                  {
                    type: "TextQuoteSelector",
                    prefix: hit.prefix,
                    exact: hit.exact,
                    suffix: hit.suffix,
                  },
                ],
              },
            })),
          },
        ]
      : [],
  };
}

/**
 * What any copy of the mock answers for a URL under `base` (a path after it, and its
 * query): the manifest, an OCR page, or a page of search results. Null for anything else.
 */
export function respond(base, path, query) {
  const ocrMatch = /^ocr\/p(\d+)-(lines|words)\.json$/.exec(path);
  if (path === "manifest.json") return manifest(base);
  if (ocrMatch) {
    return ocrPage(
      base,
      Number(ocrMatch[1]),
      ocrMatch[2] === "words" ? "word" : "line",
    );
  }
  if (path === "search") {
    return searchResponse({
      base,
      q: query.get("q") ?? "",
      page: query.get("page") ?? 1,
    });
  }
  return null;
}

/**
 * A `fetch` that answers the published mock's URLs in the browser, from this generator,
 * and passes everything else on. For a static site (the docs), which cannot run the
 * search service itself. The answers name `PUBLIC_BASE`, as the published files do.
 */
export function mockFetch(next = globalThis.fetch.bind(globalThis)) {
  return async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const prefix = `${PUBLIC_BASE}/`;
    if (!url.href.startsWith(prefix)) return next(input, init);
    const body = respond(
      PUBLIC_BASE,
      url.pathname.slice(new URL(prefix).pathname.length),
      url.searchParams,
    );
    return body
      ? new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      : new Response("Not found", { status: 404 });
  };
}
