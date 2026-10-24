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
 *   (`THEN_AND_NOW`), as Cookbook recipe 0021 tags a fountain.
 *
 * Static only (it answers no query): `scripts/build-mocks.mjs` writes it to
 * `public/mocks/paged/`, published at
 * https://nulib-ds.github.io/clover/mocks/paged/. The images are served by
 * Northwestern's IIIF Image API (level 2, CORS open). Documented at /docs/mocks.
 */
import source from "./source.json";

export const PUBLIC_BASE = "https://nulib-ds.github.io/clover/mocks/paged";

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
 * pixels: x, y, width, height. Page 15 prints "Now" with no "Then", so it has none.
 */
export const THEN_AND_NOW = [
  ["Page 4", [2705, 66, 1419, 1518], [236, 236, 4256, 4162]],
  ["Page 6", [57, 57, 1706, 1673], [237, 237, 4266, 4266]],
  ["Page 18", [968, 307, 1723, 1582], [1062, 496, 2715, 3682]],
  ["Page 20", [2080, 416, 1868, 1229], [1017, 473, 2931, 3759]],
  ["Page 22", [2386, 227, 1347, 1347], [1181, 472, 2575, 3591]],
  ["Page 24", [2452, 473, 1922, 1212], [379, 615, 3977, 3740]],
  ["Page 26", [104, 214, 1542, 1115], [285, 285, 4176, 4128]],
  ["Back Cover", [404, 86, 3351, 2163], [1901, 2139, 2495, 2424]],
];

const thenAndNow = new Map(
  THEN_AND_NOW.map(([page, then, now]) => [
    page,
    [
      ["Then", then],
      ["Now", now],
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

export function manifest(base = PUBLIC_BASE) {
  // A copy, so the imported source is never changed.
  const { items, ...record } = JSON.parse(JSON.stringify(source));
  const pages = new Map(
    items.map((page, index) => [
      labelOf(page),
      { id: `${base}/canvas/${index + 1}`, label: page.label },
    ]),
  );

  return {
    ...record,
    id: `${base}/manifest.json`,
    summary: { en: [SUMMARY] },
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
        ...(thenAndNow.has(labelOf(page)) && {
          annotations: [tags(canvas, thenAndNow.get(labelOf(page)))],
        }),
      };
    }),
    structures: SECTIONS.map((section, index) =>
      range(base, pages, section, index + 1),
    ),
  };
}
