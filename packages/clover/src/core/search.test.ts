import {
  CANVAS,
  SEARCH_V1,
  SEARCH_V2,
  manifest,
  v1Page,
  v2Pages,
} from "../fixtures/search";
import { p4 } from "../fixtures/presentation4";
import { search } from "./search";
import { SEARCH_SET_ID, searchServiceOf } from "./search-service";

function mockFetch(table: Record<string, unknown>) {
  return vi.fn(async (url: string) =>
    table[url] === undefined
      ? new Response("missing", { status: 404 })
      : new Response(JSON.stringify(table[url]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
  );
}

describe("searchServiceOf", () => {
  it("finds version 2 by type, preferring it to version 1", () => {
    const service = searchServiceOf(
      p4(
        manifest([
          { id: SEARCH_V1, type: "SearchService1" },
          { id: SEARCH_V2, type: "SearchService2" },
        ]),
      ),
    );
    expect(service).toEqual({ id: SEARCH_V2, version: 2 });
  });

  it("finds version 1 by its profile, as Presentation 2 publishes it", () => {
    const service = searchServiceOf({
      ...p4(manifest([])),
      service: [
        {
          "@context": "http://iiif.io/api/search/1/context.json",
          "@id": SEARCH_V1,
          profile: "http://iiif.io/api/search/1/search",
        },
      ],
    } as never);
    expect(service).toEqual({ id: SEARCH_V1, version: 1 });
  });

  it("never takes autocomplete for search, though they share a context", () => {
    const autocomplete = "https://example.org/autocomplete";
    const service = searchServiceOf({
      ...p4(manifest([])),
      service: [
        {
          "@context": "http://iiif.io/api/search/1/context.json",
          "@id": autocomplete,
          profile: "http://iiif.io/api/search/1/autocomplete",
        },
        { id: autocomplete, type: "AutoCompleteService2" },
        {
          "@context": "http://iiif.io/api/search/1/context.json",
          "@id": SEARCH_V1,
          profile: "http://iiif.io/api/search/1/search",
        },
      ],
    } as never);
    expect(service).toEqual({ id: SEARCH_V1, version: 1 });
  });

  it("is null without a search service", () => {
    expect(searchServiceOf(p4(manifest([])))).toBeNull();
  });
});

describe("search", () => {
  it("reads version 2: highlights with their quotes, across pages", async () => {
    const fetch = mockFetch(v2Pages);
    const results = await search({ id: SEARCH_V2, version: 2 }, "bird", {
      request: { fetch },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      results.hits.map((hit) => [
        hit.canvasId,
        hit.before,
        hit.match,
        hit.after,
      ]),
    ).toEqual([
      [CANVAS(1), "There are two ", "birds", " in the bush"],
      [CANVAS(1), "one ", "bird", " in the hand"],
      [CANVAS(2), undefined, "Birdsong", undefined],
    ]);
    expect(results.set.id).toBe(SEARCH_SET_ID);
    expect(results.set.source).toBe("search");
    expect(results.set.entries[1].target).toMatchObject({
      id: CANVAS(1),
      rect: { x: 100, y: 400, w: 250, h: 20 },
    });
  });

  it("reads version 1: a hit over several annotations, either target form", async () => {
    const results = await search({ id: SEARCH_V1, version: 1 }, "bird", {
      request: { fetch: mockFetch(v1Page) },
    });
    expect(results.hits).toHaveLength(1);
    const [hit] = results.hits;
    expect(hit).toMatchObject({
      canvasId: CANVAS(2),
      before: "a ",
      match: "blue bird",
      after: " sang",
      entryIds: [
        "https://example.org/v1/anno/1",
        "https://example.org/v1/anno/2",
      ],
    });
    // Both drawn as Presentation 4 highlighting annotations on the Canvas.
    expect(results.set.entries.map((entry) => entry.annotation.target)).toEqual(
      [`${CANVAS(2)}#xywh=100,100,40,20`, `${CANVAS(2)}#xywh=150,100,40,20`],
    );
  });

  it("keeps only text around a result, never an object a service sends in its place", async () => {
    // An element's shape where text belongs, as JSON gives it (GHSA-36hm-qxxp-pg3m).
    const forged = JSON.parse(
      '{"type":"img","props":{"dangerouslySetInnerHTML":{"__html":"<img src=x onerror=alert(1)>"}},"constructor":null}',
    );
    const v1 = JSON.parse(JSON.stringify(v1Page));
    Object.assign(v1[`${SEARCH_V1}?q=bird`].hits[0], {
      before: forged,
      after: forged,
    });
    const [hit] = (
      await search({ id: SEARCH_V1, version: 1 }, "bird", {
        request: { fetch: mockFetch(v1) },
      })
    ).hits;
    expect([hit.before, hit.match, hit.after]).toEqual([
      undefined,
      "blue bird",
      undefined,
    ]);

    const v2 = JSON.parse(JSON.stringify(v2Pages));
    for (const page of Object.values(v2) as any[])
      for (const group of page.annotations ?? [])
        for (const annotation of group.items)
          for (const target of annotation.target)
            for (const selector of target.selector)
              Object.assign(selector, { prefix: forged, suffix: forged });
    const hits = (
      await search({ id: SEARCH_V2, version: 2 }, "bird", {
        request: { fetch: mockFetch(v2) },
      })
    ).hits;
    expect(hits.map((each) => [each.before, each.match, each.after])).toEqual([
      [undefined, "birds", undefined],
      [undefined, "bird", undefined],
      [undefined, "Birdsong", undefined],
    ]);
  });
});
