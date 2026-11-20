import type { LoadedImage } from "../io/decode";
import type { TileCache } from "../io/TileCache";
import { apply } from "../math/affine";
import {
  type SceneImage,
  itemToWorld,
  layoutItems,
  resolveItem,
} from "./sceneItem";

/** A static image whose file is `width` × `height`, whatever its body declares. */
function photo(width: number, height: number): LoadedImage {
  return {
    kind: "bitmap",
    source: {} as ImageBitmap,
    width,
    height,
    naturalWidth: width,
    naturalHeight: height,
    opaque: false,
  };
}

function resolve(spec: SceneImage, file: LoadedImage) {
  return resolveItem(spec, {
    cache: { seed: () => {} } as unknown as TileCache,
    loadStatic: async () => file,
  });
}

describe("layoutItems", () => {
  it("fits a picture inside its place at its own shape, centered, never stretched", async () => {
    // Bergen's: its body and Canvas declare 1024 × 1024, its JPEG is 1024 × 690.
    const place = { x: 0, y: 0, width: 1024, height: 1024 };
    const item = await resolve(
      {
        id: "bergen",
        url: "https://data.example.org/photo.jpg",
        width: 1024,
        height: 1024,
        placement: place,
      },
      photo(1024, 690),
    );
    const world = layoutItems([item]);
    expect(item.rect).toEqual({ x: 0, y: 167, width: 1024, height: 690 });
    // The world is the Canvas as declared, the picture inside it.
    expect(world).toEqual(place);
    const toWorld = itemToWorld(item);
    expect(apply(toWorld, { x: 0, y: 0 })).toEqual({ x: 0, y: 167 });
    expect(apply(toWorld, { x: 1024, y: 690 })).toEqual({ x: 1024, y: 857 });
  });

  it("fits a tall picture across a wide place, centered across it", async () => {
    const item = await resolve(
      {
        id: "tall",
        url: "https://data.example.org/tall.jpg",
        placement: { x: 100, y: 50, width: 400, height: 200 },
      },
      photo(300, 600),
    );
    layoutItems([item]);
    expect(item.rect).toEqual({ x: 250, y: 50, width: 100, height: 200 });
  });

  it("fills a place of its own shape, at any scale", async () => {
    const place = { x: 0, y: 0, width: 1000, height: 750 };
    const item = await resolve(
      { id: "scaled", url: "https://data.example.org/a.jpg", placement: place },
      photo(4000, 3000),
    );
    layoutItems([item]);
    expect(item.rect).toEqual(place);
  });

  it("keeps a picture without a place in its declared coordinates", async () => {
    // A region read off the camera is then a valid `xywh=` for the resource.
    const item = await resolve(
      {
        id: "declared",
        url: "https://data.example.org/a.jpg",
        width: 8000,
        height: 6000,
      },
      photo(1000, 750),
    );
    expect(layoutItems([item])).toEqual({
      x: 0,
      y: 0,
      width: 8000,
      height: 6000,
    });
  });
});
