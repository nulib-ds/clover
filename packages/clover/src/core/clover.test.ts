import bookJson from "../fixtures/iiif-cookbook/0009-book-1.json";
import compareJson from "../fixtures/iiif-cookbook/0540-link-for-opening-multiple-canvases-annotation.json";
import monumentsJson from "../fixtures/iiif-cookbook/0540-link-for-opening-multiple-canvases-manifest.json";
import colosseumJson from "../fixtures/iiif-cookbook/0540-link-for-opening-multiple-canvases-manifest-2.json";
import { createClover } from "./clover";
import {
  selectSequence,
  selectTargetIndex,
  selectVisibleCanvases,
} from "./selectors";

const BOOK = bookJson.id;
const canvasIds = bookJson.items.map((canvas) => canvas.id);

/** A fetch answering from a table of URLs, recording every request. */
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

const encode = (json: unknown) =>
  btoa(encodeURIComponent(JSON.stringify(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

describe("createClover: loading", () => {
  it("loads a Manifest URL once, with the request settings, as Presentation 4", async () => {
    const fetch = mockFetch({ [BOOK]: bookJson });
    const clover = createClover({
      request: {
        fetch,
        credentials: "include",
        headers: { Authorization: "Bearer t" },
      },
    });
    await clover.load(BOOK);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer t",
    );
    const { status, manifest, canvasId } = clover.store.get();
    expect(status).toBe("ready");
    expect(manifest?.["@context"]).toContain("presentation/4");
    expect(canvasId).toBe(canvasIds[0]);
  });

  it("takes a resource object without fetching it", async () => {
    const fetch = mockFetch({});
    const clover = createClover({ request: { fetch } });
    await clover.load(bookJson);
    expect(fetch).not.toHaveBeenCalled();
    expect(clover.store.get().manifest?.id).toBe(BOOK);
  });

  it("upgrades Presentation 2", async () => {
    const clover = createClover();
    await clover.load({
      "@context": "http://iiif.io/api/presentation/2/context.json",
      "@id": "https://example.org/p2",
      "@type": "sc:Manifest",
      label: "Two",
      sequences: [
        {
          "@type": "sc:Sequence",
          canvases: [
            {
              "@id": "https://example.org/p2/c1",
              "@type": "sc:Canvas",
              label: "One",
              width: 10,
              height: 10,
              images: [],
            },
          ],
        },
      ],
    });
    const { manifest, canvasId } = clover.store.get();
    expect(manifest?.type).toBe("Manifest");
    expect(canvasId).toBe("https://example.org/p2/c1");
  });

  /*
   * A content state may carry a note its sharer wrote, as Digital Collections' shared
   * links do: shown on its Canvas as an annotation of its own, and picked on arrival.
   */
  it("shows a content state's note on its Canvas, picked, beside the host's annotations", async () => {
    const fetch = mockFetch({ [BOOK]: bookJson });
    const clover = createClover({ request: { fetch } });
    const state = "https://example.org/state/1";
    await clover.load(
      encode({
        id: state,
        type: "Annotation",
        motivation: ["contentState"],
        target: {
          type: "SpecificResource",
          source: {
            id: canvasIds[1],
            type: "Canvas",
            partOf: [{ id: BOOK, type: "Manifest" }],
          },
          selector: { type: "FragmentSelector", value: "xywh=10,20,30,40" },
        },
        body: [
          { type: "TextualBody", value: "hospital", format: "text/plain" },
        ],
      }),
    );
    const { canvasId, annotationId, addedSets, target } = clover.store.get();
    expect(canvasId).toBe(canvasIds[1]);
    expect(annotationId).toBe(state);
    // Its Canvas opens; the pick frames the note, in one move, once the spread is drawn.
    expect(target?.canvasId).toBe(canvasIds[1]);
    expect(target?.region).toBeUndefined();
    expect(addedSets).toHaveLength(1);
    expect(addedSets[0].entries).toMatchObject([
      {
        id: state,
        canvasId: canvasIds[1],
        target: { rect: { x: 10, y: 20, w: 30, h: 40 } },
        bodies: [expect.objectContaining({ value: "hospital" })],
      },
    ]);
    // The host's own annotations join it, rather than take its place.
    await clover.loadAnnotations({
      id: "https://example.org/host/page",
      type: "AnnotationPage",
      items: [
        {
          id: "https://example.org/host/1",
          type: "Annotation",
          motivation: "commenting",
          body: { type: "TextualBody", value: "Host" },
          target: canvasIds[0],
        },
      ],
    });
    expect(clover.store.get().addedSets.map((set) => set.id)).toEqual([
      "https://example.org/host/page",
      `${state}#content-state`,
    ]);
    await clover.loadAnnotations(null);
    expect(clover.store.get().addedSets.map((set) => set.id)).toEqual([
      `${state}#content-state`,
    ]);
  });

  it("follows an encoded content state to its Manifest, Canvas and region", async () => {
    const fetch = mockFetch({ [BOOK]: bookJson });
    const clover = createClover({ request: { fetch } });
    await clover.load(
      encode({
        type: "Annotation",
        motivation: ["contentState"],
        target: {
          type: "SpecificResource",
          source: {
            id: canvasIds[2],
            type: "Canvas",
            partOf: [{ id: BOOK, type: "Manifest" }],
          },
          selector: { type: "FragmentSelector", value: "xywh=1,2,3,4" },
        },
      }),
    );
    const { canvasId, target } = clover.store.get();
    expect(canvasId).toBe(canvasIds[2]);
    expect(target).toEqual({
      canvasId: canvasIds[2],
      region: { x: 1, y: 2, w: 3, h: 4 },
    });
  });

  it("shows a Collection's first Manifest, fetching it when only referenced", async () => {
    const collection = {
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/collection",
      type: "Collection",
      label: { none: ["Shelf"] },
      items: [{ id: BOOK, type: "Manifest", label: { none: ["Book"] } }],
    };
    const fetch = mockFetch({ [BOOK]: bookJson });
    const clover = createClover({ request: { fetch } });
    await clover.load(collection);
    const { manifest, collection: held } = clover.store.get();
    expect(held?.id).toBe(collection.id);
    expect(manifest?.items).toHaveLength(bookJson.items.length);
  });

  it("shows a lone Canvas as a Manifest of one", async () => {
    const clover = createClover();
    await clover.load({
      "@context": "http://iiif.io/api/presentation/3/context.json",
      ...bookJson.items[1],
    });
    const { manifest, canvasId } = clover.store.get();
    expect(manifest?.items).toHaveLength(1);
    expect(canvasId).toBe(canvasIds[1]);
  });

  /*
   * A Canvas given itself is what is shown, not its Manifest: what it says of itself is
   * kept, with its `partOf`, from which the full Manifest opens in its place.
   */
  it("shows a Canvas given itself on its own, and opens its Manifest at it", async () => {
    const fetch = mockFetch({ [BOOK]: bookJson });
    const clover = createClover({ request: { fetch } });
    await clover.load({
      "@context": "http://iiif.io/api/presentation/3/context.json",
      ...bookJson.items[1],
      summary: { en: ["The second page."] },
      metadata: [{ label: { en: ["Side"] }, value: { en: ["Verso"] } }],
      partOf: [{ id: BOOK, type: "Manifest" }],
    });
    const lone = clover.store.get().manifest as Record<string, any>;
    expect(lone.id).toBe(canvasIds[1]);
    expect(lone.summary).toEqual({ en: ["The second page."] });
    expect(lone.metadata).toHaveLength(1);
    expect(lone.partOf).toEqual([{ id: BOOK, type: "Manifest" }]);
    // Nothing of the Manifest until it is asked for.
    expect(fetch).not.toHaveBeenCalled();
    await clover.goToManifest(BOOK, canvasIds[1]);
    const { manifest, canvasId } = clover.store.get();
    expect(manifest?.id).toBe(BOOK);
    expect(canvasId).toBe(canvasIds[1]);
  });

  it("reports an error, and a later load replaces an earlier one", async () => {
    const fetch = mockFetch({ [BOOK]: bookJson });
    const clover = createClover({ request: { fetch } });
    await clover.load("https://example.org/missing");
    expect(clover.store.get().status).toBe("error");

    const first = clover.load("https://example.org/missing");
    const second = clover.load(BOOK);
    await Promise.all([first, second]);
    expect(clover.store.get().status).toBe("ready");
  });
});

describe("createClover: navigation", () => {
  it("steps by view: spreads of a paged book, no wrap", async () => {
    const clover = createClover();
    await clover.load(bookJson);
    const { views } = selectSequence(clover.store.get().manifest);
    expect(views.length).toBeLessThan(canvasIds.length);

    clover.previous();
    expect(clover.store.get().canvasId).toBe(canvasIds[0]);
    clover.next();
    expect(clover.store.get().canvasId).toBe(canvasIds[1]);
    const shown = selectVisibleCanvases(
      clover.store.get().manifest,
      clover.store.get().canvasId,
    );
    expect(shown.map((canvas) => canvas.id)).toEqual(canvasIds.slice(1, 3));

    clover.last();
    clover.next();
    expect(clover.store.get().canvasId).toBe(
      canvasIds[views[views.length - 1][0]],
    );
    clover.next({ wrap: true });
    expect(clover.store.get().canvasId).toBe(canvasIds[0]);
  });

  it("returns the same visible array while nothing changes", async () => {
    const clover = createClover();
    await clover.load(bookJson);
    const { manifest, canvasId } = clover.store.get();
    expect(selectVisibleCanvases(manifest, canvasId)).toBe(
      selectVisibleCanvases(manifest, canvasId),
    );
  });

  it("asks a controlled host instead of moving", async () => {
    const onCanvasChange = vi.fn();
    const clover = createClover({ onCanvasChange, isControlled: () => true });
    await clover.load(bookJson, { canvasId: canvasIds[0] });
    onCanvasChange.mockClear();
    clover.next();
    expect(onCanvasChange).toHaveBeenCalledWith(canvasIds[1]);
    expect(clover.store.get().canvasId).toBe(canvasIds[0]);
    clover.syncCanvas(canvasIds[1]);
    expect(clover.store.get().canvasId).toBe(canvasIds[1]);
  });

  it("lets the host's canvasId win over a default", async () => {
    const clover = createClover();
    await clover.load(bookJson, {
      canvasId: canvasIds[3],
      defaultCanvasId: canvasIds[1],
    });
    expect(clover.store.get().canvasId).toBe(canvasIds[3]);
  });
});

describe("createClover: referenced annotation pages", () => {
  it("embeds a shown Canvas's referenced page, replacing only its path", async () => {
    const pageId = "https://example.org/pages/1";
    const manifest = {
      ...bookJson,
      items: bookJson.items.map((canvas, index) =>
        index === 0
          ? { ...canvas, annotations: [{ id: pageId, type: "AnnotationPage" }] }
          : canvas,
      ),
    };
    const fetch = mockFetch({
      [pageId]: {
        "@context": "http://iiif.io/api/presentation/3/context.json",
        id: pageId,
        type: "AnnotationPage",
        items: [
          {
            id: `${pageId}/a`,
            type: "Annotation",
            motivation: "commenting",
            body: { type: "TextualBody", value: "Hello" },
            target: `${canvasIds[0]}#xywh=1,2,3,4`,
          },
        ],
      },
    });
    const clover = createClover({ request: { fetch } });
    await clover.load(manifest);
    const before = clover.store.get().manifest!;
    await vi.waitFor(() =>
      expect(clover.store.get().manifest).not.toBe(before),
    );
    const after = clover.store.get().manifest! as any;
    const page = after.items[0].annotations[0];
    expect(page.items[0].motivation).toEqual(["commenting"]);
    expect(after.items[1]).toBe((before as any).items[1]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("createClover: Collections", () => {
  const LETTER = "https://example.org/letter";
  const letter = {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: LETTER,
    type: "Manifest",
    label: { none: ["Letter"] },
    items: [
      {
        id: `${LETTER}/canvas/1`,
        type: "Canvas",
        width: 100,
        height: 100,
        items: [],
      },
    ],
  };
  const member = (id: string, type = "Manifest") => ({
    id,
    type,
    label: { none: [id] },
  });
  const shelf = (items: unknown[]) => ({
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: "https://example.org/shelf",
    type: "Collection",
    label: { none: ["Shelf"] },
    items,
  });

  it("gathers a paged Collection's members from first through next", async () => {
    const fetch = mockFetch({
      "https://example.org/shelf/page/2": {
        id: "https://example.org/shelf/page/2",
        type: "CollectionPage",
        items: [member(LETTER)],
      },
      [BOOK]: bookJson,
    });
    const clover = createClover({ request: { fetch } });
    await clover.load({
      ...shelf([]),
      items: undefined,
      first: {
        id: "https://example.org/shelf/page/1",
        type: "CollectionPage",
        items: [member(BOOK)],
        next: "https://example.org/shelf/page/2",
      },
    });
    const { collection, manifest } = clover.store.get();
    expect(collection?.items?.map((item: any) => item.id)).toEqual([
      BOOK,
      LETTER,
    ]);
    expect(manifest?.id).toBe(BOOK);
  });

  it("follows a paged Collection's pages once, though a next leads back", async () => {
    const fetch = mockFetch({
      "https://example.org/shelf/page/2": {
        id: "https://example.org/shelf/page/2",
        type: "CollectionPage",
        items: [member(LETTER)],
        next: "https://example.org/shelf/page/1",
      },
      "https://example.org/shelf/page/1": {
        id: "https://example.org/shelf/page/1",
        type: "CollectionPage",
        items: [member(BOOK)],
        next: "https://example.org/shelf/page/2",
      },
      [BOOK]: bookJson,
    });
    const clover = createClover({ request: { fetch } });
    await clover.load({
      ...shelf([]),
      items: undefined,
      first: "https://example.org/shelf/page/1",
    });
    expect(
      clover.store.get().collection?.items?.map((item: any) => item.id),
    ).toEqual([BOOK, LETTER]);
  });

  it("opens the member a host names, without fetching the first", async () => {
    const fetch = mockFetch({ [BOOK]: bookJson, [LETTER]: letter });
    const clover = createClover({ request: { fetch } });
    await clover.load(shelf([member(BOOK), member(LETTER)]), {
      manifestId: LETTER,
    });
    expect(clover.store.get().manifest?.id).toBe(LETTER);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("opens the member a content state names, among its Collection's members", async () => {
    const SHELF = "https://example.org/shelf";
    const fetch = mockFetch({
      [SHELF]: shelf([member(BOOK), member(LETTER)]),
      [BOOK]: bookJson,
      [LETTER]: letter,
    });
    const clover = createClover({ request: { fetch } });
    await clover.load(
      encode({
        type: "Annotation",
        motivation: ["contentState"],
        target: {
          id: LETTER,
          type: "Manifest",
          partOf: [{ id: SHELF, type: "Collection" }],
        },
      }),
    );
    const { manifest, collection } = clover.store.get();
    expect(collection?.id).toBe(SHELF);
    expect(manifest?.id).toBe(LETTER);
    // The Collection, then the member it names: never its first.
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([SHELF, LETTER]);
  });

  it("goes to a Canvas of a Collection's member, the Collection kept", async () => {
    const SHELF = "https://example.org/shelf";
    const fetch = mockFetch({
      [SHELF]: shelf([member(LETTER), member(BOOK)]),
      [BOOK]: bookJson,
    });
    const clover = createClover({ request: { fetch } });
    await clover.load(
      encode({
        type: "Annotation",
        motivation: ["contentState"],
        target: {
          id: canvasIds[1],
          type: "Canvas",
          partOf: [
            {
              id: BOOK,
              type: "Manifest",
              partOf: [{ id: SHELF, type: "Collection" }],
            },
          ],
        },
      }),
    );
    const { manifest, collection, canvasId } = clover.store.get();
    expect(collection?.id).toBe(SHELF);
    expect(manifest?.id).toBe(BOOK);
    expect(canvasId).toBe(canvasIds[1]);
  });

  it("opens a Collection the Manifest is part of, keeping the Manifest and its place", async () => {
    const SHELF = "https://example.org/shelf";
    const fetch = mockFetch({
      [SHELF]: shelf([member(LETTER), member(BOOK)]),
      [BOOK]: bookJson,
    });
    const clover = createClover({ request: { fetch } });
    await clover.load(BOOK);
    clover.goTo(canvasIds[2]);
    const manifest = clover.store.get().manifest;
    await clover.openCollection(SHELF);
    const state = clover.store.get();
    expect(state.collection?.id).toBe(SHELF);
    expect(state.manifest).toBe(manifest);
    expect(state.canvasId).toBe(canvasIds[2]);
    // The Collection alone was fetched: the Manifest was not loaded again.
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([BOOK, SHELF]);

    // One that will not load changes nothing.
    await clover.openCollection("https://example.org/missing");
    expect(clover.store.get().collection?.id).toBe(SHELF);
  });

  it("goes to another member, keeping the Collection and reporting it", async () => {
    const fetch = mockFetch({ [BOOK]: bookJson, [LETTER]: letter });
    const onManifestChange = vi.fn();
    const onCanvasChange = vi.fn();
    const clover = createClover({
      request: { fetch },
      onManifestChange,
      onCanvasChange,
    });
    await clover.load(shelf([member(BOOK), member(LETTER)]));
    await clover.goToManifest(LETTER);
    const { manifest, collection, canvasId, status } = clover.store.get();
    expect(status).toBe("ready");
    expect(manifest?.id).toBe(LETTER);
    expect(collection?.id).toBe("https://example.org/shelf");
    expect(canvasId).toBe(`${LETTER}/canvas/1`);
    expect(onManifestChange).toHaveBeenCalledWith(LETTER);
    expect(onCanvasChange).toHaveBeenLastCalledWith(`${LETTER}/canvas/1`);

    await clover.goToManifest(LETTER);
    expect(onManifestChange).toHaveBeenCalledTimes(1);
  });

  it("enters a nested Collection, showing its first Manifest", async () => {
    const NESTED = "https://example.org/drawer";
    const fetch = mockFetch({
      [BOOK]: bookJson,
      [LETTER]: letter,
      [NESTED]: { ...shelf([member(LETTER)]), id: NESTED },
    });
    const onManifestChange = vi.fn();
    const clover = createClover({ request: { fetch }, onManifestChange });
    await clover.load(shelf([member(BOOK), member(NESTED, "Collection")]));
    await clover.goToManifest(NESTED);
    const { manifest, collection } = clover.store.get();
    expect(collection?.id).toBe(NESTED);
    expect(manifest?.id).toBe(LETTER);
    expect(onManifestChange).toHaveBeenCalledWith(LETTER);
  });

  it("asks a controlled host, and moves only when it hands the id back", async () => {
    const fetch = mockFetch({ [BOOK]: bookJson, [LETTER]: letter });
    const onManifestChange = vi.fn();
    const clover = createClover({
      request: { fetch },
      onManifestChange,
      isManifestControlled: () => true,
    });
    await clover.load(shelf([member(BOOK), member(LETTER)]));
    await clover.goToManifest(LETTER);
    expect(onManifestChange).toHaveBeenCalledWith(LETTER);
    expect(clover.store.get().manifest?.id).toBe(BOOK);

    await clover.syncManifest(LETTER);
    expect(clover.store.get().manifest?.id).toBe(LETTER);
    expect(onManifestChange).toHaveBeenCalledTimes(1);
  });
});

/*
 * Annotations as the content (an AnnotationPage, or an AnnotationCollection of pages),
 * made apart from any Manifest, as 3.x took them: each names its Canvas's Manifest
 * (`partOf`), and Clover opens the first's, there, that annotation picked.
 */
describe("createClover: annotations as the content", () => {
  const OTHER = "https://example.org/other";
  const other = {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: OTHER,
    type: "Manifest",
    label: { none: ["Other"] },
    items: [
      {
        id: `${OTHER}/canvas/1`,
        type: "Canvas",
        width: 100,
        height: 100,
        items: [],
      },
    ],
  };
  const tag = (id: string, canvas: string, manifest: string) => ({
    id,
    type: "Annotation",
    motivation: "tagging",
    body: { type: "TextualBody", value: id, format: "text/plain" },
    target: {
      type: "SpecificResource",
      source: {
        id: canvas,
        type: "Canvas",
        partOf: [{ id: manifest, type: "Manifest" }],
      },
      selector: { type: "FragmentSelector", value: "xywh=1,2,3,4" },
    },
  });
  const PAGE = "https://example.org/annotations/page";
  const page = {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: PAGE,
    type: "AnnotationPage",
    label: { en: ["Tags"] },
    items: [
      tag("https://example.org/tag/1", canvasIds[1], BOOK),
      tag("https://example.org/tag/2", `${OTHER}/canvas/1`, OTHER),
    ],
  };

  it("opens the Manifest the first annotation names, at its Canvas, picked", async () => {
    const fetch = mockFetch({ [PAGE]: page, [BOOK]: bookJson, [OTHER]: other });
    const clover = createClover({ request: { fetch } });
    await clover.load(PAGE);
    const { manifest, canvasId, annotationId, addedSets } = clover.store.get();
    expect(manifest?.id).toBe(BOOK);
    expect(canvasId).toBe(canvasIds[1]);
    expect(annotationId).toBe("https://example.org/tag/1");
    expect(addedSets.flatMap((set) => set.entries).map((e) => e.id)).toEqual([
      "https://example.org/tag/1",
      "https://example.org/tag/2",
    ]);
    // Only what it needs: the page and the one Manifest, not the other.
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([PAGE, BOOK]);
  });

  it("reads an AnnotationCollection's pages, from first through next", async () => {
    const COLLECTION = "https://example.org/annotations/collection";
    const second = `${PAGE}/2`;
    const fetch = mockFetch({
      [COLLECTION]: {
        "@context": "http://iiif.io/api/presentation/3/context.json",
        id: COLLECTION,
        type: "AnnotationCollection",
        first: PAGE,
      },
      [PAGE]: { ...page, items: [page.items[0]], next: second },
      [second]: { ...page, id: second, items: [page.items[1]] },
      [BOOK]: bookJson,
    });
    const clover = createClover({ request: { fetch } });
    await clover.load(COLLECTION);
    const { manifest, addedSets } = clover.store.get();
    expect(manifest?.id).toBe(BOOK);
    expect(addedSets.map((set) => set.id)).toEqual([PAGE, second]);
  });

  it("opens another Manifest they name, there, when one on it is picked, keeping them", async () => {
    const fetch = mockFetch({ [PAGE]: page, [BOOK]: bookJson, [OTHER]: other });
    const onManifestChange = vi.fn();
    const clover = createClover({ request: { fetch }, onManifestChange });
    // As an object, not only by URL.
    await clover.load(page);
    clover.selectAnnotation("https://example.org/tag/2");
    await vi.waitFor(() => expect(clover.store.get().manifest?.id).toBe(OTHER));
    const { canvasId, annotationId, addedSets } = clover.store.get();
    expect(canvasId).toBe(`${OTHER}/canvas/1`);
    expect(annotationId).toBe("https://example.org/tag/2");
    expect(addedSets.flatMap((set) => set.entries)).toHaveLength(2);
    expect(onManifestChange).toHaveBeenLastCalledWith(OTHER);
  });

  it("says so when they name no Manifest", async () => {
    const lone = {
      ...page,
      items: [{ ...page.items[0], target: canvasIds[0] }],
    };
    const clover = createClover({ request: { fetch: mockFetch({}) } });
    await clover.load(lone);
    expect(clover.store.get().status).toBe("error");
  });
});

// Cookbook 0540: one content state naming two Canvases, each from its own Manifest.
describe("createClover: a content state's several targets", () => {
  const [colosseum, monuments] = compareJson.target;
  const table = {
    [colosseum.partOf[0].id]: colosseumJson,
    [monuments.partOf[0].id]: monumentsJson,
  };
  const current = (clover: ReturnType<typeof createClover>) => {
    const { targets, targetIndex, manifest, canvasId } = clover.store.get();
    return selectTargetIndex(targets, targetIndex, manifest, canvasId);
  };

  it("opens on the first, holding them all, each to be gone to in turn", async () => {
    const onManifestChange = vi.fn();
    const clover = createClover({
      request: { fetch: mockFetch(table) },
      onManifestChange,
    });
    await clover.load(encode(compareJson));
    const { targets, manifest, canvasId } = clover.store.get();
    expect(targets?.items.map((target) => target.canvasId)).toEqual([
      colosseum.id,
      monuments.id,
    ]);
    expect(manifest?.id).toBe(colosseumJson.id);
    expect(canvasId).toBe(colosseum.id);
    // Current, though the Manifest's own id is not the address it was named by.
    expect(current(clover)).toBe(0);

    clover.goToTarget(1);
    await vi.waitFor(() =>
      expect(clover.store.get().manifest?.id).toBe(monumentsJson.id),
    );
    // At its Canvas, the second of its two, not its first.
    expect(clover.store.get().canvasId).toBe(monuments.id);
    expect(current(clover)).toBe(1);
    expect(onManifestChange).toHaveBeenLastCalledWith(monuments.partOf[0].id);
    // The set holds through the move.
    expect(clover.store.get().targets?.items).toHaveLength(2);

    clover.goToTarget(0);
    await vi.waitFor(() => expect(current(clover)).toBe(0));
    expect(clover.store.get().canvasId).toBe(colosseum.id);
  });

  it("holds no set for one target, nor for other content", async () => {
    const clover = createClover({ request: { fetch: mockFetch(table) } });
    await clover.load(encode({ ...compareJson, target: [colosseum] }));
    expect(clover.store.get().targets).toBeNull();
    await clover.load(colosseum.partOf[0].id);
    expect(clover.store.get().targets).toBeNull();
  });

  it("names none current where the reader moves to a view none names", async () => {
    const clover = createClover({ request: { fetch: mockFetch(table) } });
    await clover.load(encode(compareJson));
    clover.goToTarget(1);
    await vi.waitFor(() => expect(current(clover)).toBe(1));
    // The Manifest's other Canvas, the Temple of Vesta, is not a target.
    clover.goTo(selectSequence(clover.store.get().manifest).canvases[0].id);
    expect(current(clover)).toBe(-1);
  });
});
