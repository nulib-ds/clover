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
import compareJson from "../fixtures/iiif-cookbook/0540-link-for-opening-multiple-canvases-annotation.json";
import layoutJson from "../fixtures/iiif-cookbook/0309-annotation-collection.json";
import layoutPage1 from "../fixtures/iiif-cookbook/0309-annotation-collection-anno_p1.json";
import layoutPage2 from "../fixtures/iiif-cookbook/0309-annotation-collection-anno_p2.json";
import monumentsJson from "../fixtures/iiif-cookbook/0540-link-for-opening-multiple-canvases-manifest.json";
import colosseumJson from "../fixtures/iiif-cookbook/0540-link-for-opening-multiple-canvases-manifest-2.json";
import { initCloverI18n } from "../i18n";
import { getCloverRoot } from "../lib/fullscreen";
import * as Templates from "./index";
import { SLIDE_MS } from "./shared/useSlide";

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
  // Cookbook 0540: one content state naming two Canvases, each in its own Manifest.
  it("Default: a content state's targets, counted and stepped in the header, listed in Views", async () => {
    const table: Record<string, unknown> = {
      [compareJson.target[0].partOf[0].id]: colosseumJson,
      [compareJson.target[1].partOf[0].id]: monumentsJson,
    };
    const fetch = vi.fn(async (url: string) =>
      table[url] === undefined
        ? new Response("missing", { status: 404 })
        : new Response(JSON.stringify(table[url]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
    );
    render(
      <Templates.Default
        iiifContent={JSON.stringify(compareJson)}
        request={{ fetch }}
      />,
    );
    await screen.findByRole("heading", { level: 2, name: "The Colosseum" });
    const views = await screen.findByRole("navigation", { name: "Views" });
    expect(
      within(views).getByRole("button", { name: "1 / 2" }),
    ).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(within(views).getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", {
      level: 2,
      name: "Two monuments in Rome",
    });
    expect(within(views).getByRole("button", { name: "Next" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    // The count opens them all, listed as Views lists them, the one shown selected;
    // choosing one goes there and closes it.
    const count = within(views).getByRole("button", { name: "2 / 2" });
    fireEvent.click(count);
    expect(count).toHaveAttribute("aria-expanded", "true");
    const popup = await waitFor(() => {
      const found = document.getElementById(
        count.getAttribute("aria-controls")!,
      );
      expect(found?.querySelector("[role=listbox]")).toBeTruthy();
      return found!;
    });
    const [first, second] = within(popup).getAllByRole("option");
    expect(second).toHaveAttribute("aria-selected", "true");
    // Both Canvases are "The Colosseum": each item says its Manifest's title under it.
    await waitFor(() =>
      expect(second).toHaveTextContent("Two monuments in Rome"),
    );
    fireEvent.click(first);
    await screen.findByRole("heading", { level: 2, name: "The Colosseum" });

    // The Panel lists them too, in a section of their own, with steps between them.
    fireEvent.click(screen.getByRole("button", { name: "Views" }));
    const list = await screen.findByRole("listbox", { name: "Items" });
    const options = within(list).getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    const section = list.closest(".clover-targets") as HTMLElement;
    fireEvent.click(
      within(section).getAllByRole("button", { name: "Next" })[0],
    );
    await screen.findByRole("heading", {
      level: 2,
      name: "Two monuments in Rome",
    });
    await waitFor(() =>
      expect(options[1]).toHaveAttribute("aria-selected", "true"),
    );
  });

  // Cookbook 0032: a Collection as the content, its members moved between.
  it("Default: opened on a Collection, its title over the Manifest's and its members stepped in the header", async () => {
    const letter = {
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/letter",
      type: "Manifest",
      label: { en: ["A letter"] },
      items: [
        {
          id: "https://example.org/letter/canvas/1",
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
        { id: bookJson.id, type: "Manifest", label: { en: ["The book"] } },
        { id: letter.id, type: "Manifest", label: { en: ["A letter"] } },
      ],
    };
    const table: Record<string, unknown> = {
      [bookJson.id]: bookJson,
      [letter.id]: letter,
    };
    const fetch = vi.fn(async (url: string) =>
      table[url] === undefined
        ? new Response("missing", { status: 404 })
        : new Response(JSON.stringify(table[url]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
    );
    render(<Templates.Default iiifContent={shelf} request={{ fetch }} />);
    const title = await screen.findByRole("heading", {
      level: 2,
      name: "Simple Manifest - Book",
    });
    // Under it, the Collection's title, smaller, then the members' pager.
    const row = title.nextElementSibling!;
    expect(row).toHaveClass("clover-template-default-collection-row");
    expect(row.firstElementChild).toHaveTextContent("Shelf");
    expect(row.firstElementChild?.tagName).toBe("P");
    expect(
      within(row as HTMLElement).getByRole("navigation", {
        name: "Collection",
      }),
    ).toBeInTheDocument();

    const members = screen.getByRole("navigation", { name: "Collection" });
    expect(
      within(members).getByRole("button", { name: "1 / 2" }),
    ).toBeInTheDocument();
    fireEvent.click(within(members).getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { level: 2, name: "A letter" });
    expect(
      within(members).getByRole("button", { name: "2 / 2" }),
    ).toBeInTheDocument();
    // The Collection section stays, as it says of the Manifest shown.
    expect(
      screen.getByRole("button", { name: "Collection" }),
    ).toBeInTheDocument();
  });

  it("Default: an AnnotationCollection named in the header, its annotations stepped there (Cookbook 0309)", async () => {
    const pages: Record<string, unknown> = {
      [layoutPage1.id]: layoutPage1,
      [layoutPage2.id]: layoutPage2,
    };
    const fetch = vi.fn(
      async (url: string) => new Response(JSON.stringify(pages[url])),
    );
    render(<Templates.Default iiifContent={layoutJson} request={{ fetch }} />);
    // Named from the Manifest's references, under the Manifest's title.
    const name = await screen.findByText("Newspaper layout markup", {
      selector: ".clover-template-default-collection",
    });
    const row = name.closest(".clover-template-default-collection-row")!;
    const steps = await within(row as HTMLElement).findByRole("navigation", {
      name: "Annotations",
    });
    // Its first annotation picked as it opens, of the eight its Collection counts.
    await waitFor(() => expect(steps).toHaveTextContent("1 / 8"));
    // Only the page in view is fetched; the next as a step goes past it.
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([layoutPage1.id]);
    const next = within(steps).getByRole("button", { name: "Next" });
    for (const place of [2, 3, 4]) {
      fireEvent.click(next);
      await waitFor(() => expect(steps).toHaveTextContent(`${place} / 8`));
    }
    fireEvent.click(next);
    await waitFor(() => expect(steps).toHaveTextContent("5 / 8"));
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      layoutPage1.id,
      layoutPage2.id,
    ]);
  });

  it("Default: an AnnotationPage given as the content, named in the header and walked across its Manifests", async () => {
    // James Turner's way: tags on Canvases of two Manifests, in a page of their own.
    const tag = (
      n: number,
      manifest: { id: string; items: { id: string }[] },
    ) => ({
      id: `https://example.org/tags.json#${n}`,
      type: "Annotation",
      motivation: "tagging",
      body: { type: "TextualBody", value: `Tag ${n}`, format: "text/plain" },
      target: {
        type: "SpecificResource",
        source: {
          id: manifest.items[0].id,
          type: "Canvas",
          partOf: [{ id: manifest.id, type: "Manifest" }],
        },
        selector: {
          type: "FragmentSelector",
          conformsTo: "http://www.w3.org/TR/media-frags/",
          value: "xywh=0,0,100,100",
        },
      },
    });
    const tags = {
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/tags.json",
      type: "AnnotationPage",
      label: { en: ["Two tags"] },
      items: [tag(1, bookJson), tag(2, singleJson)],
    };
    const manifests: Record<string, unknown> = {
      [bookJson.id]: bookJson,
      [singleJson.id]: singleJson,
    };
    const fetch = vi.fn(
      async (url: string) => new Response(JSON.stringify(manifests[url])),
    );
    render(<Templates.Default iiifContent={tags} request={{ fetch }} />);
    const name = await screen.findByText("Two tags", {
      selector: ".clover-template-default-collection",
    });
    const steps = await within(
      name.closest(".clover-template-default-collection-row") as HTMLElement,
    ).findByRole("navigation", { name: "Annotations" });
    // Opened on the first tag's Manifest, the tag picked.
    await waitFor(() => expect(steps).toHaveTextContent("1 / 2"));
    expect(
      screen.getByRole("heading", { level: 2, name: "Simple Manifest - Book" }),
    ).toBeInTheDocument();
    // On to the second: its own Manifest opens, the tag picked there.
    fireEvent.click(within(steps).getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", {
      level: 2,
      name: "Still image from an opera performance at Indiana University",
    });
    await waitFor(() => expect(steps).toHaveTextContent("2 / 2"));
  });

  it("Default: a Manifest on its own has no Collection's title or members in its header", async () => {
    render(<Templates.Default iiifContent={bookJson} />);
    await screen.findByRole("heading", {
      level: 2,
      name: "Simple Manifest - Book",
    });
    expect(
      document.querySelector(".clover-template-default-collection"),
    ).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Collection" })).toBeNull();
  });

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

  it("Default and Document: full screen takes the whole Viewer, Items and Panel too", async () => {
    const { container, rerender } = render(
      <Templates.Default iiifContent={bookJson} />,
    );
    await screen.findByRole("heading", {
      level: 2,
      name: "Simple Manifest - Book",
    });
    // Asked from the Canvas's control, the Viewer goes, not the Canvas alone.
    const viewer = container.querySelector(".clover-template-default");
    expect(getCloverRoot(container.querySelector(".clover-canvas"))).toBe(
      viewer,
    );
    // Full screen, its Body offers the way out at its top left, as a Canvas alone does.
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => viewer,
    });
    try {
      act(() => {
        document.dispatchEvent(new Event("fullscreenchange"));
      });
      const body = container.querySelector(".clover-canvas")!;
      expect(body).toHaveAttribute("data-exit");
      expect(
        within(body as HTMLElement).getByText("Exit full screen", {
          selector: ".clover-canvas-exit-full-screen",
        }),
      ).toBeVisible();
    } finally {
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        get: () => null,
      });
      act(() => {
        document.dispatchEvent(new Event("fullscreenchange"));
      });
    }
    rerender(<Templates.Document iiifContent={bookJson} />);
    await waitFor(() =>
      expect(container.querySelector(".clover-canvas")).not.toBeNull(),
    );
    expect(getCloverRoot(container.querySelector(".clover-canvas"))).toBe(
      container.querySelector(".clover-template-document"),
    );
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

  it("Default: narrowing under the open panel closes it, focus to its toggle; widening brings it back", async () => {
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
    // Room again: back beside the Body, as it was.
    width.mockReturnValue(1280);
    act(() => panes.forEach((measure) => measure()));
    expect(
      document.querySelector(".clover-template-default-panel"),
    ).not.toHaveAttribute("hidden");
    // Focus on its toggle, on the spine, follows it to the Body's controls as it narrows.
    const onSpine = document.querySelector<HTMLElement>(
      ".clover-template-default-spine [data-button='panel']",
    )!;
    onSpine.focus();
    width.mockReturnValue(390);
    act(() => panes.forEach((measure) => measure()));
    await waitFor(() => {
      const toggle = screen.getByRole("button", { name: "More information" });
      expect(toggle).not.toBe(onSpine);
      expect(toggle).toHaveFocus();
    });
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

    it("starts closed over the Body even when the host asks it open, focus left where it was", async () => {
      render(<Templates.Default iiifContent={bookJson} defaultPanelOpen />);
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      });
      expect(panel()).not.toBeVisible();
      expect(toggle()).toHaveAttribute("aria-expanded", "false");
      // Nothing over the Body on arrival, nor a moment later.
      expect(
        document.querySelector(".clover-template-default-scrim"),
      ).toBeNull();
      await act(() => new Promise((done) => setTimeout(done, SLIDE_MS + 60)));
      expect(panel()).not.toBeVisible();
      expect(document.body).toHaveFocus();
    });

    it("takes focus into the panel as the reader opens it", async () => {
      render(<Templates.Default iiifContent={bookJson} />);
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      });
      fireEvent.click(toggle());
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "About" })).toHaveFocus(),
      );
    });
  });

  it("Document: narrowing under the panel and thumbnails closes them, focus to its toggle; widening brings them back", async () => {
    // jsdom lays nothing out: the layout measures wide, then phone-wide (zoomed in, say).
    const panes: Array<() => void> = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private callback: () => void) {}
        observe(node: Element) {
          if (node.classList.contains("clover-template-document-panes"))
            panes.push(this.callback);
        }
        disconnect() {}
      },
    );
    const width = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(1280);
    try {
      render(<Templates.Document iiifContent={bookJson} defaultPanelOpen />);
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      });
      const panel = document.querySelector<HTMLElement>(
        ".clover-template-document-panel",
      )!;
      const sidebar = document.querySelector<HTMLElement>(
        ".clover-template-document-sidebar",
      )!;
      expect(panel).not.toHaveAttribute("hidden");
      expect(sidebar).not.toHaveAttribute("hidden");
      // Open on arrival, its code loads first.
      (await within(panel).findByRole("button", { name: "About" })).focus();
      width.mockReturnValue(390);
      act(() => panes.forEach((measure) => measure()));
      expect(panel).toHaveAttribute("hidden");
      expect(sidebar).toHaveAttribute("hidden");
      expect(
        document.querySelector(".clover-template-document-panes"),
      ).toHaveAttribute("data-narrow");
      // Its toggle has moved, from the spine to the Canvas's controls.
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "More information" }),
        ).toHaveFocus(),
      );
      // Room again: both back beside the page, as they were.
      width.mockReturnValue(1280);
      act(() => panes.forEach((measure) => measure()));
      expect(panel).not.toHaveAttribute("hidden");
      expect(sidebar).not.toHaveAttribute("hidden");
      // Focus on the thumbnails' toggle, on their spine, follows it over the page's top
      // left as they go.
      const items = () => screen.getByRole("button", { name: /^Show items/ });
      items().focus();
      width.mockReturnValue(390);
      act(() => panes.forEach((measure) => measure()));
      await waitFor(() => {
        expect(
          items().closest(".clover-template-document-sidebar-closed"),
        ).not.toBeNull();
        expect(items()).toHaveFocus();
      });
    } finally {
      width.mockRestore();
      vi.unstubAllGlobals();
    }
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
    // The Body's code loads with the first open (or as the reader reaches for the grid):
    // the title, Close and the pager are there at once, the Body a moment later.
    await waitFor(() =>
      expect(dialog.querySelector(".clover-body")).not.toBeNull(),
    );
    expect(
      dialog.querySelector(".clover-template-lightbox-pending"),
    ).toBeNull();
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
    // Shut, its code has not loaded: nothing in its pane until it first opens.
    expect(panel).toBeEmptyDOMElement();
    fireEvent.click(info());
    // The first press loads it, then opens it whole.
    await waitFor(() => expect(panel).not.toHaveAttribute("hidden"));
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

  it("Document: the downloads in its toolbar only, never again in its panel's About", async () => {
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
    await within(panel).findByRole("heading", { level: 5, name: "About" });
    expect(
      within(panel).queryByRole("heading", { name: "Download" }),
    ).toBeNull();
    expect(screen.getAllByRole("link", { name: /PDF version/ })).toHaveLength(
      1,
    );
  });

  it("Default: About's titles a level under it, its downloads behind its heading's button", async () => {
    render(<Templates.Default iiifContent={renderingJson} headingLevel={4} />);
    await screen.findByRole("heading", { level: 4 });
    // About is a 5, its titles 6.
    expect(
      await screen.findByRole("heading", { level: 6, name: "IIIF Manifest" }),
    ).toBeInTheDocument();
    // The downloads: named groups in the Download button's popover, never headings.
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(
      await screen.findByRole("group", { name: "All pages" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^(Download|All pages)$/ }),
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

    it("starts with the panel and thumbnails closed, even when the host asks them open", async () => {
      render(
        <Templates.Document
          iiifContent={bookJson}
          defaultPanelOpen
          defaultSidebarOpen
        />,
      );
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      });
      const panel = document.querySelector<HTMLElement>(
        ".clover-template-document-panel",
      )!;
      expect(panel).toHaveAttribute("hidden");
      expect(
        document.querySelector(".clover-template-document-sidebar"),
      ).toHaveAttribute("hidden");
      expect(
        screen.getByRole("button", { name: /^Show items/ }),
      ).toHaveAttribute("aria-expanded", "false");
      expect(document.querySelector(".clover-template-scrim")).toBeNull();
      await act(() => new Promise((done) => setTimeout(done, SLIDE_MS + 60)));
      expect(panel).toHaveAttribute("hidden");
      expect(document.body).toHaveFocus();
    });

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
      // The title can appear before the Canvas has mounted its controls.
      fireEvent.click(
        await screen.findByRole("button", { name: "More information" }),
      );
      await waitFor(() => expect(panel).toHaveAttribute("data-open", "true"));
      // Over the page there is no bar for it, nor for the thumbnails.
      expect(screen.queryAllByRole("separator")).toHaveLength(0);

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
      fireEvent.click(
        await screen.findByRole("button", { name: "More information" }),
      );
      await waitFor(() => expect(panel).toHaveAttribute("data-open", "true"));
      // Tabbing back from the panel reaches the thumbnails' toggle it covers.
      const under = screen.getByRole("button", { name: /^Show items/ });
      under.focus();
      fireEvent.keyDown(under, { key: "Escape" });
      expect(panel).toHaveAttribute("data-open", "false");
      expect(under).toHaveFocus();
    });

    const items = () => screen.getByRole("button", { name: /^Show items/ });
    /** Open the thumbnails over the page, as the reader does: focus goes to the page they are on. */
    const openThumbnails = async () => {
      items().focus();
      fireEvent.click(items());
      const sidebar = screen.getByRole("complementary", { name: "Items" });
      await waitFor(() =>
        expect(within(sidebar).getAllByRole("option")[0]).toHaveFocus(),
      );
      return sidebar;
    };

    it("on a phone, opened, the thumbnails take focus at the page the reader is on", async () => {
      render(<Templates.Document iiifContent={bookJson} />);
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      });
      const sidebar = await openThumbnails();
      expect(items()).toHaveAttribute("aria-expanded", "true");
      // Over the page, with a wash beside them and no bar.
      expect(
        document.querySelector(".clover-template-scrim[data-for='sidebar']"),
      ).not.toBeNull();
      expect(screen.queryAllByRole("separator")).toHaveLength(0);
      // A press on the wash puts them away, focus to their toggle.
      fireEvent.click(
        document.querySelector(".clover-template-scrim[data-for='sidebar']")!,
      );
      expect(sidebar).toHaveAttribute("hidden");
      await waitFor(() => expect(items()).toHaveFocus());
    });

    it("on a phone, Escape in the thumbnails puts them away, focus to their toggle", async () => {
      render(<Templates.Document iiifContent={bookJson} />);
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      });
      const sidebar = await openThumbnails();
      fireEvent.keyDown(within(sidebar).getAllByRole("option")[0], {
        key: "Escape",
      });
      expect(sidebar).toHaveAttribute("hidden");
      await waitFor(() => expect(items()).toHaveFocus());
    });

    it("on a phone, Escape from under the thumbnails puts them away, leaving focus there", async () => {
      render(<Templates.Document iiifContent={bookJson} />);
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      });
      const sidebar = await openThumbnails();
      // Tabbing on from the thumbnails reaches the page they cover.
      const under = await screen.findByRole("button", {
        name: "More information",
      });
      under.focus();
      fireEvent.keyDown(under, { key: "Escape" });
      expect(sidebar).toHaveAttribute("hidden");
      expect(under).toHaveFocus();
    });

    it("on a phone, choosing a page puts the thumbnails away, focus on their toggle", async () => {
      render(<Templates.Document iiifContent={bookJson} />);
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      });
      const sidebar = await openThumbnails();
      const option = within(sidebar).getAllByRole("option")[1];
      option.focus();
      fireEvent.click(option);
      expect(sidebar).toHaveAttribute("hidden");
      await waitFor(() => expect(items()).toHaveFocus());
    });
  });
});
