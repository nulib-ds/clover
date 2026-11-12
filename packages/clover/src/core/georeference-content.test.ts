import { createClover } from "./clover";
import { canvasGeoreferences, cornersOf, georeferencesOf } from "./geo";
import { isGeoreferencedContent } from "./geo-detect";
import annotation from "../fixtures/mocks/sanborn/annotation.json";
import collection from "../fixtures/mocks/sanborn/annotation-collection.json";
import page from "../fixtures/mocks/sanborn/annotation-page.json";
import evanston1899 from "../fixtures/mocks/sanborn/evanston/1899.json";
import evanston1920 from "../fixtures/mocks/sanborn/evanston/1920.json";

/*
 * Georeference Extension annotations given as the content, apart from any Manifest: a
 * lone Annotation (a sheet of Evanston's 1899 Sanborn volume), an AnnotationPage (that
 * volume's sheets nearest downtown) and an AnnotationCollection (those, and 1920's), each
 * on a bare image service, as mapsnap publishes them. Each opens what it targets, the map
 * laid on it; one whose target names its Canvas and Manifest opens that Manifest.
 */

const P3 = "http://iiif.io/api/presentation/3/context.json";
const MANIFEST = "https://example.org/evanston-1899/manifest";
const CANVAS = "https://example.org/evanston-1899/canvas/8";
type Json = Record<string, any>;

const source = annotation.target.source;

/** The sheet's georeference, its image service named `partOf` a Canvas in a Manifest. */
const named = {
  ...annotation,
  target: {
    ...annotation.target,
    source: {
      ...source,
      partOf: [
        {
          id: CANVAS,
          type: "Canvas",
          partOf: [{ id: MANIFEST, type: "Manifest" }],
        },
      ],
    },
  },
};

/** A Manifest of one Canvas, painted by the sheet's image service. */
function volume(canvasId = CANVAS) {
  return {
    "@context": P3,
    id: MANIFEST,
    type: "Manifest",
    label: { en: ["Evanston, Illinois, 1899"] },
    items: [
      {
        id: canvasId,
        type: "Canvas",
        width: source.width,
        height: source.height,
        items: [
          {
            id: `${canvasId}/page`,
            type: "AnnotationPage",
            items: [
              {
                id: `${canvasId}/painting`,
                type: "Annotation",
                motivation: "painting",
                target: canvasId,
                body: {
                  id: `${source.id}/full/max/0/default.jpg`,
                  type: "Image",
                  format: "image/jpeg",
                  width: source.width,
                  height: source.height,
                  service: [
                    { id: source.id, type: "ImageService3", profile: "level2" },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

/** A fetch answering from a table of URLs. */
function mockFetch(table: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const body = table[url];
    return body === undefined
      ? new Response("missing", { status: 404 })
      : new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  });
}

async function open(content: unknown, table: Record<string, unknown> = {}) {
  const fetch = mockFetch(table);
  const clover = createClover({ request: { fetch } });
  await clover.load(content as Json);
  return { state: clover.store.get(), fetch };
}

/** The georeferencing pages Clover laid on a Canvas. */
const laid = (canvas: Json) =>
  (canvas.annotations ?? []).filter((each: Json) =>
    /#georeferencing-/.test(each.id),
  );

describe("a georeference Annotation as the content", () => {
  test("opens the image it targets, the map laid on it, where it names no Manifest", async () => {
    const { state } = await open(annotation);
    expect(state.status).toBe("ready");
    const manifest = state.manifest as Json;
    const [canvas, ...rest] = manifest.items;
    expect(rest).toEqual([]);
    expect(canvas).toMatchObject({
      id: `${source.id}/canvas`,
      width: source.width,
      height: source.height,
    });
    expect(state.canvasId).toBe(canvas.id);
    const [overlay] = canvasGeoreferences(canvas);
    expect(overlay).toMatchObject({
      id: annotation.id,
      canvasId: canvas.id,
      transformation: "helmert",
    });
    expect(cornersOf(overlay)).not.toBeNull();
    // Named by its label, with the license and attribution it carries.
    expect(manifest.label).toEqual({ none: [annotation.label] });
    expect(manifest.rights).toBe(annotation.rights);
    expect(manifest.requiredStatement).toEqual(annotation.requiredStatement);
    // A map, not a note: nothing to list or pick.
    expect(state.addedSets).toEqual([]);
    expect(state.annotationId).toBeNull();
  });

  test("opens the Manifest its target names, the map laid on its Canvas", async () => {
    const { state } = await open(named, { [MANIFEST]: volume() });
    expect(state.status).toBe("ready");
    expect(state.manifest?.id).toBe(MANIFEST);
    expect(state.canvasId).toBe(CANVAS);
    const [overlay, ...rest] = georeferencesOf(state.manifest);
    expect(rest).toEqual([]);
    expect(overlay).toMatchObject({ id: annotation.id, canvasId: CANVAS });
  });

  test("lies on the Canvas that paints its image, where the Manifest names that Canvas otherwise", async () => {
    const other = "https://example.org/evanston-1899/canvas/eight";
    const { state } = await open(named, { [MANIFEST]: volume(other) });
    expect(state.canvasId).toBe(other);
    expect(georeferencesOf(state.manifest)[0].canvasId).toBe(other);
  });

  test("opens its image alone where the Manifest it names cannot be fetched", async () => {
    const { state } = await open(named);
    expect(state.status).toBe("ready");
    expect(state.canvasId).toBe(`${source.id}/canvas`);
    expect(georeferencesOf(state.manifest)).toHaveLength(1);
  });

  test("reports an error where it targets nothing to show", async () => {
    const { state } = await open({
      ...annotation,
      target: { type: "SpecificResource", source: { type: "Canvas" } },
    });
    expect(state.status).toBe("error");
  });
});

/** The images some annotations target, once each, in order. */
const imagesOf = (annotations: Json[]) => [
  ...new Set(annotations.map((each) => each.target.source.id as string)),
];

describe("an AnnotationPage of georeferences as the content", () => {
  test("shows the images it targets as one Manifest, each map laid on its own", async () => {
    const { state } = await open(page);
    const manifest = state.manifest as Json;
    expect(manifest.id).toBe(page.id);
    expect(manifest.label).toEqual(page.label);
    // Marked, so its maps lay every sheet.
    expect(isGeoreferencedContent(manifest)).toBe(true);
    // Its summary too, as a Manifest's.
    expect(page.summary).toBeDefined();
    expect(manifest.summary).toEqual(page.summary);
    expect(manifest.requiredStatement).toEqual(page.requiredStatement);
    expect(manifest.items.map((canvas: Json) => canvas.id)).toEqual(
      imagesOf(page.items).map((image) => `${image}/canvas`),
    );
    expect(state.canvasId).toBe(manifest.items[0].id);
    for (const canvas of manifest.items) {
      expect(laid(canvas)).toHaveLength(1);
      for (const overlay of canvasGeoreferences(canvas))
        expect(overlay.canvasId).toBe(canvas.id);
    }
    expect(georeferencesOf(state.manifest)).toHaveLength(page.items.length);
    expect(state.addedSets).toEqual([]);
  });

  test("lays every map of one image on its one Canvas", async () => {
    // 1920's sheet 28: two maps on one image, each georeferenced on its own.
    const two = page.items.filter((each) => / p28 \[\d\]$/.test(each.label));
    expect(two).toHaveLength(2);
    const { state } = await open(page);
    const canvas = (state.manifest as Json).items.find(
      (each: Json) => each.id === `${two[0].target.source.id}/canvas`,
    );
    expect(laid(canvas)[0].items.map((each: Json) => each.id)).toEqual(
      two.map((each) => each.id),
    );
    expect(canvasGeoreferences(canvas).map((each) => each.canvasId)).toEqual([
      canvas.id,
      canvas.id,
    ]);
  });
});

describe("an AnnotationCollection of georeferences as the content", () => {
  test("shows the image services its pages target as one Manifest of their images", async () => {
    const { state, fetch } = await open(collection, {
      [evanston1899.id]: evanston1899,
      [evanston1920.id]: evanston1920,
    });
    expect(state.status).toBe("ready");
    // Both pages, from `first` through `next`.
    expect(fetch).toHaveBeenCalledWith(evanston1899.id, expect.anything());
    expect(fetch).toHaveBeenCalledWith(evanston1920.id, expect.anything());
    const manifest = state.manifest as Json;
    expect(manifest.id).toBe(collection.id);
    expect(manifest.label).toEqual(collection.label);
    // What the Collection says of itself: mapsnap's license and its attribution.
    expect(manifest.rights).toBe(collection.rights);
    expect(manifest.requiredStatement).toEqual(collection.requiredStatement);
    expect(manifest.partOf).toBeUndefined();
    const sheets = [...evanston1899.items, ...evanston1920.items];
    expect(manifest.items.map((canvas: Json) => canvas.id)).toEqual(
      imagesOf(sheets).map((image) => `${image}/canvas`),
    );
    expect(georeferencesOf(state.manifest)).toHaveLength(sheets.length);
    expect(state.canvasId).toBe(manifest.items[0].id);
    // Each sheet its own Canvas, named by its annotation, its map laid on it.
    expect(manifest.items[0].label).toEqual({ none: [sheets[0].label] });
    for (const canvas of manifest.items)
      for (const overlay of canvasGeoreferences(canvas)) {
        expect(overlay.canvasId).toBe(canvas.id);
        expect(overlay.transformation).toBe("helmert");
        expect(cornersOf(overlay)).not.toBeNull();
      }
  });
});
