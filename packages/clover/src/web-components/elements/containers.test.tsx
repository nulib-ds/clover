/*
 * The containers as elements (phase 4 of WEB-COMPONENTS.md), under Preact as they ship:
 * the panel and its tabs, the toggle that shows and hides it, the Split's three, and what
 * the page hands a part as markup (slots) or as functions that return a node.
 */
import { fireEvent, waitFor, within } from "@testing-library/dom";

import { defineCloverElements } from "../define";
import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import pagedJson from "../../fixtures/mocks/paged/manifest.json";
import { stubViewport } from "../../components/Canvas/testing/viewport";
import { toPixels } from "../../components/Split/splitting";
import { initCloverI18n } from "../../i18n";

vi.mock("../../lib/renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/renderer")>()),
  CanvasRenderer: vi.fn().mockImplementation(() => ({
    host: document.createElement("div"),
    setImages: vi.fn().mockResolvedValue(undefined),
    setGestures: vi.fn(),
    setDismiss: vi.fn(),
    dispose: vi.fn(),
    isOpen: false,
    backendKind: "webgl2",
    getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    invalidate: vi.fn(),
    attachNavigator: vi.fn(() => vi.fn()),
    overlays: { container: document.createElement("div"), add: vi.fn() },
    on: () => () => undefined,
  })),
}));

const ASSETS = { styles: [{ key: "clover-1", css: ".clover-root{}" }] };

let viewport: ReturnType<typeof stubViewport>;
beforeAll(() => defineCloverElements(ASSETS));
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  viewport = stubViewport();
  localStorage.clear();
});
afterEach(async () => {
  viewport.restore();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  await Promise.resolve();
});

type WithContent = HTMLElement & { iiifContent: unknown };

/** A `<clover-root>` holding `html`, its content set as a property, on the page. */
function root(html: string, content: unknown = pagedJson) {
  const element = document.createElement("clover-root") as WithContent;
  element.innerHTML = html;
  element.iiifContent = content;
  document.body.append(element);
  return element;
}

describe("The panel and its tabs, as elements", () => {
  it("draws the sections Clover has data for, with no tabs of the page's", async () => {
    const element = root(`<clover-panel></clover-panel>`);
    const tablist = await within(element).findByRole("tablist");
    const names = within(tablist)
      .getAllByRole("tab")
      .map((tab) => tab.textContent);
    expect(names[0]).toBe("About");
    expect(names).toContain("Contents");
  });

  it("draws a tab for each clover-tab, moving its content into its section as it first opens", async () => {
    const element = root(`
      <clover-panel>
        <clover-tab value="about" label="About"><clover-about heading-level="3"></clover-about></clover-tab>
        <clover-tab value="notes"><span slot="label">Notes <em>2</em></span><p id="notes">My notes</p></clover-tab>
      </clover-panel>
    `);
    const tablist = await within(element).findByRole("tablist");
    const tabs = within(tablist).getAllByRole("tab");
    // The label's markup, as a copy: the page's own stays in the tab, hidden.
    expect(tabs.map((tab) => tab.textContent)).toEqual(["About", "Notes 2"]);
    expect(tabs[1].querySelector("em")).not.toBeNull();
    const notes = document.getElementById("notes")!;
    expect(notes.closest("clover-tab")).not.toBeNull();

    const chosen = vi.fn();
    element.addEventListener("clover-value-change", (event) =>
      chosen((event as CustomEvent).detail),
    );
    fireEvent.click(tabs[1]);
    expect(chosen).toHaveBeenCalledWith({ value: "notes" });
    // The page's own node, not a copy, now in its section.
    await waitFor(() => expect(notes.closest("clover-tab")).toBeNull());
    expect(notes.closest('[role="tabpanel"]')).not.toBeNull();
    expect(document.querySelectorAll("#notes")).toHaveLength(1);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");

    // Its value changed by the page shows that tab.
    element.querySelector("clover-panel")!.setAttribute("value", "about");
    await waitFor(() =>
      expect(tabs[0]).toHaveAttribute("aria-selected", "true"),
    );
  });

  it("closes as the page lets it, hiding what its toggle shows, or itself", async () => {
    const element = root(`<clover-panel closable></clover-panel>`);
    const panel = element.querySelector("clover-panel") as HTMLElement;
    const close = await within(element).findByRole("button", {
      name: "Close information panel",
    });
    panel.addEventListener("clover-close", (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.click(close);
    expect(panel.hidden).toBe(false);
    fireEvent.click(close);
    expect(panel.hidden).toBe(true);
  });
});

describe("The panel's toggle, as an element", () => {
  it("is one of the Body's controls in a clover-body, showing and hiding its target", async () => {
    const element = root(
      `<clover-body><clover-panel-toggle controls="info"></clover-panel-toggle></clover-body>
       <clover-panel id="info"></clover-panel>`,
      bookJson,
    );
    const info = document.getElementById("info")!;
    // The Body's code loads first, the Canvas with it.
    const toggle = await within(element).findByRole(
      "button",
      { name: "More information" },
      { timeout: 4000 },
    );
    // Drawn by the Body, in its cluster, not where the page wrote the element.
    expect(toggle.closest(".clover-canvas")).not.toBeNull();
    expect(toggle.closest("clover-panel-toggle")).toBeNull();
    expect(toggle).toHaveAttribute("aria-controls", "info");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const changes = vi.fn();
    element.addEventListener("clover-open-change", (event) =>
      changes((event as CustomEvent).detail),
    );
    fireEvent.click(toggle);
    expect(changes).toHaveBeenCalledWith({ open: false });
    expect(info.hidden).toBe(true);
    await waitFor(() =>
      expect(toggle).toHaveAttribute("aria-expanded", "false"),
    );

    // The page showing the panel itself is followed.
    info.hidden = false;
    await waitFor(() =>
      expect(toggle).toHaveAttribute("aria-expanded", "true"),
    );
    // Canceled, nothing changes.
    element.addEventListener(
      "clover-open-change",
      (event) => event.preventDefault(),
      { once: true },
    );
    fireEvent.click(toggle);
    expect(info.hidden).toBe(false);
  });

  it("is a button of its own anywhere else", async () => {
    document.body.innerHTML = `<clover-panel-toggle controls="more"></clover-panel-toggle><div id="more" hidden>More</div>`;
    const toggle = await within(document.body).findByRole("button", {
      name: "More information",
    });
    expect(toggle.closest("clover-panel-toggle")).not.toBeNull();
    // Shut, as the page wrote its target.
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(document.getElementById("more")!.hidden).toBe(false);
  });
});

describe("The Split, as elements", () => {
  /*
   * jsdom lays nothing out: a 1000px split, its bars 3px, each sized pane as wide as its
   * size says, the others sharing the rest, left to right (as `Split.test.tsx` has it).
   */
  const ACROSS = 1000;
  const unsized = (node: Element) =>
    node.classList.contains("clover-split-pane") &&
    !node.hasAttribute("data-sized");
  const widthOf = (element: HTMLElement): number => {
    if (element.classList.contains("clover-split-handle")) return 3;
    if (!element.classList.contains("clover-split-pane")) return 0;
    if (!unsized(element)) {
      const size = element.style.getPropertyValue("--clover-split-size");
      return toPixels(size, ACROSS) ?? 0;
    }
    const siblings = Array.from(
      element.parentElement!.children,
    ) as HTMLElement[];
    const rest = siblings
      .filter((node) => !unsized(node))
      .reduce((left, node) => left - widthOf(node), ACROSS);
    return rest / siblings.filter(unsized).length;
  };
  // Restored one by one: restoring every mock would undo the renderer's too.
  let spies: { mockRestore(): void }[] = [];
  beforeEach(() => {
    spies = [];
    spies.push(
      vi
        .spyOn(HTMLElement.prototype, "clientWidth", "get")
        .mockReturnValue(ACROSS),
    );
    spies.push(
      vi
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockImplementation(function (this: HTMLElement) {
          const width = widthOf(this);
          let left = 0;
          for (
            let node = this.previousElementSibling;
            node;
            node = node.previousElementSibling
          )
            left += widthOf(node as HTMLElement);
          return {
            left,
            right: left + width,
            width,
            top: 0,
            bottom: 0,
          } as DOMRect;
        }),
    );
  });
  afterEach(() => spies.forEach((spy) => spy.mockRestore()));

  const layout = (handle = "<clover-split-handle></clover-split-handle>") => {
    document.body.innerHTML = `
      <clover-split storage-key="layout">
        <clover-split-pane min="16rem">Body</clover-split-pane>
        ${handle}
        <clover-split-pane name="panel" size="24rem" min="14rem">Panel</clover-split-pane>
      </clover-split>`;
    return document.querySelectorAll<HTMLElement>("clover-split-pane")[1];
  };
  const sizeOf = (pane: HTMLElement) =>
    pane.style.getPropertyValue("--clover-split-size");

  it("says where its bar is as soon as it is drawn, whichever element draws first", async () => {
    // The pane it sizes comes after the handle has drawn and measured, as in a browser.
    document.body.innerHTML = `
      <clover-split>
        <clover-split-pane min="16rem">Body</clover-split-pane>
        <clover-split-handle></clover-split-handle>
      </clover-split>`;
    const handle = await within(document.body).findByRole("separator", {
      name: "Resize panels",
    });
    const pane = document.createElement("clover-split-pane");
    pane.setAttribute("name", "panel");
    pane.setAttribute("size", "24rem");
    pane.textContent = "Panel";
    document.querySelector("clover-split")!.append(pane);
    // Before any key: a separator that takes focus has a value (WCAG 4.1.2).
    await waitFor(() => expect(handle).toHaveAttribute("aria-valuenow"));
    expect(handle).toHaveAttribute("aria-valuemin");
    expect(handle).toHaveAttribute("aria-valuemax");
  });

  it("lays its panes side by side, and moves the bar by keys, clicks and drags, remembering it", async () => {
    const panel = layout();
    const handle = await within(document.body).findByRole("separator", {
      name: "Resize panels",
    });
    expect(handle.localName).toBe("clover-split-handle");
    expect(handle).toHaveAttribute("tabindex", "0");
    expect(document.querySelector("clover-split")).toHaveClass("clover-split");
    await waitFor(() => expect(sizeOf(panel)).toBe("24rem"));
    expect(panel).toHaveAttribute("data-sized");
    expect(panel.style.minWidth).toBe("14rem");

    // The panel is after the bar: Left widens it, by 1rem; Shift moves 4rem.
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    await waitFor(() => expect(sizeOf(panel)).toBe("400px"));
    fireEvent.keyDown(handle, { key: "ArrowRight", shiftKey: true });
    await waitFor(() => expect(sizeOf(panel)).toBe("336px"));
    fireEvent.keyDown(handle, { key: "Home" });
    await waitFor(() => expect(sizeOf(panel)).toBe("224px"));
    // End leaves the Body its minimum (1000 − the bar − 16rem).
    fireEvent.keyDown(handle, { key: "End" });
    await waitFor(() => expect(sizeOf(panel)).toBe("741px"));
    expect(handle).toHaveAttribute("aria-valuenow", "74");
    expect(handle).toHaveAttribute("aria-valuemin", "22");
    expect(JSON.parse(localStorage.getItem("layout")!)).toEqual({
      panel: 741,
    });

    // A click steps around: from its widest to its narrowest, then its own size again.
    fireEvent.click(handle);
    await waitFor(() => expect(sizeOf(panel)).toBe("224px"));
    fireEvent.click(handle);
    await waitFor(() => expect(sizeOf(panel)).toBe("24rem"));
    expect(JSON.parse(localStorage.getItem("layout")!)).toEqual({});
  });

  it("goes with the pane it sizes, when the page hides that pane, and comes back with it", async () => {
    const panel = layout();
    const handle = await within(document.body).findByRole("separator");
    panel.hidden = true;
    await waitFor(() => expect(handle.hidden).toBe(true));
    panel.hidden = false;
    await waitFor(() => expect(handle.hidden).toBe(false));
  });

  it("keeps the page's own name for its handle, unwarned", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    layout(
      `<clover-split-handle aria-label="Resize the panel"></clover-split-handle>`,
    );
    const handle = await within(document.body).findByRole("separator", {
      name: "Resize the panel",
    });
    expect(handle.querySelector(".clover-tip")).toHaveTextContent(
      "Resize the panel",
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("What the page hands a part", () => {
  it("shows a status's slots, as copies, while loading and when loading fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    const element = document.createElement("clover-root");
    element.setAttribute("iiif-content", "https://example.org/waiting.json");
    element.innerHTML = `<clover-status><span slot="loading">Fetching the catalog</span><span slot="error">It would not load.</span></clover-status>`;
    document.body.append(element);
    await waitFor(() =>
      expect(element.querySelector('[role="status"]')).toHaveTextContent(
        "Fetching the catalog",
      ),
    );
    // The slot itself stays where the page wrote it, so there is one of it to read.
    expect(element.querySelectorAll('[slot="loading"]')).toHaveLength(1);

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    element.setAttribute("iiif-content", "https://example.org/failing.json");
    await waitFor(() =>
      expect(element.querySelector('[role="alert"]')).toHaveTextContent(
        "It would not load.",
      ),
    );
  });

  it("draws what the page's own functions return: a value, an item", async () => {
    const element = root(
      `<clover-metadata></clover-metadata><clover-items></clover-items>`,
    );
    const metadata = element.querySelector("clover-metadata") as HTMLElement & {
      renderValue: unknown;
    };
    const items = element.querySelector("clover-items") as HTMLElement & {
      renderItem: unknown;
    };
    metadata.renderValue = () => {
      const bold = document.createElement("b");
      bold.textContent = "Ours";
      return bold;
    };
    items.renderItem = (item: { id: string }, state: { selected: boolean }) =>
      `${state.selected ? "Now " : ""}${item.id.split("/").pop()}`;
    await waitFor(
      () => expect(metadata.querySelector("dd b")).toHaveTextContent("Ours"),
      { timeout: 4000 },
    );
    const options = await within(items).findAllByRole(
      "option",
      {},
      { timeout: 4000 },
    );
    await waitFor(() => expect(options[0]).toHaveTextContent(/^Now /));
  });
});
