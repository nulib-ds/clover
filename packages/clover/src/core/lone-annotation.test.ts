import { createClover } from "./clover";

/*
 * A single Annotation given as the content, of any motivation, read as a content state
 * is: what it targets opens, at its region and time, and its body, where it has one, is
 * shown there as a note, picked on arrival.
 */

const P3 = "http://iiif.io/api/presentation/3/context.json";
const MANIFEST = "https://example.org/book/manifest";
const PAGE_1 = "https://example.org/book/canvas/1";
const PAGE_2 = "https://example.org/book/canvas/2";
const FILM = "https://example.org/film/manifest";
const REEL = "https://example.org/film/canvas/1";
const COLLECTION = "https://example.org/shelf";
const SERVICE = "https://example.org/iiif/3/plate";

const image = (canvas: string) => ({
  id: `${canvas}/page`,
  type: "AnnotationPage",
  items: [
    {
      id: `${canvas}/painting`,
      type: "Annotation",
      motivation: "painting",
      target: canvas,
      body: {
        id: `${canvas}/full.jpg`,
        type: "Image",
        format: "image/jpeg",
        width: 1000,
        height: 800,
      },
    },
  ],
});

const book = {
  "@context": P3,
  id: MANIFEST,
  type: "Manifest",
  label: { en: ["Book"] },
  items: [PAGE_1, PAGE_2].map((id) => ({
    id,
    type: "Canvas",
    width: 1000,
    height: 800,
    items: [image(id)],
  })),
  structures: [
    {
      id: "https://example.org/book/range/plates",
      type: "Range",
      label: { en: ["Plates"] },
      items: [
        {
          id: "https://example.org/book/range/plate-2",
          type: "Range",
          items: [{ id: `${PAGE_2}#xywh=100,100,200,200`, type: "Canvas" }],
        },
      ],
    },
  ],
};

const film = {
  "@context": P3,
  id: FILM,
  type: "Manifest",
  label: { en: ["Film"] },
  items: [
    {
      id: REEL,
      type: "Canvas",
      width: 640,
      height: 480,
      duration: 120,
      items: [
        {
          id: `${REEL}/page`,
          type: "AnnotationPage",
          items: [
            {
              id: `${REEL}/painting`,
              type: "Annotation",
              motivation: "painting",
              target: REEL,
              body: {
                id: "https://example.org/film/reel.mp4",
                type: "Video",
                format: "video/mp4",
                width: 640,
                height: 480,
                duration: 120,
              },
            },
          ],
        },
      ],
    },
  ],
};

const shelf = {
  "@context": P3,
  id: COLLECTION,
  type: "Collection",
  label: { en: ["Shelf"] },
  items: [{ id: MANIFEST, type: "Manifest", label: { en: ["Book"] } }],
};

const info = {
  "@context": "http://iiif.io/api/image/3/context.json",
  id: SERVICE,
  type: "ImageService3",
  protocol: "http://iiif.io/api/image",
  profile: "level1",
  width: 2000,
  height: 1500,
};

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

const fetch = () =>
  mockFetch({
    [MANIFEST]: book,
    [FILM]: film,
    [COLLECTION]: shelf,
    [`${SERVICE}/info.json`]: info,
    // A Canvas that answers at its own address, naming no Manifest.
    [PAGE_1]: { "@context": P3, ...book.items[0] },
  });

/** The Canvas in the Manifest, as a SpecificResource's source would name it. */
const inBook = (id: string) => ({
  id,
  type: "Canvas",
  partOf: [{ id: MANIFEST, type: "Manifest" }],
});

async function open(annotation: Record<string, unknown>) {
  const clover = createClover({ request: { fetch: fetch() } });
  await clover.load({ "@context": P3, ...annotation });
  return clover.store.get();
}

const note = { type: "TextualBody", value: "A plate", format: "text/plain" };

describe("a single Annotation as the content", () => {
  it("opens its Canvas at a region, with no body to show", async () => {
    const state = await open({
      id: "https://example.org/a/region",
      type: "Annotation",
      motivation: "highlighting",
      target: {
        type: "SpecificResource",
        source: inBook(PAGE_2),
        selector: { type: "FragmentSelector", value: "xywh=10,20,30,40" },
      },
    });
    expect(state.status).toBe("ready");
    expect(state.manifest?.id).toBe(MANIFEST);
    expect(state.canvasId).toBe(PAGE_2);
    expect(state.target).toEqual({
      canvasId: PAGE_2,
      region: { x: 10, y: 20, w: 30, h: 40 },
    });
    // Nothing to read, so no note: the region is gone to, as a content state's is.
    expect(state.addedSets).toEqual([]);
    expect(state.annotationId).toBeNull();
  });

  it("opens a whole Canvas it targets", async () => {
    const state = await open({
      id: "https://example.org/a/canvas",
      type: "Annotation",
      motivation: "commenting",
      body: note,
      target: inBook(PAGE_2),
    });
    expect(state.canvasId).toBe(PAGE_2);
    expect(state.annotationId).toBe("https://example.org/a/canvas");
    expect(state.addedSets[0].entries).toMatchObject([
      {
        canvasId: PAGE_2,
        motivation: ["commenting"],
        bodies: [expect.objectContaining({ value: "A plate" })],
      },
    ]);
    expect(state.addedSets[0].entries[0].target.rect).toBeUndefined();
  });

  it("shows its text body on its region, picked, so the pick frames it", async () => {
    const state = await open({
      id: "https://example.org/a/note",
      type: "Annotation",
      motivation: ["commenting"],
      body: note,
      target: {
        type: "SpecificResource",
        source: inBook(PAGE_2),
        selector: { type: "FragmentSelector", value: "xywh=10,20,30,40" },
      },
    });
    expect(state.canvasId).toBe(PAGE_2);
    expect(state.annotationId).toBe("https://example.org/a/note");
    expect(state.target).toEqual({ canvasId: PAGE_2 });
    expect(state.addedSets[0].entries).toMatchObject([
      { target: { rect: { x: 10, y: 20, w: 30, h: 40 } } },
    ]);
  });

  it("reads a region in its target's own fragment", async () => {
    const state = await open({
      id: "https://example.org/a/fragment",
      type: "Annotation",
      motivation: "tagging",
      body: { type: "TextualBody", value: "bicycle" },
      target: { ...inBook(PAGE_2), id: `${PAGE_2}#xywh=5,6,7,8` },
    });
    expect(state.canvasId).toBe(PAGE_2);
    expect(state.addedSets[0].entries).toMatchObject([
      { motivation: ["tagging"], target: { rect: { x: 5, y: 6, w: 7, h: 8 } } },
    ]);
  });

  it("fetches a Canvas named by its address alone, and shows it at the region", async () => {
    const state = await open({
      id: "https://example.org/a/bare",
      type: "Annotation",
      motivation: "commenting",
      target: `${PAGE_1}#xywh=1,2,3,4`,
    });
    expect(state.status).toBe("ready");
    expect(state.canvasId).toBe(PAGE_1);
    expect(state.target?.region).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });

  it("starts at its time", async () => {
    const state = await open({
      id: "https://example.org/a/time",
      type: "Annotation",
      motivation: "commenting",
      target: {
        id: `${REEL}#t=30,45`,
        type: "Canvas",
        partOf: [{ id: FILM, type: "Manifest" }],
      },
    });
    expect(state.manifest?.id).toBe(FILM);
    expect(state.target).toEqual({ canvasId: REEL, time: 30 });
  });

  it("starts at its time on its region, with its note", async () => {
    const state = await open({
      id: "https://example.org/a/both",
      type: "Annotation",
      motivation: "commenting",
      body: { type: "TextualBody", value: "The driver" },
      target: {
        type: "SpecificResource",
        source: { id: REEL, type: "Canvas", partOf: [{ id: FILM }] },
        selector: {
          type: "FragmentSelector",
          value: "xywh=100,50,200,150&t=12.5,20",
        },
      },
    });
    expect(state.canvasId).toBe(REEL);
    expect(state.target).toMatchObject({ canvasId: REEL, time: 12.5 });
    expect(state.annotationId).toBe("https://example.org/a/both");
    expect(state.addedSets[0].entries[0].target).toMatchObject({
      rect: { x: 100, y: 50, w: 200, h: 150 },
      t: "12.5,20",
    });
  });

  it("starts at a PointSelector's time", async () => {
    const state = await open({
      id: "https://example.org/a/point",
      type: "Annotation",
      motivation: "commenting",
      target: {
        type: "SpecificResource",
        source: { id: REEL, type: "Canvas", partOf: [{ id: FILM }] },
        selector: { type: "PointSelector", t: 64 },
      },
    });
    expect(state.target).toEqual({ canvasId: REEL, time: 64 });
  });

  it("goes to the box an SvgSelector's shape fills", async () => {
    const state = await open({
      id: "https://example.org/a/svg",
      type: "Annotation",
      motivation: "highlighting",
      target: {
        type: "SpecificResource",
        source: inBook(PAGE_1),
        selector: {
          type: "SvgSelector",
          value:
            "<svg xmlns='http://www.w3.org/2000/svg'><polygon points='10,10 110,10 110,60 10,60'/></svg>",
        },
      },
    });
    expect(state.target).toEqual({
      canvasId: PAGE_1,
      region: { x: 10, y: 10, w: 100, h: 50 },
    });
  });

  it("shows an image body", async () => {
    const state = await open({
      id: "https://example.org/a/image",
      type: "Annotation",
      motivation: "commenting",
      label: { en: ["The plate, restored"] },
      body: {
        id: "https://example.org/restored.jpg",
        type: "Image",
        format: "image/jpeg",
      },
      target: `${PAGE_1}#xywh=0,0,500,400`,
    });
    expect(state.canvasId).toBe(PAGE_1);
    expect(state.addedSets[0].entries[0].bodies).toEqual([
      expect.objectContaining({
        image: "https://example.org/restored.jpg",
        label: { en: ["The plate, restored"] },
      }),
    ]);
  });

  it("shows a painting annotation given alone as an annotation, not a picture", async () => {
    const state = await open({
      id: "https://example.org/a/paint",
      type: "Annotation",
      motivation: "painting",
      body: { id: "https://example.org/inset.jpg", type: "Image" },
      target: {
        type: "SpecificResource",
        source: inBook(PAGE_2),
        selector: { type: "FragmentSelector", value: "xywh=0,0,100,100" },
      },
    });
    expect(state.canvasId).toBe(PAGE_2);
    expect(state.annotationId).toBe("https://example.org/a/paint");
    expect(state.addedSets[0].entries[0]).toMatchObject({
      motivation: [],
      bodies: [{ image: "https://example.org/inset.jpg" }],
    });
    // The Canvas paints what it painted before.
    expect(
      (state.manifest as any).items[1].items[0].items.map((a: any) => a.id),
    ).toEqual([`${PAGE_2}/painting`]);
  });

  it("keeps a link to another resource, to follow", async () => {
    const state = await open({
      id: "https://example.org/a/link",
      type: "Annotation",
      motivation: "linking",
      body: { id: FILM, type: "Manifest" },
      target: inBook(PAGE_1),
    });
    expect(state.canvasId).toBe(PAGE_1);
    expect(state.addedSets[0].entries).toMatchObject([
      { motivation: ["linking"], bodies: [] },
    ]);
  });

  it("opens a Manifest it targets", async () => {
    const state = await open({
      id: "https://example.org/a/manifest",
      type: "Annotation",
      motivation: "commenting",
      body: note,
      target: { id: FILM, type: "Manifest" },
    });
    expect(state.manifest?.id).toBe(FILM);
    expect(state.canvasId).toBe(REEL);
  });

  it("opens a Collection it targets, at its first Manifest", async () => {
    const state = await open({
      id: "https://example.org/a/collection",
      type: "Annotation",
      motivation: "commenting",
      target: { id: COLLECTION, type: "Collection" },
    });
    expect(state.collection?.id).toBe(COLLECTION);
    expect(state.manifest?.id).toBe(MANIFEST);
  });

  it("opens a Range it targets at its first Canvas, and that Canvas's region", async () => {
    const state = await open({
      id: "https://example.org/a/range",
      type: "Annotation",
      motivation: "commenting",
      target: {
        id: "https://example.org/book/range/plates",
        type: "Range",
        partOf: [{ id: MANIFEST, type: "Manifest" }],
      },
    });
    expect(state.canvasId).toBe(PAGE_2);
    expect(state.target).toEqual({
      canvasId: PAGE_2,
      region: { x: 100, y: 100, w: 200, h: 200 },
    });
  });

  it("puts its note on the Range's first Canvas", async () => {
    const state = await open({
      id: "https://example.org/a/range-note",
      type: "Annotation",
      motivation: "describing",
      body: { type: "TextualBody", value: "The plates" },
      target: {
        id: "https://example.org/book/range/plate-2",
        type: "Range",
        partOf: [{ id: MANIFEST, type: "Manifest" }],
      },
    });
    expect(state.canvasId).toBe(PAGE_2);
    expect(state.annotationId).toBe("https://example.org/a/range-note");
    expect(state.addedSets[0].entries[0].canvasId).toBe(PAGE_2);
  });

  it("opens an image service it targets, at the region", async () => {
    const state = await open({
      id: "https://example.org/a/service",
      type: "Annotation",
      motivation: "commenting",
      body: { type: "TextualBody", value: "Signature" },
      target: {
        type: "SpecificResource",
        source: { id: SERVICE, type: "ImageService3" },
        selector: {
          type: "FragmentSelector",
          value: "xywh=1500,1200,400,200",
        },
      },
    });
    expect(state.status).toBe("ready");
    expect(state.canvasId).toBe(`${SERVICE}/canvas`);
    expect(state.annotationId).toBe("https://example.org/a/service");
    expect(state.addedSets[0].entries[0]).toMatchObject({
      canvasId: `${SERVICE}/canvas`,
      target: { rect: { x: 1500, y: 1200, w: 400, h: 200 } },
    });
  });

  it("holds several targets to go to in turn, as a content state does", async () => {
    const state = await open({
      id: "https://example.org/a/compare",
      type: "Annotation",
      motivation: "commenting",
      target: [
        inBook(PAGE_1),
        { id: REEL, type: "Canvas", partOf: [{ id: FILM }] },
      ],
    });
    expect(state.canvasId).toBe(PAGE_1);
    expect(state.targets?.items).toMatchObject([
      { manifestId: MANIFEST, canvasId: PAGE_1 },
      { manifestId: FILM, canvasId: REEL },
    ]);
  });

  it("reads one encoded as a content state is", async () => {
    const clover = createClover({ request: { fetch: fetch() } });
    const json = {
      id: "https://example.org/a/encoded",
      type: "Annotation",
      motivation: "commenting",
      body: note,
      target: `${PAGE_1}#xywh=1,2,3,4`,
    };
    await clover.load(
      btoa(encodeURIComponent(JSON.stringify(json)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, ""),
    );
    expect(clover.store.get().annotationId).toBe(json.id);
  });

  it("reads Presentation 2's, as Mirador 2 wrote them, within their Manifest", async () => {
    const clover = createClover({ request: { fetch: fetch() } });
    await clover.load({
      "@context": "http://iiif.io/api/presentation/2/context.json",
      "@id": "https://example.org/a/mirador",
      "@type": "oa:Annotation",
      motivation: ["oa:commenting"],
      resource: [
        { "@type": "dctypes:Text", format: "text/html", chars: "<p>Hi</p>" },
      ],
      on: [
        {
          "@type": "oa:SpecificResource",
          full: PAGE_2,
          selector: {
            "@type": "oa:Choice",
            default: {
              "@type": "oa:FragmentSelector",
              value: "xywh=10,20,30,40",
            },
            item: { "@type": "oa:SvgSelector", value: "<svg/>" },
          },
          within: { "@id": MANIFEST, "@type": "sc:Manifest" },
        },
      ],
    });
    const state = clover.store.get();
    expect(state.status).toBe("ready");
    expect(state.manifest?.id).toBe(MANIFEST);
    expect(state.canvasId).toBe(PAGE_2);
    expect(state.annotationId).toBe("https://example.org/a/mirador");
    expect(state.addedSets[0].entries[0]).toMatchObject({
      motivation: ["commenting"],
      target: { rect: { x: 10, y: 20, w: 30, h: 40 } },
      bodies: [{ value: "<p>Hi</p>", format: "text/html" }],
    });
  });

  it("says so when it targets nothing Clover can open", async () => {
    const state = await open({
      id: "https://example.org/a/nowhere",
      type: "Annotation",
      motivation: "commenting",
      target: "https://example.org/missing/canvas",
    });
    expect(state.status).toBe("error");
  });
});
