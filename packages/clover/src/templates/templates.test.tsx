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

import audioJson from "../fixtures/iiif-cookbook/0002-mvm-audio.json";
import placeholderVideoJson from "../fixtures/iiif-cookbook/0013-placeholderCanvas.json";
import bookJson from "../fixtures/iiif-cookbook/0009-book-1.json";
import tocJson from "../fixtures/iiif-cookbook/0024-book-4-toc.json";
import modelJson from "../fixtures/iiif-cookbook/0608-mvm-3d-v4.json";
import singleJson from "../fixtures/iiif-cookbook/0004-canvas-size.json";
import renderingJson from "../fixtures/iiif-cookbook/0046-rendering.json";
import rtlJson from "../fixtures/iiif-cookbook/0010-book-2-viewing-direction-rtl.json";
import ttbJson from "../fixtures/iiif-cookbook/0010-book-2-viewing-direction-ttb.json";
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

  // A copy of a template imports these from `@nulib/clover/templates` where it imported
  // `../shared/…` (issue #391), so every one must be exported there.
  it("export every helper a template imports from shared/", () => {
    for (const file of sources(resolve(__dirname))) {
      if (file.includes("/shared/")) continue;
      const text = readFileSync(file, "utf8");
      for (const [, names] of text.matchAll(
        /^import\s+(?:type\s+)?\{([^}]*)\}\s+from "\.\.\/shared\/[^"]+"/gm,
      )) {
        for (const name of names.split(",").map((n) => n.trim())) {
          if (!name || name.startsWith("type ")) continue;
          expect(
            name in Templates,
            `${file} imports ${name} from shared/: export it from templates/index.ts`,
          ).toBe(true);
        }
      }
    }
  });

  // The template on the docs' Helpers page (`content/docs/composing/helpers.mdx`, Panel), built from
  // the package's exports alone, the Panel on the start side: keep the two in step. (The
  // page's has a Map under the Body, which jsdom cannot draw.)
  it("make a template of your own from the helpers, as Helpers shows", async () => {
    const Parts = await import("../parts");
    function MyCustomViewer({
      headingLevel = 2,
      ...props
    }: {
      iiifContent: unknown;
      headingLevel?: number;
    }) {
      const split = React.useRef<HTMLDivElement>(null);
      const pane = Templates.usePanelPane({
        id: "my-panel",
        side: "start",
        beside: Templates.useWideEnough(split, Templates.BESIDE_REM),
        defaultOpen: true,
        followFocus: Templates.useFollowFocus(),
      });
      return (
        <Parts.Root {...(props as React.ComponentProps<typeof Parts.Root>)}>
          <Parts.Label
            as={`h${headingLevel}` as keyof React.JSX.IntrinsicElements}
          />
          <Parts.Split
            ref={split}
            className="clover-template-panes"
            style={{ height: "40rem" }}
            {...pane.splitProps}
          >
            <Templates.PanelPane
              pane={pane}
              layout="accordion"
              headingLevel={headingLevel + 1}
            >
              <Parts.Tab value="about" label="About">
                <Parts.About
                  label={false}
                  thumbnail={false}
                  headingLevel={headingLevel + 2}
                />
              </Parts.Tab>
            </Templates.PanelPane>
            <Parts.SplitPane min={pane.over ? undefined : Templates.PAGE_MIN}>
              <Parts.Body style={{ height: "20rem" }}>
                {!pane.docked && pane.toggle}
              </Parts.Body>
            </Parts.SplitPane>
          </Parts.Split>
        </Parts.Root>
      );
    }
    render(<MyCustomViewer iiifContent={bookJson} headingLevel={5} />);
    // An accordion of one section, About, open beside the Body.
    expect(
      await screen.findByRole("button", { name: "About" }),
    ).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById("my-panel")!;
    expect(panel).not.toHaveAttribute("hidden");
    expect(panel).toHaveAttribute("data-side", "start");
    // On the start side: the Panel, then its SplitHandle, then the Body's SplitPane.
    const handle = screen.getByRole("separator");
    expect(
      panel.compareDocumentPosition(handle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      handle.compareDocumentPosition(document.querySelector(".clover-body")!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The Manifest's label once, as the template's heading, and About's one level under
    // it, at the levels `headingLevel` gives, as a docs demo's are. The label comes with
    // the Manifest, after the panel's own button: waited for, not read at once.
    expect(
      await screen.findByRole("heading", {
        level: 5,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { name: "Simple Manifest - Book" }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 6, name: "About" }),
    ).toBeInTheDocument();
    expect(panel.querySelector(".clover-about-thumbnail")).toBeNull();
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
    expect(toggle().closest(".clover-template-spine")).not.toBeNull();
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
      within(views).getByRole("button", { name: "Item 1 of 2" }),
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
    const count = within(views).getByRole("button", { name: "Item 2 of 2" });
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
    // The pager's own chunk, loaded as it first draws.
    expect(
      await within(row as HTMLElement).findByRole("navigation", {
        name: "Collection",
      }),
    ).toBeInTheDocument();

    const members = screen.getByRole("navigation", { name: "Collection" });
    expect(
      within(members).getByRole("button", { name: "Item 1 of 2" }),
    ).toBeInTheDocument();
    fireEvent.click(within(members).getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { level: 2, name: "A letter" });
    expect(
      within(members).getByRole("button", { name: "Item 2 of 2" }),
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

  /*
   * A book read down the page (Cookbook 0010's diary): its thumbnails a column at the
   * Body's start, first in focus order as on screen, and the view's titles and position
   * under the Body. A book read across keeps its strip under the Body.
   */
  it("Default: a top-to-bottom book's thumbnails stand at the Body's start, its titles under the Body", async () => {
    const { unmount } = render(<Templates.Default iiifContent={ttbJson} />);
    const column = await screen.findByRole("listbox");
    expect(column).toHaveAttribute("aria-orientation", "vertical");
    const views = document.querySelector(".clover-template-default-views")!;
    expect(views).toHaveAttribute("data-orientation", "vertical");
    const [rail, body, titles] = Array.from(views.children);
    expect(rail).toContainElement(column);
    expect(body).toHaveClass("clover-template-default-body");
    expect(titles).toHaveClass("clover-template-default-rail-header");
    expect(titles).toHaveTextContent("1 / 4");
    unmount();

    render(<Templates.Default iiifContent={bookJson} />);
    const row = await screen.findByRole("listbox");
    expect(row).toHaveAttribute("aria-orientation", "horizontal");
    const across = document.querySelector(".clover-template-default-views")!;
    expect(across).not.toHaveAttribute("data-orientation");
    const [first, strip] = Array.from(across.children);
    expect(first).toHaveClass("clover-template-default-body");
    expect(strip).toContainElement(row);
    expect(strip.firstElementChild).toHaveClass(
      "clover-template-default-rail-header",
    );
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
      ".clover-template-spine [data-button='panel']",
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
    /*
     * The Viewer, drawn: its title, then its toggle, which sits among the Body's controls
     * and so comes with the Body's view, a moment after the title (a race CI lost once).
     */
    const drawn = async () => {
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      });
      await screen.findByRole("button", { name: "More information" });
    };
    const panel = () =>
      document.querySelector<HTMLElement>(".clover-template-default-panel")!;

    it("never stacks: it starts closed, then slides over the Body when asked", async () => {
      render(<Templates.Default iiifContent={bookJson} />);
      await drawn();
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
      await drawn();
      const open = async () => {
        fireEvent.click(toggle());
        await waitFor(() =>
          expect(toggle()).toHaveAttribute("aria-expanded", "true"),
        );
      };

      await open();
      fireEvent.click(document.querySelector(".clover-template-scrim")!);
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
      await drawn();
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
      await drawn();
      expect(panel()).not.toBeVisible();
      expect(toggle()).toHaveAttribute("aria-expanded", "false");
      // Nothing over the Body on arrival, nor a moment later.
      expect(document.querySelector(".clover-template-scrim")).toBeNull();
      await act(() => new Promise((done) => setTimeout(done, SLIDE_MS + 60)));
      expect(panel()).not.toBeVisible();
      expect(document.body).toHaveFocus();
    });

    it("takes focus into the panel as the reader opens it", async () => {
      render(<Templates.Default iiifContent={bookJson} />);
      await drawn();
      fireEvent.click(toggle());
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "About" })).toHaveFocus(),
      );
    });
  });

  it("Document: narrowing under the aside and thumbnails closes them, focus to its section's button; widening brings them back", async () => {
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
      const aside = document.querySelector<HTMLElement>(
        ".clover-template-document-aside",
      )!;
      const sidebar = document.querySelector<HTMLElement>(
        ".clover-template-document-sidebar",
      )!;
      const about = () =>
        within(
          document.querySelector<HTMLElement>(
            ".clover-template-document-toolbar",
          )!,
        ).getByRole("button", { name: "About" });
      expect(aside).not.toHaveAttribute("hidden");
      expect(sidebar).not.toHaveAttribute("hidden");
      expect(about()).toHaveAttribute("aria-expanded", "true");
      // Open on arrival, its content loads first.
      await within(aside).findByText("IIIF");
      within(aside).getAllByRole("link")[0].focus();
      width.mockReturnValue(390);
      act(() => panes.forEach((measure) => measure()));
      expect(aside).toHaveAttribute("hidden");
      expect(sidebar).toHaveAttribute("hidden");
      expect(about()).toHaveAttribute("aria-expanded", "false");
      expect(
        document.querySelector(".clover-template-document-panes"),
      ).toHaveAttribute("data-narrow");
      // Focus in it goes to the button for its section, in the toolbar.
      await waitFor(() => expect(about()).toHaveFocus());
      // Room again: both back beside the page, as they were.
      width.mockReturnValue(1280);
      act(() => panes.forEach((measure) => measure()));
      expect(aside).not.toHaveAttribute("hidden");
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

  it("Document: singleItem={false} leaves out the thumbnails, bar and their toggle for a single page", async () => {
    render(<Templates.Document iiifContent={singleJson} singleItem={false} />);
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

  it("Document: a dot marks the sections holding something of the page in sight, and About shows the page's own", async () => {
    const [first, ...rest] = bookJson.items as any[];
    const marked = {
      ...bookJson,
      id: "https://example.org/marked-book.json",
      items: [
        {
          ...first,
          summary: { en: ["The first page, described on its own."] },
          annotations: [
            {
              id: `${first.id}/comments`,
              type: "AnnotationPage",
              items: [
                {
                  id: `${first.id}/comments/1`,
                  type: "Annotation",
                  motivation: "commenting",
                  body: {
                    type: "TextualBody",
                    value: "A note on the first page",
                    format: "text/plain",
                    language: "en",
                  },
                  target: `${first.id}#xywh=0,0,100,100`,
                },
              ],
            },
          ],
        },
        ...rest,
      ],
    };
    render(<Templates.Document iiifContent={marked} />);
    const about = await screen.findByRole("button", { name: "About" });
    const annotations = await screen.findByRole("button", {
      name: "Annotations",
    });
    // The first page describes itself and carries a comment: both marked, and said so.
    await waitFor(() => expect(about).toHaveAttribute("data-marked"));
    expect(about).toHaveAccessibleDescription("This page");
    expect(annotations).toHaveAttribute("data-marked");
    expect(annotations).toHaveAccessibleDescription("This page");
    // About shows the page's own after the resource's; open, its dot is gone, and back
    // as it closes.
    fireEvent.click(about);
    expect(
      await screen.findByText("The first page, described on its own."),
    ).toBeInTheDocument();
    expect(about).not.toHaveAttribute("data-marked");
    expect(about).not.toHaveAccessibleDescription("This page");
    expect(annotations).toHaveAttribute("data-marked");
    fireEvent.click(about);
    await waitFor(() => expect(about).toHaveAttribute("data-marked"));
    expect(about).toHaveAccessibleDescription("This page");
    // The next page holds nothing of its own: no marks.
    const listbox = screen.getByRole("listbox", { name: "Items" });
    fireEvent.click(within(listbox).getAllByRole("option")[1]);
    await waitFor(() => expect(about).not.toHaveAttribute("data-marked"));
    expect(annotations).not.toHaveAttribute("data-marked");
    expect(about).not.toHaveAccessibleDescription("This page");
    expect(
      screen.queryByText("The first page, described on its own."),
    ).toBeNull();
  });

  it("Document: a single page's thumbnail and its toggle, put away to start", async () => {
    const plain = render(<Templates.Document iiifContent={singleJson} />);
    const toggle = await screen.findByRole("button", { name: /^Show items/ });
    await waitFor(() =>
      expect(
        document.querySelector(".clover-template-document-panes"),
      ).not.toHaveAttribute("data-sidebar", "open"),
    );
    expect(screen.queryByRole("listbox", { name: "Items" })).toBeNull();
    // Put away on its own, focus is left where it was.
    expect(toggle).not.toHaveFocus();
    // Opened, its one thumbnail.
    fireEvent.click(toggle);
    const listbox = await screen.findByRole("listbox", { name: "Items" });
    expect(within(listbox).getAllByRole("option")).toHaveLength(1);
    plain.unmount();
    // Where the host says, the thumbnails start shown.
    render(<Templates.Document iiifContent={singleJson} defaultSidebarOpen />);
    expect(
      await screen.findByRole("listbox", { name: "Items" }),
    ).toBeInTheDocument();
  });

  it("Default: no thumbnails for a single view, unless singleItem asks", async () => {
    const plain = render(<Templates.Default iiifContent={singleJson} />);
    await screen.findByRole("heading", {
      level: 2,
      name: "Still image from an opera performance at Indiana University",
    });
    expect(screen.queryByRole("listbox", { name: "Items" })).toBeNull();
    plain.unmount();
    render(<Templates.Default iiifContent={singleJson} singleItem />);
    const listbox = await screen.findByRole("listbox", { name: "Items" });
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("Default, Document and Gallery hand their Body collapseControls", async () => {
    const more = async () =>
      within(
        (await screen.findByRole("button", { name: "Expand viewer controls" }))
          .parentElement!,
      ).queryByRole("button", { name: "Zoom in" });
    const { unmount } = render(
      <Templates.Default iiifContent={bookJson} collapseControls="always" />,
    );
    // The view's controls behind More, the Body's row room or not.
    expect(await more()).toBeNull();
    unmount();
    const document = render(
      <Templates.Document iiifContent={bookJson} collapseControls="always" />,
    );
    // Document's are the full viewer's: a press on a page opens it.
    await screen.findByRole("heading", {
      level: 2,
      name: "Simple Manifest - Book",
    });
    await waitFor(() =>
      expect(
        window.document.querySelector(".clover-template-document-sheet"),
      ).not.toBeNull(),
    );
    fireEvent.click(
      window.document.querySelector(".clover-template-document-sheet")!,
    );
    expect(await more()).toBeNull();
    document.unmount();
    render(
      <Templates.Gallery iiifContent={bookJson} collapseControls="always" />,
    );
    fireEvent.click((await screen.findAllByRole("option"))[0]);
    expect(await more()).toBeNull();
  });

  it("Gallery: a grid even of one view, its cell opening the lightbox", async () => {
    const model = render(<Templates.Gallery iiifContent={modelJson} />);
    expect(await screen.findAllByRole("option")).toHaveLength(1);
    model.unmount();
    render(<Templates.Gallery iiifContent={singleJson} />);
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(1);
    fireEvent.click(options[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it('Gallery: lightboxItems="pager" steps through the views in the lightbox instead', async () => {
    render(<Templates.Gallery iiifContent={bookJson} lightboxItems="pager" />);
    fireEvent.click((await screen.findAllByRole("option"))[1]);
    const dialog = screen.getByRole("dialog", {
      name: "Simple Manifest - Book",
    });
    // Its view's code loads with the first open, the pager's with it.
    expect(await within(dialog).findByText(/Item 2 of 3/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("listbox")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    expect(within(dialog).getByText(/Item 3 of 3/)).toBeInTheDocument();
  });

  it("Gallery: a grid whose cells open the lightbox at that view", async () => {
    render(<Templates.Gallery iiifContent={bookJson} />);
    const options = await screen.findAllByRole("option");
    expect(document.querySelector(".clover-items")).toHaveAttribute(
      "data-layout",
      "grid",
    );
    fireEvent.click(options[1]);
    // Its title the Manifest's label, which names it; the view's label under the Body.
    const dialog = screen.getByRole("dialog", {
      name: "Simple Manifest - Book",
    });
    expect(
      within(dialog).getByRole("heading", {
        level: 3,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
    expect(
      await within(dialog).findByText("Frontispiece", {
        selector: ".clover-template-lightbox-caption",
      }),
    ).toBeInTheDocument();
    // A short strip of the views by default, the one shown chosen in it.
    const strip = within(dialog).getByRole("listbox", { name: "Items" });
    expect(strip.closest(".clover-items")).toHaveAttribute(
      "data-layout",
      "slider",
    );
    expect(
      within(strip).getByRole("option", { selected: true }),
    ).toHaveAccessibleName(/Frontispiece/);
    // The Body's code loads with the first open (or as the reader reaches for the grid):
    // the title, Close and the strip are there at once, the Body a moment later.
    await waitFor(() =>
      expect(dialog.querySelector(".clover-body")).not.toBeNull(),
    );
    expect(
      dialog.querySelector(".clover-template-lightbox-pending"),
    ).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Gallery: the lightbox is modal within the Gallery, and Escape gives focus back to the cell", async () => {
    const { container } = render(<Templates.Gallery iiifContent={bookJson} />);
    const options = await screen.findAllByRole("option");
    options[1].focus();
    fireEvent.click(options[1]);
    const dialog = screen.getByRole("dialog", {
      name: "Simple Manifest - Book",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // A layer in the Gallery, not the window's top layer: its bounds are the Gallery's.
    const gallery = container.querySelector(".clover-template-gallery")!;
    const layer = dialog.parentElement!;
    expect(layer).toHaveClass("clover-template-lightbox");
    expect(layer.parentElement).toBe(gallery);
    expect(container.querySelector("dialog")).toBeNull();
    // Focus on the view shown, in the strip; the rest of the Gallery out of reach.
    expect(
      within(dialog).getByRole("option", { selected: true }),
    ).toHaveFocus();
    expect(gallery.querySelector(".clover-items")).toHaveProperty(
      "inert",
      true,
    );
    // But not what speaks: a member loading as it is chosen is still told (WCAG 4.1.3).
    expect(gallery.querySelector(".clover-status")).not.toHaveProperty(
      "inert",
      true,
    );
    // Tab comes round inside it, either way (2.4.3), as `aria-modal` says.
    const back = within(dialog).getAllByRole("button")[0];
    back.focus();
    fireEvent.keyDown(back, { key: "Tab", shiftKey: true });
    const stops = dialog.querySelectorAll<HTMLElement>(
      'button, [tabindex]:not([tabindex="-1"])',
    );
    const last = stops[stops.length - 1];
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(back).toHaveFocus();
    // The focused control's popover first, alone (WCAG 1.4.13), then the lightbox.
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(gallery.querySelector(".clover-items")).toHaveProperty(
      "inert",
      false,
    );
    expect(options[1]).toHaveFocus();
    // A press on the layer outside the panel closes it too.
    fireEvent.click(options[2]);
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Gallery: height, gap, and its Items as masonry with no secondary line", async () => {
    const { container } = render(
      <Templates.Gallery
        iiifContent={bookJson}
        height={600}
        gap="1rem"
        items="masonry"
        secondary="none"
      />,
    );
    await screen.findAllByRole("option");
    const gallery = container.querySelector<HTMLElement>(
      ".clover-template-gallery",
    )!;
    expect(gallery).toHaveAttribute("data-height", "fixed");
    expect(
      gallery.style.getPropertyValue("--clover-template-gallery-height"),
    ).toBe("600px");
    expect(
      gallery.style.getPropertyValue("--clover-template-gallery-gap"),
    ).toBe("1rem");
    expect(container.querySelector(".clover-items")).toHaveAttribute(
      "data-layout",
      "masonry",
    );
  });

  // Cookbook 0032: a Collection as the content, its members in the grid.
  it("Gallery: opened on a Collection, its title and a cell for each member", async () => {
    const letter = {
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/letter",
      type: "Manifest",
      label: { en: ["A letter"] },
      items: [
        {
          id: "https://example.org/letter/canvas/1",
          type: "Canvas",
          label: { en: ["The letter"] },
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
      summary: { en: ["Two things on a shelf."] },
      items: [
        { id: bookJson.id, type: "Manifest", label: { en: ["The book"] } },
        {
          id: letter.id,
          type: "Manifest",
          label: { en: ["A letter"] },
          summary: { en: ["Text"] },
        },
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
    render(<Templates.Gallery iiifContent={shelf} request={{ fetch }} />);
    // The Collection's own title and summary, not its first member's.
    expect(
      await screen.findByRole("heading", { level: 2, name: "Shelf" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Two things on a shelf.")).toBeInTheDocument();
    const members = await screen.findAllByRole("option");
    expect(members).toHaveLength(2);
    // A member's summary under its label, the default secondary line.
    expect(members[1]).toHaveAccessibleName("A letter Text");
    // Choosing one shows that Manifest in the lightbox.
    fireEvent.click(members[1]);
    // Its title the Manifest's label; Back steps out to the Collection's members.
    const dialog = await screen.findByRole("dialog", { name: "A letter" });
    // (Its panel's About, a level under, names it too, as every template's does.)
    expect(
      within(dialog).getByRole("heading", { level: 3, name: "A letter" }),
    ).toBeInTheDocument();
    expect(
      await within(dialog).findByText("The letter", {
        selector: ".clover-template-lightbox-caption",
      }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("navigation")).toBeNull();
    fireEvent.click(
      await within(dialog).findByRole("button", { name: "Back to Shelf" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Gallery: the lightbox's title is the Manifest's, Back a step out to the grid", async () => {
    render(<Templates.Gallery iiifContent={bookJson} />);
    const cells = await screen.findAllByRole("option");
    cells[1].focus();
    fireEvent.click(cells[1]);
    const dialog = screen.getByRole("dialog", {
      name: "Simple Manifest - Book",
    });
    // Focus on the view shown, in the strip, for the arrow keys to go on from.
    expect(
      within(dialog).getByRole("option", { selected: true }),
    ).toHaveFocus();
    // No breadcrumb: Back, named for the grid it goes back to, before the title.
    expect(within(dialog).queryByRole("navigation")).toBeNull();
    const back = within(dialog).getByRole("button", {
      name: "Back to Simple Manifest - Book",
    });
    expect(
      within(dialog).getByRole("heading", {
        level: 3,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
    fireEvent.click(back);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(cells[1]).toHaveFocus();
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
    const dialog = screen.getByRole("dialog", {
      name: "Simple Manifest - Book",
    });
    expect(
      within(dialog).getByRole("heading", {
        level: 4,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
  });

  it("Gallery: annotations given as the content, a cell for each, opening each in its Manifest", async () => {
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
    render(<Templates.Gallery iiifContent={tags} request={{ fetch }} />);
    // Titled by their page, not the first tag's Manifest, and with no summary of its own.
    expect(
      await screen.findByRole("heading", { level: 2, name: "Two tags" }),
    ).toBeInTheDocument();
    const cells = await screen.findAllByRole("option");
    expect(cells).toHaveLength(2);
    expect(cells[1]).toHaveAccessibleName(/Tag 2/);
    fireEvent.click(cells[1]);
    // The second tag's Manifest in the lightbox, Back a step out to the tags.
    const dialog = await screen.findByRole("dialog", {
      name: "Still image from an opera performance at Indiana University",
    });
    expect(
      within(dialog).getByRole("button", { name: "Back to Two tags" }),
    ).toBeInTheDocument();
    // Its strip the tags, the one shown chosen.
    const strip = await within(dialog).findByRole("listbox", { name: "Items" });
    expect(
      within(strip).getByRole("option", { selected: true }),
    ).toHaveAccessibleName(/Tag 2/);
  });

  it("Gallery: its summary under the title, two lines with Read more, unless summary is false", async () => {
    const summarized = { ...bookJson, summary: { en: ["A book of plates."] } };
    const { unmount } = render(<Templates.Gallery iiifContent={summarized} />);
    const shown = await screen.findByText("A book of plates.");
    // Summary's own clamp, its lines set by the template (`Gallery.css`).
    expect(shown).toHaveClass(
      "clover-summary",
      "clover-template-gallery-summary",
    );
    unmount();
    render(<Templates.Gallery iiifContent={summarized} summary={false} />);
    await screen.findAllByRole("option");
    expect(screen.queryByText("A book of plates.")).toBeNull();
  });

  it("Gallery: the lightbox is named by its view when the Manifest has no label", async () => {
    render(
      <Templates.Gallery iiifContent={{ ...bookJson, label: undefined }} />,
    );
    fireEvent.click((await screen.findAllByRole("option"))[1]);
    expect(
      screen.getByRole("dialog", { name: "Frontispiece" }),
    ).toBeInTheDocument();
    // Back, with nothing to name where it goes, is Back.
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("Document: toolbar, thumbnails, a sheet for each view, PageDown, and its aside", async () => {
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
    expect(
      sheets[1].querySelectorAll(".clover-template-document-frame > *"),
    ).toHaveLength(2);
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

    // With room for both, the aside sits beside the page, a bar between them.
    const toolbar = document.querySelector<HTMLElement>(
      ".clover-template-document-toolbar",
    )!;
    const aside = document.querySelector<HTMLElement>(
      ".clover-template-document-aside",
    )!;
    // A button in the toolbar for each section the resource has, each a disclosure of
    // the aside.
    const group = within(toolbar).getByRole("group", {
      name: "Information panel",
    });
    const about = within(group).getByRole("button", { name: "About" });
    expect(about).toHaveAttribute("aria-expanded", "false");
    expect(about).toHaveAttribute("aria-controls", aside.id);
    expect(aside).toHaveAttribute("hidden");
    expect(screen.getAllByRole("separator")).toHaveLength(1);
    // Shut, its content has not loaded: its name alone, until it first opens.
    expect(
      aside.querySelector(".clover-template-document-aside-scroll")!.children,
    ).toHaveLength(1);
    fireEvent.click(about);
    await waitFor(() => expect(aside).not.toHaveAttribute("hidden"));
    expect(about).toHaveAttribute("aria-expanded", "true");
    // Its section alone, named by its heading: no accordion's boxes, no tabs.
    expect(screen.getByRole("complementary", { name: "About" })).toBe(aside);
    expect(
      within(aside).getByRole("heading", { level: 3, name: "About" }),
    ).toBeInTheDocument();
    await within(aside).findByText("IIIF");
    expect(within(aside).queryByRole("tab")).toBeNull();
    expect(within(aside).queryByRole("button", { name: "About" })).toBeNull();
    const bars = screen.getAllByRole("separator");
    expect(bars).toHaveLength(2);
    expect(bars[1]).toHaveAttribute("aria-controls", aside.id);
    // Beside the page, its button puts it away, and so does its close, on its edge.
    fireEvent.click(about);
    expect(aside).toHaveAttribute("hidden");
    expect(screen.getAllByRole("separator")).toHaveLength(1);
    fireEvent.click(about);
    await waitFor(() => expect(aside).not.toHaveAttribute("hidden"));
    const close = within(aside).getByRole("button", {
      name: "Close information panel",
    });
    close.focus();
    fireEvent.click(close);
    expect(aside).toHaveAttribute("hidden");
    await waitFor(() => expect(about).toHaveFocus());

    // Put away, it waits over the page's top left, and focus goes with it.
    toggle().focus();
    fireEvent.click(toggle());
    expect(sidebar).toHaveAttribute("hidden");
    expect(
      toggle().closest(".clover-template-document-sidebar-closed"),
    ).not.toBeNull();
    await waitFor(() => expect(toggle()).toHaveFocus());
  });

  it("Document: a Timeline's or a Scene's sheet takes the column, as the Body takes Default's pane", async () => {
    const sheet = () =>
      document.querySelector<HTMLElement>(".clover-template-document-sheet");
    // A Presentation 3 Canvas of sound alone, a Timeline: no width and height to fit.
    const timeline = render(<Templates.Document iiifContent={audioJson} />);
    await waitFor(() => expect(sheet()).toHaveAttribute("data-fill"));
    expect(sheet()!.style.getPropertyValue("--ratio")).toBe("");
    timeline.unmount();
    const scene = render(<Templates.Document iiifContent={modelJson} />);
    await waitFor(() => expect(sheet()).toHaveAttribute("data-fill"));
    scene.unmount();
    // A page keeps its own shape.
    render(<Templates.Document iiifContent={singleJson} />);
    await waitFor(() =>
      expect(sheet()!.style.getPropertyValue("--ratio")).not.toBe(""),
    );
    expect(sheet()).not.toHaveAttribute("data-fill");
  });

  it("Document: a video showing its frames covers its sheet's still, which need not have its shape", async () => {
    render(<Templates.Document iiifContent={placeholderVideoJson} />);
    const column = document.querySelector<HTMLElement>(
      ".clover-template-document-column",
    )!;
    const sheet = () =>
      column.querySelector<HTMLElement>(
        ".clover-template-document-sheet[data-active]",
      );
    // Open at once (the sheet's still is its placeholder), the still stays meanwhile.
    await waitFor(() =>
      expect(
        column.querySelector(
          ".clover-template-document-live .clover-canvas:not([data-placeholder='true'])",
        ),
      ).not.toBeNull(),
    );
    await waitFor(() => expect(sheet()).not.toBeNull());
    expect(column).not.toHaveAttribute("data-covered");
    // jsdom has no WebGL, so the renderer places no element: one stands in for it.
    const video = document.createElement("video");
    column.querySelector(".clover-canvas")!.append(video);
    // Played, but no frame yet: the still stays until there is one.
    expect(column).not.toHaveAttribute("data-covered");
    Object.defineProperty(video, "readyState", {
      configurable: true,
      value: HTMLMediaElement.HAVE_CURRENT_DATA,
    });
    fireEvent(video, new Event("loadeddata"));
    await waitFor(() => expect(column).toHaveAttribute("data-covered"));
    // Moved to another sheet, the Canvas out of sight: the still is back.
    const live = column.querySelector(".clover-template-document-live")!;
    live.setAttribute("data-moved", "");
    await waitFor(() => expect(column).not.toHaveAttribute("data-covered"));
  });

  it("Document: the title at headingLevel, the aside's name a level under it, its section's headings under that", async () => {
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
    const aside = document.querySelector<HTMLElement>(
      ".clover-template-document-aside",
    )!;
    expect(
      within(aside).getByRole("heading", { level: 4, name: "About" }),
    ).toBeInTheDocument();
    // About's own, the Manifest's label and its titles, under the aside's name.
    expect(
      await within(aside).findByRole("heading", {
        level: 5,
        name: "IIIF",
      }),
    ).toBeInTheDocument();
  });

  it("Document: the languages as a globe among the toolbar's controls, always, About offering none", async () => {
    const twoLanguages = {
      ...bookJson,
      id: "https://example.org/manifest/document-languages",
      label: { de: ["Ein Buch"], en: ["A book"] },
    };
    render(<Templates.Document iiifContent={twoLanguages} />);
    const toolbar = await waitFor(() => {
      const found = document.querySelector<HTMLElement>(
        ".clover-template-document-toolbar",
      );
      expect(found).not.toBeNull();
      return found!;
    });
    const globe = await within(toolbar).findByRole("button", {
      name: /Language/,
    });
    expect(globe).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(globe);
    expect(within(toolbar).getAllByRole("radio")).toHaveLength(2);
    // About, opened, offers no row of its own: the page has one choice.
    fireEvent.click(within(toolbar).getByRole("button", { name: "About" }));
    const aside = document.querySelector<HTMLElement>(
      ".clover-template-document-aside",
    )!;
    await within(aside).findByText("IIIF");
    expect(within(aside).queryByRole("radio")).toBeNull();
  });

  it("Document: a section's button opens it alone, another's replaces it, its own again puts it away", async () => {
    render(<Templates.Document iiifContent={tocJson} />);
    const toolbar = await waitFor(() => {
      const found = document.querySelector<HTMLElement>(
        ".clover-template-document-toolbar",
      );
      expect(
        within(found!).getByRole("button", { name: "Contents" }),
      ).toBeInTheDocument();
      return found!;
    });
    const aside = document.querySelector<HTMLElement>(
      ".clover-template-document-aside",
    )!;
    const button = (name: string) =>
      within(toolbar).getByRole("button", { name });
    fireEvent.click(button("Contents"));
    await waitFor(() => expect(aside).not.toHaveAttribute("hidden"));
    expect(screen.getByRole("complementary", { name: "Contents" })).toBe(aside);
    expect(button("Contents")).toHaveAttribute("aria-expanded", "true");
    expect(button("About")).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button("About"));
    expect(screen.getByRole("complementary", { name: "About" })).toBe(aside);
    expect(button("About")).toHaveAttribute("aria-expanded", "true");
    expect(button("Contents")).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button("About"));
    expect(aside).toHaveAttribute("hidden");
    expect(button("About")).toHaveAttribute("aria-expanded", "false");
  });

  it("Document: the downloads behind the toolbar's Download button, their groups a level under the title", async () => {
    render(<Templates.Document iiifContent={renderingJson} headingLevel={4} />);
    await screen.findByRole("heading", { level: 4 });
    const toolbar = document.querySelector<HTMLElement>(
      ".clover-template-document-toolbar",
    )!;
    const button = await within(toolbar).findByRole("button", {
      name: "Download",
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(
      within(toolbar).queryByRole("link", { name: /PDF version/ }),
    ).toBeNull();
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const menu = document.getElementById(
      button.getAttribute("aria-controls")!,
    )!;
    expect(
      within(menu).getByRole("heading", { level: 5, name: "All pages" }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("link", { name: /PDF version/ }),
    ).toBeInTheDocument();
    // Escape closes it, focus back on its button.
    fireEvent.keyDown(within(menu).getByRole("link", { name: /PDF version/ }), {
      key: "Escape",
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("Document: the downloads in its toolbar only, never again in its aside's About", async () => {
    render(
      <Templates.Document
        iiifContent={renderingJson}
        headingLevel={4}
        defaultPanelOpen
      />,
    );
    await screen.findByRole("heading", { level: 4 });
    const aside = document.querySelector<HTMLElement>(
      ".clover-template-document-aside",
    )!;
    expect(
      within(aside).getByRole("heading", { level: 5, name: "About" }),
    ).toBeInTheDocument();
    await within(aside).findByText("IIIF");
    expect(
      within(aside).queryByRole("heading", { name: "Download" }),
    ).toBeNull();
    expect(
      screen.getAllByRole("link", { name: /PDF version/, hidden: true }),
    ).toHaveLength(1);
  });

  it("Default: About's titles a level under it, its downloads behind its heading's button", async () => {
    render(<Templates.Default iiifContent={renderingJson} headingLevel={4} />);
    await screen.findByRole("heading", { level: 4 });
    // About is a 5, its titles 6.
    expect(
      await screen.findByRole("heading", { level: 6, name: "IIIF" }),
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

  describe("Document, with no room for the aside beside the page", () => {
    // jsdom lays nothing out: a phone-wide layout, as the template measures it.
    let width: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      width = vi
        .spyOn(HTMLElement.prototype, "clientWidth", "get")
        .mockReturnValue(390);
    });
    afterEach(() => width.mockRestore());

    const toolbar = () =>
      document.querySelector<HTMLElement>(".clover-template-document-toolbar")!;
    const button = (name: string) =>
      within(toolbar()).getByRole("button", { name });
    const aside = () =>
      document.querySelector<HTMLElement>(".clover-template-document-aside")!;

    it("starts with the aside and thumbnails closed, even when the host asks them open", async () => {
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
      expect(aside()).toHaveAttribute("hidden");
      expect(button("About")).toHaveAttribute("aria-expanded", "false");
      expect(
        document.querySelector(".clover-template-document-sidebar"),
      ).toHaveAttribute("hidden");
      expect(
        screen.getByRole("button", { name: /^Show items/ }),
      ).toHaveAttribute("aria-expanded", "false");
      expect(document.querySelector(".clover-template-scrim")).toBeNull();
      await act(() => new Promise((done) => setTimeout(done, SLIDE_MS + 60)));
      expect(aside()).toHaveAttribute("hidden");
      expect(document.body).toHaveFocus();
    });

    it("slides the aside over the page, focused, closing on Escape or its button, focus back to its section's button", async () => {
      render(<Templates.Document iiifContent={tocJson} />);
      await waitFor(() => expect(button("Contents")).toBeInTheDocument());
      fireEvent.click(button("Contents"));
      await waitFor(() => expect(aside()).toHaveAttribute("data-open", "true"));
      // Over the page there is no bar for it, nor for the thumbnails.
      expect(screen.queryAllByRole("separator")).toHaveLength(0);

      // Opening takes focus into it, at its close button; Escape there, its popover
      // first, alone (WCAG 1.4.13), hands it back to the button for its section, not
      // the first of them.
      const close = within(aside()).getByRole("button", {
        name: "Close information panel",
      });
      await waitFor(() => expect(close).toHaveFocus());
      fireEvent.keyDown(close, { key: "Escape" });
      expect(aside()).toHaveAttribute("data-open", "true");
      fireEvent.keyDown(close, { key: "Escape" });
      expect(aside()).toHaveAttribute("data-open", "false");
      expect(button("Contents")).toHaveFocus();
      await waitFor(() => expect(aside()).toHaveAttribute("hidden"));

      // And its close button.
      fireEvent.click(button("About"));
      await waitFor(() =>
        expect(
          within(aside()).getByRole("button", {
            name: "Close information panel",
          }),
        ).toHaveFocus(),
      );
      fireEvent.click(
        within(aside()).getByRole("button", {
          name: "Close information panel",
        }),
      );
      expect(aside()).toHaveAttribute("data-open", "false");
      expect(button("About")).toHaveFocus();
    });

    it("puts the aside away on Escape from the toolbar, leaving focus there", async () => {
      render(<Templates.Document iiifContent={tocJson} />);
      await waitFor(() => expect(button("Contents")).toBeInTheDocument());
      fireEvent.click(button("Contents"));
      await waitFor(() => expect(aside()).toHaveAttribute("data-open", "true"));
      // Tabbing back from the aside reaches the toolbar, which it does not cover.
      const about = button("About");
      about.focus();
      // Its popover first, alone (WCAG 1.4.13), then the aside.
      fireEvent.keyDown(about, { key: "Escape" });
      expect(aside()).toHaveAttribute("data-open", "true");
      fireEvent.keyDown(about, { key: "Escape" });
      expect(aside()).toHaveAttribute("data-open", "false");
      expect(about).toHaveFocus();
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
      // Focus under them, on the page's Canvas.
      const under = await waitFor(() => {
        const viewport = document.querySelector<HTMLElement>(
          ".clover-template-document-live [data-testid='clover-canvas-viewport']",
        );
        expect(viewport).not.toBeNull();
        return viewport!;
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
