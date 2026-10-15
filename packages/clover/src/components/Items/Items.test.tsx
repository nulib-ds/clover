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
    expect(previous).toBeDisabled();
    fireEvent.click(next);
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("active")).toHaveTextContent("Frontispiece");
    fireEvent.click(next);
    expect(next).toBeDisabled();
    fireEvent.click(previous);
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
