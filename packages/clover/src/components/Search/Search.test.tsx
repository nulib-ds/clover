import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";

import { CANVAS, SEARCH_V2, manifest, v2Pages } from "../../fixtures/search";
import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";

const withSearch = manifest([{ id: SEARCH_V2, type: "SearchService2" }]);

function mockFetch() {
  return vi.fn(async (url: string) => {
    const body = (v2Pages as Record<string, unknown>)[url];
    return body === undefined
      ? new Response("missing", { status: 404 })
      : new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  });
}

beforeEach(() => initCloverI18n({ lng: "en" }));

describe("Search", () => {
  it("is a tab when the Manifest has a search service, and not otherwise", async () => {
    const { unmount } = render(
      <Clover.Root iiifContent={manifest([])}>
        <Clover.Panel />
      </Clover.Root>,
    );
    await screen.findByRole("tab", { name: "About" });
    expect(screen.queryByRole("tab", { name: "Search" })).toBeNull();
    unmount();

    render(
      <Clover.Root iiifContent={withSearch}>
        <Clover.Panel />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("tab", { name: "Search" }),
    ).toBeInTheDocument();
  });

  it("lists the hits by Canvas, words around them, and goes to the one chosen", async () => {
    const fetch = mockFetch();
    render(
      <Clover.Root iiifContent={withSearch} request={{ fetch }}>
        <Clover.Label of="canvas" data-testid="canvas" />
        <Clover.Search />
      </Clover.Root>,
    );
    const field = await screen.findByRole("searchbox", { name: "Search" });
    fireEvent.change(field, { target: { value: "bird" } });
    fireEvent.submit(within(screen.getByRole("search")).getByRole("searchbox"));

    const groups = await screen.findAllByRole("heading", { level: 3 });
    expect(groups.map((group) => group.textContent)).toEqual([
      "Page 1",
      "Page 2",
    ]);
    expect(screen.getByText("3 results")).toBeInTheDocument();
    const hit = screen.getByRole("button", { name: "Birdsong" });
    expect(
      within(
        screen.getAllByRole("button", { name: /birds in the bush/ })[0],
      ).getByText("birds").tagName,
    ).toBe("MARK");

    fireEvent.click(hit);
    await waitFor(() =>
      expect(screen.getByTestId("canvas")).toHaveTextContent("Page 2"),
    );
    expect(hit).toHaveAttribute("aria-current", "true");

    // Emptying the field clears them.
    fireEvent.change(field, { target: { value: "" } });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Birdsong" })).toBeNull(),
    );
  });

  it("runs the Root's searchQuery once the Manifest is shown", async () => {
    const fetch = mockFetch();
    render(
      <Clover.Root
        iiifContent={withSearch}
        request={{ fetch }}
        searchQuery="bird"
      >
        <Clover.Search />
      </Clover.Root>,
    );
    expect(await screen.findByText("3 results")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveValue("bird");
    expect(fetch.mock.calls[0][0]).toBe(`${SEARCH_V2}?q=bird`);
  });

  it("says when nothing matched, or the service failed", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.includes("q=none")
        ? new Response(JSON.stringify({ type: "AnnotationPage", items: [] }), {
            status: 200,
          })
        : new Response("down", { status: 500 }),
    );
    render(
      <Clover.Root iiifContent={withSearch} request={{ fetch }}>
        <Clover.Search />
      </Clover.Root>,
    );
    const field = await screen.findByRole("searchbox");
    fireEvent.change(field, { target: { value: "none" } });
    fireEvent.submit(field);
    expect(await screen.findByText("No results")).toBeInTheDocument();
    fireEvent.change(field, { target: { value: "boom" } });
    fireEvent.submit(field);
    expect(
      await screen.findByText("The search could not be completed."),
    ).toBeInTheDocument();
  });
});

describe("clover.search", () => {
  it("draws the hits as a set beside the annotations, and forgets them on another Manifest", async () => {
    const clover = Clover.createClover({ request: { fetch: mockFetch() } });
    await clover.load(withSearch);
    await clover.search("bird");
    const { search } = clover.store.get();
    expect(search.status).toBe("ready");
    expect(search.set?.id).toBe(Clover.SEARCH_SET_ID);
    expect(search.set?.entries.map((entry) => entry.canvasId)).toEqual([
      CANVAS(1),
      CANVAS(1),
      CANVAS(2),
    ]);

    clover.selectAnnotation(search.hits[2].entryIds[0]);
    expect(clover.store.get().canvasId).toBe(CANVAS(2));

    await clover.load(manifest([]));
    expect(clover.store.get().search.status).toBe("idle");
    expect(clover.store.get().search.set).toBeNull();
  });
});
