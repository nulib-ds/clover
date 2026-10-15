/**
 * The homepage playground's templates and resources, described as data, so the pickers
 * and the share link read from one source.
 */

export type TemplateKey = "default" | "document" | "gallery";

export interface PlaygroundResource {
  key: string;
  /** What it is, in a word, under its thumbnail. */
  name: string;
  /** Its own label, copied from the resource so the picker needs no fetch. */
  title: string;
  /** Its address, a content state, or a path under the docs' published `/mocks/`. */
  resource: string;
  mock?: boolean;
  thumbnail: string;
  /** Has places or a georeference, so the docs' MapLibre worker must be set first. */
  map?: boolean;
}

const works = "https://api.dc.library.northwestern.edu/api/v2/works";
const nul = (id: string) => `${works}/${id}?as=iiif`;

/**
 * A IIIF Content State as a link carries it: the JSON, URI-encoded, then base64url,
 * unpadded (as Clover's `encodeContentState`, written out here so the homepage need not
 * load Clover to name a resource).
 */
const contentState = (target: Record<string, unknown>) =>
  btoa(
    encodeURIComponent(
      JSON.stringify({
        "@context": "http://iiif.io/api/presentation/3/context.json",
        type: "Annotation",
        motivation: ["contentState"],
        target,
      }),
    ),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const MASKS =
  "https://api.dc.library.northwestern.edu/api/v2/collections/c373ecd2-2c45-45f2-9f9e-52dc244870bd?as=iiif";

/**
 * One of each kind of thing a page might show: a catalog of pages, a print with its words
 * tagged, a Collection, then still, placed and timed. Every template opens each of them.
 */
export const resources: PlaygroundResource[] = [
  // The White Sewing Machine Company's 1896 bicycle catalog, from Northwestern's
  // Transportation Library: a cover and its pages, some in colour, 31 Canvases in spreads.
  // A mock, its double-page plate (Page 15) `facing-pages`, so it stands alone and the
  // openings after it pair as the book's do.
  {
    key: "catalog",
    name: "Catalog",
    title:
      "Portfolio of illustrations showing the White bicycles : then and now",
    resource: "paged/manifest.json",
    mock: true,
    thumbnail: `${works}/386ff30f-1975-4d9c-9905-ec76381d6992/thumbnail`,
  },
  // Curtis's photogravure, as Northwestern publishes it, with the words printed on the
  // plate tagged where they sit and its caption as the Canvas's summary (a mock).
  {
    key: "print",
    name: "Print",
    title: "The Vanishing Race - Navaho",
    resource: "tagging/manifest.json",
    mock: true,
    thumbnail: `${works}/46dc28d1-9d59-4160-a511-72418f70cffc/thumbnail`,
  },
  {
    key: "collection",
    name: "Collection",
    title: "Commedia dell'Arte: The Masks of Antonio Fava",
    // The Collection, opened on Zagna "lunga": a content state naming the Manifest, part
    // of the Collection, so the reader arrives on it among the other masks.
    resource: contentState({
      id: nul("71153379-4283-43be-8b0f-4e7e3bfda275"),
      type: "Manifest",
      partOf: [{ id: MASKS, type: "Collection" }],
    }),
    // The mask it opens on, not the Collection's own.
    thumbnail: `${works}/71153379-4283-43be-8b0f-4e7e3bfda275/thumbnail`,
  },
  // A Sullivan slide of a Chicago bus, as Northwestern publishes it, with a navPlace put
  // at the corner it shows (a mock), so the Viewer adds a Map tab with the photo's place.
  {
    key: "photo",
    name: "Photo",
    title: "516; 151, Michigan & Washington, 1948, GM/TDH5502",
    resource: "navplace/manifest.json",
    mock: true,
    map: true,
    thumbnail: `${works}/24157482-0c2c-4907-8d25-7905adc3cfd9/thumbnail`,
  },
  // Georeferenced, so the Viewer adds a Map tab that lays the sheet over the town.
  {
    key: "map",
    name: "Map",
    title: "Map of the Township of Evanston, Cook County, Illinois",
    resource: "georeference/manifest.json",
    mock: true,
    map: true,
    thumbnail:
      "https://iiif.dc.library.northwestern.edu/iiif/3/2fb1e81a-9e24-420c-b224-0bfd6a279baf/full/!300,300/0/default.jpg",
  },
  {
    key: "film",
    name: "Film",
    title: "Northwestern Football scrimmages, 1959",
    resource: nul("d8fb6329-f7fb-48bf-8bb7-70a64ded5a15"),
    thumbnail: `${works}/d8fb6329-f7fb-48bf-8bb7-70a64ded5a15/thumbnail`,
  },
  {
    key: "recording",
    name: "Recording",
    title: "Partial audio recording of Gustav Mahler's Symphony No. 3",
    resource:
      "https://iiif.io/api/cookbook/recipe/0014-accompanyingcanvas/manifest.json",
    // The score's first page, which the recording shows while it plays.
    thumbnail:
      "https://iiif.io/api/image/3.0/example/reference/4b45bba3ea612ee46f5371ce84dbcd89-mahler-0/full/!300,300/0/default.jpg",
  },
  {
    key: "animation",
    name: "Animation",
    title: "Plate Number 700. Buffalo galloping",
    resource:
      "https://nulib-ds.github.io/muybridge/iiif/plate-number-700-buffalo-galloping.json",
    // The first frame, not the plate's own animated GIF, which is over a megabyte.
    thumbnail:
      "https://api.nga.gov/iiif/53c83e9d-7a7f-46c7-8701-13fd2d26decc/pct:1.5494,2.0782,24.1071,21.7604/!300,300/0/default.jpg",
  },
];

export const resourceByKey = (key: string) =>
  resources.find((entry) => entry.key === key);

export interface TemplateSpec {
  key: TemplateKey;
  /** The layout's label, and the component's name in `@nulib/clover/templates`. */
  name: string;
  /** The key of the resource it opens on, until the reader picks one. */
  defaultResource: string;
}

export const templateSpecs: Record<TemplateKey, TemplateSpec> = {
  default: { key: "default", name: "Default", defaultResource: "catalog" },
  document: { key: "document", name: "Document", defaultResource: "catalog" },
  gallery: { key: "gallery", name: "Gallery", defaultResource: "collection" },
};

export const templateOrder: TemplateKey[] = ["default", "document", "gallery"];

/**
 * Accent presets for the page-theme knob.
 *
 * The site's own blue first, then university brand colors, because that is who runs
 * IIIF: a reader can pick their own institution and see Clover wearing it. Every value is the institution's published
 * brand color, and each clears 4.5:1 against the white text Clover puts on a solid
 * accent — burnt orange is the tightest at 4.59:1.
 *
 * The picker beside them accepts any hex, so these are a starting point rather than a
 * menu.
 */
export const accentPresets = [
  /* The site's own accent (`--accent-9` in tokens.css), so choosing it clears the override. */
  { name: "Clover blue", value: "" },
  { name: "Northwestern purple", value: "#4E2A84" },
  { name: "Harvard crimson", value: "#A51C30" },
  { name: "Texas burnt orange", value: "#BF5700" },
  { name: "Tulane green", value: "#006747" },
  { name: "UCLA blue", value: "#2774AE" },
];

/**
 * Hue and saturation of a hex color, for Nextra's chrome.
 *
 * Nextra builds its primary color as
 * `hsl(var(--nextra-primary-hue) var(--nextra-primary-saturation) <L>%)`, taking hue
 * and saturation as variables while baking lightness into each utility. Feeding it
 * H and S therefore shifts the whole primary family while leaving Nextra's own
 * light/dark contrast decisions alone — which is why the accent has to be decomposed
 * rather than handed over as a hex.
 */
export const hexToHueSaturation = (hex: string) => {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) return { hue: 0, saturation: 0 };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));

  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  return { hue, saturation: Math.round(saturation * 100) };
};
