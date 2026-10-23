/*
 * Parts of your own, as elements (phase 6 of WEB-COMPONENTS.md), under Preact as they
 * ship: `root.clover`, the page's renderers, its control buttons and its own buttons on
 * the stage, `<clover-tip>`, and the Canvas's handle on the stage's elements.
 */
import { fireEvent, waitFor, within } from "@testing-library/dom";

import { defineCloverElements } from "../define";
import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import tocJson from "../../fixtures/iiif-cookbook/0024-book-4-toc.json";
import { stubViewport } from "../../components/Canvas/testing/viewport";
import { initCloverI18n } from "../../i18n";
import { tableOfContents } from "../../core/ranges";

type Listener = (detail?: unknown) => void;

/** Every renderer the stage makes, standing in for WebGL; each opens once given images. */
const made = vi.hoisted(() => [] as Array<Record<string, any>>);
vi.mock("../../lib/renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/renderer")>()),
  CanvasRenderer: vi.fn().mockImplementation(() => {
    const listeners = new Map<string, Set<Listener>>();
    const renderer = {
      host: document.createElement("div"),
      setImages: vi.fn(async () => {
        queueMicrotask(() =>
          listeners.get("open")?.forEach((listener) => listener()),
        );
      }),
      setGestures: vi.fn(),
      setDismiss: vi.fn(),
      setHidden: vi.fn(),
      dispose: vi.fn(),
      isOpen: true,
      isAtHome: true,
      backendKind: "webgl2",
      getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
      getHomeBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
      getCamera: () => ({ x: 50, y: 50, zoom: 1, rotation: 0 }),
      getRotation: () => 0,
      zoomBy: vi.fn(),
      panBy: vi.fn(),
      home: vi.fn(),
      fitBounds: vi.fn(),
      setRotation: vi.fn(),
      invalidate: vi.fn(),
      attachNavigator: vi.fn(() => vi.fn()),
      overlays: { container: document.createElement("div"), add: vi.fn() },
      on: (event: string, listener: Listener) => {
        const known = listeners.get(event) ?? new Set<Listener>();
        listeners.set(event, known.add(listener));
        return () => known.delete(listener);
      },
    };
    made.push(renderer);
    return renderer;
  }),
}));

let viewport: ReturnType<typeof stubViewport>;
beforeAll(() =>
  defineCloverElements({
    styles: [{ key: "clover-1", css: ".clover-root{}" }],
  }),
);
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  viewport = stubViewport();
  made.length = 0;
});
afterEach(async () => {
  viewport.restore();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  await Promise.resolve();
});

type Root = HTMLElement & {
  iiifContent: unknown;
  clover: any;
  renderers: unknown;
};

/** A root over the book, with what `markup` puts in it, and the `clover-ready` it sends. */
function rootOf(markup = "") {
  const root = document.createElement("clover-root") as Root;
  root.innerHTML = markup;
  const ready = new Promise<CustomEvent>((resolve) =>
    root.addEventListener("clover-ready", (event) =>
      resolve(event as CustomEvent),
    ),
  );
  root.iiifContent = bookJson;
  return { root, ready };
}

const labelOf = (index: number) => bookJson.items[index].label.en[0];

describe("root.clover", () => {
  it("is the root's Clover once it has loaded, sent with clover-ready", async () => {
    const { root, ready } = rootOf();
    expect(root.clover).toBeNull();
    document.body.append(root);
    const event = await ready;
    expect(event.detail.clover).toBe(root.clover);
    const { clover } = root;
    await waitFor(() => expect(clover.status().status).toBe("ready"));
    expect(clover.manifest().id).toBe(bookJson.id);
    expect(clover.visibleCanvases()[0].id).toBe(bookJson.items[0].id);
    expect(clover.activeCanvas().id).toBe(bookJson.items[0].id);
    expect(clover.navigation()).toMatchObject({
      position: 0,
      hasPrevious: false,
      hasNext: true,
    });
    expect(clover.sequence().canvases).toHaveLength(bookJson.items.length);
  });

  it("moves the reader as React's hooks do, and says so to whoever subscribes", async () => {
    const { root, ready } = rootOf();
    document.body.append(root);
    await ready;
    const { clover } = root;
    await waitFor(() => expect(clover.status().status).toBe("ready"));
    const heard = vi.fn();
    const stop = clover.subscribe(heard);
    clover.navigation().next();
    expect(clover.navigation().position).toBe(1);
    expect(heard).toHaveBeenLastCalledWith(
      expect.objectContaining({ canvasId: clover.state.canvasId }),
    );
    stop();
    heard.mockClear();
    clover.previous();
    expect(heard).not.toHaveBeenCalled();
    expect(clover.navigation().position).toBe(0);
  });

  it("gives the Manifest's table of contents, as tableOfContents gives React's", async () => {
    const root = document.createElement("clover-root") as Root;
    const ready = new Promise((resolve) =>
      root.addEventListener("clover-ready", resolve),
    );
    root.iiifContent = tocJson;
    document.body.append(root);
    await ready;
    const { clover } = root;
    await waitFor(() => expect(clover.status().status).toBe("ready"));
    expect(clover.contents()).toEqual(tableOfContents(clover.manifest()));
    expect(clover.contents().length).toBeGreaterThan(0);
    expect(clover.contents()[0]).toMatchObject({
      canvasId: expect.any(String),
      children: expect.any(Array),
    });
  });

  it("reads language maps and Clover's own words as the root does", async () => {
    const { root, ready } = rootOf();
    document.body.append(root);
    await ready;
    const { clover } = root;
    expect(clover.localize({ fr: ["Livre"], en: ["Book"] }).text).toBe("Book");
    expect(clover.t("informationPanelToggle")).toBe("More information");
    expect(clover.langOf("informationPanelToggle")).toBeUndefined();
    // The Clover a React part reads with useClover(): its store and channels.
    expect(clover.store.get()).toBe(clover.state);
    expect(typeof clover.viewport.subscribe).toBe("function");
  });

  it("lets it go when the root goes", async () => {
    const { root, ready } = rootOf();
    document.body.append(root);
    await ready;
    root.remove();
    await waitFor(() => expect(root.clover).toBeNull());
  });
});

describe("Renderers of the page's", () => {
  it("draw a view they claim into a box of their own, again as the view changes", async () => {
    const undo = vi.fn();
    const render = vi.fn((container: HTMLElement, view: any) => {
      container.textContent = view.canvases[0].id;
      return undo;
    });
    const { root, ready } = rootOf("<clover-body></clover-body>");
    root.renderers = [{ match: () => true, render }];
    document.body.append(root);
    await ready;
    const box = await waitFor(() => {
      const found = root.querySelector(".clover-body-renderer");
      expect(found?.textContent).toBe(bookJson.items[0].id);
      return found!;
    });
    expect(render.mock.calls[0][1].clover).toBe(root.clover);
    expect(root.querySelector("[data-renderer='custom']")).not.toBeNull();
    root.clover.next();
    await waitFor(() =>
      expect(box.textContent).toBe(root.clover.visibleCanvases()[0].id),
    );
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("leave a view they do not claim to the Canvas", async () => {
    const render = vi.fn();
    const { root, ready } = rootOf("<clover-body></clover-body>");
    root.renderers = [{ format: ["model/gltf-binary"], render }];
    document.body.append(root);
    await ready;
    await within(root).findByRole("img", { name: labelOf(0) });
    expect(render).not.toHaveBeenCalled();
  });
});

describe("The stage's controls, the page's own", () => {
  it("take a button of the page's for one of Clover's, named, keyed and pressed as Clover's", async () => {
    const { root, ready } = rootOf("<clover-body></clover-body>");
    const content = root.querySelector("clover-body") as HTMLElement & {
      controlButtons: unknown;
    };
    const told = vi.fn();
    content.controlButtons = {
      zoomIn: (control: { label: string; icon: HTMLElement }) => {
        told(control);
        const button = document.createElement("button");
        button.className = "mine";
        button.append(control.icon);
        return button;
      },
    };
    document.body.append(root);
    await ready;
    const mine = await waitFor(() => {
      const found = root.querySelector<HTMLButtonElement>("button.mine");
      expect(found).not.toBeNull();
      return found!;
    });
    const cluster = root.querySelector(".clover-canvas-controls");
    expect(mine.parentElement).toBe(cluster);
    expect(mine).toHaveAttribute("aria-label", "Zoom in");
    expect(mine).toHaveAttribute("aria-keyshortcuts", "Plus");
    expect(mine).toHaveAttribute("type", "button");
    expect(mine.querySelector("svg")).not.toBeNull();
    await waitFor(() =>
      expect(mine.lastElementChild).toHaveClass("clover-tip"),
    );
    expect(told).toHaveBeenCalledWith(
      expect.objectContaining({ name: "zoomIn", label: "Zoom in" }),
    );
    // One zoom-in control: the page's.
    expect(within(root).getAllByRole("button", { name: "Zoom in" })).toEqual([
      mine,
    ]);
    await waitFor(() => expect(made.length).toBeGreaterThan(0));
    fireEvent.click(mine);
    expect(made.at(-1)!.zoomBy).toHaveBeenCalled();
  });

  it("place the page's own buttons among them, after Clover's, keeping their listeners", async () => {
    const { root, ready } = rootOf(
      `<clover-body><button type="button" aria-label="Share">S<clover-tip label="Share" keys="S"></clover-tip></button></clover-body>`,
    );
    const share = root.querySelector("button") as HTMLButtonElement;
    const pressed = vi.fn();
    share.addEventListener("click", pressed);
    document.body.append(root);
    await ready;
    await waitFor(() =>
      expect(share.parentElement).toHaveClass("clover-canvas-controls"),
    );
    const buttons = [
      ...share.parentElement!.querySelectorAll(":scope > button"),
    ];
    expect(buttons.at(-1)).toBe(share);
    fireEvent.click(share);
    expect(pressed).toHaveBeenCalledTimes(1);
    // Its popover, from the <clover-tip> in it, last.
    await waitFor(() =>
      expect(share.lastElementChild).toHaveClass("clover-tip"),
    );
    expect(share.lastElementChild).toHaveTextContent("Share (S)");
    expect(share.lastElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("<clover-tip>", () => {
  it("draws Clover's popover in the page's button, last, and nothing where it is written", async () => {
    document.body.innerHTML = `<button aria-label="Rotate the page" aria-keyshortcuts="Shift+T"><clover-tip label="Rotate the page" keys="Shift+T" glyph="⇧T"></clover-tip></button>`;
    const button = document.querySelector("button")!;
    await waitFor(() =>
      expect(button.lastElementChild).toHaveClass("clover-tip"),
    );
    expect(button.lastElementChild).toHaveTextContent("Rotate the page (⇧T)");
    expect(button.querySelector("clover-tip")!.childNodes).toHaveLength(0);
  });
});

describe("<clover-read-more>", () => {
  it("opens text of the page's that its CSS cuts short, as ReadMore does", async () => {
    document.body.innerHTML = `<clover-read-more><p class="note">A long note.</p></clover-read-more>`;
    const note = document.querySelector("p")!;
    // Taller than the box its clamp leaves it: jsdom measures nothing of its own.
    Object.defineProperty(note, "scrollHeight", { value: 120 });
    Object.defineProperty(note, "clientHeight", { value: 40 });
    const button = await within(document.body).findByRole("button", {
      name: "Read more",
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", note.id);
    expect(note.id).not.toBe("");
    expect(document.querySelector("clover-read-more")).toHaveClass(
      "clover-read-more",
    );
    fireEvent.click(button);
    expect(
      await within(document.body).findByRole("button", { name: "Read less" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(note).toHaveAttribute("data-read-more", "open");
  });
});

describe("The Canvas's handle, on the stage's elements", () => {
  it("is kept by <clover-canvas> once its view is laid out, as onReady hands it in React", async () => {
    const canvas = document.createElement("clover-canvas") as HTMLElement & {
      handle: any;
    };
    expect(canvas.handle).toBeNull();
    const ready = new Promise<CustomEvent>((resolve) =>
      canvas.addEventListener("clover-ready", (event) =>
        resolve(event as CustomEvent),
      ),
    );
    canvas.setAttribute("src", "https://example.org/picture.jpg");
    document.body.append(canvas);
    const event = await ready;
    expect(event.detail.handle).toBe(canvas.handle);
    canvas.handle.zoomBy(2);
    expect(made.at(-1)!.zoomBy).toHaveBeenCalledWith(2, undefined, undefined);
    expect(canvas.handle.getCamera()).toEqual({
      x: 50,
      y: 50,
      zoom: 1,
      rotation: 0,
    });
  });

  it("is kept by <clover-body>, inside its root", async () => {
    const { root, ready } = rootOf("<clover-body></clover-body>");
    const content = root.querySelector("clover-body") as HTMLElement & {
      handle: any;
    };
    const opened = new Promise<CustomEvent>((resolve) =>
      content.addEventListener("clover-ready", (event) =>
        resolve(event as CustomEvent),
      ),
    );
    const heardByRoot = vi.fn();
    root.addEventListener("clover-ready", heardByRoot);
    document.body.append(root);
    await ready;
    const event = await opened;
    expect(event.detail.handle).toBe(content.handle);
    // Each element's ready is its own: the root never hears the stage's.
    expect(event.bubbles).toBe(false);
    expect(heardByRoot).toHaveBeenCalledTimes(1);
    expect(heardByRoot.mock.calls[0][0].detail.clover).toBe(root.clover);
    content.handle.home();
    expect(made.at(-1)!.home).toHaveBeenCalled();
  });
});
