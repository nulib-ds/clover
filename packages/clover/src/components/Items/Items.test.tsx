import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";

import audioJson from "../../fixtures/iiif-cookbook/0002-mvm-audio.json";
import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import rtlJson from "../../fixtures/iiif-cookbook/0010-book-2-viewing-direction-rtl.json";
import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";

const canvasIds = bookJson.items.map((canvas) => canvas.id);

const collection = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.org/collection",
  type: "Collection",
  label: { en: ["Shelf"] },
  summary: { en: ["<b>Two</b> books"] },
  homepage: [{ id: "https://example.org/shelf", type: "Text" }],
  items: [
    {
      id: "https://example.org/m1",
      type: "Manifest",
      label: { en: ["First book"] },
      homepage: [{ id: "https://example.org/first", type: "Text" }],
      thumbnail: [{ id: "https://example.org/first.jpg", type: "Image" }],
    },
    {
      id: "https://example.org/m2",
      type: "Manifest",
      label: { en: ["Second book"] },
      thumbnail: [{ id: "https://example.org/second.jpg", type: "Image" }],
    },
  ],
};

beforeEach(() => initCloverI18n({ lng: "en" }));

describe("Items in a Root", () => {
  const renderInRoot = (props: Partial<Clover.ItemsProps> = {}) =>
    render(
      <Clover.Root iiifContent={bookJson}>
        <Clover.Label of="canvas" data-testid="active" />
        <Clover.Items {...props} />
      </Clover.Root>,
    );

  it("is a listbox of views, a spread as one option, the current one selected", async () => {
    renderInRoot();
    const listbox = await screen.findByRole("listbox", { name: "Items" });
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(3);
    // A spread is one item, a card per page, each page's own label under it.
    const labels = within(options[1]).getAllByText(/Frontispiece|Title page/);
    expect(labels.map((label) => label.textContent?.trim())).toEqual([
      "Frontispiece",
      "Title page",
    ]);
    expect(options[1]).toHaveTextContent("Frontispiece Title page");
    // Named by its labels. The figure has no role: Chromium and Firefox would leave a
    // figure's caption out of the option's name.
    expect(options[1]).toHaveAccessibleName("Frontispiece Title page");
    expect(within(options[1]).queryByRole("figure")).toBeNull();
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options.map((option) => option.tabIndex)).toEqual([0, -1, -1]);
  });

  it("selects as focus moves, like a radio group, one tab stop throughout", async () => {
    const onSelect = vi.fn();
    renderInRoot({ onSelect });
    const options = await screen.findAllByRole("option");
    options[0].focus();
    fireEvent.keyDown(options[0], { key: "ArrowRight" });
    expect(options[1]).toHaveFocus();
    // The option in focus is the one shown.
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("active")).toHaveTextContent("Frontispiece");
    fireEvent.keyDown(options[1], { key: "End" });
    expect(options[2]).toHaveFocus();
    expect(options[2]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("active")).toHaveTextContent(
      bookJson.items[3].label.en[0],
    );
    expect(options.map((option) => option.tabIndex)).toEqual([-1, -1, 0]);
    // Moving is selecting; choosing, which a host may act on, is still Enter or a click.
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.keyDown(options[2], { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("selects where a held arrow stops, not each option it passes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderInRoot();
      const options = await screen.findAllByRole("option");
      options[0].focus();
      fireEvent.keyDown(options[0], { key: "ArrowRight", repeat: true });
      expect(options[1]).toHaveFocus();
      expect(screen.getByTestId("active")).toHaveTextContent("Blank page");
      act(() => vi.advanceTimersByTime(200));
      expect(options[1]).toHaveAttribute("aria-selected", "true");
    } finally {
      vi.useRealTimers();
    }
  });

  it("has Previous and Next for arrows, stepping the selection", async () => {
    renderInRoot();
    const options = await screen.findAllByRole("option");
    const previous = screen.getByRole("button", { name: "Previous" });
    const next = screen.getByRole("button", { name: "Next" });
    // At an end, `aria-disabled` and out of the tab order, as a disabled button is.
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(previous).toHaveAttribute("tabindex", "-1");
    next.focus();
    fireEvent.click(next);
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("active")).toHaveTextContent("Frontispiece");
    expect(previous).not.toHaveAttribute("aria-disabled");
    fireEvent.click(next);
    // The press that reaches the end leaves focus where it was (WCAG 2.4.3)…
    expect(next).toBeEnabled();
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(next).toHaveFocus();
    // …and another does nothing.
    fireEvent.click(next);
    expect(options[2]).toHaveAttribute("aria-selected", "true");
    expect(next).toHaveFocus();
    fireEvent.click(previous);
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("hands onSelect the key's own event, which it may prevent", async () => {
    const seen: Array<{ key?: string; target: unknown; prevented: boolean }> =
      [];
    const onSelect = vi.fn(
      (_item: Clover.ItemModel, event: React.SyntheticEvent) => {
        seen.push({
          key: (event as React.KeyboardEvent).key,
          target: event.currentTarget,
          // Untouched, as a click arrives: a host's `if (event.defaultPrevented)` guard
          // treats a key as it does a press.
          prevented: event.defaultPrevented,
        });
        // A real event: a host may stop it, as it would a click.
        event.preventDefault();
        event.stopPropagation();
      },
    );
    renderInRoot({ onSelect });
    const options = await screen.findAllByRole("option");
    // Focus moved without an arrow, so nothing is selected until Enter.
    options[2].focus();
    fireEvent.keyDown(options[2], { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: canvasIds[3] }),
      expect.objectContaining({ type: "keydown" }),
    );
    expect(seen).toEqual([
      { key: "Enter", target: options[2], prevented: false },
    ]);
    expect(options[2]).toHaveAttribute("aria-selected", "true");
    // Space too, and Clover still keeps it from scrolling the page.
    onSelect.mockImplementation(() => {});
    options[1].focus();
    const space = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      options[1].dispatchEvent(space);
    });
    expect(onSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: canvasIds[1] }),
      expect.objectContaining({ type: "keydown", key: " " }),
    );
    expect(space.defaultPrevented).toBe(true);
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("selects on click, and follows a selection made elsewhere", async () => {
    const onSelect = vi.fn();
    render(
      <Clover.Root iiifContent={bookJson}>
        <Clover.Items onSelect={onSelect} />
        <Clover.Next />
      </Clover.Root>,
    );
    const options = await screen.findAllByRole("option");
    fireEvent.click(options[1]);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: canvasIds[1] }),
      expect.anything(),
    );
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    // The Pager's Next, beside the strip's own.
    fireEvent.click(document.querySelector("button.clover-pager-next")!);
    expect(options[2]).toHaveAttribute("aria-selected", "true");
    expect(options[2].tabIndex).toBe(0);
  });

  it("names a view with no label by its place", async () => {
    const [first, ...rest] = bookJson.items;
    const unlabeled = {
      ...bookJson,
      id: `${bookJson.id}/unlabeled`,
      items: [
        { ...first, id: `${first.id}/unlabeled`, label: undefined },
        ...rest,
      ],
    };
    render(
      <Clover.Root iiifContent={unlabeled}>
        <Clover.Items />
      </Clover.Root>,
    );
    const options = await screen.findAllByRole("option");
    expect(options[0]).toHaveAccessibleName("Item 1 of 3");
    // A labeled view keeps its own name.
    expect(options[1]).not.toHaveAttribute("aria-label");
  });

  it("reads right to left: the left arrow goes forward", async () => {
    render(
      <Clover.Root iiifContent={rtlJson}>
        <Clover.Items />
      </Clover.Root>,
    );
    const options = await screen.findAllByRole("option");
    options[0].focus();
    fireEvent.keyDown(options[0], { key: "ArrowLeft" });
    expect(options[1]).toHaveFocus();
  });

  it("lays out as a list or a grid", async () => {
    const { container } = renderInRoot({ layout: "grid" });
    await screen.findAllByRole("option");
    expect(container.querySelector(".clover-items")).toHaveAttribute(
      "data-layout",
      "grid",
    );
    expect(screen.getByRole("listbox")).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
  });
});

describe("Items standalone", () => {
  it("lists a Collection's members as links, with its header", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(collection)));
    render(
      <Clover.Items
        iiifContent={collection.id}
        request={{ fetch, credentials: "include" }}
      />,
    );
    const first = await screen.findByRole("link", { name: /First book/ });
    expect(first).toHaveAttribute("href", "https://example.org/first");
    expect(within(first).queryByRole("figure")).toBeNull();
    expect(screen.getByRole("link", { name: /Second book/ })).toHaveAttribute(
      "href",
      "https://example.org/m2",
    );
    expect(screen.getByRole("heading", { name: "Shelf" })).toBeInTheDocument();
    expect(screen.getByText("Two books")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View All" })).toHaveAttribute(
      "href",
      "https://example.org/shelf",
    );
    expect((fetch.mock.calls[0] as unknown[])[1]).toMatchObject({
      credentials: "include",
    });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("titles its header at headingLevel, to fit the page's outline", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(collection)));
    const { unmount } = render(
      <Clover.Items iiifContent={collection.id} request={{ fetch }} />,
    );
    expect(
      await screen.findByRole("heading", { level: 2, name: "Shelf" }),
    ).toBeInTheDocument();
    unmount();
    render(
      <Clover.Items
        iiifContent={collection.id}
        request={{ fetch }}
        headingLevel={4}
      />,
    );
    const title = await screen.findByRole("heading", { name: "Shelf" });
    expect(title.tagName).toBe("H4");
    // Not passed on to the list's element.
    expect(title.closest(".clover-items")).not.toHaveAttribute("headingLevel");
  });

  it("hands a link's click to onSelect, which may keep the reader on the page", async () => {
    const onSelect = vi.fn((_, event) => event.preventDefault());
    render(<Clover.Items items={collection.items} onSelect={onSelect} />);
    const link = screen.getByRole("link", { name: /First book/ });
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "https://example.org/m1" }),
      expect.anything(),
    );
    expect(click.defaultPrevented).toBe(true);
  });

  it("names an item with no label by its place", () => {
    const [first, second] = collection.items;
    render(
      <Clover.Items items={[first, { ...second, label: undefined as any }]} />,
    );
    expect(screen.getByRole("link", { name: "First book" })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Item 2 of 2" }),
    ).toBeInTheDocument();
  });

  it("renders an item of your own", () => {
    render(
      <Clover.Items
        items={collection.items}
        renderItem={(item) => <span>custom {item.id}</span>}
      />,
    );
    expect(
      screen.getByText("custom https://example.org/m2"),
    ).toBeInTheDocument();
  });

  it("lazy-loads each thumbnail at the size asked, alt left to the label", () => {
    render(<Clover.Items items={collection.items} thumbnailSize={120} />);
    const image = screen
      .getByRole("link", { name: /First book/ })
      .querySelector("img")!;
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("width", "120");
    expect(image).toHaveAttribute("alt", "");
  });
});

describe("Items' languages", () => {
  afterEach(() => {
    document.documentElement.lang = "";
  });

  it("names the list by its heading, which carries the label's language", async () => {
    const spanish = { ...collection, label: { es: ["Estante"] } };
    const fetch = vi.fn(async () => new Response(JSON.stringify(spanish)));
    render(<Clover.Items iiifContent={spanish.id} request={{ fetch }} />);
    const heading = await screen.findByRole("heading", { name: "Estante" });
    expect(heading).toHaveAttribute("lang", "es");
    const list = screen.getByRole("list", { name: "Estante" });
    expect(list).toHaveAttribute("aria-labelledby", heading.id);
    expect(list).not.toHaveAttribute("aria-label");
  });

  it("keeps the host's own name for the list", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(collection)));
    render(
      <Clover.Items
        iiifContent={collection.id}
        request={{ fetch }}
        aria-label="Related"
      />,
    );
    await screen.findByRole("heading", { name: "Shelf" });
    expect(screen.getByRole("list", { name: "Related" })).not.toHaveAttribute(
      "aria-labelledby",
    );
  });

  it("marks its own strings, standalone, where the page's language is not Clover's, and keeps the page's for labels in none", async () => {
    document.documentElement.lang = "fr";
    const { container } = render(
      <Clover.Items
        items={[
          { ...collection.items[0], label: { none: ["Premier livre"] } },
          collection.items[1],
        ]}
      />,
    );
    // The list's name is English: a hidden element's, which says so.
    const list = screen.getByRole("list", { name: "Items" });
    await vi.waitFor(() =>
      expect(
        document.getElementById(list.getAttribute("aria-labelledby") ?? ""),
      ).toHaveAttribute("lang", "en"),
    );
    // Not the section: it holds the items, in their own languages or the page's.
    expect(container.querySelector(".clover-items")).not.toHaveAttribute(
      "lang",
    );
    expect(screen.getByText("Premier livre").closest("[lang]")).toBe(
      document.documentElement,
    );
    expect(screen.getByText("Second book")).toHaveAttribute("lang", "en");
  });
});

describe("Items with nothing to picture", () => {
  // Cookbook 0002's sound Canvas, twice: no thumbnail, no image, no size.
  const track = audioJson.items[0];
  const tracks = {
    ...audioJson,
    items: [
      { ...track, label: { en: ["First track"] } },
      { ...track, id: `${track.id}-2`, label: { en: ["Second track"] } },
    ],
  };

  it("keeps each sound's picture a box, square, with a speaker in it", async () => {
    render(
      <Clover.Root iiifContent={tracks}>
        <Clover.Items />
      </Clover.Root>,
    );
    await screen.findByRole("option", { name: /Second track/ });
    const pictures = document.querySelectorAll<HTMLElement>(
      ".clover-items-picture",
    );
    expect(pictures).toHaveLength(2);
    for (const picture of pictures) {
      expect(picture).toHaveAttribute("data-empty", "true");
      expect(picture.style.getPropertyValue("--clover-items-ratio")).toBe("1");
      expect(picture.querySelector("img")).toBeNull();
      expect(picture.querySelector("svg")).not.toBeNull();
      expect(picture.querySelector(".clover-items-duration")).toHaveTextContent(
        "33:05",
      );
    }
  });

  it("keeps the box, without the speaker, for a member with no thumbnail", () => {
    render(
      <Clover.Items
        items={[{ id: "https://example.org/m3", type: "Manifest" }]}
      />,
    );
    const picture = document.querySelector(".clover-items-picture")!;
    expect(picture).toHaveAttribute("data-empty", "true");
    expect(picture.querySelector("svg")).toBeNull();
  });
});

describe("Items' long titles", () => {
  const LONG = "A title long enough to run past three lines under its picture";
  // jsdom lays nothing out: a title's text is taller than its box when it is the long one.
  const sizes = (element: HTMLElement) =>
    element.classList.contains("clover-items-label-text")
      ? { scroll: element.textContent === LONG ? 90 : 30, client: 60 }
      : { scroll: 0, client: 0 };
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return sizes(this).scroll;
      },
    );
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return sizes(this).client;
      },
    );
  });
  afterEach(() => vi.restoreAllMocks());

  const render2 = () => {
    const [first, second] = collection.items;
    return render(
      <Clover.Items items={[{ ...first, label: { en: [LONG] } }, second]} />,
    );
  };

  it("keeps a full copy of a title cut short, hidden and out of the name", () => {
    const { container } = render2();
    const [long, short] = container.querySelectorAll(".clover-items-label");
    expect(long).toHaveAttribute("data-clamped");
    const full = long.querySelector(".clover-items-label-full")!;
    expect(full).toHaveTextContent(LONG);
    expect(full).toHaveAttribute("hidden");
    expect(full).toHaveAttribute("aria-hidden", "true");
    // The name reads the title once.
    expect(screen.getByRole("link", { name: LONG })).toBeInTheDocument();
    expect(short).not.toHaveAttribute("data-clamped");
    expect(short.querySelector(".clover-items-label-full")).toBeNull();
  });

  it("never cuts a title that has no box of its own, as Firefox measures an inline one", () => {
    // Inline, as a list's titles are: no client height, and the text's own scroll height.
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(0);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.classList.contains("clover-items-label-text") ? 20 : 0;
      },
    );
    const { container } = render2();
    for (const label of container.querySelectorAll(".clover-items-label")) {
      expect(label).not.toHaveAttribute("data-clamped");
      expect(label.querySelector(".clover-items-label-full")).toBeNull();
    }
  });

  it("hides the full title on Escape until focus leaves, and takes the Escape", () => {
    render2();
    const link = screen.getByRole("link", { name: LONG });
    link.focus();
    const escape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    link.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(link).toHaveAttribute("data-full-hidden");
    fireEvent.blur(link);
    expect(link).not.toHaveAttribute("data-full-hidden");
  });

  it("leaves an Escape alone where no full title shows", () => {
    render2();
    screen.getByRole("link", { name: "Second book" }).focus();
    const escape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    document.activeElement!.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(false);
  });
});
