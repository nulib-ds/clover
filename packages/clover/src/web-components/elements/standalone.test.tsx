/*
 * The standalone elements and the viewer's templates (phase 5 of WEB-COMPONENTS.md), under
 * Preact as they ship: a Canvas alone or in a root, Items and a Map alone, and a
 * `<clover-viewer>` in the template it names, its stylesheet loading beside it.
 */
import { fireEvent, waitFor, within } from "@testing-library/dom";

import { defineCloverElements } from "../define";
import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import audioJson from "../../fixtures/iiif-cookbook/0002-mvm-audio-v4.json";
import modelJson from "../../fixtures/iiif-cookbook/0608-mvm-3d-v4.json";
import placesJson from "../../fixtures/iiif-cookbook/0240-navPlace-on-canvases.json";
import { stubViewport } from "../../components/Canvas/testing/viewport";
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

/** The Scene's 3D drawing, without WebGL, as the Scene's own tests stand it in. */
vi.mock("../../components/Scene/cloverEngine", () => ({
  createEngine: () => ({
    load: vi.fn().mockResolvedValue({ center: [0, 0, 0], radius: 1 }),
    draw: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  }),
}));

/** MapLibre, as the Map's own tests stand it in: a map that loads at once. */
class FakeMap {
  canvas = document.createElement("canvas");
  private handlers: { event: string; fn: (event: unknown) => void }[] = [];
  private sources: Record<string, unknown> = {};
  private layers: { id: string }[] = [];
  constructor(options: { container?: HTMLElement }) {
    options.container?.append(this.canvas);
    queueMicrotask(() =>
      this.handlers
        .filter((handler) => handler.event === "load")
        .forEach((handler) => handler.fn({})),
    );
  }
  on(event: string, layer: unknown, fn?: (event: unknown) => void) {
    if (typeof layer === "function")
      this.handlers.push({ event, fn: layer as (event: unknown) => void });
    else if (fn) this.handlers.push({ event, fn });
  }
  getStyle = () => ({ layers: [] });
  addSource = (id: string, spec: object) =>
    (this.sources[id] = { ...spec, setData: vi.fn() });
  getSource = (id: string) => this.sources[id];
  removeSource = (id: string) => delete this.sources[id];
  addLayer = (layer: { id: string }) => this.layers.push(layer);
  getLayer = (id: string) => this.layers.find((layer) => layer.id === id);
  removeLayer = vi.fn();
  addControl = vi.fn();
  getCanvas = () => this.canvas;
  getZoom = () => 1;
  fitBounds = vi.fn();
  jumpTo = vi.fn();
  setPaintProperty = vi.fn();
  resize = vi.fn();
  remove = vi.fn();
}
vi.mock("maplibre-gl", () => ({
  Map: FakeMap,
  Popup: class {
    setLngLat = () => this;
    setDOMContent = () => this;
    addTo = () => this;
    remove = () => this;
  },
  NavigationControl: class {},
  setWorkerUrl: vi.fn(),
}));

let viewport: ReturnType<typeof stubViewport>;
beforeAll(() => defineCloverElements({}));
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  viewport = stubViewport();
});
afterEach(async () => {
  viewport.restore();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  await Promise.resolve();
});

/** Every request answered with `body`, as JSON. */
const serve = (body: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );

const labelOf = (index: number) => bookJson.items[index].label.en[0];

describe("A Canvas, as an element", () => {
  it("draws what it is given, alone: a Manifest's first Canvas, by URL", async () => {
    serve(bookJson);
    document.body.innerHTML = `<clover-canvas iiif-content="https://example.org/book.json"></clover-canvas>`;
    const element = document.querySelector("clover-canvas") as HTMLElement;
    const view = await within(element).findByRole(
      "img",
      { name: labelOf(0) },
      { timeout: 4000 },
    );
    expect(view.closest("figure")).toHaveClass("clover-canvas");
  });

  it("shows its root's view inside a clover-root, as Body does", async () => {
    const root = document.createElement("clover-root") as HTMLElement & {
      iiifContent: unknown;
    };
    root.innerHTML = `<clover-canvas></clover-canvas><clover-next></clover-next>`;
    root.iiifContent = bookJson;
    document.body.append(root);
    await within(root).findByRole(
      "img",
      { name: labelOf(0) },
      { timeout: 4000 },
    );
    fireEvent.click(await within(root).findByRole("button", { name: "Next" }));
    expect(
      await within(root).findByRole("img", { name: labelOf(1) }),
    ).toBeInTheDocument();
  });
});

describe("A Timeline and a Scene, as elements", () => {
  it("plays a Manifest's first Timeline, by URL, in the Canvas's figure", async () => {
    serve(audioJson);
    document.body.innerHTML = `<clover-timeline iiif-content="https://example.org/audio.json"></clover-timeline>`;
    const element = document.querySelector("clover-timeline") as HTMLElement;
    const play = await within(element).findByRole(
      "button",
      { name: "Play" },
      { timeout: 4000 },
    );
    expect(play.closest("figure")).toHaveClass(
      "clover-canvas",
      "clover-timeline",
    );
  });

  it("draws a Scene it is given, and its root's Scene inside a clover-root", async () => {
    const scene = document.createElement("clover-scene") as HTMLElement & {
      scene: unknown;
    };
    scene.scene = modelJson.items[0];
    document.body.append(scene);
    const view = await within(scene).findByRole(
      "img",
      { name: "A Scene" },
      { timeout: 4000 },
    );
    expect(view.closest("figure")).toHaveClass("clover-scene");
    document.body.innerHTML = "";

    const root = document.createElement("clover-root") as HTMLElement & {
      iiifContent: unknown;
    };
    root.innerHTML = `<clover-scene></clover-scene>`;
    root.iiifContent = modelJson;
    document.body.append(root);
    expect(
      await within(root).findByRole(
        "img",
        { name: "A Scene" },
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
  });
});

describe("Items and a Map, alone", () => {
  it("lists a Collection's members as links", async () => {
    const MEMBER = "https://example.org/letter.json";
    serve({
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/shelf.json",
      type: "Collection",
      label: { en: ["Shelf"] },
      items: [{ id: MEMBER, type: "Manifest", label: { en: ["A letter"] } }],
    });
    document.body.innerHTML = `<clover-items iiif-content="https://example.org/shelf.json"></clover-items>`;
    const link = await within(document.body).findByRole(
      "link",
      { name: /A letter/ },
      { timeout: 4000 },
    );
    expect(link).toHaveAttribute("href", MEMBER);
  });

  it("maps the places of what it is given, each a button under it", async () => {
    const map = document.createElement("clover-map") as HTMLElement & {
      iiifContent: unknown;
    };
    map.iiifContent = placesJson;
    document.body.append(map);
    await waitFor(
      () =>
        expect(
          map.querySelectorAll(".clover-geomap-places button").length,
        ).toBeGreaterThan(0),
      { timeout: 4000 },
    );
  });
});

describe("<clover-viewer template>", () => {
  type Viewer = HTMLElement & { iiifContent: unknown };
  const viewer = (attributes: Record<string, string>) => {
    const element = document.createElement("clover-viewer") as Viewer;
    for (const [name, value] of Object.entries(attributes))
      element.setAttribute(name, value);
    element.iiifContent = bookJson;
    document.body.append(element);
    return element;
  };

  it("draws the template it names, its stylesheet with it, after Clover's own", async () => {
    const sheet = () =>
      document.head.querySelector<HTMLElement>(
        'style[data-clover="templates/document/Document"]',
      );
    expect(sheet()).toBeNull();
    const element = viewer({ template: "document" });
    await waitFor(
      () =>
        expect(
          element.querySelector(".clover-template-document"),
        ).not.toBeNull(),
      { timeout: 4000 },
    );
    // Brought by the template's code, after Clover's own sheets, as `templates.css` is.
    const sheets = [
      ...document.head.querySelectorAll<HTMLElement>(
        "style[data-clover-index]",
      ),
    ];
    expect(sheets.at(-1)).toBe(sheet());
    const indexes = sheets.map((style) => Number(style.dataset.cloverIndex));
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it("hands a template its own attributes, and none of another's", async () => {
    const gallery = viewer({
      template: "gallery",
      size: "12rem",
      items: "grid",
    });
    await waitFor(
      () =>
        expect(
          gallery.querySelector(".clover-template-gallery"),
        ).not.toBeNull(),
      { timeout: 4000 },
    );
    const box = gallery.querySelector(
      ".clover-template-gallery",
    ) as HTMLElement;
    expect(box.style.getPropertyValue("--clover-items-size")).toBe("12rem");
    expect(box).not.toHaveAttribute("items");

    const plain = viewer({ size: "12rem" });
    await within(plain).findByRole("heading", {
      level: 2,
      name: "Simple Manifest - Book",
    });
    expect(plain.querySelector(".clover-template-default")).not.toBeNull();
    expect(plain.querySelector("[size]")).toBeNull();
  });
});
