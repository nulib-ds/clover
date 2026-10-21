import bookJson from "../fixtures/iiif-cookbook/0009-book-1.json";
import placeholderJson from "../fixtures/iiif-cookbook/0013-placeholderCanvas.json";
import { p4 } from "../fixtures/presentation4";
import { clearInfoCache } from "../lib/renderer/sources/imageService";
import { regionSource } from "./region";
import { resolveThumbnail, thumbnailSource } from "./thumbnail";

const book = p4(bookJson);
const placeholder = p4(placeholderJson);

describe("thumbnailSource", () => {
  it("asks a level 1 or 2 service for a sized image at once", () => {
    const source = thumbnailSource(book.items[0], 200);
    expect(source?.src).toMatch(/\/full\/!200,200\/0\/default\.jpg$/);
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

  it("needs info.json for a level 0 service, keeping the image as a fallback", () => {
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
  afterEach(() => clearInfoCache());

  it("picks the smallest listed size that fills the request, with the request settings", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            "@context": "http://iiif.io/api/image/3/context.json",
            id: "https://example.org/static",
            type: "ImageService3",
            protocol: "http://iiif.io/api/image",
            profile: "level0",
            width: 4000,
            height: 3000,
            sizes: [
              { width: 125, height: 94 },
              { width: 250, height: 188 },
              { width: 500, height: 375 },
            ],
          }),
        ),
    );
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
 * A region of a Canvas, cut small by the image server: read in the image's pixels, from
 * where it is painted, and never asked of a server that cannot cut it.
 */
describe("regionSource", () => {
  const SERVICE = "https://example.org/iiif/page";
  const canvas = (
    profile: string,
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
                service: [{ id: SERVICE, type: "ImageService3", profile }],
              },
            ],
          },
        ],
      },
    ],
  });

  it("asks for the region in the image's pixels, at no more than the size", () => {
    // The image is twice the Canvas's size: the region is doubled.
    expect(
      regionSource(canvas("level2"), { x: 10, y: 20, w: 100, h: 50 }, 52),
    ).toBe(`${SERVICE}/20,40,200,100/!52,52/0/default.jpg`);
  });

  it("reads the region from where the image is painted on the Canvas", () => {
    // Painted at x 500, half the Canvas wide, at its own size.
    const placed = canvas(
      "level1",
      "https://example.org/canvas/1#xywh=500,0,500,500",
      { width: 500, height: 500 },
    );
    expect(regionSource(placed, { x: 600, y: 100, w: 50, h: 50 }, 52)).toBe(
      `${SERVICE}/100,100,50,50/!50,50/0/default.jpg`,
    );
    // Off that image, nothing.
    expect(regionSource(placed, { x: 0, y: 0, w: 50, h: 50 }, 52)).toBeNull();
  });

  it("never asks for more pixels than the region has, which Image API 3 refuses", () => {
    // A line of text 300 by 20 pixels: fitted within 52 by 20, never scaled up.
    expect(
      regionSource(canvas("level2"), { x: 0, y: 0, w: 150, h: 10 }, 52),
    ).toBe(`${SERVICE}/0,0,300,20/!52,20/0/default.jpg`);
  });

  it("asks nothing of a level 0 service, which cannot cut", () => {
    expect(
      regionSource(canvas("level0"), { x: 0, y: 0, w: 10, h: 10 }, 52),
    ).toBeNull();
  });
});
