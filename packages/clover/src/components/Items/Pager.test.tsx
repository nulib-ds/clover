import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";

import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";

const BOOK = bookJson.id;
const LETTER = "https://example.org/letter";
const letter = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: LETTER,
  type: "Manifest",
  label: { en: ["A letter"] },
  items: [
    {
      id: `${LETTER}/canvas/1`,
      type: "Canvas",
      width: 100,
      height: 100,
      items: [],
    },
  ],
};
const shelf = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.org/shelf",
  type: "Collection",
  label: { en: ["Shelf"] },
  items: [
    { id: BOOK, type: "Manifest", label: { en: ["The book"] } },
    { id: LETTER, type: "Manifest", label: { en: ["A letter"] } },
  ],
};

function mockFetch() {
  const table: Record<string, unknown> = { [BOOK]: bookJson, [LETTER]: letter };
  return vi.fn(async (url: string) =>
    table[url] === undefined
      ? new Response("missing", { status: 404 })
      : new Response(JSON.stringify(table[url]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
  );
}

/** The book is `paged`: its five pages are three views, the cover and two spreads. */
const VIEWS = 3;

/** What the Position shows, its count for sight; for members, the count's button. */
const shown = (pager: HTMLElement) =>
  pager.querySelector(
    ".clover-pager-position > [aria-hidden]:not(.clover-pager-room), .clover-pager-count-button .clover-pager-position > span:first-child",
  )?.textContent;

beforeEach(() => initCloverI18n({ lng: "en" }));

describe("Items' pager", () => {
  it("steps through the Root's views, in a nav named as Items are", async () => {
    render(
      <Clover.Root iiifContent={bookJson}>
        <Clover.Items layout="pager" />
      </Clover.Root>,
    );
    const pager = await screen.findByRole("navigation", { name: "Items" });
    expect(shown(pager)).toBe(`1 / ${VIEWS}`);
    expect(pager).toHaveTextContent(`Item 1 of ${VIEWS}`);
    // No thumbnails: one item at a time.
    expect(screen.queryByRole("listbox")).toBeNull();

    const previous = within(pager).getByRole("button", { name: "Previous" });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(within(pager).getByRole("button", { name: "Next" }));
    expect(shown(pager)).toBe(`2 / ${VIEWS}`);
    expect(previous).not.toHaveAttribute("aria-disabled");
  });

  it("follows the strip beside it, and the strip follows it", async () => {
    render(
      <Clover.Root iiifContent={bookJson}>
        <Clover.Items />
        <Clover.Items layout="pager" />
      </Clover.Root>,
    );
    const pager = await screen.findByRole("navigation", { name: "Items" });
    const options = screen.getAllByRole("option");
    fireEvent.click(within(pager).getByRole("button", { name: "Next" }));
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.click(options[2]);
    expect(shown(pager)).toBe(`3 / ${VIEWS}`);
  });

  it("steps through a Collection's Manifests with of=members, telling onSelect", async () => {
    const onSelect = vi.fn();
    render(
      <Clover.Root iiifContent={shelf} request={{ fetch: mockFetch() }}>
        <Clover.Label as="h1" />
        <Clover.Items layout="pager" of="members" onSelect={onSelect} />
      </Clover.Root>,
    );
    await screen.findByRole("heading", { name: "Simple Manifest - Book" });
    // The pager's own chunk, loaded as it first draws.
    const pager = await screen.findByRole("navigation", { name: "Collection" });
    expect(shown(pager)).toBe("1 / 2");
    // Its count opens the members, listed as the Panel lists them, the one shown selected.
    const count = within(pager).getByRole("button", { name: "1 / 2" });
    fireEvent.click(count);
    await waitFor(() =>
      expect(count.getAttribute("aria-controls")).toBeTruthy(),
    );
    const popup = await waitFor(() => {
      const found = document.getElementById(
        count.getAttribute("aria-controls")!,
      );
      expect(found?.querySelector("[role=listbox]")).toBeTruthy();
      return found!;
    });
    expect(within(popup).getAllByRole("option")[0]).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // It opens over the pager: a step taken with it open keeps it open, and it follows.
    const next = within(pager).getByRole("button", { name: "Next" });
    fireEvent.pointerDown(next);
    fireEvent.click(next);
    expect(
      await screen.findByRole("heading", { name: "A letter" }),
    ).toBeInTheDocument();
    expect(document.getElementById(popup.id)).not.toBeNull();
    await waitFor(() =>
      expect(within(popup).getAllByRole("option")[1]).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.getElementById(popup.id)).toBeNull();
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: LETTER }),
      expect.anything(),
    );
    expect(shown(pager)).toBe("2 / 2");
    expect(within(pager).getByRole("button", { name: "Next" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("steps a standalone list's selection, telling onSelect of each step", async () => {
    const onSelect = vi.fn();
    render(
      <Clover.Items
        layout="pager"
        items={shelf.items}
        aria-label="Shelf"
        onSelect={onSelect}
      />,
    );
    const pager = await screen.findByRole("navigation", { name: "Shelf" });
    expect(shown(pager)).toBe("1 / 2");
    fireEvent.click(within(pager).getByRole("button", { name: "Next" }));
    expect(shown(pager)).toBe("2 / 2");
    expect(onSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: LETTER }),
      expect.anything(),
    );
  });

  it("renders nothing for a single item", async () => {
    render(
      <Clover.Root iiifContent={letter}>
        <Clover.Label as="h1" />
        <Clover.Items layout="pager" />
      </Clover.Root>,
    );
    await screen.findByRole("heading", { name: "A letter" });
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});

describe("Previous, Next and Position", () => {
  it("count and step a Collection's members with of=members, apart from the views", async () => {
    render(
      <Clover.Root iiifContent={shelf} request={{ fetch: mockFetch() }}>
        <Clover.Label as="h1" />
        <Clover.Position data-testid="views" />
        <Clover.Position of="members" data-testid="members" />
        <Clover.Next of="members" />
      </Clover.Root>,
    );
    await screen.findByRole("heading", { name: "Simple Manifest - Book" });
    expect(screen.getByTestId("views")).toHaveTextContent(`1 / ${VIEWS}`);
    expect(screen.getByTestId("members")).toHaveTextContent("1 / 2");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      await screen.findByRole("heading", { name: "A letter" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("members")).toHaveTextContent("2 / 2");
  });
});
