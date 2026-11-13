import { parseInfo } from "../lib/renderer/sources/imageService";
import { fittedSize } from "./image-service-content";
import { isImageService, isImageServiceManifest, loadContent } from "./load";

/** The Image 3 service of the example, as its server answers (trimmed). */
const SERVICE = "https://ndeiiif.adlibhosting.com/iiif/3/Q1852477.648";
const INFO_3 = {
  "@context": "http://iiif.io/api/image/3/context.json",
  id: SERVICE,
  type: "ImageService3",
  protocol: "http://iiif.io/api/image",
  profile: "level2",
  width: 1200,
  height: 370,
  maxArea: 444000,
  sizes: [
    { width: 300, height: 93 },
    { width: 600, height: 185 },
    { width: 1200, height: 370 },
  ],
  tiles: [{ width: 512, height: 370, scaleFactors: [1, 2, 4] }],
};

const INFO_2 = {
  "@context": "http://iiif.io/api/image/2/context.json",
  "@id": "https://example.org/iiif/2/abc",
  protocol: "http://iiif.io/api/image",
  width: 4000,
  height: 3000,
  profile: ["http://iiif.io/api/image/2/level0.json", { maxWidth: 1000 }],
  sizes: [
    { width: 250, height: 188 },
    { width: 500, height: 375 },
    { width: 1000, height: 750 },
  ],
  license: "http://rightsstatements.org/vocab/InC/1.0/",
  attribution: [{ "@value": "Example Library", "@language": "en" }],
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

const painting = (manifest: any) =>
  manifest.items[0].items[0].items[0].body as Record<string, any>;

describe("isImageService", () => {
  it("knows an info.json by its type, protocol or context", () => {
    expect(isImageService(INFO_3)).toBe(true);
    expect(isImageService(INFO_2)).toBe(true);
    expect(isImageService({ type: "ImageService2", id: "x" })).toBe(true);
    expect(
      isImageService({
        "@context": "http://iiif.io/api/presentation/3/context.json",
        type: "Manifest",
      }),
    ).toBe(false);
    expect(isImageService(null)).toBe(false);
  });

  it("reads a Presentation resource listing the Image API's context as Presentation (#423)", () => {
    const contexts = [
      "http://iiif.io/api/presentation/3/context.json",
      "http://iiif.io/api/image/2/context.json",
    ];
    for (const type of ["Manifest", "Collection", "Canvas"])
      expect(isImageService({ "@context": contexts, type })).toBe(false);
    expect(
      isImageService({
        "@context": [
          "http://iiif.io/api/presentation/2/context.json",
          "http://iiif.io/api/image/2/context.json",
        ],
        "@type": "sc:Manifest",
      }),
    ).toBe(false);
    // An info.json with no `protocol` is still known by its context.
    expect(
      isImageService({
        "@context": "http://iiif.io/api/image/2/context.json",
        "@id": "https://example.org/iiif/2/abc",
        width: 10,
        height: 10,
      }),
    ).toBe(true);
  });
});

describe("loadContent: a Manifest listing the Image API's context", () => {
  it("opens as the Manifest, not an image service (#423)", async () => {
    const url = "https://example.org/manifest.json";
    const fetch = mockFetch({
      [url]: {
        "@context": [
          "http://iiif.io/api/presentation/3/context.json",
          "http://iiif.io/api/image/2/context.json",
        ],
        id: url,
        type: "Manifest",
        label: { en: ["A book"] },
        items: [
          {
            id: `${url}/canvas/1`,
            type: "Canvas",
            width: 100,
            height: 100,
            items: [
              {
                id: `${url}/page/1`,
                type: "AnnotationPage",
                items: [
                  {
                    id: `${url}/annotation/1`,
                    type: "Annotation",
                    motivation: "painting",
                    target: `${url}/canvas/1`,
                    body: {
                      id: "https://example.org/iiif/2/abc/full/full/0/default.jpg",
                      type: "Image",
                      format: "image/jpeg",
                      width: 100,
                      height: 100,
                      service: [
                        {
                          "@id": "https://example.org/iiif/2/abc",
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
      },
    });
    const { manifest } = await loadContent(url, { request: { fetch } });
    const m = manifest as any;
    expect(m.id).toBe(url);
    expect(m.label).toEqual({ en: ["A book"] });
    expect(m.items).toHaveLength(1);
    expect(m.items[0].id).toBe(`${url}/canvas/1`);
  });
});

describe("loadContent: an image service", () => {
  it("shows an Image 3 service as one Canvas the image's size, with no label", async () => {
    const fetch = mockFetch({ [SERVICE]: INFO_3 });
    const { manifest } = await loadContent(SERVICE, { request: { fetch } });
    const m = manifest as any;

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(m["@context"]).toContain("presentation/4");
    expect(m.id).toBe(SERVICE);
    expect(Object.values(m.label).flat().join("")).toBe("");
    expect(m.items).toHaveLength(1);
    expect(m.items[0]).toMatchObject({
      type: "Canvas",
      width: 1200,
      height: 370,
    });
    const body = painting(m);
    expect(body).toMatchObject({ type: "Image", width: 1200, height: 370 });
    expect(body.id).toBe(`${SERVICE}/full/max/0/default.jpg`);
    expect(body.service[0]).toMatchObject({
      id: SERVICE,
      type: "ImageService3",
    });
  });

  it("is known as an image service shown as its image, by its base URI or info.json", async () => {
    const fetch = mockFetch({
      [SERVICE]: INFO_3,
      [`${SERVICE}/info.json`]: INFO_3,
    });
    for (const address of [SERVICE, `${SERVICE}/info.json`]) {
      const { manifest } = await loadContent(address, { request: { fetch } });
      expect(isImageServiceManifest(manifest as any)).toBe(true);
    }
    expect(isImageServiceManifest(null)).toBe(false);
  });

  it("tries the base URI's info.json where the base URI itself fails", async () => {
    const fetch = mockFetch({ [`${SERVICE}/info.json`]: INFO_3 });
    const { manifest } = await loadContent(SERVICE, { request: { fetch } });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(manifest.items[0]).toMatchObject({ width: 1200 });
  });

  it("keeps the URL's own failure where its info.json fails too", async () => {
    const fetch = mockFetch({});
    await expect(
      loadContent("https://example.org/missing", { request: { fetch } }),
    ).rejects.toThrow("https://example.org/missing answered 404");
  });

  it("tries no info.json after an address naming a .json file", async () => {
    const fetch = mockFetch({});
    await expect(
      loadContent("https://example.org/manifest.json", { request: { fetch } }),
    ).rejects.toThrow("answered 404");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("asks an Image 2 level 0 service only for a size it lists, keeping its rights", async () => {
    const { manifest } = await loadContent(INFO_2);
    const m = manifest as any;
    expect(m.items[0]).toMatchObject({ width: 4000, height: 3000 });
    const body = painting(m);
    expect(body.id).toBe(
      "https://example.org/iiif/2/abc/full/1000,/0/default.jpg",
    );
    expect(body.service[0]).toMatchObject({
      id: "https://example.org/iiif/2/abc",
      type: "ImageService2",
    });
    expect(m.rights).toBe("http://rightsstatements.org/vocab/InC/1.0/");
    expect(m.requiredStatement.value.none).toEqual(["Example Library"]);
  });
});

describe("fittedSize", () => {
  it("is the full size where the service's limits allow it", () => {
    expect(fittedSize(parseInfo(INFO_3))).toEqual({ width: 1200, height: 370 });
  });

  it("scales into a level 1 service's maxArea where no size is listed", () => {
    const info = parseInfo({
      ...INFO_3,
      profile: "level1",
      sizes: undefined,
      maxArea: 1000000,
      width: 2000,
      height: 2000,
    });
    expect(fittedSize(info)).toEqual({ width: 1000, height: 1000 });
  });
});
