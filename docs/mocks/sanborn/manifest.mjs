/**
 * The Sanborn mock's Manifest (`manifest.json`): four sheets of its 1920 volume, from
 * downtown Evanston to Northwestern University's campus, as one Presentation 3 Manifest
 * whose Canvases carry pages of georeference annotations, with places and annotations of
 * many other kinds beside them, for trying a viewer's list of annotations with
 * georeferences and places mixed in (2026-11-13; Mat, the same day: never "atlas").
 *
 * - Each sheet is a Canvas painting mapsnap's copy of the Library's scan, a level 0 Image
 *   API service at cdn.chronoscope.io (CORS open), at the size its `info.json` gives.
 * - Each Canvas has two pages of annotations, "Georeferences" and "Notes":
 *   - a `georeferencing` annotation for each map on the sheet, as mapsnap fitted it
 *     (`evanston.json`, kept as fetched): its body (the control points and
 *     the `helmert` transformation) and its SvgSelector as fetched, its target now the
 *     Canvas, as the Georeference Extension allows. Sheet 28 holds two maps, so it has
 *     two;
 *   - Sheet 17: a `describing` annotation on the National W.C.T.U. Headquarters' lot, and the
 *     Evanston Public Library tagged with a GeoJSON Feature, a point (Cookbook 0139);
 *   - Sheet 24: a `commenting` annotation on the whole sheet, and "POST OFFICE" tagged where it
 *     is printed;
 *   - Sheet 28: a `commenting` annotation on the whole sheet, in English and Spanish, a Choice
 *     (Cookbook 0346);
 *   - Sheet 115: "NORTHWESTERN UNIVERSITY" tagged where it is printed, and a `linking`
 *     annotation from the sheet's title, "EVANSTON, ILL." over "115", to the volume at the
 *     Library of Congress (Cookbook 0022).
 * - A navPlace on the Manifest, Evanston, Illinois: the box that holds every map on the
 *   sheets where mapsnap's fits put them. And one on Sheet 115's Canvas, Northwestern
 *   University: the outline of the sheet's map of the campus south of Garrett Place (the
 *   one mapsnap placed; its map north of there it did not), where its fit puts it.
 *
 * Every region was read from the image at its full size (the service's one tile at scale
 * factor 1), in the Canvas's pixels, and every tag's words are as printed. The GeoJSON
 * point and the navPlaces are worked out here from mapsnap's fits, as Clover reads a
 * `helmert` fit (`helmertTransform` in `packages/clover/src/core/geo.ts`: Web Mercator,
 * the image's y mirrored), so they move with the fits.
 *
 * Rights: the Library of Congress's Sanborn maps are public domain; mapsnap's fits are
 * under the Open Database License, so the Manifest carries the mock's `rights` and
 * `requiredStatement`, which `index.mjs` hands in.
 *
 * `index.mjs` gives it as `manifest`, which `scripts/build-mocks.mjs` writes to
 * `public/mocks/sanborn/manifest.json` and `npm run dev` answers live under
 * `/api/mocks/sanborn/`, its ids under the dev server. Documented at /docs/mocks.
 */
import evanston from "./evanston.json";

/** The 1920 volume, by the Library's id for it, under which mapsnap filed its fits. */
const VOLUME = "sanborn01857_004";

/** The volume's page at the Library of Congress, and its title there. */
const VOLUME_PAGE = {
  id: "https://www.loc.gov/item/sanborn01857_004/",
  title: "Sanborn Fire Insurance Map from Evanston, Cook County, Illinois",
};

/**
 * Every sheet's image, as its service's `info.json` gives it (read on 2026-11-13): a
 * quarter of the Library's size, which mapsnap's fits measured too, with 704 × 1032,
 * 352 × 516 and 176 × 258 listed; the middle one is the thumbnail.
 */
const SIZE = { width: 1407, height: 2063 };
const THUMBNAIL = { width: 352, height: 516 };

/**
 * The sheets, by the number each prints, in the volume's order, and what its Notes page holds. A
 * region is `[x, y, w, h]` in the Canvas's pixels; `text` is a value by language.
 */
const SHEETS = [
  {
    number: 17,
    notes: [
      {
        motivation: "describing",
        // Both buildings on the lot, and the name printed across it.
        region: [576, 1334, 272, 94],
        text: {
          en: "The National W.C.T.U. Headquarters on Chicago Avenue, between Clark and Church Streets, with a frame office at the front of its lot and a brick printing building at the rear.",
        },
      },
      {
        motivation: "tagging",
        // The building, its coal bin and the name printed under it.
        region: [312, 1668, 204, 267],
        place: "Evanston Public Library",
      },
    ],
  },
  {
    number: 24,
    notes: [
      {
        motivation: "commenting",
        text: {
          en: "Downtown Evanston from Church Street to Grove Street, its blocks built up mostly in brick, with the railroad on an embankment along its west side.",
        },
      },
      {
        motivation: "tagging",
        region: [648, 348, 98, 18],
        text: { en: "POST OFFICE" },
      },
    ],
  },
  {
    number: 28,
    notes: [
      {
        motivation: "commenting",
        text: {
          en: "Two maps on one sheet, each from Lake Street to Greenwood Boulevard: Hinman and Judson Avenues above, and Forest Avenue to Sheridan Road below.",
          es: "Dos mapas en una hoja, cada uno de Lake Street a Greenwood Boulevard: Hinman Avenue y Judson Avenue arriba, y de Forest Avenue a Sheridan Road abajo.",
        },
      },
    ],
  },
  {
    number: 115,
    place: "Northwestern University",
    notes: [
      {
        motivation: "tagging",
        // Printed across both of the sheet's maps.
        region: [330, 1011, 544, 25],
        text: { en: "NORTHWESTERN UNIVERSITY" },
      },
      {
        motivation: "linking",
        // "EVANSTON, ILL." over "115", in the sheet's top left corner.
        region: [48, 30, 92, 76],
        text: {
          en: "The 1920 volume, all 119 sheets, at the Library of Congress.",
        },
        link: VOLUME_PAGE,
      },
    ],
  },
];

/** A copy, so the imported sources are never changed. */
const copy = (json) => JSON.parse(JSON.stringify(json));

/** The fits of a sheet's maps, in mapsnap's order: those on its image. */
function fitsOf(fits, number) {
  const file = `-${String(number).padStart(4, "0")}`;
  const found = fits.filter((fit) => fit.target.source.id.endsWith(file));
  if (!found.length) throw new Error(`No fit for sheet ${number}`);
  for (const { label, target, body } of found) {
    if (
      target.source.width !== SIZE.width ||
      target.source.height !== SIZE.height
    )
      throw new Error(`${label} measured another size than its Canvas's`);
    if (body.transformation?.type !== "helmert")
      throw new Error(`${label} is not fitted by helmert`);
  }
  return found;
}

const toMercator = ([lng, lat]) => [
  (lng * Math.PI) / 180,
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
];

const fromMercator = ([x, y]) => [
  (x * 180) / Math.PI,
  ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI,
];

/**
 * Where a fit puts a pixel of its sheet, [longitude, latitude]: the Helmert transform
 * (scale, rotation and shift) through its control points, by least squares in Web
 * Mercator, the image's y mirrored, as Clover reads it.
 */
function placer(fit) {
  const points = fit.body.features.map(({ properties, geometry }) => ({
    from: [properties.resourceCoords[0], -properties.resourceCoords[1]],
    to: toMercator(geometry.coordinates),
  }));
  const mean = (key, i) =>
    points.reduce((sum, point) => sum + point[key][i], 0) / points.length;
  const [u0, v0, x0, y0] = [
    mean("from", 0),
    mean("from", 1),
    mean("to", 0),
    mean("to", 1),
  ];
  let [ac, bc, spread] = [0, 0, 0];
  for (const { from, to } of points) {
    const [du, dv, dx, dy] = [
      from[0] - u0,
      from[1] - v0,
      to[0] - x0,
      to[1] - y0,
    ];
    ac += du * dx + dv * dy;
    bc += du * dy - dv * dx;
    spread += du * du + dv * dv;
  }
  const [a, b] = [ac / spread, bc / spread];
  return ([x, y]) => {
    const [du, dv] = [x - u0, -y - v0];
    return fromMercator([x0 + a * du - b * dv, y0 + b * du + a * dv]);
  };
}

/** A fit's mask, the part of its sheet that is its map, in the sheet's pixels. */
const maskOf = (fit) =>
  /points="([^"]+)"/
    .exec(fit.target.selector.value)[1]
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number));

/** Whether a pixel is inside a polygon (ray casting). */
function inside([x, y], polygon) {
  let found = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [[xi, yi], [xj, yj]] = [polygon[i], polygon[j]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      found = !found;
  }
  return found;
}

const round = (value, places) => Number(value.toFixed(places));

/** A ring closed and counterclockwise, as GeoJSON's right-hand rule has it. */
function ring(positions) {
  const closed =
    positions[0].join() === positions.at(-1).join()
      ? positions
      : [...positions, positions[0]];
  const area = closed
    .slice(1)
    .reduce((sum, [x, y], i) => sum + (closed[i][0] * y - x * closed[i][1]), 0);
  return area < 0 ? [...closed].reverse() : closed;
}

/** Where a fit puts its map: its mask, to a tenth of a meter or so. */
const groundOf = (fit) =>
  maskOf(fit)
    .map(placer(fit))
    .map(([lng, lat]) => [round(lng, 6), round(lat, 6)]);

/** Where the middle of a region is, by the fit of the map it is on. */
function centerOf(fits, [x, y, w, h], number) {
  const middle = [x + w / 2, y + h / 2];
  const fit = fits.find((each) => inside(middle, maskOf(each)));
  if (!fit) throw new Error(`No map on sheet ${number} holds ${middle}`);
  const [lng, lat] = placer(fit)(middle);
  return [round(lng, 6), round(lat, 6)];
}

/** The box that holds every map on the sheets, its edges rounded outward to 1 m or so. */
function boxOf(fits) {
  const positions = fits.flatMap(groundOf);
  const [lngs, lats] = [0, 1].map((i) => positions.map((each) => each[i]));
  const [west, south] = [lngs, lats].map(
    (values) => Math.floor(Math.min(...values) * 1e5) / 1e5,
  );
  const [east, north] = [lngs, lats].map(
    (values) => Math.ceil(Math.max(...values) * 1e5) / 1e5,
  );
  return ring([
    [west, south],
    [east, south],
    [east, north],
    [west, north],
  ]);
}

/** A navPlace of one place, its ids under `id`. */
const navPlace = (id, label, geometry) => ({
  id,
  type: "FeatureCollection",
  features: [
    {
      id: `${id}/1`,
      type: "Feature",
      properties: { label: { en: [label] } },
      geometry,
    },
  ],
});

/** A sheet's image at a size its service gives, `max` for its full size. */
const image = (service, { width, height }, size = `${width},${height}`) => ({
  id: `${service}/full/${size}/0/default.jpg`,
  type: "Image",
  format: "image/jpeg",
  width,
  height,
  service: [{ id: service, type: "ImageService3", profile: "level0" }],
});

const textual = (value, language) => ({
  type: "TextualBody",
  value,
  language,
  format: "text/plain",
});

/** What an annotation of the Notes page says: one TextualBody, or a Choice of them by language (Cookbook 0346). */
function said(text) {
  const bodies = Object.entries(text).map(([language, value]) =>
    textual(value, language),
  );
  return bodies.length > 1 ? { type: "Choice", items: bodies } : bodies[0];
}

/** A fit as an annotation on the Canvas: its body and selector as fetched. */
const georeference = (canvas, fit, index) => ({
  id: `${canvas}/georeferences/${index + 1}`,
  type: "Annotation",
  // As Clover names a plain string label: in no language.
  label: { none: [fit.label] },
  created: fit.created,
  modified: fit.modified,
  motivation: fit.motivation,
  target: {
    type: "SpecificResource",
    source: { id: canvas, type: "Canvas", ...SIZE },
    selector: fit.target.selector,
  },
  body: fit.body,
});

/** An entry of the Notes page as an annotation on the Canvas, or on a region of it. */
function note(canvas, fits, number, entry, index) {
  const id = `${canvas}/notes/${index + 1}`;
  const target = entry.region
    ? `${canvas}#xywh=${entry.region.join(",")}`
    : canvas;
  const body = entry.place
    ? {
        id: `${id}/feature`,
        type: "Feature",
        properties: { label: { en: [entry.place] } },
        geometry: {
          type: "Point",
          coordinates: centerOf(fits, entry.region, number),
        },
      }
    : entry.link
      ? [
          said(entry.text),
          {
            type: "SpecificResource",
            source: {
              id: entry.link.id,
              type: "Text",
              format: "text/html",
              label: { en: [entry.link.title] },
            },
          },
        ]
      : said(entry.text);
  return { id, type: "Annotation", motivation: entry.motivation, body, target };
}

function canvasOf(base, fitted, { number, place, notes }) {
  const canvas = `${base}/canvas/${number}`;
  const fits = fitsOf(fitted, number);
  const service = fits[0].target.source.id;
  return {
    id: canvas,
    type: "Canvas",
    label: { en: [`Sheet ${number}`] },
    ...SIZE,
    thumbnail: [image(service, THUMBNAIL)],
    ...(place && {
      navPlace: navPlace(
        `${canvas}/navplace`,
        place,
        fits.length > 1
          ? {
              type: "MultiPolygon",
              coordinates: fits.map((fit) => [ring(groundOf(fit))]),
            }
          : { type: "Polygon", coordinates: [ring(groundOf(fits[0]))] },
      ),
    }),
    items: [
      {
        id: `${canvas}/page`,
        type: "AnnotationPage",
        items: [
          {
            id: `${canvas}/page/1`,
            type: "Annotation",
            motivation: "painting",
            body: image(service, SIZE, "max"),
            target: canvas,
          },
        ],
      },
    ],
    annotations: [
      {
        id: `${canvas}/georeferences`,
        type: "AnnotationPage",
        label: { en: ["Georeferences"] },
        items: fits.map((fit, index) => georeference(canvas, fit, index)),
      },
      {
        id: `${canvas}/notes`,
        type: "AnnotationPage",
        label: { en: ["Notes"] },
        items: notes.map((entry, index) =>
          note(canvas, fits, number, entry, index),
        ),
      },
    ],
  };
}

/** The Manifest, its ids under `base`, carrying the mock's rights and attribution. */
export function sheetsManifest(base, rights, requiredStatement) {
  const fitted = copy(evanston[VOLUME].items);
  const fits = SHEETS.flatMap(({ number }) => fitsOf(fitted, number));
  return {
    // The extensions' contexts come before the Presentation API's.
    "@context": [
      "http://iiif.io/api/extension/georef/1/context.json",
      "http://iiif.io/api/extension/navplace/context.json",
      "http://iiif.io/api/presentation/3/context.json",
    ],
    id: `${base}/manifest.json`,
    type: "Manifest",
    label: {
      en: [
        "Sanborn Fire Insurance Maps of Evanston, Illinois, 1920, annotated",
      ],
    },
    summary: {
      en: [
        "Sheets of the 1920 volume, from downtown Evanston to Northwestern University's campus, annotated in many ways side by side: georeferences, places, tags, comments, a description and a link. Published by Clover IIIF for testing viewers.",
      ],
    },
    rights,
    requiredStatement,
    navPlace: navPlace(`${base}/navplace`, "Evanston, Illinois", {
      type: "Polygon",
      coordinates: [boxOf(fits)],
    }),
    items: SHEETS.map((sheet) => canvasOf(base, fitted, sheet)),
  };
}
