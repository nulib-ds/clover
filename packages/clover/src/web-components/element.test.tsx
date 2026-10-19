import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import { defineCloverViewer } from "./element";
import bookJson from "../fixtures/iiif-cookbook/0009-book-1.json";
import { stubViewport } from "../components/Canvas/testing/viewport";
import { initCloverI18n } from "../i18n";

vi.mock("../lib/renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/renderer")>()),
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

let viewport: ReturnType<typeof stubViewport>;
/** The stylesheet in runs, as the build hands it: the middle one only for a map. */
const loadMapRun = vi.fn(async () => ".clover-geomap{}");
beforeAll(() =>
  defineCloverViewer({
    styles: [
      { key: "clover-1", css: ".clover-root{}" },
      { key: "map", when: ".clover-geomap", load: loadMapRun },
      { key: "clover-2", css: ".clover-status{}" },
    ],
  }),
);
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  viewport = stubViewport();
});
afterEach(() => {
  viewport.restore();
  document.body.innerHTML = "";
});

function mount(attributes: Record<string, string> = {}) {
  const element = document.createElement("clover-viewer") as HTMLElement & {
    iiifContent: unknown;
  };
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.iiifContent = bookJson;
  act(() => {
    document.body.append(element);
  });
  return element;
}

describe("<clover-viewer>", () => {
  it("renders the Viewer in its light DOM, from a IIIF object set as a property", async () => {
    const element = mount();
    expect(
      await within(element).findByRole("heading", {
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
    expect(element.shadowRoot).toBeNull();
    // The stylesheet is in the document once, however many elements there are.
    mount();
    expect(
      document.querySelectorAll('style[data-clover="clover-1"]'),
    ).toHaveLength(1);
  });

  it("loads a run only some pages need when what needs it draws, in its place", async () => {
    const element = mount();
    await within(element).findByRole("heading", {
      name: "Simple Manifest - Book",
    });
    const order = () =>
      [...document.head.querySelectorAll("style[data-clover]")].map(
        (style) => (style as HTMLElement).dataset.clover,
      );
    expect(order()).toEqual(["clover-1", "clover-2"]);
    expect(loadMapRun).not.toHaveBeenCalled();

    const map = document.createElement("div");
    map.className = "clover-geomap";
    await act(async () => {
      element.querySelector(".clover-root")!.append(map);
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(order()).toEqual(["clover-1", "map", "clover-2"]),
    );
    expect(loadMapRun).toHaveBeenCalledTimes(1);
  });

  it("maps attributes to the Viewer's props, `false` turning a part off", async () => {
    const element = mount({
      panel: "false",
      download: "false",
      items: "false",
    });
    await within(element).findByRole("heading", {
      name: "Simple Manifest - Book",
    });
    expect(within(element).queryByRole("tab", { name: "About" })).toBeNull();
    expect(
      within(element).queryByRole("button", { name: "Download" }),
    ).toBeNull();
    expect(within(element).queryByRole("listbox")).toBeNull();
  });

  it("header=false leaves out the title over the stage", async () => {
    const element = mount({ header: "false" });
    // The strip still draws, so the Manifest has loaded.
    await within(element).findByRole("button", { name: "Next" });
    expect(
      within(element).queryByRole("heading", {
        name: "Simple Manifest - Book",
      }),
    ).toBeNull();
  });

  it("heading-level sets the title's level, and the panel's a level below", async () => {
    const element = mount({ "heading-level": "4" });
    expect(
      await within(element).findByRole("heading", {
        level: 4,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
    expect(
      within(element).getByRole("heading", { level: 5, name: "About" }),
    ).toBeInTheDocument();
  });

  it("with header=false, the panel's sections take heading-level themselves", async () => {
    const element = mount({ header: "false", "heading-level": "3" });
    expect(
      await within(element).findByRole("heading", { level: 3, name: "About" }),
    ).toBeInTheDocument();
  });

  it("tells the page where the reader moves, as events", async () => {
    const element = mount();
    const moved = vi.fn();
    element.addEventListener("canvaschange", (event) =>
      moved((event as CustomEvent).detail),
    );
    fireEvent.click(
      await within(element).findByRole("button", { name: "Next" }),
    );
    await waitFor(() =>
      expect(moved).toHaveBeenCalledWith({ canvasId: bookJson.items[1].id }),
    );
  });

  it("lets a page without React set Clover's language, and marks it where the page's differs", async () => {
    document.documentElement.lang = "fr";
    const Element = customElements.get("clover-viewer") as unknown as {
      initCloverI18n: typeof initCloverI18n;
    };
    const element = mount();
    const next = await within(element).findByRole("button", { name: "Next" });
    await waitFor(() => expect(next).toHaveAttribute("lang", "en"));
    expect(element.querySelector(".clover-root")).not.toHaveAttribute("lang");

    act(() => {
      Element.initCloverI18n({ lng: "fr" });
    });
    expect(
      await within(element).findByRole("button", { name: "Suivant" }),
    ).not.toHaveAttribute("lang");
    document.documentElement.lang = "";
  });

  it("tears down when removed, and not when moved", async () => {
    const element = mount();
    await within(element).findByRole("heading", {
      name: "Simple Manifest - Book",
    });
    const other = document.createElement("div");
    document.body.append(other);
    await act(async () => {
      other.append(element); // a move: disconnected, then connected again at once
      await Promise.resolve();
    });
    expect(
      within(element).getByRole("heading", { name: "Simple Manifest - Book" }),
    ).toBeInTheDocument();
    await act(async () => {
      element.remove();
      await Promise.resolve();
    });
    expect(element.childNodes).toHaveLength(0);
    void screen;
  });
});
