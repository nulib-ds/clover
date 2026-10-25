import { describe, expect, it } from "vitest";

import { chooseSize, thumbnailFrom } from "./iiif-image-sizes";

const service = "https://example.org/iiif/abc/";

describe("chooseSize", () => {
  const sizes = [
    { width: 1000, height: 800 },
    { width: 125, height: 100 },
    { width: 250, height: 200 },
  ];

  it("picks the smallest still wanted on its shorter side", () => {
    expect(chooseSize(sizes, 96)).toEqual({ width: 125, height: 100 });
    expect(chooseSize(sizes, 150)).toEqual({ width: 250, height: 200 });
  });

  it("else the largest", () => {
    expect(chooseSize(sizes, 2000)).toEqual({ width: 1000, height: 800 });
    expect(chooseSize([], 96)).toBeUndefined();
  });
});

describe("thumbnailFrom", () => {
  it("asks a version 3 server at level 1 for its own size, by w,h", () => {
    expect(
      thumbnailFrom(
        service,
        {
          type: "ImageService3",
          profile: "level1",
          width: 4032,
          height: 3024,
          tiles: [{ width: 512, scaleFactors: [1, 2, 4] }],
        },
        96,
      ),
    ).toEqual({
      id: "https://example.org/iiif/abc/full/128,96/0/default.jpg",
      width: 128,
      height: 96,
    });
  });

  it("asks a version 2 server at level 1 by w,", () => {
    expect(
      thumbnailFrom(
        service,
        {
          "@context": "http://iiif.io/api/image/2/context.json",
          profile: ["http://iiif.io/api/image/2/level1.json"],
          width: 1000,
          height: 2000,
        },
        96,
      )?.id,
    ).toBe("https://example.org/iiif/abc/full/96,/0/default.jpg");
  });

  it("never asks for more than the image", () => {
    expect(
      thumbnailFrom(
        service,
        { type: "ImageService3", profile: "level2", width: 80, height: 60 },
        96,
      ),
    ).toMatchObject({ width: 80, height: 60 });
  });

  it("keeps to a level 0 server's listed sizes", () => {
    expect(
      thumbnailFrom(
        service,
        {
          type: "ImageService3",
          profile: "level0",
          width: 4000,
          height: 3000,
          sizes: [
            { width: 250, height: 188 },
            { width: 1000, height: 750 },
          ],
        },
        96,
      )?.id,
    ).toBe("https://example.org/iiif/abc/full/250,188/0/default.jpg");
  });

  it("else to a scale where the whole image fits in one tile", () => {
    expect(
      thumbnailFrom(
        service,
        {
          "@context": "http://iiif.io/api/image/2/context.json",
          profile: ["http://iiif.io/api/image/2/level0.json"],
          width: 2000,
          height: 1000,
          tiles: [{ width: 512, scaleFactors: [1, 2, 4, 8] }],
        },
        96,
      ),
    ).toEqual({
      id: "https://example.org/iiif/abc/full/250,/0/default.jpg",
      width: 250,
      height: 125,
    });
  });

  it("asks for nothing it is not sure the server keeps", () => {
    expect(
      thumbnailFrom(
        service,
        { type: "ImageService3", profile: "level0", width: 4000, height: 3000 },
        96,
      ),
    ).toBeUndefined();
  });

  it("keeps within a server's limits", () => {
    expect(
      thumbnailFrom(
        service,
        {
          type: "ImageService3",
          profile: "level2",
          width: 4000,
          height: 3000,
          maxArea: 1000,
          sizes: [{ width: 40, height: 30 }],
        },
        96,
      )?.id,
    ).toBe("https://example.org/iiif/abc/full/40,30/0/default.jpg");
  });
});
