import { GOTTINGEN_V3 } from "../../../fixtures/iiif-image/info";
import { fitCamera } from "../camera/Camera";
import type { LoadedImage } from "../io/decode";
import { apply } from "../math/affine";
import { planFrame } from "./planFrame";
import { parseRegion, parseRotation } from "./regions";
import { uploadBudget } from "./uploadBudget";
import { type SceneItem, itemToWorld, layoutItems, turnOf } from "./sceneItem";
import { parseInfo } from "../sources/imageService";
import { servicePyramid } from "../sources/tilePyramid";

const viewport = { width: 800, height: 600 };

function gottingen(region?: string, rotation?: string): SceneItem {
  const pyramid = servicePyramid(parseInfo(GOTTINGEN_V3));
  const size = { width: 4032, height: 3024 };
  const clip = parseRegion(region, 4032, 3024) ?? {
    x: 0,
    y: 0,
    ...size,
  };
  const item: SceneItem = {
    id: "g",
    spec: { id: "g" },
    pyramid,
    size,
    clip,
    contentClip: clip,
    rect: { x: 0, y: 0, width: 0, height: 0 },
  };
  const turn = parseRotation(rotation);
  if (turn) item.turn = turnOf(clip, turn);
  layoutItems([item]);
  return item;
}

function tileImage(width: number, height: number): LoadedImage {
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

/** A cache holding every tile, sized as the server would send it. */
const everything = (item: SceneItem) => {
  const sizes = new Map<string, [number, number]>();
  item.pyramid.levels.forEach((level, index) => {
    for (let row = 0; row < level.rows; row++) {
      for (let col = 0; col < level.cols; col++) {
        const tile = item.pyramid.tile({ level: index, col, row });
        sizes.set(tile.url, [
          Math.ceil(tile.region.width / level.scaleFactor),
          Math.ceil(tile.region.height / level.scaleFactor),
        ]);
      }
    }
  });
  return (url: string) => {
    const size = sizes.get(url);
    return size ? tileImage(size[0], size[1]) : undefined;
  };
};

describe("planFrame", () => {
  it("keeps a hidden item's tiles coming, but does not draw it", () => {
    const item = gottingen();
    const hidden = { ...item, spec: { ...item.spec, hidden: true } };
    const camera = fitCamera(item.rect, viewport);
    const input = {
      camera,
      viewport,
      pixelRatio: 1,
      getTile: everything(item),
    };
    const shown = planFrame({ ...input, items: [item] });
    const kept = planFrame({ ...input, items: [hidden] });
    expect(kept.wants).toEqual(shown.wants);
    expect(shown.draws.length).toBeGreaterThan(0);
    expect(kept.draws).toHaveLength(0);
  });

  it("at home, wants the thumbnail first and a fitting level after it", () => {
    const item = gottingen();
    const camera = fitCamera(item.rect, viewport);
    const plan = planFrame({
      items: [item],
      camera,
      viewport,
      pixelRatio: 1,
      getTile: () => undefined,
    });
    // 4032px into 800 CSS px at 1x: ~5 image px per device px → scale factor 4.
    expect(item.pyramid.levels[plan.levels[0]].scaleFactor).toBe(4);
    expect(plan.wants[0].url).toMatch(/\/full\/512,384\//);
    expect(plan.wants).toHaveLength(1 + 4);
    expect(plan.draws).toHaveLength(0);
  });

  it("doubles the resolution it asks for on a 2x display", () => {
    const item = gottingen();
    const camera = fitCamera(item.rect, viewport);
    const plan = planFrame({
      items: [item],
      camera,
      viewport,
      pixelRatio: 2,
      getTile: () => undefined,
    });
    expect(item.pyramid.levels[plan.levels[0]].scaleFactor).toBe(2);
  });

  it("only wants tiles under the view when zoomed in", () => {
    const item = gottingen();
    const camera = { x: 100, y: 100, zoom: 1, rotation: 0 };
    const plan = planFrame({
      items: [item],
      camera,
      viewport,
      pixelRatio: 1,
      getTile: () => undefined,
    });
    // Full resolution; the view spans x −300…500, y −200…400 → tiles (0,0) only.
    const fine = plan.wants.filter((w) =>
      /\/0,0,512,512\/512,512\//.test(w.url),
    );
    expect(fine).toHaveLength(1);
    expect(plan.wants).toHaveLength(2);
  });

  it("draws coarser tiles under missing ones, then only the target once complete", () => {
    const item = gottingen();
    const camera = fitCamera(item.rect, viewport);
    const all = everything(item);
    const thumbnailOnly = (url: string) =>
      /\/full\//.test(url) ? all(url) : undefined;

    const partial = planFrame({
      items: [item],
      camera,
      viewport,
      pixelRatio: 1,
      getTile: thumbnailOnly,
    });
    expect(partial.draws.map((d) => d.url)).toEqual([
      expect.stringMatching(/\/full\/512,384\//),
    ]);

    const complete = planFrame({
      items: [item],
      camera,
      viewport,
      pixelRatio: 1,
      getTile: all,
    });
    expect(complete.draws).toHaveLength(4);
    expect(complete.draws.every((d) => !/\/full\//.test(d.url))).toBe(true);
  });

  it("places tiles edge to edge on screen, with a bleed only between neighbors", () => {
    const item = gottingen();
    const camera = fitCamera(item.rect, viewport);
    const plan = planFrame({
      items: [item],
      camera,
      viewport,
      pixelRatio: 1,
      getTile: everything(item),
    });
    const corners = plan.draws.map((d) => ({
      topLeft: apply(d.transform, { x: d.crop.x, y: d.crop.y }),
      bottomRight: apply(d.transform, {
        x: d.crop.x + d.crop.width,
        y: d.crop.y + d.crop.height,
      }),
      bleed: d.bleed,
    }));
    const [a, b, c, d] = corners;
    expect(a.topLeft.x).toBeCloseTo(0, 6);
    expect(b.topLeft.x).toBeCloseTo(a.bottomRight.x, 6);
    expect(c.topLeft.y).toBeCloseTo(a.bottomRight.y, 6);
    expect(d.bottomRight.x).toBeCloseTo(800, 6);
    expect(a.bleed).toEqual({ right: true, bottom: true });
    expect(d.bleed).toEqual({ right: false, bottom: false });
  });

  it("crops tiles to a region clip, which then fills the world", () => {
    const item = gottingen("1000,500,1000,800");
    expect(item.rect).toEqual({ x: 0, y: 0, width: 1000, height: 800 });
    const camera = fitCamera(item.rect, viewport);
    const plan = planFrame({
      items: [item],
      camera,
      viewport,
      pixelRatio: 1,
      getTile: everything(item),
    });
    expect(plan.draws.length).toBeGreaterThan(0);
    for (const draw of plan.draws) {
      const p = apply(draw.transform, { x: draw.crop.x, y: draw.crop.y });
      expect(p.x).toBeGreaterThanOrEqual(-1e-6);
      expect(p.y).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  describe("a turned picture (Cookbook 0040)", () => {
    it("reads the Image API's rotation, mirrored first where it starts with !", () => {
      expect(parseRotation("90")).toEqual({ degrees: 90, mirror: false });
      expect(parseRotation("!0")).toEqual({ degrees: 0, mirror: true });
      expect(parseRotation("22.5")).toEqual({ degrees: 22.5, mirror: false });
      for (const none of ["0", "360", "", "-90", "400", "90deg", undefined])
        expect(parseRotation(none)).toBeNull();
    });

    it("turns a quarter clockwise into its place, from tiles as they are", () => {
      const item = gottingen(undefined, "90");
      // A landscape image, turned upright: its bounding box fills the world.
      expect(item.rect).toEqual({ x: 0, y: 0, width: 3024, height: 4032 });
      const toWorld = itemToWorld(item);
      // Its top edge is now its right one.
      expect(apply(toWorld, { x: 0, y: 0 })).toEqual({ x: 3024, y: 0 });
      expect(apply(toWorld, { x: 4032, y: 0 })).toEqual({ x: 3024, y: 4032 });
      expect(apply(toWorld, { x: 0, y: 3024 })).toEqual({ x: 0, y: 0 });

      const camera = fitCamera(item.rect, viewport);
      const plan = planFrame({
        items: [item],
        camera,
        viewport,
        pixelRatio: 1,
        getTile: everything(item),
      });
      expect(plan.draws.length).toBeGreaterThan(0);
      // Never a rotation asked of the server.
      for (const want of plan.wants) expect(want.url).toMatch(/\/0\/default\./);
      // Each tile lands inside the turned picture, on screen.
      const screen = {
        x: (viewport.width - 3024 * camera.zoom) / 2,
        width: 3024 * camera.zoom,
      };
      for (const draw of plan.draws) {
        const { crop } = draw;
        for (const corner of [
          { x: crop.x, y: crop.y },
          { x: crop.x + crop.width, y: crop.y + crop.height },
        ]) {
          const p = apply(draw.transform, corner);
          expect(p.x).toBeGreaterThanOrEqual(screen.x - 1e-6);
          expect(p.x).toBeLessThanOrEqual(screen.x + screen.width + 1e-6);
          expect(p.y).toBeGreaterThanOrEqual(-1e-6);
          expect(p.y).toBeLessThanOrEqual(viewport.height + 1e-6);
        }
      }
    });

    it("wants the tiles under the view, read back through the turn", () => {
      const item = gottingen(undefined, "90");
      // Zoomed in at the turned picture's top right: the image's top left.
      const camera = { x: 2924, y: 100, zoom: 1, rotation: 0 };
      const plan = planFrame({
        items: [item],
        camera,
        viewport,
        pixelRatio: 1,
        getTile: () => undefined,
      });
      const full = plan.wants
        .map((want) => want.url.match(/\/(\d+),(\d+),(\d+),(\d+)\/(\d+),/))
        .filter((m): m is RegExpMatchArray => !!m && +m[3] === +m[5])
        .map((m) => [+m[1], +m[2]]);
      expect(full.length).toBeGreaterThan(0);
      // The image's top left, never its far corner.
      for (const [x, y] of full) {
        expect(x).toBeLessThan(1024);
        expect(y).toBeLessThan(1024);
      }
    });

    it("mirrors before it turns", () => {
      const item = gottingen(undefined, "!0");
      expect(apply(itemToWorld(item), { x: 0, y: 0 })).toEqual({
        x: 4032,
        y: 0,
      });
    });
  });

  describe("while the camera animates", () => {
    /** A tile request's scale factor: full-size pixels per requested pixel. */
    const scaleOf = (url: string) => {
      const m = url.match(/\/(\d+),(\d+),(\d+),(\d+)\/(\d+),/);
      return m ? Math.round(+m[3] / +m[5]) : Infinity;
    };
    const atFullSize = (urls: string[]) => urls.filter((u) => scaleOf(u) === 1);

    it("wants full resolution where it lands, not for each view on the way", () => {
      const item = gottingen();
      // Mid-flight over the middle of the image, full size, heading for the top left.
      const camera = { x: 2000, y: 1500, zoom: 1, rotation: 0 };
      const destination = { x: 100, y: 100, zoom: 1, rotation: 0 };
      const still = planFrame({
        items: [item],
        camera,
        viewport,
        pixelRatio: 1,
        getTile: () => undefined,
      });
      const moving = planFrame({
        items: [item],
        camera,
        viewport,
        pixelRatio: 1,
        getTile: () => undefined,
        destination,
      });
      const urls = moving.wants.map((w) => w.url);

      // At rest it wants the view's own full-size tiles…
      expect(atFullSize(still.wants.map((w) => w.url)).length).toBeGreaterThan(
        1,
      );
      // …in flight, only the landing view's: tile (0,0), as at rest over it.
      expect(atFullSize(urls)).toEqual([
        expect.stringMatching(/\/0,0,512,512\/512,512\//),
      ]);
      // The view passed through gets a level two coarser than its target.
      expect(urls.some((u) => scaleOf(u) === 4)).toBe(true);
      // The landing tile outranks the in-flight ones, and the thumbnail outranks both.
      expect(scaleOf(urls[urls.length - 1])).toBe(4);
      expect(urls[0]).toMatch(/\/full\//);
      // What is drawn is still the current view, from whatever is loaded.
      expect(moving.levels).toEqual(still.levels);
    });

    it("wants the landing view of an item not yet on screen", () => {
      const item = gottingen();
      const plan = planFrame({
        items: [item],
        camera: { x: 100000, y: 100000, zoom: 1, rotation: 0 },
        viewport,
        pixelRatio: 1,
        getTile: () => undefined,
        destination: { x: 100, y: 100, zoom: 1, rotation: 0 },
      });
      expect(plan.levels).toEqual([-1]);
      expect(atFullSize(plan.wants.map((w) => w.url))).toHaveLength(1);
      expect(plan.draws).toHaveLength(0);
    });
  });

  it("paints the coarser level under tiles the upload budget holds back", () => {
    const item = gottingen();
    const camera = fitCamera(item.rect, viewport);
    const all = everything(item);
    const thumbnail = (url: string) => /\/full\//.test(url);
    // Room for one new tile this frame; the thumbnail is already on the GPU.
    const budget = uploadBudget(all, thumbnail, 1);
    const plan = planFrame({
      items: [item],
      camera,
      viewport,
      pixelRatio: 1,
      getTile: budget.getTile,
    });
    expect(budget.deferred).toBe(true);
    expect(plan.draws.map((d) => d.url)).toEqual([
      expect.stringMatching(/\/full\//),
      expect.not.stringMatching(/\/full\//),
    ]);
  });

  it("wants the whole coarsest level for the navigator, even offscreen", () => {
    const item = gottingen();
    const camera = { x: 100000, y: 100000, zoom: 1, rotation: 0 };
    const plan = planFrame({
      items: [item],
      camera,
      viewport,
      pixelRatio: 1,
      getTile: () => undefined,
      wantOverview: true,
    });
    expect(plan.levels).toEqual([-1]);
    expect(plan.wants).toHaveLength(1);
  });
});
