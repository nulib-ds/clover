import { readLink } from "./link";
import { showLink } from "./show-link";
import { createClover } from "./clover";
import hotspotJson from "../fixtures/iiif-cookbook/0022-linking-with-a-hotspot.json";

const BASE = "https://iiif.io/api/cookbook/recipe/0022-linking-with-a-hotspot";
const linking = (body: unknown) => ({
  id: "https://example.org/a",
  type: "Annotation",
  motivation: "linking",
  body,
  target: "https://example.org/canvas#xywh=0,0,10,10",
});

describe("readLink", () => {
  it("reads a Canvas and its Manifest, as Cookbook 0022 links them", () => {
    const annotation = hotspotJson.items[0].annotations![0].items[0];
    expect(readLink(annotation)).toEqual({
      id: `${BASE}/canvas/p2`,
      canvasId: `${BASE}/canvas/p2`,
      manifestId: `${BASE}/manifest.json`,
    });
  });

  it("reads a Manifest, and a page on the web, but never a script", () => {
    expect(
      readLink(linking({ id: "https://example.org/m", type: "Manifest" })),
    ).toEqual({
      id: "https://example.org/m",
      manifestId: "https://example.org/m",
    });
    expect(
      readLink(linking({ id: "https://example.org/page", type: "Text" })),
    ).toEqual({ id: "https://example.org/page" });
    expect(readLink(linking("javascript:alert(1)"))).toBeUndefined();
  });

  it("reads nothing from an annotation that is not linking", () => {
    expect(
      readLink({
        ...linking({ id: "https://example.org/page", type: "Text" }),
        motivation: "commenting",
      }),
    ).toBeUndefined();
  });
});

describe("showLink", () => {
  it("goes to a Canvas of the Manifest shown", async () => {
    const clover = createClover();
    await clover.load(hotspotJson as any);
    const annotation = hotspotJson.items[0].annotations![0].items[0];
    expect(showLink(clover, readLink(annotation)!)).toBe(true);
    expect(clover.store.get().canvasId).toBe(`${BASE}/canvas/p2`);
    // A Canvas of no Manifest it can reach: nowhere.
    expect(showLink(clover, { id: "x", canvasId: "x" })).toBe(false);
  });
});
