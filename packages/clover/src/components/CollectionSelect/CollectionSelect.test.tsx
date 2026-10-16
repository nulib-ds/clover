import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React, { useState } from "react";

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
const NOTE = "https://example.org/note";
const note = {
  ...letter,
  id: NOTE,
  label: { en: ["A note"] },
  items: [{ ...letter.items[0], id: `${NOTE}/canvas/1` }],
};
const DRAWER = "https://example.org/drawer";
const drawer = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: DRAWER,
  type: "Collection",
  label: { en: ["A drawer"] },
  items: [
    { id: NOTE, type: "Manifest", label: { en: ["A note"] } },
    { id: LETTER, type: "Manifest", label: { en: ["A letter"] } },
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
  const table: Record<string, unknown> = {
    [BOOK]: bookJson,
    [LETTER]: letter,
    [NOTE]: note,
    [DRAWER]: drawer,
  };
  return vi.fn(async (url: string) =>
    table[url] === undefined
      ? new Response("missing", { status: 404 })
      : new Response(JSON.stringify(table[url]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
  );
}

beforeEach(() => initCloverI18n({ lng: "en" }));

describe("CollectionSelect", () => {
  it("lists the members, labelled by the Collection, and shows the one chosen", async () => {
    const onManifestChange = vi.fn();
    render(
      <Clover.Root
        iiifContent={shelf}
        request={{ fetch: mockFetch() }}
        onManifestChange={onManifestChange}
      >
        <Clover.Label as="h1" />
        <Clover.CollectionSelect />
      </Clover.Root>,
    );
    const select = await screen.findByRole("combobox", { name: "Shelf" });
    expect(select).toHaveValue(BOOK);
    expect(within(select).getAllByRole("option")).toHaveLength(2);
    await screen.findByRole("heading", { name: "Simple Manifest - Book" });

    fireEvent.change(select, { target: { value: LETTER } });
    expect(
      await screen.findByRole("heading", { name: "A letter" }),
    ).toBeInTheDocument();
    expect(select).toHaveValue(LETTER);
    expect(onManifestChange).toHaveBeenCalledWith(LETTER);
  });

  /*
   * WCAG 3.2.2: Windows and Linux browsers fire `change` for each arrow key on a closed
   * select, in the same task as the keydown. Stepping only moves; Enter or leaving makes
   * the choice.
   */
  describe("by keyboard", () => {
    const longShelf = {
      ...shelf,
      items: [
        ...shelf.items,
        { id: NOTE, type: "Manifest", label: { en: ["A note"] } },
      ],
    };

    async function open(onChange = vi.fn()) {
      const fetch = mockFetch();
      render(
        <Clover.Root iiifContent={longShelf} request={{ fetch }}>
          <Clover.Label as="h1" />
          <Clover.CollectionSelect onChange={onChange} />
        </Clover.Root>,
      );
      const select = await screen.findByRole("combobox", { name: "Shelf" });
      await screen.findByRole("heading", { name: "Simple Manifest - Book" });
      return { select, fetch, onChange };
    }

    /** An arrow key as a closed select takes it: the value moves, `change` fires. */
    function step(select: HTMLElement, key: string, value: string) {
      fireEvent.keyDown(select, { key });
      fireEvent.change(select, { target: { value } });
    }

    const asked = (fetch: ReturnType<typeof mockFetch>, url: string) =>
      fetch.mock.calls.filter(([called]) => called === url).length;

    it("moves through the members without loading them, and loads on Enter", async () => {
      const { select, fetch, onChange } = await open();
      step(select, "ArrowDown", LETTER);
      step(select, "ArrowDown", NOTE);
      expect(select).toHaveValue(NOTE);
      // The work shown has not changed under the reader.
      expect(
        screen.getByRole("heading", { name: "Simple Manifest - Book" }),
      ).toBeInTheDocument();
      expect(asked(fetch, LETTER)).toBe(0);
      expect(onChange).not.toHaveBeenCalled();

      fireEvent.keyDown(select, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith(NOTE);
      expect(
        await screen.findByRole("heading", { name: "A note" }),
      ).toBeInTheDocument();
      expect(asked(fetch, LETTER)).toBe(0);
      expect(select).toHaveValue(NOTE);
    });

    /*
     * WCAG 2.4.3: loaded once focus had moved on, a Manifest could take away the control
     * focus moved to (Document's Download, for a Manifest with no renderings).
     */
    it("takes a step back on leaving the menu, and loads nothing", async () => {
      const { select, fetch, onChange } = await open();
      step(select, "End", NOTE);
      fireEvent.blur(select);
      expect(select).toHaveValue(BOOK);
      expect(onChange).not.toHaveBeenCalled();
      expect(asked(fetch, NOTE)).toBe(0);
    });

    it("keeps a choice made on leaving while it loads", async () => {
      const { select, fetch } = await open();
      step(select, "End", NOTE);
      fireEvent.keyDown(select, { key: "Enter" });
      fireEvent.blur(select);
      expect(select).toHaveValue(NOTE);
      expect(
        await screen.findByRole("heading", { name: "A note" }),
      ).toBeInTheDocument();
      expect(asked(fetch, NOTE)).toBe(1);
    });

    it("asks again on Enter for a member that failed to load", async () => {
      const FLAKY = "https://example.org/flaky";
      const flaky = { ...note, id: FLAKY, label: { en: ["A flaky note"] } };
      const table: Record<string, unknown> = { [BOOK]: bookJson };
      let tries = 0;
      const fetch = vi.fn(async (url: string) => {
        if (url === FLAKY && tries++ === 0) {
          return new Response("busy", { status: 503 });
        }
        const json = url === FLAKY ? flaky : table[url];
        return json === undefined
          ? new Response("missing", { status: 404 })
          : new Response(JSON.stringify(json), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
      });
      const onChange = vi.fn();
      render(
        <Clover.Root
          iiifContent={{
            ...shelf,
            items: [
              shelf.items[0],
              { id: FLAKY, type: "Manifest", label: { en: ["A flaky note"] } },
            ],
          }}
          request={{ fetch }}
        >
          <Clover.Label as="h1" />
          <Clover.Status />
          <Clover.CollectionSelect onChange={onChange} />
        </Clover.Root>,
      );
      const select = await screen.findByRole("combobox", { name: "Shelf" });
      await screen.findByRole("heading", { name: "Simple Manifest - Book" });

      step(select, "ArrowDown", FLAKY);
      fireEvent.keyDown(select, { key: "Enter" });
      await screen.findByRole("alert");
      // The member that failed is still the one in the menu, to try again.
      expect(select).toHaveValue(FLAKY);

      fireEvent.keyDown(select, { key: "Enter" });
      expect(
        await screen.findByRole("heading", { name: "A flaky note" }),
      ).toBeInTheDocument();
      expect(asked(fetch, FLAKY)).toBe(2);
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it("loads nothing on leaving where it started", async () => {
      const { select, onChange } = await open();
      step(select, "ArrowDown", LETTER);
      step(select, "ArrowUp", BOOK);
      fireEvent.blur(select);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("takes a step back with Escape, and only that", async () => {
      const { select, onChange } = await open();
      step(select, "ArrowDown", LETTER);
      const escape = fireEvent.keyDown(select, { key: "Escape" });
      // Handled: a dialog or floating panel around it stays open.
      expect(escape).toBe(false);
      expect(select).toHaveValue(BOOK);
      fireEvent.blur(select);
      expect(onChange).not.toHaveBeenCalled();
      // With nothing to take back, Escape is left to what is around it.
      expect(fireEvent.keyDown(select, { key: "Escape" })).toBe(true);
    });

    it("loads at once a choice made in the menu's own list, after its key", async () => {
      const { select, onChange } = await open();
      // macOS, or Alt+↓: the key opens the list, and the choice comes later, on its own.
      fireEvent.keyDown(select, { key: "ArrowDown", altKey: true });
      await new Promise((resolve) => setTimeout(resolve, 150));
      fireEvent.change(select, { target: { value: LETTER } });
      expect(onChange).toHaveBeenCalledWith(LETTER);
      expect(
        await screen.findByRole("heading", { name: "A letter" }),
      ).toBeInTheDocument();
    });
  });

  it("shows a visible label for a Collection with none", async () => {
    const unlabelled = { ...shelf, label: undefined };
    render(
      <Clover.Root iiifContent={unlabelled} request={{ fetch: mockFetch() }}>
        <Clover.CollectionSelect />
      </Clover.Root>,
    );
    const select = await screen.findByRole("combobox", { name: "Collection" });
    expect(select).not.toHaveAttribute("aria-label");
    expect(screen.getByText("Collection", { selector: "label" })).toBeVisible();
  });

  it("renders nothing for a Manifest", async () => {
    render(
      <Clover.Root iiifContent={bookJson}>
        <Clover.Label as="h1" />
        <Clover.CollectionSelect />
      </Clover.Root>,
    );
    await screen.findByRole("heading");
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("Items of members", () => {
  it("is a listbox of the Collection's members choosing the Manifest shown", async () => {
    render(
      <Clover.Root iiifContent={shelf} request={{ fetch: mockFetch() }}>
        <Clover.Label as="h1" />
        <Clover.Items of="members" aria-label="Shelf" />
      </Clover.Root>,
    );
    const listbox = await screen.findByRole("listbox", { name: "Shelf" });
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.click(options[1]);
    await screen.findByRole("heading", { name: "A letter" });
    await waitFor(() =>
      expect(within(listbox).getAllByRole("option")[1]).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
  });

  const withDrawer = {
    ...shelf,
    items: [
      ...shelf.items,
      { id: DRAWER, type: "Collection", label: { en: ["A drawer"] } },
    ],
  };

  it("keeps focus in the list on entering a nested Collection", async () => {
    render(
      <Clover.Root iiifContent={withDrawer} request={{ fetch: mockFetch() }}>
        <Clover.Label as="h1" />
        <Clover.Items of="members" layout="list" aria-label="Shelf" />
      </Clover.Root>,
    );
    const listbox = await screen.findByRole("listbox", { name: "Shelf" });
    const option = within(listbox).getByRole("option", { name: "A drawer" });
    option.focus();
    fireEvent.keyDown(option, { key: "Enter" });
    await screen.findByRole("heading", { name: "A note" });
    // The drawer's members replace the shelf's, the option in focus with them; focus
    // goes to the new list's selected option, not to the page (WCAG 2.4.3).
    const note = within(listbox).getByRole("option", { name: "A note" });
    expect(within(listbox).getAllByRole("option")).toHaveLength(2);
    await waitFor(() => expect(note).toHaveFocus());
    expect(note).toHaveAttribute("aria-selected", "true");
    expect(note.tabIndex).toBe(0);
  });

  it("chooses by Enter when onSelect prevents the key's event", async () => {
    const onSelect = vi.fn((_item, event: React.SyntheticEvent) =>
      event.preventDefault(),
    );
    render(
      <Clover.Root iiifContent={shelf} request={{ fetch: mockFetch() }}>
        <Clover.Label as="h1" />
        <Clover.Items of="members" layout="list" onSelect={onSelect} />
      </Clover.Root>,
    );
    const options = await screen.findAllByRole("option");
    await screen.findByRole("heading", { name: "Simple Manifest - Book" });
    options[1].focus();
    fireEvent.keyDown(options[1], { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: LETTER }),
      expect.objectContaining({ type: "keydown", key: "Enter" }),
    );
    expect(
      await screen.findByRole("heading", { name: "A letter" }),
    ).toBeInTheDocument();
  });

  it("leaves focus elsewhere where it is when a nested Collection opens", async () => {
    render(
      <Clover.Root iiifContent={withDrawer} request={{ fetch: mockFetch() }}>
        <Clover.Label as="h1" />
        <Clover.Items of="members" layout="list" aria-label="Shelf" />
        <button type="button">Elsewhere</button>
      </Clover.Root>,
    );
    const listbox = await screen.findByRole("listbox", { name: "Shelf" });
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    elsewhere.focus();
    fireEvent.click(within(listbox).getByRole("option", { name: "A drawer" }));
    await screen.findByRole("heading", { name: "A note" });
    expect(elsewhere).toHaveFocus();
  });
});

describe("Root manifestId", () => {
  it("opens the Manifest named, and moves only when the host hands back a choice", async () => {
    const asked: string[] = [];
    function Host({ follow }: { follow: boolean }) {
      const [manifestId, setManifestId] = useState(LETTER);
      return (
        <Clover.Root
          iiifContent={shelf}
          request={{ fetch: mockFetch() }}
          manifestId={manifestId}
          onManifestChange={(id) => {
            asked.push(id);
            if (follow) setManifestId(id);
          }}
        >
          <Clover.Label as="h1" />
          <Clover.CollectionSelect />
        </Clover.Root>
      );
    }
    const { unmount } = render(<Host follow={false} />);
    await screen.findByRole("heading", { name: "A letter" });
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: BOOK } });
    expect(asked).toEqual([BOOK]);
    expect(screen.getByRole("heading")).toHaveTextContent("A letter");
    // A host that kept its own is asked again on Enter, and the menu, left, shows it.
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
    await settle();
    fireEvent.keyDown(select, { key: "Enter" });
    expect(asked).toEqual([BOOK, BOOK]);
    await settle();
    fireEvent.blur(select);
    expect(select).toHaveValue(LETTER);
    unmount();

    render(<Host follow />);
    await screen.findByRole("heading", { name: "A letter" });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: BOOK },
    });
    expect(
      await screen.findByRole("heading", { name: "Simple Manifest - Book" }),
    ).toBeInTheDocument();
  });
});
