import { describe, expect, it } from "vitest";
import { buildContentState } from "../../packages/clover/src/core/content-state";
import {
  contentStateNote,
  itemIds,
  loadable,
  rootAddress,
} from "docs/lib/resource-content";

const encode = (state: unknown) =>
  btoa(encodeURIComponent(JSON.stringify(state)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

describe("homepage resource addresses", () => {
  it("accepts web addresses and encoded content states, rejecting other input", () => {
    const url = "https://example.org/manifest.json?as=iiif";
    expect(loadable(` ${url} `)).toBe(url);
    expect(rootAddress(url)).toBe(url);
    const state = encode({ target: url });
    expect(loadable(state)).toBe(state);
    expect(rootAddress(state)).toBe(url);
    for (const value of [
      "javascript:alert(1)",
      "/manifest.json",
      "not-a-state",
      encode(null),
    ]) {
      expect(loadable(value)).toBeUndefined();
      expect(rootAddress(value)).toBeUndefined();
    }
  });

  it("reads Collections and a target's parent Manifest, with no selected fragment", () => {
    expect(
      rootAddress(
        encode({
          target: { id: "https://example.org/collection", type: "Collection" },
        }),
      ),
    ).toBe("https://example.org/collection");
    expect(
      rootAddress(
        encode({
          target: {
            type: "Canvas",
            partOf: {
              type: "Manifest",
              id: "https://example.org/manifest#selection",
            },
          },
        }),
      ),
    ).toBe("https://example.org/manifest");
    expect(
      rootAddress(encode({ target: "https://example.org/manifest#selection" })),
    ).toBe("https://example.org/manifest");
    // Presentation 2 names its kind by `@type`.
    expect(
      rootAddress(
        encode({
          target: {
            "@id": "https://example.org/canvas/1",
            "@type": "sc:Canvas",
            partOf: {
              "@id": "https://example.org/manifest",
              "@type": "sc:Manifest",
            },
          },
        }),
      ),
    ).toBe("https://example.org/manifest");
  });

  it("reads the Manifest of a content state Clover writes for a time or a region", () => {
    const manifestId = "https://example.org/manifest";
    const canvasId = "https://example.org/canvas/1";
    for (const view of [
      { time: 85.67 },
      { region: { x: 10, y: 20, w: 300, h: 200 } },
    ]) {
      const { json, encoded } = buildContentState({
        manifestId,
        canvasId,
        ...view,
      });
      // Clover's SpecificResource, its Canvas and that Canvas's Manifest in its `source`.
      expect(json.target).toMatchObject({ type: "SpecificResource" });
      expect(rootAddress(encoded)).toBe(manifestId);
    }
    expect(
      rootAddress(
        encode({
          target: {
            type: "SpecificResource",
            source: "https://example.org/manifest#selection",
          },
        }),
      ),
    ).toBe("https://example.org/manifest");
  });

  // Mat, 2026-11-12: a content state that targets a search's hit, by its `id`.
  it("reads the Manifest of a content state that targets an annotation, and where it opens", () => {
    const state = encode({
      type: "Annotation",
      motivation: ["contentState"],
      target: {
        id: "https://example.org/search/hit/3-w7",
        type: "Annotation",
        target: {
          type: "SpecificResource",
          source: {
            id: "https://example.org/canvas/3",
            type: "Canvas",
            partOf: [{ id: "https://example.org/manifest", type: "Manifest" }],
          },
          selector: { type: "FragmentSelector", value: "xywh=10,20,30,40" },
        },
      },
    });
    expect(rootAddress(state)).toBe("https://example.org/manifest");
    const items = [1, 2, 3, 4].map((n) => `https://example.org/canvas/${n}`);
    expect(contentStateNote(state, items)).toEqual([
      { word: "Canvas", text: "3 / 4" },
      { text: "xywh=10,20,30,40" },
    ]);
  });

  it("ignores unknown or malformed targets without throwing", () => {
    for (const target of [
      null,
      {},
      { type: "Canvas", partOf: "unexpected" },
      { type: "Canvas", partOf: [null] },
      { type: "SpecificResource" },
      { type: "SpecificResource", source: { type: "Canvas" } },
    ]) {
      expect(rootAddress(encode({ target }))).toBeUndefined();
    }
  });
});

describe("where a content state opens, said in the homepage's field", () => {
  const manifestId = "https://example.org/manifest";
  const canvas = (n: number) => `https://example.org/canvas/${n}`;
  const items = Array.from({ length: 12 }, (_, i) => canvas(i + 1));
  // As a wide field shows it: a place's word before its figures.
  const said = (content: string, list?: string[]) =>
    contentStateNote(content, list)?.map(({ word, text }) =>
      word ? `${word} ${text}` : text,
    );

  it("gives the Canvas's place where there are several, and its time or region", () => {
    const at = (view: object, n = 3) =>
      buildContentState({ manifestId, canvasId: canvas(n), ...view }).encoded;
    expect(contentStateNote(at({ time: 85.67 }), items)).toEqual([
      { word: "Canvas", text: "3 / 12" },
      { text: "1:25" },
    ]);
    expect(
      said(at({ region: { x: 10, y: 20, w: 300, h: 200 } }), items),
    ).toEqual(["Canvas 3 / 12", "xywh=10,20,300,200"]);
    expect(said(at({ time: 3723 }))).toEqual(["1:02:03"]);
    // One Canvas has no place to give, and a Canvas alone no time or region to say.
    expect(said(at({ time: 85.67 }, 1), [canvas(1)])).toEqual(["1:25"]);
    expect(contentStateNote(at({}, 1), [canvas(1)])).toBeUndefined();
  });

  it("reads a time's range, a point, a fragment in the id and a Timeline", () => {
    const note = (target: unknown) =>
      said(encode({ type: "Annotation", target }), items);
    expect(
      note({
        type: "SpecificResource",
        source: { id: canvas(2), type: "Canvas" },
        selector: {
          type: "FragmentSelector",
          value: "xywh=1,2,3,4&t=85.67,100.5",
        },
      }),
    ).toEqual(["Canvas 2 / 12", "1:25–1:40", "xywh=1,2,3,4"]);
    expect(
      note({
        type: "SpecificResource",
        source: canvas(2),
        selector: { type: "PointSelector", t: 30 },
      }),
    ).toEqual(["Canvas 2 / 12", "0:30"]);
    expect(note({ id: `${canvas(12)}#t=npt:61`, type: "Canvas" })).toEqual([
      "Canvas 12 / 12",
      "1:01",
    ]);
    expect(note({ id: canvas(5), type: "Timeline" })).toEqual([
      "Timeline 5 / 12",
    ]);
  });

  it("says nothing for an address, a Manifest, a Collection or a malformed target", () => {
    expect(contentStateNote(manifestId, items)).toBeUndefined();
    for (const target of [
      { id: manifestId, type: "Manifest" },
      { id: "https://example.org/collection", type: "Collection" },
      null,
      {},
      { type: "SpecificResource" },
    ]) {
      expect(contentStateNote(encode({ target }), items)).toBeUndefined();
    }
  });

  it("lists a Manifest's items in Presentation 3 and 2, and nothing for a Collection", () => {
    expect(
      itemIds({ type: "Manifest", items: [{ id: canvas(1) }, {}] }),
    ).toEqual([canvas(1)]);
    expect(
      itemIds({
        "@type": "sc:Manifest",
        sequences: [{ canvases: [{ "@id": canvas(1) }, { "@id": canvas(2) }] }],
      }),
    ).toEqual([canvas(1), canvas(2)]);
    expect(
      itemIds({ type: "Collection", items: [{ id: manifestId }] }),
    ).toBeUndefined();
  });
});
