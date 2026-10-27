import * as newspaper from "docs/mocks/content-search/index.mjs";
import * as catalog from "docs/mocks/paged/index.mjs";

import { SEARCHABLE, mockSearchFetch } from "./mock-search";

const json = async (response: Response) => response.json();

describe("the mocks' searches, answered in the browser", () => {
  it("knows each mock where its generator publishes it", () => {
    expect(SEARCHABLE["content-search"]).toBe(newspaper.PUBLIC_BASE);
    expect(SEARCHABLE.paged).toBe(catalog.PUBLIC_BASE);
  });

  it("searches the catalog by word, each hit on a page's words", async () => {
    const answer = await json(
      await mockSearchFetch(`${catalog.PUBLIC_BASE}/search?q=steel`),
    );
    expect(answer.partOf.total).toBeGreaterThan(25);
    expect(answer.items).toHaveLength(25);
    expect(answer.next.id).toContain("page=2");
    const [hit] = answer.items;
    expect(hit.motivation).toBe("highlighting");
    expect(hit.target.source.id).toMatch(/\/mocks\/paged\/canvas\/\d+$/);
    expect(hit.target.selector.value).toMatch(/^xywh=\d+,\d+,\d+,\d+$/);
    // The words around it, quoted.
    const [context] = answer.annotations[0].items;
    expect(context.target.selector[0].exact.toLowerCase()).toContain("steel");
  });

  it("finds a phrase across words, and nothing for a word that is not there", async () => {
    const phrase = await json(
      await mockSearchFetch(`${catalog.PUBLIC_BASE}/search?q=model%20d`),
    );
    expect(phrase.partOf.total).toBeGreaterThan(0);
    const miss = await json(
      await mockSearchFetch(`${catalog.PUBLIC_BASE}/search?q=zzzz`),
    );
    expect(miss.partOf.total).toBe(0);
  });

  it("answers the newspaper as before", async () => {
    const answer = await json(
      await mockSearchFetch(
        `${newspaper.PUBLIC_BASE}/search?q=${encodeURIComponent("Moskau")}`,
      ),
    );
    expect(answer.partOf.total).toBe(11);
  });

  it("passes everything else on", async () => {
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}"));
    await mockSearchFetch(`${catalog.PUBLIC_BASE}/manifest.json`);
    expect(network).toHaveBeenCalledWith(
      `${catalog.PUBLIC_BASE}/manifest.json`,
      undefined,
    );
    network.mockRestore();
  });
});

describe("the catalog's OCR", () => {
  it("gives each page read its words and its lines, at their granularity", () => {
    const pages = catalog.pagesOfWords();
    expect(pages).toHaveLength(31);
    const read = pages.filter((page) => page.words.length);
    expect(read.length).toBeGreaterThan(25);
    const words = catalog.ocrPage(catalog.PUBLIC_BASE, read[1].key, "word")!;
    expect(words.items[0]).toMatchObject({
      motivation: "supplementing",
      textGranularity: "word",
      body: { type: "TextualBody", language: "en" },
    });
    expect(words.items[0].target).toMatch(/#xywh=\d+,\d+,\d+,\d+$/);
  });

  it("offers its search service in the Manifest", () => {
    expect(catalog.manifest().service).toContainEqual({
      id: `${catalog.PUBLIC_BASE}/search`,
      type: "SearchService2",
    });
  });
});
