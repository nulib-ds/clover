/**
 * A catalog that turns as a book does: Northwestern University Libraries' record of the
 * White Sewing Machine Company's _Portfolio of illustrations showing the White bicycles :
 * then and now_ (1896), from its Transportation Library, as its Digital Collections API
 * published it on October 14, 2026 (`source.json`, kept as fetched), with five changes:
 *
 * - the Manifest and its Canvases take ids under the mock's own address;
 * - a `summary` (`SUMMARY`), which the record has none of, written from its own fields
 *   (Publisher, Location, Date, the illustrators its Alternate Title names, Materials)
 *   and its pages;
 * - Page 15 is `facing-pages`. It is one image of a whole opening, a color plate across
 *   both pages (9423 × 4694, twice a page's width), so it is shown alone, and the pages
 *   after it pair as the book's openings do: Page 16 with Page 17, and the Back Cover
 *   alone. The record is `paged` but says nothing of the plate, so a viewer pairs it with
 *   Page 16, and every opening after it is split;
 * - `structures`: Ranges for the catalog's sections (`SECTIONS`), which the record has
 *   none of;
 * - each plate that pairs a "Then" with a "Now" has them tagged where they are
 *   (`THEN_AND_NOW`), as Cookbook recipe 0021 tags a fountain;
 * - its words, read by machine (`ocr.json`, written by `npm run build:paged-ocr` with
 *   Apple's Vision framework, not corrected by hand), as each page's OCR by line and by
 *   word, and a IIIF Content Search 2.0 service over them, searchable by word or phrase
 *   (Mat, 2026-10-26), by the engine the newspaper's mock shares (`../ocr-search.mjs`).
 *
 * `scripts/build-mocks.mjs` writes it to `public/mocks/paged/` (the Manifest, the OCR
 * pages and example searches), published at https://clover.iiif.library.northwestern.edu/mocks/paged/;
 * `npm run dev` answers any query live under `/api/mocks/paged/`, and the docs answer in
 * the browser (`mockFetch`), as a static site cannot read `?q=`. The images are served by
 * Northwestern's IIIF Image API (level 2, CORS open). Documented at /docs/mocks.
 */
import { ocrSearch, union } from "../ocr-search.mjs";
import ocr from "./ocr.json";
import source from "./source.json";

export const PUBLIC_BASE =
  "https://clover.iiif.library.northwestern.edu/mocks/paged";

/**
 * The Manifest's summary: who issued the catalog, where and when, and what is in it, in
 * under 30 words. "Then" and "Now" are as the plates print them.
 */
export const SUMMARY =
  "The White Sewing Machine Company of Cleveland issued this bicycle catalog in 1896. Color plates by Thulstrup, Mente, Veenfliet, and Clarke pair “Then” with “Now”; specifications describe four models.";

/** The Canvas that is a whole opening, by its label, and the behavior that says so. */
export const OPENING = { label: "Page 15", behavior: ["facing-pages"] };

/**
 * The plates that pair a "Then" with a "Now", by page, each with the box around its "Then"
 * (the inset scene and the word printed by it) and around its "Now" (most of the picture,
 * kept clear of its edges; on the Back Cover, the round scene below), in the page's own
 * pixels: x, y, width, height, and what each shows, described as a cataloger would, after
 * the word the plate prints (Mat, 2026-10-26: "describe each Then and Now. keep it
 * concise"; Page 4's "Now" in his words). Page 15 prints "Now" with no "Then", so it has
 * none.
 */
export const THEN_AND_NOW = [
  [
    "Page 4",
    [2705, 66, 1419, 1518],
    "Postman on foot collects mail from a red letter box on a lamppost.",
    [236, 236, 4256, 4162],
    "Postman on bicycle greets woman in period style white dress on bicycle.",
  ],
  [
    "Page 6",
    [57, 57, 1706, 1673],
    "Stableman leads a horse from a barn toward a waiting buggy.",
    [237, 237, 4266, 4266],
    "Bearded man with a satchel cycles past a woman standing with her bicycle.",
  ],
  [
    "Page 18",
    [968, 307, 1723, 1582],
    "Woman at a spinning wheel beside the hearth.",
    [1062, 496, 2715, 3682],
    "Woman in cycling bloomers mounts a bicycle on a garden path.",
  ],
  [
    "Page 20",
    [2080, 416, 1868, 1229],
    "Two women toboggan down a snowy hill.",
    [1017, 473, 2931, 3759],
    "Three women in white cycle abreast, one waving a handkerchief.",
  ],
  [
    "Page 22",
    [2386, 227, 1347, 1347],
    "Children play tag on a lawn before a towered house.",
    [1181, 472, 2575, 3591],
    "Young man on bicycle reaches to tag a young woman riding ahead.",
  ],
  [
    "Page 24",
    [2452, 473, 1922, 1212],
    "Family rides in a two-horse surrey along a country road.",
    [379, 615, 3977, 3740],
    "Three generations of a family cycle along a lakeside path.",
  ],
  [
    "Page 26",
    [104, 214, 1542, 1115],
    "Three women stroll a garden path with parasols.",
    [285, 285, 4176, 4128],
    "Two Vassar students cycle along a campus drive.",
  ],
  [
    "Back Cover",
    [404, 86, 3351, 2163],
    "Man and woman riding sidesaddle canter on horseback by a lake.",
    [1901, 2139, 2495, 2424],
    "Man tips his cap to a woman in white as they cycle side by side.",
  ],
];

const thenAndNow = new Map(
  THEN_AND_NOW.map(([page, then, thenText, now, nowText]) => [
    page,
    [
      [`Then – ${thenText}`, then],
      [`Now – ${nowText}`, now],
    ],
  ]),
);

/** A page's tags: words printed on it, each around the box it names. */
const tags = (canvas, words) => ({
  id: `${canvas}/tags`,
  type: "AnnotationPage",
  items: words.map(([value, [x, y, w, h]], index) => ({
    id: `${canvas}/tags/${index + 1}`,
    type: "Annotation",
    motivation: "tagging",
    body: { type: "TextualBody", value, language: "en", format: "text/plain" },
    target: `${canvas}#xywh=${x},${y},${w},${h}`,
  })),
});

/**
 * The catalog's sections, each titled exactly as the catalog has it: by the heading
 * printed on its page (its words, without the closing period), or, for a cover, by the
 * Canvas's own label. Nothing printed groups the four models, so each stands alone; where
 * the headings nest in print, the Ranges nest.
 *
 * A section is a cover (its page, titled by its label), or `[label, target]`: a target is
 * a page (a Canvas, by the record's label), a list of pages, or a list of sections. A page
 * may name a region, `#xywh=` in its own pixels, where several headings share it.
 */
export const SECTIONS = [
  "Front Cover",
  ["Introduction", "Page 5"],
  ["Specifications “White” 1896 Model A", ["Page 7", "Page 8"]],
  ["Specifications “White” 1896 Model B", ["Page 9", "Page 10"]],
  ["Specifications “White” 1896 Model C", ["Page 11", "Page 12"]],
  ["Specifications “White” 1896 Model D", ["Page 13", "Page 14"]],
  [
    "“White” Bearings",
    [
      ["Crank Bearing", "Page 16"],
      ["The Hubs", "Page 17"],
    ],
  ],
  [
    "Important Features of the “White”",
    [
      ["The Large Sprocket", "Page 19#xywh=449,756,3685,1890"],
      ["Saddles", "Page 19#xywh=449,2645,3685,1583"],
      ["Direct Seat Post", "Page 21#xywh=521,450,3651,1304"],
      ["“Built-up” Wood Rim", "Page 21#xywh=521,853,3651,1209"],
      ["Pedals", "Page 21#xywh=521,2086,3698,2181"],
      ["“White” Handle Bars", "Page 23"],
    ],
  ],
  ["Guaranty on “White” Bicycles", "Page 25"],
  ["Tire Guarantees", "Page 27"],
  ["Terms of Sale", "Page 28"],
  "Back Cover",
];

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

/**
 * A section as a Range, its id from its place in `SECTIONS` (`range/3`, `range/3-2`). Pages
 * are found by label in `pages` (label → the Canvas's id and label), and a missing one is
 * an error.
 */
const range = (base, pages, section, place) => {
  const page = (name) => {
    const [label, fragment] = name.split("#");
    const found = pages.get(label);
    if (!found) throw new Error(`No Canvas labeled "${label}"`);
    return { ...found, ref: fragment ? `${found.id}#${fragment}` : found.id };
  };
  // A cover: its page alone, titled by the Canvas's own label.
  if (typeof section === "string") {
    const cover = page(section);
    return {
      id: `${base}/range/${place}`,
      type: "Range",
      label: cover.label,
      items: [{ id: cover.ref, type: "Canvas" }],
    };
  }
  const [label, target] = section;
  return {
    id: `${base}/range/${place}`,
    type: "Range",
    label: { en: [label] },
    items: (typeof target === "string" ? [target] : target).map(
      (item, index) =>
        Array.isArray(item)
          ? range(base, pages, item, `${place}-${index + 1}`)
          : { id: page(item).ref, type: "Canvas" },
    ),
  };
};

/** Every URL a copy of the mock answers, under one base; a Canvas by its place, from 1. */
export function urls(base) {
  return {
    manifest: `${base}/manifest.json`,
    canvas: (n) => `${base}/canvas/${n}`,
    ocr: (n, granularity) => `${base}/ocr/${n}-${granularity}s.json`,
    search: `${base}/search`,
    hit: (n, first) => `${base}/search/hit/${n}-w${first}`,
  };
}

/** The OCR by page, in the Canvases' order: its words and its lines, with their boxes. */
export function pagesOfWords() {
  return ocr.pages.map(({ lines: read }, place) => {
    const words = [];
    const lines = read.map((line, index) => {
      const run = line.map(([text, x, y, w, h]) => {
        const word = { index: words.length, text, x, y, w, h };
        words.push(word);
        return word;
      });
      return {
        index,
        text: run.map((word) => word.text).join(" "),
        ...union(run),
      };
    });
    return { key: place + 1, words, lines };
  });
}

export function manifest(base = PUBLIC_BASE) {
  // A copy, so the imported source is never changed.
  const { items, ...record } = JSON.parse(JSON.stringify(source));
  const pages = new Map(
    items.map((page, index) => [
      labelOf(page),
      { id: `${base}/canvas/${index + 1}`, label: page.label },
    ]),
  );

  const at = urls(base);
  const read = new Set(
    pagesOfWords()
      .filter((page) => page.words.length)
      .map((page) => page.key),
  );

  return {
    ...record,
    id: `${base}/manifest.json`,
    summary: { en: [SUMMARY] },
    service: [
      ...[record.service ?? []].flat(),
      { id: at.search, type: "SearchService2" },
    ],
    items: items.map((page, index) => {
      const canvas = `${base}/canvas/${index + 1}`;
      // Its tags, and its OCR by line where there are words to read.
      const annotations = [
        ...(thenAndNow.has(labelOf(page))
          ? [tags(canvas, thenAndNow.get(labelOf(page)))]
          : []),
        ...(read.has(index + 1)
          ? [
              {
                id: at.ocr(index + 1, "line"),
                type: "AnnotationPage",
                label: { en: ["OCR (lines)"] },
              },
            ]
          : []),
      ];
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
        ...(annotations.length && { annotations }),
      };
    }),
    structures: SECTIONS.map((section, index) =>
      range(base, pages, section, index + 1),
    ),
  };
}

/** Its OCR and search, by the engine both OCR mocks share (`../ocr-search.mjs`). */
const engine = ocrSearch({
  publicBase: PUBLIC_BASE,
  pages: pagesOfWords,
  urls,
  manifest,
  ocrPath: (path) => {
    const found = /^ocr\/(\d+)-(lines|words)\.json$/.exec(path);
    return found
      ? {
          key: Number(found[1]),
          granularity: found[2] === "words" ? "word" : "line",
        }
      : null;
  },
  language: "en",
});

export const { ocrPage, matches, searchResponse, respond, mockFetch } = engine;
