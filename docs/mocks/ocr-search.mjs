/**
 * OCR and a IIIF Content Search 2.0 service, for a mock whose pages' words are known with
 * their boxes: the newspaper's (`content-search`) and the bicycle catalog's (`paged`). One
 * engine, so both answer alike: each page's OCR as an AnnotationPage of `supplementing`
 * text by line or by word (`textGranularity`), and searches by word or phrase, paged, with
 * the words around each match (Mat, 2026-10-26: the catalog "searchable by word").
 *
 * A mock gives its pages and its URLs (`ocrSearch`), and gets back what answers for them:
 * the OCR pages, the matches, a page of results, a responder for any URL under a base (the
 * live copy in `npm run dev`, the static files' writer) and a `fetch` that answers in the
 * browser, as a static site cannot read `?q=`.
 */

const PRESENTATION = "http://iiif.io/api/presentation/3/context.json";
const SEARCH = "http://iiif.io/api/search/2/context.json";
const TEXT_GRANULARITY =
  "http://iiif.io/api/extension/text-granularity/context.json";

/** Hits per page of results. */
export const PAGE_SIZE = 25;

/** Words of context either side of a match. */
const CONTEXT_WORDS = 6;

/** The box around boxes. */
export function union(boxes) {
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));
  return { x, y, w: right - x, h: bottom - y };
}

const xywh = ({ x, y, w, h }) => `xywh=${x},${y},${w},${h}`;

/**
 * Case and accents aside, punctuation stripped, and the long s (ſ) of a Fraktur read as
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
 * A mock's OCR and search.
 *
 * - `publicBase`: where its static files are published, which `mockFetch` answers for.
 * - `pages()`: its pages, in order, each `{ key, words, lines }`: `words` in reading order,
 *   `{ index, text, x, y, w, h }` in the Canvas's pixels; `lines` the same, a line's text
 *   its words'.
 * - `urls(base)`: `{ manifest, canvas(key), ocr(key, granularity), search, hit(key, first) }`.
 * - `manifest(base)`: the Manifest, for `respond`.
 * - `ocrPath`: a path's OCR page (`{ key, granularity }`), or null.
 * - `language`: the OCR's language, as its bodies say.
 */
export function ocrSearch({
  publicBase,
  pages,
  urls,
  manifest,
  ocrPath,
  language,
}) {
  /**
   * One page's OCR as an AnnotationPage of `supplementing` TextualBodies, each targeting
   * the Canvas region it was read from (`#xywh=`), at a `textGranularity` of `line` or
   * `word`.
   */
  function ocrPage(base, key, granularity) {
    const at = urls(base);
    const page = pages().find((item) => item.key === key);
    if (!page) return null;
    const units = granularity === "word" ? page.words : page.lines;
    const id = at.ocr(key, granularity);
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
          language,
        },
        target: `${at.canvas(key)}#${xywh(unit)}`,
      })),
    };
  }

  /**
   * Every match of `q` (one word or a phrase), in reading order: a match is consecutive
   * words each containing the query's word at its place, so `berlin` finds "Berliner".
   */
  function matches(q) {
    const terms = String(q ?? "")
      .split(/\s+/)
      .map(fold)
      .filter(Boolean);
    if (!terms.length) return [];
    const found = [];
    for (const { key, words } of pages()) {
      const folded = words.map((word) => fold(word.text));
      for (let i = 0; i + terms.length <= words.length; i++) {
        if (!terms.every((term, j) => folded[i + j].includes(term))) continue;
        const run = words.slice(i, i + terms.length);
        found.push({
          key,
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
   * A page of Content Search 2.0 results for `q`: `highlighting` annotations on each
   * match's OCR region, `contextualizing` annotations quoting the words around it
   * (TextQuoteSelector), and paging through an AnnotationCollection (`partOf`, `next`,
   * `prev`, `startIndex`). `pageUrl(q, page)` spells a page's URL: the live services use
   * `?q=…&page=…`, the static examples a file per page.
   */
  function searchResponse({
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
    const count = Math.max(1, Math.ceil(all.length / pageSize));
    const number = Math.min(Math.max(1, Number(page) || 1), count);
    const start = (number - 1) * pageSize;
    const shown = all.slice(start, start + pageSize);
    const link = (n) => ({ id: pageUrl(q, n), type: "AnnotationPage" });
    const hitId = (hit) => at.hit(hit.key, hit.first);
    return {
      "@context": SEARCH,
      id: pageUrl(q, number),
      type: "AnnotationPage",
      partOf: {
        id: `${at.search}?q=${encodeURIComponent(q)}`,
        type: "AnnotationCollection",
        total: all.length,
        first: link(1),
        last: link(count),
      },
      startIndex: start,
      ...(number > 1 ? { prev: link(number - 1) } : {}),
      ...(number < count ? { next: link(number + 1) } : {}),
      items: shown.map((hit) => ({
        id: hitId(hit),
        type: "Annotation",
        motivation: "highlighting",
        target: {
          type: "SpecificResource",
          source: {
            id: at.canvas(hit.key),
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
   * query): the manifest, an OCR page, or a page of search results. Null for anything
   * else.
   */
  function respond(base, path, query) {
    if (path === "manifest.json") return manifest(base);
    const ocr = ocrPath(path);
    if (ocr) return ocrPage(base, ocr.key, ocr.granularity);
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
   * A `fetch` that answers the published mock's URLs in the browser, from the generator,
   * and passes everything else on. For a static site (the docs), which cannot run the
   * search service itself. The answers name `publicBase`, as the published files do.
   */
  function mockFetch(next = globalThis.fetch.bind(globalThis)) {
    return async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.url);
      const prefix = `${publicBase}/`;
      if (!url.href.startsWith(prefix)) return next(input, init);
      const body = respond(
        publicBase,
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

  return { ocrPage, matches, searchResponse, respond, mockFetch };
}
