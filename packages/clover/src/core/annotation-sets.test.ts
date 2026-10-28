import htmlJson from "../fixtures/iiif-cookbook/0019-html-in-annotations.json";
import imageJson from "../fixtures/iiif-cookbook/0377-image-in-annotation.json";
import captionsJson from "../fixtures/iiif-cookbook/0219-using-caption-file.json";
import simpleJson from "../fixtures/iiif-cookbook/simple-annotation.json";
import articlesJson from "../fixtures/iiif-cookbook/0025-newspaper-article-index.json";
import layersJson from "../fixtures/iiif-cookbook/0326-annotating-image-layer.json";
import { p4 } from "../fixtures/presentation4";
import { loadAnnotationSets } from "./annotation-collection";
import {
  CONTENTS_SET_ID,
  paintsLayers,
  readPage,
  selectAnnotationSets,
  selectDrawnSets,
  selectHiddenSets,
  selectListedSets,
  selectManifestSets,
  selectUnlistedSets,
} from "./annotation-sets";
import { createClover } from "./clover";
import { imageLayers } from "./image-layers";
import { contentsSet } from "./range-regions";
import { SEARCH_SET_ID } from "./search-service";
import { buildContentState } from "./content-state";
import {
  decodeContentState,
  resolveContentState,
} from "./content-state-reader";

describe("annotation sets", () => {
  it("reads a Canvas's commenting annotations, with their language", () => {
    const [set] = selectManifestSets(p4(simpleJson));
    expect(set.entries).toHaveLength(1);
    expect(set.entries[0]).toMatchObject({
      canvasId: simpleJson.items[0].id,
      motivation: ["commenting"],
      bodies: [{ language: "de", format: "text/plain" }],
    });
  });

  it("keeps HTML bodies as published, and image bodies as images", () => {
    expect(
      selectManifestSets(p4(htmlJson))[0].entries[0].bodies[0],
    ).toMatchObject({
      format: "text/html",
      value: expect.stringContaining("<a href="),
    });
    const [entry] = selectManifestSets(p4(imageJson))[0].entries;
    expect(entry.bodies[0].image).toMatch(/fountain/);
    expect(entry.target.rect).toEqual({ x: 138, y: 550, w: 1477, h: 1710 });
  });

  it("keeps an image body's label, else its annotation's, for its text alternative", () => {
    const page = (annotation: Record<string, unknown>) => ({
      items: [
        {
          id: "https://example.org/anno",
          type: "Annotation",
          motivation: ["commenting"],
          target: "https://example.org/canvas",
          ...annotation,
        },
      ],
    });
    const image = { id: "https://example.org/a.jpg", type: "Image" };
    const [own] = readPage(
      page({
        label: { en: ["The annotation"] },
        body: { ...image, label: { en: ["The image"] } },
      }),
      "set",
    );
    expect(own.bodies[0].label).toEqual({ en: ["The image"] });
    const [annotation] = readPage(
      page({ label: { en: ["The annotation"] }, body: image }),
      "set",
    );
    expect(annotation.bodies[0].label).toEqual({ en: ["The annotation"] });
    const [none] = readPage(page({ body: image }), "set");
    expect(none.bodies[0]).not.toHaveProperty("label");
  });

  it("leaves caption files to the media transcript", () => {
    expect(selectManifestSets(p4(captionsJson))).toEqual([]);
  });

  describe("a still Canvas's OCR", () => {
    // A page of each: OCR on an image (Cookbook 0068), and text supplementing a recording.
    const ocr = (canvas: string, motivation = "supplementing") => ({
      id: `${canvas}/ocr`,
      type: "AnnotationPage",
      items: [
        {
          id: `${canvas}/ocr#line-0`,
          type: "Annotation",
          motivation,
          body: {
            type: "TextualBody",
            value: "I. 54. Jahrgang",
            language: "de",
          },
          target: `${canvas}#xywh=0,376,399,53`,
        },
      ],
    });
    const manifest = p4({
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/manifest",
      type: "Manifest",
      label: { none: ["OCR"] },
      items: [
        {
          id: "https://example.org/page",
          type: "Canvas",
          width: 1000,
          height: 1400,
          items: [],
          annotations: [ocr("https://example.org/page")],
        },
        {
          id: "https://example.org/note",
          type: "Canvas",
          width: 1000,
          height: 1400,
          items: [],
          annotations: [ocr("https://example.org/note", "commenting")],
        },
        {
          id: "https://example.org/recording",
          type: "Canvas",
          duration: 60,
          items: [],
          annotations: [ocr("https://example.org/recording")],
        },
      ],
    } as never);

    it("starts hidden, ready for a search, where a recording's and comments do not", () => {
      expect(selectHiddenSets(manifest, [], [], [])).toEqual([
        "https://example.org/page/ocr",
      ]);
    });

    it("is left out of the sets listed to read, where a recording's and comments stay", () => {
      expect(selectListedSets(manifest, []).map((set) => set.id)).toEqual([
        "https://example.org/note/ocr",
        "https://example.org/recording/ocr",
      ]);
    });

    it("is never offered by the Canvas's menu, nor are a search's hits or the Ranges' regions, unless shown", () => {
      const page = "https://example.org/page/ocr";
      expect(selectUnlistedSets(manifest, [], [], [])).toEqual([
        SEARCH_SET_ID,
        CONTENTS_SET_ID,
        page,
      ]);
      // Shown by the host, the menu offers it, to hide again; hidden again, too.
      expect(selectUnlistedSets(manifest, [], [], [page])).toEqual([
        SEARCH_SET_ID,
        CONTENTS_SET_ID,
      ]);
      expect(selectUnlistedSets(manifest, [], [page], [])).toEqual([
        SEARCH_SET_ID,
        CONTENTS_SET_ID,
      ]);
    });

    it("shows when switched on, and hides again when switched off", () => {
      const clover = createClover();
      clover.store.set({ manifest });
      const hidden = () => {
        const state = clover.store.get();
        return selectHiddenSets(
          state.manifest,
          state.addedSets,
          state.hiddenSets,
          state.shownSets,
        );
      };
      clover.setSetVisible("https://example.org/page/ocr", true);
      expect(hidden()).toEqual([]);
      clover.setSetVisible("https://example.org/page/ocr", false);
      expect(hidden()).toEqual(["https://example.org/page/ocr"]);
    });

    it("shows a hidden set again when one of its annotations is chosen", () => {
      const clover = createClover();
      clover.store.set({ manifest });
      const hidden = () => {
        const state = clover.store.get();
        return selectHiddenSets(
          state.manifest,
          state.addedSets,
          state.hiddenSets,
          state.shownSets,
        );
      };
      const note = "https://example.org/note/ocr";
      clover.setSetVisible(note, false);
      expect(hidden()).toContain(note);
      const [entry] = selectAnnotationSets(manifest, []).find(
        (set) => set.id === note,
      )!.entries;
      clover.selectAnnotation(entry.id);
      expect(clover.store.get().annotationId).toBe(entry.id);
      expect(hidden()).not.toContain(note);
      // A set that starts hidden, too.
      const [line] = selectAnnotationSets(manifest, []).find(
        (set) => set.id === "https://example.org/page/ocr",
      )!.entries;
      clover.selectAnnotation(line.id);
      expect(hidden()).toEqual([]);
    });

    it("leaves caption files alone: they are never a set", () => {
      expect(selectHiddenSets(p4(captionsJson), [], [], [])).toEqual([]);
    });
  });

  // Cookbook 0326: an image of a Choice carries its own annotations.
  it("reads an image's own annotations, placed on its Canvas and marked with its layer", () => {
    const manifest = p4(layersJson);
    // Not the Canvas's pages: the Root reads them apart, once it has loaded their code.
    expect(selectManifestSets(manifest)).toEqual([]);
    expect(paintsLayers(manifest)).toBe(true);
    expect(paintsLayers(p4(simpleJson))).toBe(false);
    const [set] = imageLayers(manifest);
    expect(set.label).toEqual({ en: ["X-ray"] });
    const [entry] = set.entries;
    expect(entry.target.rect).toEqual({ x: 810, y: 900, w: 260, h: 370 });
    expect(entry.canvasId).toBe(layersJson.items[0].id);
    expect(entry.layer).toMatchObject({ item: 1 });
    expect(entry.layer?.image).toMatch(/dee-xray/);
  });

  it("are read by the Root, beside its own, once a Manifest whose images carry some is shown", async () => {
    const clover = createClover();
    await clover.load(layersJson as never);
    await vi.waitFor(() => {
      const { manifest, addedSets } = clover.store.get();
      expect(
        selectAnnotationSets(manifest, addedSets).map((set) => set.label),
      ).toEqual([{ en: ["X-ray"] }]);
    });
    // The next Manifest's are its own.
    await clover.load(simpleJson);
    expect(clover.store.get().addedSets).toEqual([]);
  });

  // Cookbook 0306, opened by its Annotation Page: the page added is one the Manifest holds.
  it("lists a page once, the Manifest's, when it is added again", () => {
    const manifest = p4(simpleJson);
    const own = selectAnnotationSets(manifest, []);
    const again = { ...own[0], source: "added" as const };
    const sets = selectAnnotationSets(manifest, [again]);
    expect(sets.filter((set) => set.id === own[0].id)).toHaveLength(1);
    expect(sets.find((set) => set.id === own[0].id)?.source).toBe("manifest");
  });

  it("returns the same arrays while nothing changes", () => {
    const manifest = p4(simpleJson);
    expect(selectAnnotationSets(manifest, [])).toBe(
      selectAnnotationSets(manifest, []),
    );
  });
});

describe("added annotations", () => {
  const canvas = "https://example.org/canvas/1";
  const page = (n: number, next?: string) => ({
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: `https://example.org/pages/${n}`,
    type: "AnnotationPage",
    ...(next ? { next } : {}),
    items: [
      {
        id: `https://example.org/pages/${n}/a`,
        type: "Annotation",
        motivation: "tagging",
        body: { type: "TextualBody", value: `Tag ${n}` },
        target: `${canvas}#xywh=${n},0,10,10`,
      },
    ],
  });

  it("follows a collection from first through next, with the request settings", async () => {
    const table: Record<string, unknown> = {
      "https://example.org/collection": {
        "@context": "http://iiif.io/api/presentation/3/context.json",
        id: "https://example.org/collection",
        type: "AnnotationCollection",
        label: { en: ["Tags"] },
        first: "https://example.org/pages/1",
      },
      "https://example.org/pages/1": page(1, "https://example.org/pages/2"),
      "https://example.org/pages/2": page(2),
    };
    const fetch = vi.fn(
      async (url: string) => new Response(JSON.stringify(table[url])),
    );
    const sets = await loadAnnotationSets("https://example.org/collection", {
      request: { fetch, credentials: "include" },
    });
    expect(sets.map((set) => set.entries[0].target.rect?.x)).toEqual([1, 2]);
    expect(sets[0]).toMatchObject({ source: "added", label: { en: ["Tags"] } });
    expect(sets[0].entries[0].motivation).toEqual(["tagging"]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect((fetch.mock.calls[0] as unknown[])[1]).toMatchObject({
      credentials: "include",
    });
  });

  it("reads a collection's pages once, though a next leads back", async () => {
    const table: Record<string, unknown> = {
      "https://example.org/collection": {
        id: "https://example.org/collection",
        type: "AnnotationCollection",
        first: "https://example.org/pages/1",
      },
      "https://example.org/pages/1": page(1, "https://example.org/pages/2"),
      "https://example.org/pages/2": page(2, "https://example.org/pages/1"),
    };
    const fetch = vi.fn(
      async (url: string) => new Response(JSON.stringify(table[url])),
    );
    const sets = await loadAnnotationSets("https://example.org/collection", {
      request: { fetch },
    });
    expect(sets.map((set) => set.entries[0].target.rect?.x)).toEqual([1, 2]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("selects an added annotation on another Canvas by going there", async () => {
    const clover = createClover();
    await clover.load(simpleJson);
    await clover.loadAnnotations(page(7));
    clover.selectAnnotation("https://example.org/pages/7/a");
    // The added page targets a Canvas this Manifest does not have: the pick stands,
    // and Clover does not move to a Canvas it cannot show.
    expect(clover.store.get().annotationId).toBe(
      "https://example.org/pages/7/a",
    );
    expect(clover.store.get().canvasId).toBe(simpleJson.items[0].id);
  });
});

describe("content state output", () => {
  it("round-trips a Canvas and its region", () => {
    const { json, encoded } = buildContentState({
      manifestId: "https://example.org/m",
      canvasId: "https://example.org/c",
      region: { x: 1.4, y: 2.6, w: 30, h: 40 },
    });
    expect(decodeContentState(encoded)).toEqual(json);
    expect(resolveContentState(json)).toEqual({
      id: "https://example.org/m",
      type: "Manifest",
      target: {
        canvasId: "https://example.org/c",
        region: { x: 1, y: 3, w: 30, h: 40 },
      },
    });
  });

  it("carries a media time instead of a region", () => {
    const { json } = buildContentState({
      manifestId: "https://example.org/m",
      canvasId: "https://example.org/c",
      region: { x: 0, y: 0, w: 1, h: 1 },
      time: 12.345,
    });
    expect(resolveContentState(json)?.target).toEqual({
      canvasId: "https://example.org/c",
      time: 12.35,
    });
  });

  it("is built from the Root's place: the view's Canvas and region", async () => {
    const clover = createClover();
    await clover.load(simpleJson);
    clover.viewport.emit({
      canvasId: simpleJson.items[0].id,
      region: { x: 10, y: 20, w: 30, h: 40 },
    });
    const state = clover.getContentState()!;
    expect(resolveContentState(state.json)?.target?.region).toEqual({
      x: 10,
      y: 20,
      w: 30,
      h: 40,
    });
  });
});

// Cookbook 0025: the articles' columns, drawn as annotations, though nothing lists them.
describe("the Ranges' regions", () => {
  it("are drawn with the Manifest's own sets, and listed by none", () => {
    const manifest = p4(articlesJson);
    const regions = contentsSet(manifest);
    const drawn = selectDrawnSets(manifest, [], null, regions);
    expect(drawn.map((set) => set.id)).toContain(CONTENTS_SET_ID);
    expect(selectListedSets(manifest, []).map((set) => set.id)).not.toContain(
      CONTENTS_SET_ID,
    );
    // The same array while nothing changes.
    expect(selectDrawnSets(manifest, [], null, regions)).toBe(drawn);
  });

  it("are read by the Root once a Manifest with Ranges is shown", async () => {
    const clover = createClover();
    await clover.load(articlesJson as never);
    await vi.waitFor(() =>
      expect(clover.store.get().regions?.id).toBe(CONTENTS_SET_ID),
    );
  });
});
