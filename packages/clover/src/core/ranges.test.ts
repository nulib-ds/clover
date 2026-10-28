import bookJson from "../fixtures/iiif-cookbook/0024-book-4-toc.json";
import articlesJson from "../fixtures/iiif-cookbook/0025-newspaper-article-index.json";
import sequencesJson from "../fixtures/iiif-cookbook/0027-alternative-page-order.json";
import behaviorsJson from "../fixtures/iiif-cookbook/0229-behavior-ranges.json";
import operaJson from "../fixtures/iiif-cookbook/0026-toc-opera.json";
import { p4 } from "../fixtures/presentation4";
import { CONTENTS_SET_ID } from "./annotation-sets";
import { contentsSet } from "./range-regions";
import { chaptersOf, currentContents, tableOfContents } from "./ranges";

describe("tableOfContents", () => {
  it("unwraps a single top Range and nests the rest", () => {
    const toc = tableOfContents(p4(bookJson));
    expect(toc.map((node) => node.label)).toEqual(
      bookJson.structures[0].items.map((range: any) => range.label),
    );
    const second = toc[1];
    expect(second.children.length).toBeGreaterThan(0);
    // A Range made only of Ranges starts where its first child starts.
    expect(second.canvasId).toBe(second.children[0].canvasId);
  });

  it("marks the deepest entry covering the Canvas, not only its first", () => {
    const toc = tableOfContents(p4(bookJson));
    const [first] = toc;
    expect(currentContents(toc, first.canvasIds[1])).toBe(first.id);
    const monday = toc[1].children[0];
    expect(currentContents(toc, monday.canvasIds[0])).toBe(monday.id);
  });

  it("follows time through an opera's acts", () => {
    const toc = tableOfContents(p4(operaJson));
    const canvas = operaJson.items[0].id;
    const acts = toc[0].children.length ? toc[0].children : toc;
    expect(acts[0].time?.start).toBe(0);
    expect(currentContents(toc, canvas, 10)).toBe(
      currentContents(toc, canvas, 20),
    );
    expect(currentContents(toc, canvas, 4000)).not.toBe(
      currentContents(toc, canvas, 10),
    );
  });

  it("is empty without structures", () => {
    expect(tableOfContents(p4({ ...bookJson, structures: undefined }))).toEqual(
      [],
    );
  });

  // Cookbook 0025: an article in columns, page 2 then page 5, read in its Range's order.
  it("gives an article its parts in the order its Range reads them", () => {
    const [news, tournament] = tableOfContents(p4(articlesJson));
    const page = (n: number) => (articlesJson.items[n - 1] as any).id;
    expect(news.parts?.map((part) => part.canvasId)).toEqual([
      page(2),
      page(2),
      page(5),
      page(5),
    ]);
    expect(news.parts?.[0].region).toEqual({
      x: 553,
      y: 1157,
      w: 470,
      h: 1103,
    });
    expect(tournament.parts).toHaveLength(3);
    // Every one of its pages counts it current, page 5 too.
    expect(currentContents([news, tournament], page(5))).toBe(news.id);
  });

  it("keeps no parts for whole pages in order, nor for a recording's time", () => {
    const [first] = tableOfContents(p4(bookJson));
    expect(first.parts).toBeUndefined();
    tableOfContents(p4(operaJson)).forEach((node) =>
      expect(node.parts).toBeUndefined(),
    );
  });

  it("draws the regions the Ranges name as a set of their own, each named for its Range", () => {
    const set = contentsSet(p4(articlesJson))!;
    expect(set.id).toBe(CONTENTS_SET_ID);
    expect(set.source).toBe("contents");
    expect(set.entries).toHaveLength(7);
    expect(set.entries[0].target.rect).toEqual({
      x: 553,
      y: 1157,
      w: 470,
      h: 1103,
    });
    expect(set.entries[0].bodies[0]).toEqual({
      value: "Tagesneuigkeiten",
      language: "de",
    });
    // Each with its place among its article's parts, which its hotspot shows.
    expect(set.entries.map((entry) => entry.place)).toEqual([
      { index: 1, total: 4 },
      { index: 2, total: 4 },
      { index: 3, total: 4 },
      { index: 4, total: 4 },
      { index: 1, total: 3 },
      { index: 2, total: 3 },
      { index: 3, total: 3 },
    ]);
    expect(set.entries[0].annotation.body).toEqual([
      { type: "TextualBody", value: "Tagesneuigkeiten", language: "de" },
    ]);
    expect(contentsSet(p4(bookJson))).toBeNull();
  });

  // Cookbook 0027: two orders of the same four pages, the first the default.
  it("takes the first of two sequences as current, until the reader chooses the other", () => {
    const toc = tableOfContents(p4(sequencesJson));
    const [physical, author] = toc;
    expect(physical.sequence).toBe(true);
    const page = (sequencesJson.items[0] as any).id;
    expect(currentContents(toc, page)).toBe(physical.id);
    expect(currentContents(toc, page, undefined, author.id)).toBe(author.id);
    // Each sequence's pages, in its order, to step through: the physical one's too.
    expect(author.parts?.map((part) => part.canvasId)).toEqual(
      (sequencesJson.structures[1] as any).items.map((item: any) => item.id),
    );
    expect(physical.parts).toHaveLength(4);
  });

  it("keeps the deepest entry current inside the one the reader chose", () => {
    const toc = tableOfContents(p4(operaJson));
    const [act] = toc;
    const canvas = act.canvasId!;
    // Atto Primo chosen, its first scene playing: the scene is current.
    expect(currentContents(toc, canvas, 10, act.id)).toBe(act.children[0].id);
  });

  // Cookbook 0229: the first 9 seconds are `no-nav`, in Contents and on the seek bar alike.
  it("leaves a no-nav Range's stretch out of the chapters, as Contents does", () => {
    const manifest = p4(behaviorsJson);
    const canvas = (behaviorsJson.items[0] as any).id;
    const chapters = chaptersOf(manifest, canvas, 3307.22);
    expect(chapters[0].start).toBe(9);
    expect(chapters).toHaveLength(10);
    expect(tableOfContents(manifest)).toHaveLength(10);
  });

  // Cookbook 0229: each chapter's Range has a picture of it, shown as it is (no service).
  it("gives each chapter and entry its Range's thumbnail, as written", () => {
    const manifest = p4(behaviorsJson);
    const canvas = (behaviorsJson.items[0] as any).id;
    const thumbnail = {
      id: "https://fixtures.iiif.io/video/indiana/donizetti-elixir/thumbnails/thumb-nav-01.png",
      type: "Image",
    };
    expect(chaptersOf(manifest, canvas, 3307.22)[0].thumbnail).toMatchObject(
      thumbnail,
    );
    expect(tableOfContents(manifest)[0].thumbnail).toMatchObject(thumbnail);
    // One without a thumbnail has none.
    expect(tableOfContents(p4(operaJson))[0]).not.toHaveProperty("thumbnail");
  });
});
