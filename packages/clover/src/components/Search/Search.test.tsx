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
import { createClover } from "../../core/clover";

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

  it("steps through the hits with Previous and Next, saying which is current", async () => {
    const fetch = mockFetch();
    render(
      <Clover.Root iiifContent={withSearch} request={{ fetch }}>
        <Clover.Label of="canvas" data-testid="canvas" />
        <Clover.Search />
      </Clover.Root>,
    );
    const field = await screen.findByRole("searchbox", { name: "Search" });
    fireEvent.change(field, { target: { value: "bird" } });
    fireEvent.submit(field);
    await screen.findByText("3 results");

    // The answer goes to its first hit, as find in a page does: nothing before it.
    await screen.findByText("Result 1 of 3");
    const hits = screen
      .getAllByRole("listitem")
      .map((item) => within(item).getByRole("button"));
    expect(hits[0]).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Previous" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // Focus stays in the field.
    expect(document.activeElement).not.toBe(hits[0]);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Result 2 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Result 3 of 3");
    await waitFor(() =>
      expect(screen.getByTestId("canvas")).toHaveTextContent("Page 2"),
    );
    // The last: Next stays where it is, focus kept on it (WCAG 2.4.3).
    expect(screen.getByRole("button", { name: "Next" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await screen.findByText("Result 2 of 3");
  });

  it("clears with its own Clear, focus back in the field", async () => {
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
    await screen.findByText("Result 1 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    const field = screen.getByRole("searchbox", { name: "Search" });
    expect(field).toHaveValue("");
    expect(document.activeElement).toBe(field);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Birdsong" })).toBeNull(),
    );
    // Nothing to clear, no Clear.
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("is large by default, and small when asked", async () => {
    const { rerender } = render(
      <Clover.Root iiifContent={withSearch}>
        <Clover.Search />
      </Clover.Root>,
    );
    const part = () => screen.getByRole("search");
    await screen.findByRole("search");
    expect(part()).toHaveAttribute("data-size", "large");
    rerender(
      <Clover.Root iiifContent={withSearch}>
        <Clover.Search size="small" />
      </Clover.Root>,
    );
    expect(part()).toHaveAttribute("data-size", "small");
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
    // Said in the status, and shown in the pill.
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("status")
          .some((status) => status.textContent === "No results"),
      ).toBe(true),
    );
    expect(
      within(screen.getByRole("search")).getByText("No results"),
    ).toBeInTheDocument();
    fireEvent.change(field, { target: { value: "boom" } });
    fireEvent.submit(field);
    expect(
      await screen.findByText("The search could not be completed."),
    ).toBeInTheDocument();
  });
});

describe("clover.search", () => {
  it("draws the hits as a set beside the annotations, and forgets them on another Manifest", async () => {
    const clover = createClover({ request: { fetch: mockFetch() } });
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

describe("Search in the Panel", () => {
  let fetch = mockFetch();
  beforeEach(() => (fetch = mockFetch()));
  const panel = (props: Record<string, unknown> | null, query: string) => (
    <Clover.Root
      iiifContent={withSearch}
      request={{ fetch }}
      searchQuery={query}
    >
      {props && <Clover.Panel {...props} />}
    </Clover.Root>
  );
  const searched = () =>
    waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("?q="),
        expect.anything(),
      ),
    );
  const tab = (name: string) => screen.findByRole("tab", { name });

  it("opens on Search for a query it did not start, focus left where it was", async () => {
    render(panel({}, "bird"));
    expect(await tab("Search")).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("3 results")).toBeInTheDocument();
    expect(document.activeElement).toBe(document.body);
  });

  it("lets a query beat defaultValue, and a controlled value beat both", async () => {
    const { unmount } = render(panel({ defaultValue: "about" }, "bird"));
    expect(await tab("Search")).toHaveAttribute("aria-selected", "true");
    unmount();

    render(panel({ value: "about" }, "bird"));
    await searched();
    expect(await tab("About")).toHaveAttribute("aria-selected", "true");
  });

  it("opens on Search when a Panel that was shut shows after the query", async () => {
    const { rerender } = render(panel(null, "bird"));
    await searched();
    rerender(panel({}, "bird"));
    expect(await tab("Search")).toHaveAttribute("aria-selected", "true");
  });

  it("draws its hits only while its section is open", async () => {
    function Hidden() {
      const hidden = Clover.useCloverSelector((state) =>
        state.hiddenSets.includes(Clover.SEARCH_SET_ID),
      );
      return <p data-testid="hits">{hidden ? "hidden" : "drawn"}</p>;
    }
    render(
      <Clover.Root
        iiifContent={withSearch}
        request={{ fetch }}
        searchQuery="bird"
      >
        <Clover.Panel />
        <Hidden />
      </Clover.Root>,
    );
    expect(await tab("Search")).toHaveAttribute("aria-selected", "true");
    await waitFor(() =>
      expect(screen.getByTestId("hits")).toHaveTextContent("drawn"),
    );
    fireEvent.click(await tab("About"));
    await waitFor(() =>
      expect(screen.getByTestId("hits")).toHaveTextContent("hidden"),
    );
    fireEvent.click(await tab("Search"));
    await waitFor(() =>
      expect(screen.getByTestId("hits")).toHaveTextContent("drawn"),
    );
  });

  it("holds the count and steps inside its field, the field held in view", async () => {
    render(panel({ layout: "accordion" }, "bird"));
    await screen.findByText("Result 1 of 3");
    const field = screen.getByRole("search");
    expect(within(field).getByRole("button", { name: "Next" })).toBeVisible();
    expect(within(field).getByText("1 / 3")).toBeInTheDocument();
    // The field is held in view there (`sticky`).
    expect(field.closest(".clover-content-search")).toHaveAttribute(
      "data-sticky",
    );
  });

  it("takes focus in its field as the reader opens its section, in an accordion", async () => {
    render(panel({ layout: "accordion" }, ""));
    const heading = await screen.findByRole("button", { name: "Search" });
    fireEvent.click(heading);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("searchbox", { name: "Search" }),
      ),
    );
  });

  it("stays where the reader went until another query", async () => {
    const { rerender } = render(panel({}, "bird"));
    expect(await tab("Search")).toHaveAttribute("aria-selected", "true");
    fireEvent.click(await tab("About"));
    expect(await tab("About")).toHaveAttribute("aria-selected", "true");

    rerender(panel({}, "birds"));
    await waitFor(async () =>
      expect(await tab("Search")).toHaveAttribute("aria-selected", "true"),
    );
  });
});

describe("A long answer", () => {
  // A hundred hits on page 1, one answer page, no context: each its own match.
  const many = {
    "@context": "http://iiif.io/api/search/2/context.json",
    type: "AnnotationPage",
    items: Array.from({ length: 100 }, (_, n) => ({
      id: `https://example.org/hit/many-${n}`,
      type: "Annotation",
      motivation: "highlighting",
      body: { type: "TextualBody", value: `die ${n}` },
      target: `${CANVAS(1)}#xywh=10,${10 + n * 12},40,10`,
    })),
  };
  const observers: Array<(entries: { isIntersecting: boolean }[]) => void> = [];
  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(
          callback: (entries: { isIntersecting: boolean }[]) => void,
        ) {
          observers.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("draws its hits a chunk at a time, the current one always among them", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(many), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    render(
      <Clover.Root
        iiifContent={withSearch}
        request={{ fetch }}
        searchQuery="die"
      >
        <Clover.Search />
      </Clover.Root>,
    );
    await screen.findByText("Result 1 of 100");
    const drawn = () => screen.getAllByRole("listitem").length;
    expect(drawn()).toBe(40);

    // The end nears the view: the next chunk.
    observers.at(-1)?.([{ isIntersecting: true }]);
    await waitFor(() => expect(drawn()).toBe(80));

    // Focus on one of the last few drawn: more, so Tab never runs out first.
    fireEvent.focus(screen.getByRole("button", { name: "die 77" }));
    await waitFor(() => expect(drawn()).toBe(100));
  });
});
