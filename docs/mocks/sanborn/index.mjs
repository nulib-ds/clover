/**
 * Sanborn Fire Insurance Maps of Evanston, Illinois, georeferenced, in each shape the
 * Georeference Extension comes in that a viewer is handed on its own, apart from any
 * Manifest (Mat, 2026-11-12: "build out fixtures for each with georeference … it's the
 * sanborn maps", "lean on this evanston example for all cases/mocks", then "fill out this
 * example further. try to include maps of Northwestern University too … stick to sanborn
 * maps"):
 *
 * - `annotation.json`, one georeference Annotation: Northwestern University's campus, in
 *   the 1920 volume (`SHEET`);
 * - `annotation-page.json`, an AnnotationPage: the 1920 volume's sheets from downtown
 *   Evanston through the campus and along the lake (Mat, 2026-11-12: "bring in other
 *   related sanborn maps that cover this region", the lakefront);
 * - `annotation-collection.json`, an AnnotationCollection of two pages,
 *   `evanston/1899.json` and `evanston/1920.json`: the 1899 volume's sheets of the same
 *   ground, and those of 1920.
 *
 * The sheets are the Library of Congress's, as mapsnap fitted them by machine
 * (`evanston.json`, as fetched from https://data.mapsnap.org/): those whose control points
 * center between latitudes 42.0395 and 42.07 and longitudes -87.687 and -87.66, fitted
 * with a confidence of 0.9 or more (a split sheet's panels too, which mapsnap marks
 * provisional); and the campus sheet, which mapsnap fitted with a confidence of 0.24, as
 * a campus has few streets to match, but which lies where the campus is, against the
 * sheets beside it (1899's campus sheets, and 1920's north of it, mapsnap could not
 * place). Each targets a bare image service (mapsnap's copy of the Library's image at a
 * quarter of its size), no Canvas or Manifest named, and is fitted from two points, by
 * `helmert`.
 *
 * Each annotation is kept as fetched; only the documents' own ids are this mock's, so
 * each answers at its id, and the pages and the Collection are made here (their `label`,
 * the Collection's `total`, `first` and `last`, and each of its pages' `partOf`, `next`
 * and `prev`).
 *
 * Rights: the Library of Congress's Sanborn maps are public domain; mapsnap's fits are
 * under the Open Database License, which asks for attribution and that a database made
 * from them be shared alike, so every document says so (`rights`, `requiredStatement`).
 *
 * `scripts/build-mocks.mjs` writes it to `public/mocks/sanborn/`; `npm run dev` answers
 * it live under `/api/mocks/sanborn/`, its ids under the dev server, so the Collection's
 * pages load before they are deployed. Documented at /docs/mocks.
 */
import evanston from "./evanston.json";

export const PUBLIC_BASE =
  "https://clover.iiif.library.northwestern.edu/mocks/sanborn";

const ANNOTATIONS = "http://www.w3.org/ns/anno.jsonld";

/** The Evanston volumes, by year: the Library's id for each, and its sheets as fitted. */
const VOLUMES = { 1899: "sanborn01857_003", 1920: "sanborn01857_004" };

export const YEARS = Object.keys(VOLUMES).map(Number);

/** The lone Annotation's sheet: Northwestern's campus, 1920, as mapsnap labels it. */
const SHEET = "sanborn01857_004 p115 [2]";

/** Every URL a copy of the mock answers, under one base. */
export function urls(base) {
  return {
    annotation: `${base}/annotation.json`,
    annotationPage: `${base}/annotation-page.json`,
    collection: `${base}/annotation-collection.json`,
    page: (year) => `${base}/evanston/${year}.json`,
  };
}

/** A copy, so the imported sources are never changed. */
const copy = (json) => JSON.parse(JSON.stringify(json));

/** A volume's sheets, as fitted. */
const sheets = (year) => copy(evanston[VOLUMES[year]].items);

const LABEL = {
  en: [
    "Sanborn Fire Insurance Maps of Evanston, Illinois, 1899 and 1920, georeferenced by machine",
  ],
};

const RIGHTS = "https://opendatacommons.org/licenses/odbl/1-0/";

const ATTRIBUTION = {
  label: { en: ["Attribution"] },
  value: {
    en: [
      // HTML, as IIIF reads a value only between `<` and `>`.
      '<span>Maps: Library of Congress, Geography and Map Division, Sanborn Maps Collection. Georeferenced by <a href="https://mapsnap.org">mapsnap</a>, under the Open Database License.</span>',
    ],
  },
};

/** The campus sheet: its georeference, at this mock's address, with its rights. */
export function annotation(base = PUBLIC_BASE) {
  const sheet = sheets(1920).find((each) => each.label.endsWith(` ${SHEET}`));
  return {
    ...sheet,
    id: urls(base).annotation,
    rights: RIGHTS,
    requiredStatement: ATTRIBUTION,
  };
}

/** The 1920 volume's sheets: a page of their georeferences, at this mock's address. */
export function annotationPage(base = PUBLIC_BASE) {
  return {
    "@context": ANNOTATIONS,
    id: urls(base).annotationPage,
    type: "AnnotationPage",
    label: {
      en: [
        "Sanborn Fire Insurance Maps of Evanston, Illinois, 1920, georeferenced by machine",
      ],
    },
    rights: RIGHTS,
    requiredStatement: ATTRIBUTION,
    items: sheets(1920),
  };
}

/** The Collection as its own document and its pages' `partOf` describe it. */
function described(base) {
  const at = urls(base);
  return {
    id: at.collection,
    type: "AnnotationCollection",
    label: LABEL,
    total: YEARS.reduce(
      (sum, year) => sum + evanston[VOLUMES[year]].items.length,
      0,
    ),
    first: at.page(YEARS[0]),
    last: at.page(YEARS.at(-1)),
  };
}

export function collection(base = PUBLIC_BASE) {
  return {
    "@context": ANNOTATIONS,
    ...described(base),
    rights: RIGHTS,
    requiredStatement: ATTRIBUTION,
  };
}

/** One volume's sheets, as a page of the Collection; null for a year it lacks. */
export function evanstonPage(base, year) {
  if (!VOLUMES[year]) return null;
  const at = urls(base);
  const place = YEARS.indexOf(Number(year));
  return {
    "@context": ANNOTATIONS,
    id: at.page(year),
    type: "AnnotationPage",
    label: { en: [`Evanston, Illinois, ${year}`] },
    partOf: described(base),
    ...(place > 0 ? { prev: at.page(YEARS[place - 1]) } : {}),
    ...(place < YEARS.length - 1 ? { next: at.page(YEARS[place + 1]) } : {}),
    rights: RIGHTS,
    requiredStatement: ATTRIBUTION,
    items: sheets(year),
  };
}

/** The document at a path under the base, for the live copy; null for none. */
export function respond(base, path) {
  if (path === "annotation.json") return annotation(base);
  if (path === "annotation-page.json") return annotationPage(base);
  if (path === "annotation-collection.json") return collection(base);
  const found = /^evanston\/(\d{4})\.json$/.exec(path);
  return found ? evanstonPage(base, found[1]) : null;
}
