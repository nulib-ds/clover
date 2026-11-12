import annotationJson from "../fixtures/iiif-cookbook/0139-geolocate-canvas-fragment.json";
import manifestJson from "../fixtures/iiif-cookbook/0154-geo-extension.json";
import canvasesJson from "../fixtures/iiif-cookbook/0240-navPlace-on-canvases.json";
import romeJson from "../fixtures/iiif-cookbook/0318-navPlace-navDate-collection.json";
import castelJson from "../fixtures/iiif-cookbook/0318-navPlace-navDate-manifest-1.json";
import colosseumJson from "../fixtures/iiif-cookbook/0318-navPlace-navDate-manifest-2.json";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DC_CANVAS_ID,
  DC_GEOREF_ANNOTATION_CANVAS,
  DC_IMAGE_SERVICE_V3_ID,
  evanston,
} from "../fixtures/georef";
import evanston1899 from "../fixtures/mocks/sanborn/evanston/1899.json";
import { p4 } from "../fixtures/presentation4";
import {
  affineTransform,
  boundsOf,
  canvasGeoreferences,
  canvasHasMapData,
  cornersOf,
  georeferencesOf,
  hasMapData,
  helmertTransform,
  navPlaceOf,
  readGeoreference,
} from "./geo";

describe("navPlaceOf", () => {
  it("reads a Manifest's navPlace, titled in the reader's language", () => {
    const { features } = navPlaceOf(p4(manifestJson), null, "it");
    expect(features).toHaveLength(1);
    expect(features[0].geometry.type).toBe("Point");
    expect(features[0].properties.title).toBe(
      "Bronzo Laocoonte e i suoi figli",
    );
    expect(features[0].properties.canvasId).toBeUndefined();
  });

  it("titles a feature in plain text, its markup off and its entities decoded", () => {
    const feature = manifestJson.navPlace.features[0];
    const { features } = navPlaceOf(
      p4({
        ...manifestJson,
        navPlace: {
          ...manifestJson.navPlace,
          features: [
            {
              ...feature,
              properties: {
                label: { en: ["<b>Getty</b> Villa &amp; Museum"] },
              },
            },
          ],
        },
      }),
    );
    expect(features[0].properties.title).toBe("Getty Villa & Museum");
  });

  // Cookbook 0318: a Collection of five views of Rome, each Manifest where it is.
  it("reads every member's place, in the Collection's order, each naming its member", () => {
    const collection = p4(romeJson);
    const { features } = navPlaceOf(p4(colosseumJson), collection);
    expect(features.map((f) => f.properties.manifestId)).toEqual(
      romeJson.items.map((member) => member.id),
    );
    expect(features.map((f) => f.properties.title)).toEqual(
      romeJson.items.map((member) => member.label.en[0]),
    );
    // Each with its member's date, as written.
    expect(features.map((f) => f.properties.navDate)).toEqual(
      romeJson.items.map((member) => member.navDate),
    );
    // The open member's place is its own Manifest's, once.
    expect(
      features.filter((f) => f.properties.manifestId === colosseumJson.id),
    ).toHaveLength(1);
    expect(navPlaceOf(p4(castelJson), collection).features[0].geometry).toEqual(
      castelJson.navPlace.features[0].geometry,
    );
  });

  it("names the Canvas a Canvas's navPlace belongs to", () => {
    const manifest = p4(canvasesJson);
    const { features } = navPlaceOf(manifest);
    expect(features.map((f) => f.properties.canvasId)).toEqual(
      canvasesJson.items.map((canvas) => canvas.id),
    );
    expect(features[1].properties.title).toBe("Current Location of Painting");
  });

  it("keeps the language a title is in, the feature's own or its owner's", () => {
    const { features } = navPlaceOf(p4(canvasesJson), null, "it");
    expect(features[0].properties).toMatchObject({
      title: "Ubicazione attuale del Bronzo Laocoonte e i suoi figli",
      titleLang: "it",
    });
    // Only English is given, so English it is, and says so.
    expect(features[1].properties.titleLang).toBe("en");
    // Named by its Canvas, in the Canvas's language.
    const unnamed = p4({
      ...canvasesJson,
      items: [
        {
          ...canvasesJson.items[1],
          label: { de: ["Gemälde"] },
          navPlace: { type: "Point", coordinates: [0, 0] },
        },
      ],
    });
    expect(navPlaceOf(unnamed).features[0].properties).toMatchObject({
      title: "Gemälde",
      titleLang: "de",
    });
    // A plain string, or `none`, has no language.
    const plain = navPlaceOf(
      p4({
        ...canvasesJson,
        items: [],
        navPlace: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { label: "Rome" },
              geometry: { type: "Point", coordinates: [12.5, 41.9] },
            },
            {
              type: "Feature",
              properties: { label: { none: ["Roma"] } },
              geometry: { type: "Point", coordinates: [12.5, 41.9] },
            },
          ],
        },
      }),
    ).features;
    expect(plain.map((f) => f.properties.titleLang)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it("reads a GeoJSON annotation body, on the Canvas it targets", () => {
    const { features } = navPlaceOf(p4(annotationJson));
    expect(features.length).toBeGreaterThan(0);
    expect(features[0].properties.canvasId).toBe(annotationJson.items[0].id);
    // Its ring, written open (four corners), closed, so its edge goes all the way round.
    const [ring] = features[0].geometry.coordinates as number[][][];
    expect(ring).toHaveLength(5);
    expect(ring.at(-1)).toEqual(ring[0]);
    // And the annotation it is the body of, which a press on the place selects.
    expect(features[0].properties.annotationId).toBe(
      annotationJson.items[0].annotations[0].items[0].id,
    );
  });

  it("is memoized on the Manifest, and shared when empty", () => {
    const manifest = p4(canvasesJson);
    expect(navPlaceOf(manifest)).toBe(navPlaceOf(manifest));
    const bare = p4({ ...canvasesJson, items: [] });
    expect(navPlaceOf(bare)).toBe(navPlaceOf(null));
  });
});

describe("georeferences", () => {
  it("reads a stored annotation: points, extent, and the Canvas's painted image", () => {
    const [georeference] = georeferencesOf(evanston());
    expect(georeference.canvasId).toBe(DC_CANVAS_ID);
    expect(georeference.points.length).toBeGreaterThanOrEqual(3);
    expect([georeference.width, georeference.height]).toEqual([
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    ]);
    // Its selector is the whole image, so there is no mask.
    expect(georeference.mask).toBeUndefined();
    expect((georeference.image as any).service[0].id).toBe(
      DC_IMAGE_SERVICE_V3_ID,
    );
    expect(hasMapData(evanston())).toBe(true);
  });

  it("says whether one Canvas has a place of its own, as hasMapData asks of each", () => {
    // A georeference.
    expect(canvasHasMapData(evanston().items[0])).toBe(true);
    // Its own navPlace (Cookbook 0240).
    expect(
      (canvasesJson.items as unknown[]).every((canvas) =>
        canvasHasMapData(canvas),
      ),
    ).toBe(true);
    // A place on an annotation's body (Cookbook 0139).
    expect(canvasHasMapData(annotationJson.items[0])).toBe(true);
    // Nothing of its own.
    expect(canvasHasMapData({ id: "c", type: "Canvas" })).toBe(false);
    expect(canvasHasMapData(undefined)).toBe(false);
  });

  it("reads one Canvas's, for its place box, the same as the Manifest's", () => {
    const manifest = evanston();
    const canvas = manifest.items[0] as any;
    expect(canvasGeoreferences(canvas)).toEqual(georeferencesOf(manifest));
    expect(canvasGeoreferences(canvas)).toBe(canvasGeoreferences(canvas));
    expect(canvasGeoreferences({ id: "c", type: "Canvas" } as any)).toEqual([]);
    expect(canvasGeoreferences(undefined)).toEqual([]);
  });

  it("is named by the annotation's label, or else its Canvas's", () => {
    const canvas = {
      ...(evanston().items[0] as object),
      label: { en: ["Township map"] },
    };
    expect(
      readGeoreference(DC_GEOREF_ANNOTATION_CANVAS, canvas)?.label,
    ).toEqual({ en: ["Township map"] });
    expect(
      readGeoreference(
        { ...DC_GEOREF_ANNOTATION_CANVAS, label: { de: ["Karte"] } },
        canvas,
      )?.label,
    ).toEqual({ de: ["Karte"] });
    expect(georeferencesOf(evanston())[0].label).toBeUndefined();
  });

  it("takes an annotation on an image service directly, with its mask", () => {
    const georeference = readGeoreference({
      ...DC_GEOREF_ANNOTATION_CANVAS,
      target: {
        type: "SpecificResource",
        source: {
          id: DC_IMAGE_SERVICE_V3_ID,
          type: "ImageService3",
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
        },
        selector: {
          type: "SvgSelector",
          value:
            '<svg><polygon points="100,100 7000,120 6900,9700 90,9600" /></svg>',
        },
      },
    });
    expect(georeference?.canvasId).toBeUndefined();
    expect(georeference?.mask).toEqual([
      [100, 100],
      [7000, 120],
      [6900, 9700],
      [90, 9600],
    ]);
  });

  it("needs three points", () => {
    const two = {
      ...DC_GEOREF_ANNOTATION_CANVAS,
      body: {
        ...DC_GEOREF_ANNOTATION_CANVAS.body,
        features: DC_GEOREF_ANNOTATION_CANVAS.body.features.slice(0, 2),
      },
    };
    expect(readGeoreference(two, { width: 10, height: 10 })).toBeNull();
  });

  it("takes two points where its transformation is helmert", () => {
    const georeference = readGeoreference(sheet);
    expect(georeference).toMatchObject({
      transformation: "helmert",
      width: sheet.target.source.width,
      height: sheet.target.source.height,
      image: { service: [{ id: sheet.target.source.id }] },
    });
    expect(georeference?.points).toHaveLength(2);
  });
});

/** Sheet 68 of Evanston's 1899 Sanborn volume, fitted by mapsnap from two points. */
const sheet = evanston1899.items[0] as Record<string, any>;

describe("the helmert overlay", () => {
  it("passes through both its control points", () => {
    const { points } = readGeoreference(sheet)!;
    const transform = helmertTransform(points)!;
    for (const { resource, geo } of points) {
      const [lng, lat] = transform(resource);
      expect(lng).toBeCloseTo(geo[0], 9);
      expect(lat).toBeCloseTo(geo[1], 9);
    }
  });

  it("keeps the sheet's shape, face up, never mirrored", () => {
    const georeference = readGeoreference(sheet)!;
    const corners = cornersOf(georeference)!;
    const [tl, tr, br, bl] = corners;
    for (const [lng, lat] of corners) {
      expect(lng).toBeGreaterThan(-87.7);
      expect(lng).toBeLessThan(-87.66);
      expect(lat).toBeGreaterThan(42.04);
      expect(lat).toBeLessThan(42.07);
    }
    // Clockwise on the ground, as on the scan: a sheet may be turned, never flipped.
    const area = corners.reduce((sum, [x, y], i) => {
      const [nx, ny] = corners[(i + 1) % 4];
      return sum + x * ny - nx * y;
    }, 0);
    expect(area).toBeLessThan(0);
    // A similarity: opposite sides as long, as the scan's are.
    const length = (a: number[], b: number[]) =>
      Math.hypot(
        (a[0] - b[0]) * Math.cos((42.05 * Math.PI) / 180),
        a[1] - b[1],
      );
    expect(length(tl, tr)).toBeCloseTo(length(bl, br), 6);
    expect(length(tl, bl)).toBeCloseTo(length(tr, br), 6);
  });

  it("needs two points that are not one", () => {
    const [first] = readGeoreference(sheet)!.points;
    expect(helmertTransform([first])).toBeNull();
    expect(helmertTransform([first, first])).toBeNull();
  });
});

describe("the affine overlay", () => {
  it("passes through its control points", () => {
    const [georeference] = georeferencesOf(evanston());
    const transform = affineTransform(georeference.points)!;
    for (const { resource, geo } of georeference.points.slice(0, 3)) {
      const [lng, lat] = transform(resource);
      // Least squares over every point: within a few hundred meters of each.
      expect(Math.abs(lng - geo[0])).toBeLessThan(0.01);
      expect(Math.abs(lat - geo[1])).toBeLessThan(0.01);
    }
  });

  it("puts the corners around Evanston, top left first, north up", () => {
    const [georeference] = georeferencesOf(evanston());
    const [tl, tr, br, bl] = cornersOf(georeference)!;
    for (const [lng, lat] of [tl, tr, br, bl]) {
      expect(lng).toBeGreaterThan(-88);
      expect(lng).toBeLessThan(-87.5);
      expect(lat).toBeGreaterThan(41.9);
      expect(lat).toBeLessThan(42.2);
    }
    expect(tl[1]).toBeGreaterThan(bl[1]);
    expect(tr[0]).toBeGreaterThan(tl[0]);
    void br;
  });

  it("bounds an overlay by its mask, the part of the image that is map", () => {
    // A sheet's mask traces its map: inside the whole scan, which a sheet of several maps
    // would place far off by any one map's fit.
    const overlay = readGeoreference(sheet)!;
    expect(overlay.mask?.length).toBeGreaterThan(3);
    const [[west, south], [east, north]] = boundsOf([], [overlay])!;
    const corners = cornersOf(overlay)!;
    const lngs = corners.map(([lng]) => lng);
    const lats = corners.map(([, lat]) => lat);
    expect(west).toBeGreaterThanOrEqual(Math.min(...lngs));
    expect(east).toBeLessThanOrEqual(Math.max(...lngs));
    expect(south).toBeGreaterThanOrEqual(Math.min(...lats));
    expect(north).toBeLessThanOrEqual(Math.max(...lats));
    expect((east - west) * (north - south)).toBeLessThan(
      (Math.max(...lngs) - Math.min(...lngs)) *
        (Math.max(...lats) - Math.min(...lats)),
    );
  });

  it("bounds the features and the overlays together", () => {
    const features = navPlaceOf(p4(canvasesJson)).features;
    const [georeference] = georeferencesOf(evanston());
    const [[west, south], [east, north]] = boundsOf(features, [georeference])!;
    expect(west).toBeLessThan(east);
    expect(south).toBeLessThan(north);
    expect(boundsOf([], [])).toBeNull();
  });
});
