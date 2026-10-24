import {
  GOTTINGEN_V2_1,
  GOTTINGEN_V3,
  LEVEL0_SIZES_ONLY,
} from "../../../fixtures/iiif-image/info";
import { parseInfo } from "./imageService";
import { sizedImageUrl } from "./sizedImage";

/*
 * A picture asked strictly as the server's info.json says it can answer (Mat, 2026-10-24),
 * never as Clover would like it: a server may refuse to scale up (the University of
 * Washington's answers 403 past 200%), and a level 0 tree has only what it lists.
 */
describe("sizedImageUrl", () => {
  const v3 = parseInfo(GOTTINGEN_V3);
  const v2 = parseInfo(GOTTINGEN_V2_1);
  const small = parseInfo({
    "@context": "http://iiif.io/api/image/2/context.json",
    "@id": "https://example.org/iiif/2/page",
    protocol: "http://iiif.io/api/image",
    profile: ["http://iiif.io/api/image/2/level2.json"],
    width: 500,
    height: 741,
    sizes: [{ width: 125, height: 185 }],
  });

  it("asks for the whole image at its own size where the request is larger", () => {
    expect(sizedImageUrl(small, 1600)).toBe(
      "https://example.org/iiif/2/page/full/full/0/default.jpg",
    );
    expect(sizedImageUrl(v3, 5000)).toMatch(/\/full\/max\/0\/default\.jpg$/);
  });

  it("sizes in the canonical form every level 1 server answers: w, (2.x) or w,h (3.0)", () => {
    expect(sizedImageUrl(v2, 200)).toMatch(/\/full\/200,\/0\/default\.jpg$/);
    expect(sizedImageUrl(v3, 200)).toMatch(/\/full\/200,150\/0\/default\.jpg$/);
  });

  it("keeps within maxWidth, maxHeight and maxArea", () => {
    const capped = parseInfo({ ...GOTTINGEN_V3, maxWidth: 1000 });
    expect(sizedImageUrl(capped, 2000)).toMatch(/\/full\/1000,750\//);
    const area = parseInfo({ ...GOTTINGEN_V3, maxArea: 10000 });
    const [w, h] = /\/full\/(\d+),(\d+)\//
      .exec(sizedImageUrl(area, 2000)!)!
      .slice(1)
      .map(Number);
    expect(w * h).toBeLessThanOrEqual(10000);
  });

  it("cuts a region given as shares of the image, never larger than the region", () => {
    const quarter = { x: 0.25, y: 0.25, width: 0.25, height: 0.25 };
    expect(sizedImageUrl(v3, 52, quarter)).toMatch(
      /\/1008,756,1008,756\/52,39\/0\/default\.jpg$/,
    );
    const tiny = { x: 0, y: 0, width: 0.01, height: 0.01 };
    expect(sizedImageUrl(v3, 52, tiny)).toMatch(/\/0,0,40,30\/40,30\//);
  });

  it("asks a level 0 tree only for a size it lists, and for no region", () => {
    const tree = parseInfo(LEVEL0_SIZES_ONLY);
    expect(sizedImageUrl(tree, 600)).toMatch(/\/full\/750,500\//);
    expect(sizedImageUrl(tree, 4000)).toMatch(/\/full\/1500,1000\//);
    expect(
      sizedImageUrl(tree, 52, { x: 0, y: 0, width: 0.5, height: 0.5 }),
    ).toBeNull();
    const bare = parseInfo({ ...LEVEL0_SIZES_ONLY, sizes: undefined });
    expect(sizedImageUrl(bare, 200)).toMatch(/\/full\/max\/0\/default\.jpg$/);
  });
});
