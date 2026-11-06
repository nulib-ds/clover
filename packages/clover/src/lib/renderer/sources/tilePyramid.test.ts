import {
  GOTTINGEN_V2_0,
  GOTTINGEN_V3,
  LEVEL0_SIZES_ONLY,
  LEVEL2_UNTILED_V2,
} from "../../../fixtures/iiif-image/info";
import { parseInfo } from "./imageService";

/** Northwestern's image server's info.json, as it answers (2026-11-06). */
const NORTHWESTERN = {
  "@context": "http://iiif.io/api/image/3/context.json",
  id: "https://iiif.dc.library.northwestern.edu/iiif/3/7ff31828-e562-4cbe-b517-74baace7745c",
  type: "ImageService3",
  protocol: "http://iiif.io/api/image",
  profile: "level2",
  width: 4756,
  height: 4700,
  tiles: [{ width: 256, height: 256, scaleFactors: [1, 2, 4, 8, 16, 32] }],
  sizes: [
    { width: 4756, height: 4700 },
    { width: 2378, height: 2350 },
    { width: 1189, height: 1175 },
    { width: 594, height: 587 },
    { width: 297, height: 293 },
    { width: 148, height: 146 },
  ],
};
import {
  chooseLevel,
  servicePyramid,
  staticPyramid,
  tilesInRegion,
} from "./tilePyramid";

describe("servicePyramid", () => {
  it("builds the reference service's levels on its own grid, coarse to fine, with a thumbnail", () => {
    const pyramid = servicePyramid(parseInfo(GOTTINGEN_V3), 0);
    expect(pyramid.levels.map((l) => [l.scaleFactor, l.cols, l.rows])).toEqual([
      // Its own coarsest level is still 2×2 tiles, so a 512px whole image comes first.
      [4032 / 512, 1, 1],
      [4, 2, 2],
      [2, 4, 3],
      [1, 8, 6],
    ]);
  });

  it("cuts edge tiles to the image and sizes them by ceil(region / scale)", () => {
    const pyramid = servicePyramid(parseInfo(GOTTINGEN_V3), 0);
    const finest = pyramid.levels.length - 1;
    const edge = pyramid.tile({ level: finest, col: 7, row: 5 });
    expect(edge.region).toEqual({ x: 3584, y: 2560, width: 448, height: 464 });
    expect(edge.url).toMatch(/\/3584,2560,448,464\/448,464\/0\/default\.jpg$/);

    const s4 = pyramid.tile({ level: 1, col: 1, row: 1 });
    expect(s4.region).toEqual({ x: 2048, y: 2048, width: 1984, height: 976 });
    expect(s4.url).toMatch(/\/2048,2048,1984,976\/496,244\//);
  });

  it("spells 2.0 tiles with w, and offers no native retry above level 0", () => {
    const pyramid = servicePyramid(parseInfo(GOTTINGEN_V2_0), 0);
    const tile = pyramid.tile({ level: 1, col: 0, row: 0 });
    expect(tile.url).toMatch(/\/0,0,2048,2048\/512,\/0\/default\.jpg$/);
    expect(tile.fallbackUrl).toBeUndefined();
  });

  it("uses a level 0 tree's listed sizes as whole-image levels", () => {
    const pyramid = servicePyramid(parseInfo(LEVEL0_SIZES_ONLY));
    expect(pyramid.levels.map((l) => l.width)).toEqual([375, 750, 1500]);
    expect(pyramid.tile({ level: 2, col: 0, row: 0 }).url).toBe(
      "https://example.org/iiif/static/full/1500,1000/0/default.jpg",
    );
  });

  it("asks a level 0 2.x tree for `native` once `default` fails", () => {
    const pyramid = servicePyramid(
      parseInfo({
        "@context": "http://iiif.io/api/image/2/context.json",
        "@id": "https://example.org/old",
        profile: ["http://iiif.io/api/image/2/level0.json"],
        width: 1000,
        height: 800,
        tiles: [{ width: 256, scaleFactors: [1, 2, 4] }],
      }),
    );
    const tile = pyramid.tile({ level: 0, col: 0, row: 0 });
    expect(tile.url).toMatch(/\/default\.jpg$/);
    expect(tile.fallbackUrl).toMatch(/\/native\.jpg$/);
  });

  it("cuts its own 1024 px tiles for a level 2 service that lists none", () => {
    const pyramid = servicePyramid(parseInfo(LEVEL2_UNTILED_V2));
    expect(pyramid.levels.map((l) => l.scaleFactor)).toEqual([4, 2, 1]);
    expect(pyramid.levels[pyramid.levels.length - 1]).toMatchObject({
      tileWidth: 1024,
      cols: 3,
      rows: 2,
    });
  });

  it("cuts its own tiles no larger than the service's maxWidth", () => {
    const pyramid = servicePyramid(
      parseInfo({
        ...LEVEL2_UNTILED_V2,
        profile: ["http://iiif.io/api/image/2/level2.json", { maxWidth: 800 }],
      }),
    );
    expect(pyramid.levels[pyramid.levels.length - 1].tileWidth).toBe(512);
  });

  it("joins a service's 256 px tiles into 1024 px ones, on its own grid", () => {
    // Northwestern's: level 2, 256 px tiles, every level a power of two.
    const pyramid = servicePyramid(parseInfo(NORTHWESTERN));
    const finest = pyramid.levels.length - 1;
    expect(pyramid.levels[finest]).toMatchObject({
      tileWidth: 1024,
      cols: 5,
      rows: 5,
    });
    const tile = pyramid.tile({ level: finest, col: 1, row: 0 });
    expect(tile.region).toEqual({ x: 1024, y: 0, width: 1024, height: 1024 });
    expect(tile.url).toBe(
      `${NORTHWESTERN.id}/1024,0,1024,1024/1024,1024/0/default.jpg`,
    );
    // At half resolution a tile covers 2048 px of the image, at the same 1024 px.
    const half = pyramid.tile({ level: finest - 1, col: 1, row: 1 });
    expect(half.url).toBe(
      `${NORTHWESTERN.id}/2048,2048,2048,2048/1024,1024/0/default.jpg`,
    );
    // A view of the whole page at 2× (1800 device px tall) wants scale factor 2: nine
    // tiles, where 256 px ones would be a hundred.
    const target = chooseLevel(pyramid, 4700 / 1800);
    expect(pyramid.levels[target].scaleFactor).toBe(2);
    expect(
      tilesInRegion(pyramid, target, { x: 0, y: 0, width: 4756, height: 4700 }),
    ).toHaveLength(9);
  });

  it("joins only as far as maxWidth and maxArea allow", () => {
    const pyramid = servicePyramid(
      parseInfo({ ...NORTHWESTERN, maxWidth: 600 }),
    );
    expect(pyramid.levels[pyramid.levels.length - 1].tileWidth).toBe(512);
    const area = servicePyramid(
      parseInfo({ ...NORTHWESTERN, maxArea: 600 * 600 }),
    );
    expect(area.levels[area.levels.length - 1].tileWidth).toBe(512);
  });

  it("keeps a level 0 service's own tiles, which may be the only ones it has", () => {
    const pyramid = servicePyramid(
      parseInfo({ ...NORTHWESTERN, profile: "level0" }),
    );
    expect(pyramid.levels[pyramid.levels.length - 1].tileWidth).toBe(256);
  });
});

describe("chooseLevel", () => {
  const pyramid = servicePyramid(parseInfo(GOTTINGEN_V3), 0);

  it("picks the coarsest level with at least one level pixel per device pixel", () => {
    // 3 image pixels per device pixel: scale factor 2 is the coarsest that is ≥ 1:1.
    expect(pyramid.levels[chooseLevel(pyramid, 3)].scaleFactor).toBe(2);
    expect(pyramid.levels[chooseLevel(pyramid, 4)].scaleFactor).toBe(4);
    expect(pyramid.levels[chooseLevel(pyramid, 100)].scaleFactor).toBeCloseTo(
      7.875,
    );
  });

  it("stays at full resolution when zoomed in past it", () => {
    expect(pyramid.levels[chooseLevel(pyramid, 0.25)].scaleFactor).toBe(1);
  });
});

describe("tilesInRegion", () => {
  const pyramid = servicePyramid(parseInfo(GOTTINGEN_V3), 0);
  const finest = pyramid.levels.length - 1;

  it("returns only the tiles a region touches", () => {
    const tiles = tilesInRegion(pyramid, finest, {
      x: 500,
      y: 500,
      width: 600,
      height: 100,
    });
    expect(tiles.map((t) => [t.col, t.row])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ]);
  });

  it("is empty outside the image", () => {
    expect(
      tilesInRegion(pyramid, finest, { x: 5000, y: 0, width: 10, height: 10 }),
    ).toEqual([]);
  });

  it("treats a static image as one level of one tile", () => {
    const one = staticPyramid("a.jpg", 800, 600);
    expect(
      tilesInRegion(one, 0, { x: 0, y: 0, width: 800, height: 600 }),
    ).toEqual([{ level: 0, col: 0, row: 0 }]);
    expect(one.tile({ level: 0, col: 0, row: 0 }).url).toBe("a.jpg");
  });
});
