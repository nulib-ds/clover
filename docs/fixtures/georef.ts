/**
 * Fixture data for the IIIF Georeference Extension and navPlace Extension.
 *
 * Unit-test fixtures use example.org following IIIF spec conventions.
 * Geographic coordinates are real WGS-84 values from a scan of the
 * "Map of the Township of Evanston, Cook County, Illinois" held by
 * Northwestern University Libraries (FileSet 2fb1e81a).
 *
 * Real NUL identifiers are exported separately (DC_*) for docs and
 * visual/integration tests.  See src/fixtures/dc_annotation.json for
 * the full dc-api response.
 */

import type { GeoreferenceAnnotation } from "@samvera/clover-iiif/map";

// ── Identifiers (example.org — for unit tests) ────────────────────────────────

export const CANVAS_ID = "https://example.org/iiif/canvas/map-1";
export const IMAGE_SERVICE_V2_ID = "https://iiif.example.org/image/2/map-1";
export const IMAGE_SERVICE_V3_ID = "https://iiif.example.org/image/3/map-1";

// ── Real NUL identifiers (from dc_annotation.json) ───────────────────────────

/** Canvas source URL. */
export const DC_CANVAS_ID =
  "https://api.dc.library.northwestern.edu/api/v2/file-sets/2fb1e81a-9e24-420c-b224-0bfd6a279baf?as=iiif";

/**
 * IIIF Image API v3 base URL for the same FileSet.
 * Used with `adaptGeoreferenceAnnotationForOverlay` to produce an overlay
 * annotation compatible with @allmaps/maplibre.
 */
export const DC_IMAGE_SERVICE_V3_ID =
  "https://iiif.dc.library.northwestern.edu/iiif/3/2fb1e81a-9e24-420c-b224-0bfd6a279baf";

// ── Canvas dimensions ──────────────────────────────────────────────────────────

export const CANVAS_WIDTH = 7337;
export const CANVAS_HEIGHT = 9833;

// ── Georeference annotation (Canvas source — as stored) ───────────────────────

/**
 * A IIIF Georeference Extension annotation whose `target.source` is a Canvas.
 * This is the form an annotation takes when saved by an authoring tool.
 * Pass to `adaptGeoreferenceAnnotationForOverlay` before using with
 * @allmaps/maplibre, which requires an ImageService source.
 */
export const GEOREF_ANNOTATION_CANVAS: GeoreferenceAnnotation = {
  "@context": [
    "http://iiif.io/api/extension/georef/1/context.json",
    "http://iiif.io/api/presentation/3/context.json",
  ],
  id: "https://example.org/iiif/annotation/georef-1",
  type: "Annotation",
  motivation: "georeferencing",
  target: {
    type: "SpecificResource",
    source: {
      id: CANVAS_ID,
      type: "Canvas",
      height: CANVAS_HEIGHT,
      width: CANVAS_WIDTH,
    },
    selector: {
      type: "SvgSelector",
      value: `<svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}"><polygon points="0,0 ${CANVAS_WIDTH},0 ${CANVAS_WIDTH},${CANVAS_HEIGHT} 0,${CANVAS_HEIGHT}" /></svg>`,
    },
  },
  body: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { confidence: "medium", resourceCoords: [577.7, 1074.97] },
        geometry: { type: "Point", coordinates: [-87.71064, 42.06793] },
      },
      {
        type: "Feature",
        properties: {
          confidence: "medium",
          resourceCoords: [3023.66, 1560.92],
        },
        geometry: { type: "Point", coordinates: [-87.67961, 42.06283] },
      },
      {
        type: "Feature",
        properties: { confidence: "medium", resourceCoords: [3499.96, 6785.6] },
        geometry: { type: "Point", coordinates: [-87.6752, 42.01607] },
      },
    ],
  },
};

/**
 * The same annotation adapted for @allmaps/maplibre (ImageService2 source).
 * Produced by `adaptGeoreferenceAnnotationForOverlay(GEOREF_ANNOTATION_CANVAS, IMAGE_SERVICE_V2_ID)`.
 */
export const GEOREF_ANNOTATION_IMAGE_SERVICE: GeoreferenceAnnotation = {
  ...GEOREF_ANNOTATION_CANVAS,
  target: {
    ...GEOREF_ANNOTATION_CANVAS.target,
    source: {
      id: IMAGE_SERVICE_V2_ID,
      type: "ImageService2",
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    },
  },
};

/**
 * Real georeference annotation as returned by dc-api (content already JSON,
 * not a JSON string).  Target source is a Canvas — pass to
 * `adaptGeoreferenceAnnotationForOverlay` before using with @allmaps/maplibre.
 *
 * Source: src/fixtures/dc_annotation.json → data.annotations[0].content
 */
export const DC_GEOREF_ANNOTATION_CANVAS: GeoreferenceAnnotation = {
  "@context": [
    "http://iiif.io/api/extension/georef/1/context.json",
    "http://iiif.io/api/presentation/3/context.json",
  ],
  id: "urn:meadow:georeference:2fb1e81a-9e24-420c-b224-0bfd6a279baf:2026-05-21T19%3A22%3A19.291Z",
  type: "Annotation",
  motivation: "georeferencing",
  target: {
    type: "SpecificResource",
    source: {
      id: DC_CANVAS_ID,
      type: "Canvas",
      height: CANVAS_HEIGHT,
      width: CANVAS_WIDTH,
    },
    selector: {
      type: "SvgSelector",
      value: `<svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}"><polygon points="0,0 ${CANVAS_WIDTH},0 ${CANVAS_WIDTH},${CANVAS_HEIGHT} 0,${CANVAS_HEIGHT}" /></svg>`,
    },
  },
  body: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { confidence: "medium", resourceCoords: [577.7, 1074.97] },
        geometry: { type: "Point", coordinates: [-87.71064, 42.06793] },
      },
      {
        type: "Feature",
        properties: {
          confidence: "medium",
          resourceCoords: [3023.66, 1560.92],
        },
        geometry: { type: "Point", coordinates: [-87.67961, 42.06283] },
      },
      {
        type: "Feature",
        properties: { confidence: "medium", resourceCoords: [3499.96, 6785.6] },
        geometry: { type: "Point", coordinates: [-87.6752, 42.01607] },
      },
    ],
  },
};

/**
 * The same annotation adapted for @allmaps/maplibre (ImageService3 source).
 * Produced by `adaptGeoreferenceAnnotationForOverlay(DC_GEOREF_ANNOTATION_CANVAS, DC_IMAGE_SERVICE_V3_ID, "ImageService3")`.
 */
export const DC_GEOREF_ANNOTATION_OVERLAY: GeoreferenceAnnotation = {
  ...DC_GEOREF_ANNOTATION_CANVAS,
  target: {
    ...DC_GEOREF_ANNOTATION_CANVAS.target,
    source: {
      id: DC_IMAGE_SERVICE_V3_ID,
      type: "ImageService3",
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    },
  },
};

// ── Second real NUL map (Wilmette) — for multi-overlay demos ─────────────────

/**
 * Canvas source URL for the "Map of the village of Wilmette, Cook County,
 * Illinois" (FileSet f8fd564d).  Wilmette borders Evanston on the North Shore,
 * so the two georeferenced sheets tile together on one map.
 */
export const DC_WILMETTE_CANVAS_ID =
  "https://api.dc.library.northwestern.edu/api/v2/file-sets/f8fd564d-2d0d-4c58-badb-e575bdaaac5b?as=iiif";

/** IIIF Image API v3 base URL for the Wilmette FileSet. */
export const DC_WILMETTE_IMAGE_SERVICE_V3_ID =
  "https://iiif.dc.library.northwestern.edu/iiif/3/f8fd564d-2d0d-4c58-badb-e575bdaaac5b";

export const DC_WILMETTE_CANVAS_WIDTH = 18844;
export const DC_WILMETTE_CANVAS_HEIGHT = 6595;

/**
 * Real georeference annotation for the Wilmette map as returned by dc-api
 * (content already JSON).  Target source is a Canvas — pass to
 * `adaptGeoreferenceAnnotationForOverlay` before using with @allmaps/maplibre.
 */
export const DC_WILMETTE_GEOREF_ANNOTATION_CANVAS: GeoreferenceAnnotation = {
  "@context": [
    "http://iiif.io/api/extension/georef/1/context.json",
    "http://iiif.io/api/presentation/3/context.json",
  ],
  id: "urn:meadow:georeference:f8fd564d-2d0d-4c58-badb-e575bdaaac5b:2026-05-29T19%3A59%3A12.203Z",
  type: "Annotation",
  motivation: "georeferencing",
  target: {
    type: "SpecificResource",
    source: {
      id: DC_WILMETTE_CANVAS_ID,
      type: "Canvas",
      height: DC_WILMETTE_CANVAS_HEIGHT,
      width: DC_WILMETTE_CANVAS_WIDTH,
    },
    selector: {
      type: "SvgSelector",
      value: `<svg width="${DC_WILMETTE_CANVAS_WIDTH}" height="${DC_WILMETTE_CANVAS_HEIGHT}"><polygon points="0,0 ${DC_WILMETTE_CANVAS_WIDTH},0 ${DC_WILMETTE_CANVAS_WIDTH},${DC_WILMETTE_CANVAS_HEIGHT} 0,${DC_WILMETTE_CANVAS_HEIGHT}" /></svg>`,
    },
  },
  body: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          confidence: "medium",
          resourceCoords: [11818.74, 3855.76],
        },
        geometry: { type: "Point", coordinates: [-87.69964, 42.07017] },
      },
      {
        type: "Feature",
        properties: {
          confidence: "medium",
          resourceCoords: [1815.28, 4233.17],
        },
        geometry: { type: "Point", coordinates: [-87.77029, 42.06886] },
      },
      {
        type: "Feature",
        properties: {
          confidence: "medium",
          resourceCoords: [11349.49, 1444.54],
        },
        geometry: { type: "Point", coordinates: [-87.70287, 42.08273] },
      },
    ],
  },
};

/**
 * The Wilmette annotation adapted for @allmaps/maplibre (ImageService3 source).
 * Produced by
 * `adaptGeoreferenceAnnotationForOverlay(DC_WILMETTE_GEOREF_ANNOTATION_CANVAS, DC_WILMETTE_IMAGE_SERVICE_V3_ID, "ImageService3")`.
 */
export const DC_WILMETTE_GEOREF_ANNOTATION_OVERLAY: GeoreferenceAnnotation = {
  ...DC_WILMETTE_GEOREF_ANNOTATION_CANVAS,
  target: {
    ...DC_WILMETTE_GEOREF_ANNOTATION_CANVAS.target,
    source: {
      id: DC_WILMETTE_IMAGE_SERVICE_V3_ID,
      type: "ImageService3",
      width: DC_WILMETTE_CANVAS_WIDTH,
      height: DC_WILMETTE_CANVAS_HEIGHT,
    },
  },
};

/** Expected GCPs extracted by `parseGeoreferenceAnnotation`. */
export const EXPECTED_GCPS = [
  {
    id: "gcp-0",
    resourceCoords: [577.7, 1074.97] as [number, number],
    geoCoords: [-87.71064, 42.06793] as [number, number],
  },
  {
    id: "gcp-1",
    resourceCoords: [3023.66, 1560.92] as [number, number],
    geoCoords: [-87.67961, 42.06283] as [number, number],
  },
  {
    id: "gcp-2",
    resourceCoords: [3499.96, 6785.6] as [number, number],
    geoCoords: [-87.6752, 42.01607] as [number, number],
  },
];

// ── navPlace fixtures ──────────────────────────────────────────────────────────

/** A navPlace FeatureCollection with a single Point feature. */
export const EXAMPLE_NAV_PLACE: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "https://example.org/place/1",
      properties: {
        label: { en: ["Example Location"] },
        summary: { en: ["A representative geographic point"] },
      },
      geometry: {
        type: "Point",
        coordinates: [-87.6881, 42.045],
      },
    },
  ],
};

/** A navPlace expressed as a single Feature (non-collection form). */
export const EXAMPLE_NAV_PLACE_FEATURE: GeoJSON.Feature = {
  type: "Feature",
  id: "https://example.org/place/1",
  properties: {
    label: "Example Location",
  },
  geometry: {
    type: "Point",
    coordinates: [-87.6881, 42.045],
  },
};

/** A navPlace with a Polygon geometry. */
export const EXAMPLE_NAV_PLACE_POLYGON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        label: { en: ["Example Region"] },
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-88.263, 41.469],
            [-87.524, 41.469],
            [-87.524, 42.154],
            [-88.263, 42.154],
            [-88.263, 41.469],
          ],
        ],
      },
    },
  ],
};
