import { isImageService, isImageServiceManifest, loadContent } from "./load";
import { searchServiceOf } from "./search-service";

/*
 * JSON-LD lets a resource list several contexts: its own API's, and those of the APIs and
 * extensions it uses (#423). Clover tells content apart by its type and contexts
 * together, so a context it lists never makes it what it is not: a Manifest that lists
 * the Image API's context is still a Manifest, and an `info.json` that lists an
 * extension's is still an image service.
 */

const P2 = "http://iiif.io/api/presentation/2/context.json";
const P3 = "http://iiif.io/api/presentation/3/context.json";
const P4 = "http://iiif.io/api/presentation/4/context.json";
const IMAGE_2 = "http://iiif.io/api/image/2/context.json";
const IMAGE_3 = "http://iiif.io/api/image/3/context.json";
const SEARCH_1 = "http://iiif.io/api/search/1/context.json";
const SEARCH_2 = "http://iiif.io/api/search/2/context.json";
const ANNO = "http://www.w3.org/ns/anno.jsonld";
const NAVPLACE = "http://iiif.io/api/extension/navplace/context.json";
const GEOREF = "http://iiif.io/api/extension/georef/1/context.json";
const EXTENSION = "https://example.org/extension/context.json";

const MANIFEST = "https://example.org/iiif/book/manifest";
const CANVAS = "https://example.org/iiif/book/canvas/1";
const SERVICE = "https://example.org/iiif/image/page-1";

/** A Manifest of one Canvas, painted by an image with an Image 2 service. */
const presentation3 = (context: unknown) => ({
  "@context": context,
  id: MANIFEST,
  type: "Manifest",
  label: { en: ["A book"] },
  items: [
    {
      id: CANVAS,
      type: "Canvas",
      width: 1000,
      height: 800,
      items: [
        {
          id: `${CANVAS}/page`,
          type: "AnnotationPage",
          items: [
            {
              id: `${CANVAS}/page/image`,
              type: "Annotation",
              motivation: "painting",
              target: CANVAS,
              body: {
                id: `${SERVICE}/full/max/0/default.jpg`,
                type: "Image",
                format: "image/jpeg",
                width: 1000,
                height: 800,
                service: [
                  {
                    "@id": SERVICE,
                    "@type": "ImageService2",
                    profile: "http://iiif.io/api/image/2/level2.json",
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
});

/** The same Manifest as Presentation 2 writes it. */
const presentation2 = (context: unknown) => ({
  "@context": context,
  "@id": MANIFEST,
  "@type": "sc:Manifest",
  label: "A book",
  sequences: [
    {
      "@type": "sc:Sequence",
      canvases: [
        {
          "@id": CANVAS,
          "@type": "sc:Canvas",
          label: "1",
          width: 1000,
          height: 800,
          images: [
            {
              "@type": "oa:Annotation",
              motivation: "sc:painting",
              on: CANVAS,
              resource: {
                "@id": `${SERVICE}/full/full/0/default.jpg`,
                "@type": "dctypes:Image",
                format: "image/jpeg",
                width: 1000,
                height: 800,
                service: {
                  "@context": IMAGE_2,
                  "@id": SERVICE,
                  profile: "http://iiif.io/api/image/2/level2.json",
                },
              },
            },
          ],
        },
      ],
    },
  ],
});

/** A fetch answering from a table of URLs. */
function mockFetch(table: Record<string, unknown>) {
  return vi.fn(async (url: string) =>
    table[url] === undefined
      ? new Response("missing", { status: 404 })
      : new Response(JSON.stringify(table[url]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
  );
}

const open = (url: string, json: unknown) =>
  loadContent(url, { request: { fetch: mockFetch({ [url]: json }) } });

/** The image service the Manifest's Canvas is painted by, as Presentation 4 has it. */
const paintedService = (manifest: any) => {
  const service = manifest.items[0].items[0].items[0].body.service[0];
  return service.id ?? service["@id"];
};

describe("a Presentation resource whose contexts list other APIs", () => {
  it.each([
    ["Presentation 3, then Image 2 (#423)", presentation3([P3, IMAGE_2])],
    ["Image 2, then Presentation 3", presentation3([IMAGE_2, P3])],
    ["Presentation 3, then Image 3", presentation3([P3, IMAGE_3])],
    ["Web Annotation, then Presentation 3", presentation3([ANNO, P3])],
    ["navPlace, then Presentation 3", presentation3([NAVPLACE, P3])],
    ["Georeference, then Presentation 3", presentation3([GEOREF, P3])],
    ["Presentation 3, then Search 2", presentation3([P3, SEARCH_2])],
    ["navPlace, then Presentation 4", presentation3([NAVPLACE, P4])],
    ["Presentation 2, then Image 2", presentation2([P2, IMAGE_2])],
    ["Image 2, then Presentation 2", presentation2([IMAGE_2, P2])],
    ["Search 1, then Presentation 2", presentation2([SEARCH_1, P2])],
  ])("opens as the Manifest it is: %s", async (_, json) => {
    expect(isImageService(json)).toBe(false);
    const { manifest } = await open(MANIFEST, json);
    expect(manifest).toMatchObject({ id: MANIFEST, type: "Manifest" });
    expect((manifest.items as { id: string }[]).map(({ id }) => id)).toEqual([
      CANVAS,
    ]);
    expect(paintedService(manifest)).toBe(SERVICE);
    expect(isImageServiceManifest(manifest)).toBe(false);
  });
});

describe("an info.json whose contexts list an extension's", () => {
  it.each([
    [
      "an extension's, then Image 3",
      {
        "@context": [EXTENSION, IMAGE_3],
        id: SERVICE,
        type: "ImageService3",
        protocol: "http://iiif.io/api/image",
        profile: "level1",
        width: 1000,
        height: 800,
      },
    ],
    [
      "an extension's, then Image 2",
      {
        "@context": [EXTENSION, IMAGE_2],
        "@id": SERVICE,
        protocol: "http://iiif.io/api/image",
        profile: ["http://iiif.io/api/image/2/level1.json"],
        width: 1000,
        height: 800,
      },
    ],
  ])("opens as an image service: %s", async (_, info) => {
    expect(isImageService(info)).toBe(true);
    const { manifest } = await open(SERVICE, info);
    expect(manifest.id).toBe(SERVICE);
    expect(manifest.items?.[0]).toMatchObject({ width: 1000, height: 800 });
    expect(paintedService(manifest)).toBe(SERVICE);
    expect(isImageServiceManifest(manifest)).toBe(true);
  });
});

describe("a Manifest that lists Content Search's context with its own", () => {
  const AUTOCOMPLETE = `${MANIFEST}/autocomplete`;
  const SEARCH = `${MANIFEST}/search`;

  it("finds its search service, never its autocomplete, in Presentation 2", async () => {
    const { manifest } = await open(MANIFEST, {
      ...presentation2([P2, SEARCH_1]),
      service: [
        {
          "@context": SEARCH_1,
          "@id": AUTOCOMPLETE,
          profile: "http://iiif.io/api/search/1/autocomplete",
        },
        {
          "@context": SEARCH_1,
          "@id": SEARCH,
          profile: "http://iiif.io/api/search/1/search",
        },
      ],
    });
    expect(searchServiceOf(manifest)).toEqual({ id: SEARCH, version: 1 });
  });

  it("finds its search service, never its autocomplete, in Presentation 3", async () => {
    const { manifest } = await open(MANIFEST, {
      ...presentation3([P3, SEARCH_2]),
      service: [
        {
          "@context": SEARCH_2,
          id: AUTOCOMPLETE,
          type: "AutoCompleteService2",
        },
        { "@context": SEARCH_2, id: SEARCH, type: "SearchService2" },
      ],
    });
    expect(searchServiceOf(manifest)).toEqual({ id: SEARCH, version: 2 });
  });
});
