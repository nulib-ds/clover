import bookJson from "../fixtures/iiif-cookbook/0009-book-1.json";
import placeholderJson from "../fixtures/iiif-cookbook/0013-placeholderCanvas.json";
import { p4 } from "../fixtures/presentation4";
import { clearInfoCache } from "../lib/renderer/sources/imageService";
import { regionSource } from "./region";
import { resolveThumbnail, thumbnailSource } from "./thumbnail";

const book = p4(bookJson);
const placeholder = p4(placeholderJson);

/** A server whose `info.json` is this, as `request.fetch`. */
const serving = (info: Record<string, unknown>) =>
  vi.fn(async () => new Response(JSON.stringify(info)));

/** An Image API 3 service at level 2, this size. */
const level2 = (id: string, width: number, height: number) => ({
  "@context": "http://iiif.io/api/image/3/context.json",
  id,
  type: "ImageService3",
  protocol: "http://iiif.io/api/image",
  profile: "level2",
  width,
  height,
});

afterEach(() => clearInfoCache());

describe("thumbnailSource", () => {
  it("asks a service nothing until its info.json is read, whatever level the manifest says", () => {
    const source = thumbnailSource(book.items[0]);
    expect(source?.src).toBeUndefined();
    expect(source?.service).toMatch(/^https:\/\//);
    expect(source?.fallback).toMatch(/\.jpg$/);
  });

  it("prefers a resource's own thumbnail", () => {
    expect(
      thumbnailSource({
        thumbnail: [{ id: "https://example.org/t.jpg", type: "Image" }],
        items: book.items[0].items,
      }),
    ).toEqual({ src: "https://example.org/t.jpg" });
  });

  it("falls back to a video's placeholder image", () => {
    expect(thumbnailSource(placeholder.items[0])?.src).toMatch(
      /act1-thumbnail\.png$/,
    );
  });

  it("keeps the image as a fallback for a service", () => {
    expect(
      thumbnailSource({
        thumbnail: [
          {
            id: "https://example.org/static/full.jpg",
            type: "Image",
            service: [
              {
                id: "https://example.org/static",
                type: "ImageService3",
                profile: "level0",
              },
            ],
          },
        ],
      }),
    ).toEqual({
      service: "https://example.org/static",
      fallback: "https://example.org/static/full.jpg",
    });
  });
});

describe("resolveThumbnail", () => {
  it("picks the smallest listed size that fills the request, with the request settings", async () => {
    const fetch = serving({
      ...level2("https://example.org/static", 4000, 3000),
      profile: "level0",
      sizes: [
        { width: 125, height: 94 },
        { width: 250, height: 188 },
        { width: 500, height: 375 },
      ],
    });
    const url = await resolveThumbnail(
      { service: "https://example.org/static", fallback: "x.jpg" },
      200,
      { fetch, credentials: "include" },
    );
    expect(url).toBe("https://example.org/static/full/250,188/0/default.jpg");
    expect((fetch.mock.calls[0] as unknown[])[1]).toMatchObject({
      credentials: "include",
    });
  });

  it("asks for the whole image at its size, never more, as info.json gives it", async () => {
    // The University of Washington's pages: 500 by 741, and a server that refuses to
    // scale past 200%. The manifest calls it level 1; info.json, level 2.
    const fetch = serving({
      "@context": "http://iiif.io/api/image/2/context.json",
      "@id": "https://example.org/iiif/2/iww:60",
      protocol: "http://iiif.io/api/image",
      profile: ["http://iiif.io/api/image/2/level2.json"],
      width: 500,
      height: 741,
    });
    const source = { service: "https://example.org/iiif/2/iww:60" };
    expect(await resolveThumbnail(source, 1600, { fetch })).toBe(
      "https://example.org/iiif/2/iww:60/full/full/0/default.jpg",
    );
    // 200 on its longer side, down the page: 134 across, in the w, form.
    expect(await resolveThumbnail(source, 200, { fetch })).toBe(
      "https://example.org/iiif/2/iww:60/full/134,/0/default.jpg",
    );
  });

  it("reads a painting's region in the service's own pixels", async () => {
    const fetch = serving(level2("https://example.org/page", 4000, 3000));
    expect(
      await resolveThumbnail(
        { service: "https://example.org/page", region: "1000,750,1000,750" },
        100,
        { fetch },
      ),
    ).toBe("https://example.org/page/1000,750,1000,750/100,75/0/default.jpg");
  });

  it("uses the fallback when info.json fails", async () => {
    const fetch = vi.fn(async () => new Response("no", { status: 500 }));
    expect(
      await resolveThumbnail(
        { service: "https://example.org/broken", fallback: "x.jpg" },
        200,
        { fetch },
      ),
    ).toBe("x.jpg");
  });
});

/*
 * A region of a Canvas, cut small by the image server: read as shares of the image, from
 * where it is painted, then asked as the server's info.json allows, and never of a server
 * that cannot cut it.
 */
describe("regionSource", () => {
  const SERVICE = "https://example.org/iiif/page";
  const canvas = (
    target = "https://example.org/canvas/1",
    image = { width: 2000, height: 1000 },
  ) => ({
    id: "https://example.org/canvas/1",
    type: "Canvas",
    width: 1000,
    height: 500,
    items: [
      {
        type: "AnnotationPage",
        items: [
          {
            type: "Annotation",
            motivation: ["painting"],
            target,
            body: [
              {
                id: `${SERVICE}/full/max/0/default.jpg`,
                type: "Image",
                ...image,
                service: [
                  { id: SERVICE, type: "ImageService3", profile: "level2" },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  const cut = (
    source: ReturnType<typeof regionSource>,
    info: Record<string, unknown>,
  ) => resolveThumbnail(source!, 52, { fetch: serving(info) });

  it("asks for the region in the image's pixels, at no more than the size", async () => {
    // The image is twice the Canvas's size: the region is doubled.
    const source = regionSource(canvas(), { x: 10, y: 20, w: 100, h: 50 });
    expect(await cut(source, level2(SERVICE, 2000, 1000))).toBe(
      `${SERVICE}/20,40,200,100/52,26/0/default.jpg`,
    );
  });

  it("reads the region from where the image is painted on the Canvas", async () => {
    // Painted at x 500, half the Canvas wide, at its own size.
    const placed = canvas("https://example.org/canvas/1#xywh=500,0,500,500", {
      width: 500,
      height: 500,
    });
    const source = regionSource(placed, { x: 600, y: 100, w: 50, h: 50 });
    expect(await cut(source, level2(SERVICE, 500, 500))).toBe(
      `${SERVICE}/100,100,50,50/50,50/0/default.jpg`,
    );
    // Off that image, nothing.
    expect(regionSource(placed, { x: 0, y: 0, w: 50, h: 50 })).toBeNull();
  });

  it("never asks for more pixels than the region has, which Image API 3 refuses", async () => {
    // A line of text 300 by 20 pixels: 52 across, never scaled up.
    const source = regionSource(canvas(), { x: 0, y: 0, w: 150, h: 10 });
    expect(await cut(source, level2(SERVICE, 2000, 1000))).toBe(
      `${SERVICE}/0,0,300,20/52,3/0/default.jpg`,
    );
  });

  it("asks nothing of a level 0 service, which cannot cut, and shows nothing", async () => {
    const source = regionSource(canvas(), { x: 0, y: 0, w: 10, h: 10 });
    const fetch = serving({
      ...level2(SERVICE, 2000, 1000),
      profile: "level0",
    });
    expect(await resolveThumbnail(source!, 52, { fetch })).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1); // info.json alone
  });
});
