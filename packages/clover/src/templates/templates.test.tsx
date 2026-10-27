import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import React from "react";

import bookJson from "../fixtures/iiif-cookbook/0009-book-1.json";
import singleJson from "../fixtures/iiif-cookbook/0004-canvas-size.json";
import renderingJson from "../fixtures/iiif-cookbook/0046-rendering.json";
import rtlJson from "../fixtures/iiif-cookbook/0010-book-2-viewing-direction-rtl.json";
import { initCloverI18n } from "../i18n";
import * as Templates from "./index";

beforeEach(() => initCloverI18n({ lng: "en" }));

// jsdom has `<dialog>` but not `showModal()` or `close()`.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe("templates", () => {
  it("are built only from what @nulib/clover exports", () => {
    for (const file of sources(resolve(__dirname))) {
      const text = readFileSync(file, "utf8");
      for (const [, specifier] of text.matchAll(
        /^(?:import|export)\b[^;]*?from "([^"]+)"/gm,
      )) {
        const allowed =
          specifier === "react" ||
          specifier === "../../parts" ||
          specifier.startsWith("./") ||
          specifier.startsWith("../shared/");
        expect(allowed, `${file} imports ${specifier}`).toBe(true);
      }
    }
  });

  it("Default: title, Body, strip with position and arrows, and the panel", async () => {
    render(<Templates.Default iiifContent={bookJson} />);
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Item 1 of 3/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Items" })).toBeInTheDocument();
    // The panel's sections are stacked boxes, About open.
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("button", { name: "About" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    // Beside the Body, the toggle closes the panel; it has no close button of its own.
    const panel = document.querySelector(".clover-template-default-panel")!;
    expect(
      within(panel as HTMLElement).queryByRole("button", {
        name: "Close information panel",
      }),
    ).toBeNull();
    // Open, it sits on the bar between them; closed, among the Canvas's controls.
    const toggle = () =>
      screen.getByRole("button", { name: "More information" });
    expect(toggle().closest(".clover-template-default-spine")).not.toBeNull();
    fireEvent.click(toggle());
    expect(panel).not.toBeVisible();
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle().closest(".clover-canvas-controls")).not.toBeNull();
  });

  // `fill` lays it out in the box it is given; without it, the Body keeps its height.
  it("Default: fill marks the layout to fill its box, and is off by default", async () => {
    const { rerender, container } = render(
      <Templates.Default iiifContent={bookJson} />,
    );
    await screen.findByRole("heading", {
      level: 2,
      name: "Simple Manifest - Book",
    });
    const layout = () => container.querySelector(".clover-template-default");
    expect(layout()).not.toHaveAttribute("data-fill");
    rerender(<Templates.Default iiifContent={bookJson} fill />);
    expect(layout()).toHaveAttribute("data-fill", "true");
  });

  it("Default: the strip's arrows step the view; its header names the pages", async () => {
    render(<Templates.Default iiifContent={bookJson} />);
    const next = await screen.findByRole("button", { name: "Next" });
    // One Previous and one Next: the strip's own, with no second pair above it.
    expect(screen.getAllByRole("button", { name: "Next" })).toHaveLength(1);
    expect(next).toHaveClass("clover-items-scroll-next");
    fireEvent.click(next);
    expect(document.querySelector(".clover-pager-position")).toHaveTextContent(
      "Item 2 of 3",
    );
    const titles = document.querySelector(".clover-template-default-titles")!;
    expect(titles).toHaveTextContent("Frontispiece");
    expect(titles).toHaveTextContent("Title page");
  });

  it("Default: header={false} and panel={false} leave out the title and the panel", async () => {
    render(
      <Templates.Default iiifContent={bookJson} header={false} panel={false} />,
    );
    // The strip still draws, so the Manifest has loaded.
    await screen.findByRole("button", { name: "Next" });
    expect(
      screen.queryByRole("heading", { name: "Simple Manifest - Book" }),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector(".clover-template-default-header"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "More information" }),
    ).not.toBeInTheDocument();
    expect(document.querySelector(".clover-panel")).not.toBeInTheDocument();
  });

  it("Default: the title at headingLevel, the panel's sections a level under it", async () => {
    const { unmount } = render(<Templates.Default iiifContent={bookJson} />);
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "About" }),
    ).toBeInTheDocument();
    unmount();

    render(<Templates.Default iiifContent={bookJson} headingLevel={4} />);
    expect(
      await screen.findByRole("heading", {
        level: 4,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 5, name: "About" }),
    ).toBeInTheDocument();
    // Every heading in it is at that level or under it, About's own at 6.
    for (const heading of screen.getAllByRole("heading")) {
      expect(heading.tagName).toMatch(/^H[4-6]$/);
    }
  });

  it("Default: with no header, the panel's sections take the title's level", async () => {
    render(
      <Templates.Default
        iiifContent={bookJson}
        header={false}
        headingLevel={2}
      />,
    );
    expect(
      await screen.findByRole("heading", { level: 2, name: "About" }),
    ).toBeInTheDocument();
    // The title is About's alone, a level under it.
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Simple Manifest - Book" }),
    ).toBeInTheDocument();
  });

  it("Default: a right-to-left book's strip runs leftward, Previous on the right", async () => {
    render(<Templates.Default iiifContent={rtlJson} />);
    const previous = await screen.findByRole("button", { name: "Previous" });
    expect(previous.closest("[dir]")).toHaveAttribute("dir", "rtl");
  });

  it("Default: narrowing under the open panel hands focus in it to its toggle", async () => {
    // jsdom lays nothing out: the layout measures wide, then phone-wide (zoomed in, say).
    const panes: Array<() => void> = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private callback: () => void) {}
        observe(node: Element) {
          if (node.classList.contains("clover-template-default-panes"))
            panes.push(this.callback);
        }
        disconnect() {}
      },
    );
    const width = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(1280);
    render(<Templates.Default iiifContent={bookJson} />);
    await screen.findByRole("heading", {
      level: 2,
      name: "Simple Manifest - Book",
    });
    screen.getByRole("button", { name: "About" }).focus();
    width.mockReturnValue(390);
    act(() => panes.forEach((measure) => measure()));
    expect(
      document.querySelector(".clover-template-default-panel"),
    ).toHaveAttribute("hidden");
    // In the frame after: the toggle has moved, from the spine to the Body's controls.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "More information" }),
      ).toHaveFocus(),
    );
    width.mockRestore();
    vi.unstubAllGlobals();
  });

  describe("Default, with no room for the panel beside the Body", () => {
    // jsdom lays nothing out: a phone-wide layout, as the template measures it.
    let width: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      width = vi
        .spyOn(HTMLElement.prototype, "clientWidth", "get")
        .mockReturnValue(390);
    });
    afterEach(() => width.mockRestore());

    const toggle = () =>
      screen.getByRole("button", { name: "More information" });
    const panel = () =>
      document.querySelector<HTMLElement>(".clover-template-default-panel")!;

    it("never stacks: it starts closed, then slides over the Body when asked", async () => {
      render(<Templates.Default iiifContent={bookJson} />);
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      });
      const panes = document.querySelector(".clover-template-default-panes");
      expect(panes).toHaveAttribute("data-panel", "over");
      expect(panel()).not.toBeVisible();
      expect(toggle()).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(toggle());
      expect(panel()).toBeVisible();
      // Focus goes in, at the open box's heading: the panel covers the page.
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "About" })).toHaveFocus(),
      );
      await waitFor(() => expect(panel()).toHaveAttribute("data-open", "true"));
    });

    it("closes from the uncovered strip, from Escape, and from its close button", async () => {
      render(<Templates.Default iiifContent={bookJson} />);
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      });
      const open = async () => {
        fireEvent.click(toggle());
        await waitFor(() =>
          expect(toggle()).toHaveAttribute("aria-expanded", "true"),
        );
      };

      await open();
      fireEvent.click(
        document.querySelector(".clover-template-default-scrim")!,
      );
      expect(toggle()).toHaveAttribute("aria-expanded", "false");

      await open();
      fireEvent.keyDown(screen.getByRole("button", { name: "About" }), {
        key: "Escape",
      });
      expect(toggle()).toHaveAttribute("aria-expanded", "false");

      await open();
      fireEvent.click(
        within(panel()).getByRole("button", {
          name: "Close information panel",
        }),
      );
      expect(toggle()).toHaveAttribute("aria-expanded", "false");
    });

    it("puts the panel away on Escape from under it, leaving focus there", async () => {
      render(<Templates.Default iiifContent={bookJson} />);
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      });
      fireEvent.click(toggle());
      await waitFor(() =>
        expect(toggle()).toHaveAttribute("aria-expanded", "true"),
      );
      // Tabbing on from the panel reaches the strip it covers.
      const option = screen.getAllByRole("option")[0];
      option.focus();
      fireEvent.keyDown(option, { key: "Escape" });
      expect(toggle()).toHaveAttribute("aria-expanded", "false");
      expect(option).toHaveFocus();
    });

    it("starts open over the Body only when the host asks", async () => {
      render(<Templates.Default iiifContent={bookJson} defaultPanelOpen />);
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      });
      expect(panel()).toBeVisible();
    });
  });

  it("Document: no thumbnails, bar or their toggle for a single page", async () => {
    render(<Templates.Document iiifContent={singleJson} />);
    await screen.findByRole("heading", {
      name: "Still image from an opera performance at Indiana University",
    });
    expect(screen.queryByRole("button", { name: /^Show items/ })).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Items" })).toBeNull();
    expect(screen.queryByRole("separator")).toBeNull();
    expect(
      document.querySelector(".clover-template-document-panes"),
    ).toHaveAttribute("data-sidebar", "closed");
  });

  it("Gallery: a grid whose cells open the lightbox at that view", async () => {
    render(<Templates.Gallery iiifContent={bookJson} />);
    const options = await screen.findAllByRole("option");
    expect(document.querySelector(".clover-items")).toHaveAttribute(
      "data-layout",
      "grid",
    );
    fireEvent.click(options[1]);
    // The Canvas's label alone: the Manifest's names it only when the Canvas has none.
    const dialog = screen.getByRole("dialog", { name: "Frontispiece" });
    expect(
      within(dialog).getByRole("heading", { name: "Frontispiece" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Item 2 of 3/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(dialog.querySelector(".clover-body")).toBeNull();
  });

  it("Gallery: the title at headingLevel, the lightbox's a level under it", async () => {
    render(<Templates.Gallery iiifContent={bookJson} headingLevel={3} />);
    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("option"))[1]);
    const dialog = screen.getByRole("dialog", { name: "Frontispiece" });
    expect(
      within(dialog).getByRole("heading", { level: 4, name: "Frontispiece" }),
    ).toBeInTheDocument();
  });

  it("Gallery: the lightbox is named by the Manifest when its Canvas has no label", async () => {
    const unlabeled = {
      ...bookJson,
      items: bookJson.items.map((canvas) => ({ ...canvas, label: undefined })),
    };
    render(<Templates.Gallery iiifContent={unlabeled} />);
    fireEvent.click((await screen.findAllByRole("option"))[1]);
    expect(
      screen.getByRole("dialog", { name: "Simple Manifest - Book" }),
    ).toBeInTheDocument();
  });

  it("Document: toolbar, thumbnails, a sheet for each view, PageDown, and a sliding panel", async () => {
    render(<Templates.Document iiifContent={bookJson} />);
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
    const sidebar = screen.getByRole("complementary", { name: "Items" });
    // Their toggle: on the spine while they show, out of their pane, which is theirs whole.
    const toggle = () => screen.getByRole("button", { name: /^Show items/ });
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(
      toggle().closest(".clover-template-document-spine[data-for='sidebar']"),
    ).not.toBeNull();
    expect(sidebar).not.toContainElement(toggle());
    expect(within(sidebar).getAllByRole("option")).toHaveLength(3);

    // A still sheet for each view, the cover and two spreads, hidden from assistive
    // technology: the live Canvas and the thumbnails are the way to each page.
    const column = document.querySelector<HTMLElement>(
      ".clover-template-document-column",
    )!;
    const sheets = column.querySelectorAll(".clover-template-document-sheet");
    expect(sheets).toHaveLength(3);
    expect(sheets[1]).toHaveAttribute("aria-hidden", "true");
    expect(sheets[1].querySelectorAll("img, span")).toHaveLength(2);
    const canvas = column.querySelector('[data-testid="clover-canvas"]');
    fireEvent.keyDown(column, { key: "PageDown" });
    // The second view current, its thumbnail selected.
    await waitFor(() =>
      expect(within(sidebar).getAllByRole("option")[1]).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    // The one Canvas shows the next view: nothing remounted.
    expect(column.querySelector('[data-testid="clover-canvas"]')).toBe(canvas);

    // With room for both, the panel sits beside the page, a bar between them.
    const panel = document.querySelector<HTMLElement>(
      ".clover-template-document-panel",
    )!;
    const info = () => screen.getByRole("button", { name: "More information" });
    expect(panel).toHaveAttribute("hidden");
    expect(screen.getAllByRole("separator")).toHaveLength(1);
    fireEvent.click(info());
    expect(panel).not.toHaveAttribute("hidden");
    // Its sections are stacked boxes, as Default's, About open.
    expect(
      within(panel).getByRole("button", { name: "About" }),
    ).toHaveAttribute("aria-expanded", "true");
    const bars = screen.getAllByRole("separator");
    expect(bars).toHaveLength(2);
    expect(bars[1]).toHaveAttribute("aria-controls", panel.id);
    // Beside the page, the toggle puts it away: it has no close button of its own.
    expect(
      within(panel).queryByRole("button", { name: "Close information panel" }),
    ).toBeNull();
    fireEvent.click(info());
    expect(panel).toHaveAttribute("hidden");
    expect(screen.getAllByRole("separator")).toHaveLength(1);

    // Put away, it waits over the page's top left, and focus goes with it.
    toggle().focus();
    fireEvent.click(toggle());
    expect(sidebar).toHaveAttribute("hidden");
    expect(
      toggle().closest(".clover-template-document-sidebar-closed"),
    ).not.toBeNull();
    await waitFor(() => expect(toggle()).toHaveFocus());
  });

  it("Document: the title at headingLevel, the panel's sections a level under it", async () => {
    render(
      <Templates.Document
        iiifContent={bookJson}
        headingLevel={3}
        defaultPanelOpen
      />,
    );
    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
    const panel = document.querySelector<HTMLElement>(
      ".clover-template-document-panel",
    )!;
    expect(
      within(panel).getByRole("heading", { level: 4, name: "About" }),
    ).toBeInTheDocument();
  });

  it("Document: the downloads in the toolbar, as links, their groups a level under the title", async () => {
    render(<Templates.Document iiifContent={renderingJson} headingLevel={4} />);
    await screen.findByRole("heading", { level: 4 });
    const toolbar = document.querySelector<HTMLElement>(
      ".clover-template-document-toolbar",
    )!;
    expect(
      within(toolbar).getByRole("heading", { level: 5, name: "All pages" }),
    ).toBeInTheDocument();
    expect(
      within(toolbar).getByRole("link", { name: /PDF version/ }),
    ).toBeInTheDocument();
    expect(
      within(toolbar).queryByRole("button", { name: "Download" }),
    ).toBeNull();
  });

  it("Document: a title that would be past h6 names what it heads, never an h6 beside its own", async () => {
    render(
      <Templates.Document
        iiifContent={renderingJson}
        headingLevel={4}
        defaultPanelOpen
      />,
    );
    await screen.findByRole("heading", { level: 4 });
    const panel = document.querySelector<HTMLElement>(
      ".clover-template-document-panel",
    )!;
    // About is a 5, its titles 6: its downloads' groups would be 7.
    expect(
      await within(panel).findByRole("heading", { level: 6, name: "Download" }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole("region", { name: "All pages" }),
    ).toBeInTheDocument();
    expect(
      within(panel).queryByRole("heading", { name: "All pages" }),
    ).not.toBeInTheDocument();
  });

  it("Gallery: past h6 its title is no heading, and names the Viewer", async () => {
    render(<Templates.Gallery iiifContent={bookJson} headingLevel={7} />);
    expect(
      await screen.findByRole("group", { name: "Simple Manifest - Book" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Simple Manifest - Book" }),
    ).not.toBeInTheDocument();
  });

  describe("Document, with no room for the panel beside the page", () => {
    // jsdom lays nothing out: a phone-wide layout, as the template measures it.
    let width: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      width = vi
        .spyOn(HTMLElement.prototype, "clientWidth", "get")
        .mockReturnValue(390);
    });
    afterEach(() => width.mockRestore());

    it("slides the panel over the page, focused, closing on Escape or its button", async () => {
      render(<Templates.Document iiifContent={bookJson} />);
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      });
      const panel = document.querySelector<HTMLElement>(
        ".clover-template-document-panel",
      )!;
      const info = () =>
        screen.getByRole("button", { name: "More information" });
      fireEvent.click(info());
      await waitFor(() => expect(panel).toHaveAttribute("data-open", "true"));
      // Over the page there is no bar for it, only the thumbnails'.
      expect(screen.getAllByRole("separator")).toHaveLength(1);

      // Opening takes focus into the panel, at the open box's heading; Escape there
      // hands it back to the toggle.
      const about = within(panel).getByRole("button", { name: "About" });
      await waitFor(() => expect(about).toHaveFocus());
      fireEvent.keyDown(about, { key: "Escape" });
      expect(panel).toHaveAttribute("data-open", "false");
      expect(info()).toHaveFocus();
      await waitFor(() => expect(panel).toHaveAttribute("hidden"));

      // And its close button.
      fireEvent.click(info());
      fireEvent.click(
        within(panel).getByRole("button", { name: "Close information panel" }),
      );
      expect(panel).toHaveAttribute("data-open", "false");
    });

    it("puts the panel away on Escape from under it, leaving focus there", async () => {
      render(<Templates.Document iiifContent={bookJson} />);
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      });
      const panel = document.querySelector<HTMLElement>(
        ".clover-template-document-panel",
      )!;
      fireEvent.click(screen.getByRole("button", { name: "More information" }));
      await waitFor(() => expect(panel).toHaveAttribute("data-open", "true"));
      // Tabbing back from the panel reaches the thumbnails it covers.
      const sidebar = screen.getByRole("complementary", { name: "Items" });
      const option = within(sidebar).getAllByRole("option")[0];
      option.focus();
      fireEvent.keyDown(option, { key: "Escape" });
      expect(panel).toHaveAttribute("data-open", "false");
      expect(option).toHaveFocus();
    });

    it("on a phone, choosing a page puts the thumbnails away, focus on their toggle", async () => {
      const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(
        (query: string) =>
          ({
            matches: query === "(max-width: 40rem)",
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
          }) as unknown as MediaQueryList,
      );
      render(<Templates.Document iiifContent={bookJson} defaultSidebarOpen />);
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      });
      const sidebar = screen.getByRole("complementary", { name: "Items" });
      const option = within(sidebar).getAllByRole("option")[1];
      option.focus();
      fireEvent.click(option);
      expect(sidebar).toHaveAttribute("hidden");
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /^Show items/ }),
        ).toHaveFocus(),
      );
      matchMedia.mockRestore();
    });
  });
});
