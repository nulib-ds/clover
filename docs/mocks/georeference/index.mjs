/**
 * A georeferenced map as a IIIF Manifest: Northwestern University Libraries' scan of the
 * "Map of the Township of Evanston, Cook County, Illinois", with the Georeference
 * Extension annotation its Meadow authoring tool stored, and a navPlace naming the town.
 *
 * Static only (it answers no query): `scripts/build-mocks.mjs` writes it to
 * `public/mocks/georeference/`, published at
 * https://clover.iiif.library.northwestern.edu/mocks/georeference/. The image is served by
 * Northwestern's IIIF Image API (level 2, CORS open). Documented at /docs/mocks.
 */

export const PUBLIC_BASE =
  "https://clover.iiif.library.northwestern.edu/mocks/georeference";

const IMAGE_SERVICE =
  "https://iiif.dc.library.northwestern.edu/iiif/3/2fb1e81a-9e24-420c-b224-0bfd6a279baf";
const WIDTH = 7337;
const HEIGHT = 9833;

/** The control points as stored: image pixel ↔ [longitude, latitude]. */
const POINTS = [
  [
    [577.7, 1074.97],
    [-87.71064, 42.06793],
  ],
  [
    [3023.66, 1560.92],
    [-87.67961, 42.06283],
  ],
  [
    [3499.96, 6785.6],
    [-87.6752, 42.01607],
  ],
];

export function manifest(base = PUBLIC_BASE) {
  const canvas = `${base}/canvas/1`;
  return {
    "@context": [
      "http://iiif.io/api/extension/navplace/context.json",
      "http://iiif.io/api/extension/georef/1/context.json",
      "http://iiif.io/api/presentation/3/context.json",
    ],
    id: `${base}/manifest.json`,
    type: "Manifest",
    label: { en: ["Map of the Township of Evanston, Cook County, Illinois"] },
    summary: {
      en: [
        "A mock for the IIIF Georeference and navPlace extensions: a scanned map, its control points, and the town it shows. Published by Clover IIIF for testing viewers.",
      ],
    },
    requiredStatement: {
      label: { en: ["Attribution"] },
      value: { en: ["Northwestern University Libraries"] },
    },
    homepage: [
      {
        id: "https://dc.library.northwestern.edu/",
        type: "Text",
        label: {
          en: ["Northwestern University Libraries Digital Collections"],
        },
        format: "text/html",
      },
    ],
    navPlace: {
      id: `${base}/feature-collection/1`,
      type: "FeatureCollection",
      features: [
        {
          id: `${base}/feature/1`,
          type: "Feature",
          properties: { label: { en: ["Evanston, Illinois"] } },
          geometry: { type: "Point", coordinates: [-87.6877, 42.0451] },
        },
      ],
    },
    items: [
      {
        id: canvas,
        type: "Canvas",
        label: { en: ["Map"] },
        width: WIDTH,
        height: HEIGHT,
        items: [
          {
            id: `${canvas}/page`,
            type: "AnnotationPage",
            items: [
              {
                id: `${canvas}/page/image`,
                type: "Annotation",
                motivation: "painting",
                body: {
                  id: `${IMAGE_SERVICE}/full/max/0/default.jpg`,
                  type: "Image",
                  format: "image/jpeg",
                  width: WIDTH,
                  height: HEIGHT,
                  service: [
                    {
                      id: IMAGE_SERVICE,
                      type: "ImageService3",
                      profile: "level2",
                    },
                  ],
                },
                target: canvas,
              },
            ],
          },
        ],
        annotations: [
          {
            id: `${canvas}/georeference`,
            type: "AnnotationPage",
            items: [
              {
                id: `${canvas}/georeference/1`,
                type: "Annotation",
                motivation: "georeferencing",
                target: {
                  type: "SpecificResource",
                  source: {
                    id: canvas,
                    type: "Canvas",
                    width: WIDTH,
                    height: HEIGHT,
                  },
                  selector: {
                    type: "SvgSelector",
                    value: `<svg width="${WIDTH}" height="${HEIGHT}"><polygon points="0,0 ${WIDTH},0 ${WIDTH},${HEIGHT} 0,${HEIGHT}" /></svg>`,
                  },
                },
                body: {
                  type: "FeatureCollection",
                  transformation: { type: "polynomial", options: { order: 1 } },
                  features: POINTS.map(([resourceCoords, coordinates]) => ({
                    type: "Feature",
                    properties: { resourceCoords },
                    geometry: { type: "Point", coordinates },
                  })),
                },
              },
            ],
          },
        ],
      },
    ],
  };
}
