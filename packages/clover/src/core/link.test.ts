import { readLink, readTagSource } from "./link";
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
const specific = (source: unknown) => ({ type: "SpecificResource", source });

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
      readLink(
        linking(specific({ id: "https://example.org/m", type: "Manifest" })),
      ),
    ).toEqual({
      id: "https://example.org/m",
      manifestId: "https://example.org/m",
    });
    expect(readLink(linking(specific("https://example.org/page")))).toEqual({
      id: "https://example.org/page",
    });
    expect(readLink(linking(specific("javascript:alert(1)")))).toBeUndefined();
  });

  it("follows only a SpecificResource's source, never a body's own id", () => {
    expect(
      readLink(linking({ id: "https://example.org/page", type: "Text" })),
    ).toBeUndefined();
    expect(readLink(linking("https://example.org/page"))).toBeUndefined();
    expect(readLink(linking(specific("")))).toBeUndefined();
  });

  it("reads nothing from an annotation that is not linking", () => {
    expect(
      readLink({
        ...linking(specific("https://example.org/page")),
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

// Cookbook 0258: a tag beside the Wikidata entity it names.
describe("readTagSource", () => {
  const tag = {
    type: "Annotation",
    motivation: "tagging",
    body: [
      {
        type: "SpecificResource",
        source: "http://www.wikidata.org/entity/Q18624915",
      },
      { type: "TextualBody", value: "Gänseliesel-Brunnen", language: "de" },
    ],
  };

  it("reads what a tag names on the web", () => {
    expect(readTagSource(tag)).toEqual({
      id: "http://www.wikidata.org/entity/Q18624915",
    });
  });

  it("is no link to follow on the image", () => {
    expect(readLink(tag)).toBeUndefined();
  });

  it("reads nothing from a tag of words alone, or an address that is no web page", () => {
    expect(readTagSource({ ...tag, body: tag.body[1] })).toBeUndefined();
    expect(
      readTagSource({
        ...tag,
        body: { type: "SpecificResource", source: "javascript:alert(1)" },
      }),
    ).toBeUndefined();
  });

  // Cookbook 0139: a geotag's GeoJSON Feature has an id that only identifies it.
  it("reads nothing from a body that is a resource itself", () => {
    expect(
      readTagSource({
        ...tag,
        body: {
          id: "https://example.org/geo.json",
          type: "Feature",
          geometry: { type: "Point", coordinates: [0, 0] },
        },
      }),
    ).toBeUndefined();
    expect(
      readTagSource({ ...tag, body: "http://www.wikidata.org/entity/Q1" }),
    ).toBeUndefined();
  });
});
