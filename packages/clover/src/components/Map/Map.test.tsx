import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";

import {
  DC_GEOREF_ANNOTATION_CANVAS,
  DC_IMAGE_SERVICE_V3_ID,
  evanston,
} from "../../fixtures/georef";
import canvasesJson from "../../fixtures/iiif-cookbook/0240-navPlace-on-canvases.json";
import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";
import { Map as CloverMap } from "../../map";
import { stubViewport } from "../Canvas/testing/viewport";

/** A MapLibre that records what is asked of it, and loads at once. */
const maps: FakeMap[] = [];
let failNext = false;

class FakeMap {
  options: any;
  sources: Record<string, any> = {};
  layers: Array<{ id: string; type: string; source?: string }> = [];
  handlers: Array<{ event: string; layer?: string; fn: (e: any) => void }> = [];
  canvas = document.createElement("canvas");
  fitBounds = vi.fn();
  jumpTo = vi.fn();
  setPaintProperty = vi.fn();
  constructor(options: any) {
    if (failNext) {
      failNext = false;
      throw new Error("WebGL is not available");
    }
    this.options = options;
    maps.push(this);
    // The canvas as MapLibre makes it: a focusable region, named from its locale.
    this.canvas.className = "maplibregl-canvas";
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute("role", "region");
    this.canvas.setAttribute("aria-label", options.locale["Map.Title"]);
    // The compact credits as MapLibre opens them: open, and shown, named from its locale.
    const attrib = document.createElement("details");
    attrib.className =
      "maplibregl-ctrl maplibregl-ctrl-attrib maplibregl-compact maplibregl-compact-show";
    attrib.open = true;
    const credits = document.createElement("summary");
    credits.className = "maplibregl-ctrl-attrib-button";
    const label = options.locale["AttributionControl.ToggleAttribution"];
    credits.title = label;
    credits.setAttribute("aria-label", label);
    attrib.append(credits);
    options.container?.append?.(this.canvas, attrib);
    queueMicrotask(() => this.fire("load", {}));
  }
  on(event: string, layer: any, fn?: any) {
    if (typeof layer === "function") this.handlers.push({ event, fn: layer });
    else this.handlers.push({ event, layer, fn });
  }
  fire(event: string, payload: any, layer?: string) {
    this.handlers
      .filter((h) => h.event === event && h.layer === layer)
      .forEach((h) => h.fn(payload));
  }
  getStyle() {
    return { layers: [{ id: "road-primary", type: "line" }] };
  }
  addSource(id: string, spec: any) {
    this.sources[id] = { ...spec, setData: vi.fn() };
  }
  getSource(id: string) {
    return this.sources[id];
  }
  removeSource(id: string) {
    delete this.sources[id];
  }
  addLayer(layer: any) {
    this.layers.push(layer);
  }
  getLayer(id: string) {
    return this.layers.find((layer) => layer.id === id);
  }
  removeLayer(id: string) {
    this.layers = this.layers.filter((layer) => layer.id !== id);
  }
  addControl() {}
  getCanvas() {
    return this.canvas;
  }
  getZoom() {
    return 1;
  }
  resize() {}
  remove() {}
}

const popups: FakePopup[] = [];
class FakePopup {
  text?: string | null;
  node?: HTMLElement;
  at?: unknown;
  removed = false;
  setLngLat(at: unknown) {
    this.at = at;
    return this;
  }
  setDOMContent(node: HTMLElement) {
    this.node = node;
    this.text = node.textContent;
    return this;
  }
  addTo() {
    popups.push(this);
    return this;
  }
  remove() {
    this.removed = true;
    return this;
  }
}

vi.mock("maplibre-gl", () => ({
  Map: FakeMap,
  Popup: FakePopup,
  NavigationControl: class {},
  setWorkerUrl: vi.fn(),
  getVersion: () => "6.11.1",
}));

// jsdom has no 2D canvas, and loads no images: give the overlay both.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    clip() {},
    drawImage() {},
  })) as never;
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    set(this: HTMLImageElement) {
      Object.defineProperty(this, "naturalWidth", { value: 1528 });
      Object.defineProperty(this, "naturalHeight", { value: 2048 });
      queueMicrotask(() => this.onload?.(new Event("load")));
    },
  });
});

// Every map on screen, as the suite's own observer reports none: MapLibre loads near view.
let viewport: ReturnType<typeof stubViewport>;
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  maps.length = 0;
  popups.length = 0;
  viewport = stubViewport();
});
afterEach(() => viewport.restore());

const placeData = (map: FakeMap) =>
  map.sources["geomap-navplace"].setData.mock.calls.at(-1)?.[0];

describe("Map", () => {
  it("starts with its credits collapsed, and cases its lines in white", async () => {
    const { container } = render(
      <CloverMap
        navPlace={{
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [-87.69, 42.04],
              [-87.68, 42.05],
            ],
          },
        }}
      />,
    );
    await waitFor(() => expect(maps).toHaveLength(1));
    const attrib = container.querySelector("details")!;
    await waitFor(() => expect(attrib.open).toBe(false));
    expect(attrib).not.toHaveClass("maplibregl-compact-show");
    const ids = maps[0].layers.map((layer) => layer.id);
    expect(ids.indexOf("geomap-navplace-casing")).toBe(
      ids.indexOf("geomap-navplace-line") - 1,
    );
    // A place with no name is listed by its number.
    expect(screen.getByRole("button", { name: "Place 1" })).toBeInTheDocument();
  });

  it("loads MapLibre only as it comes near the window", async () => {
    viewport.restore();
    viewport = stubViewport({ onScreen: false });
    const { container } = render(
      <CloverMap
        navPlace={{
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [-87.69, 42.04] },
        }}
      />,
    );
    await act(() => new Promise((done) => setTimeout(done, 50)));
    expect(maps).toHaveLength(0);
    expect(container.querySelector(".clover-geomap")).toHaveAttribute(
      "data-status",
      "loading",
    );
    act(() =>
      viewport.scrollIntoView(container.querySelector(".clover-geomap")!),
    );
    await waitFor(() => expect(maps).toHaveLength(1));
  });

  it("draws GeoJSON it is given, framed on its one point", async () => {
    render(
      <CloverMap
        navPlace={{
          type: "Feature",
          properties: { label: { en: ["Evanston"] } },
          geometry: { type: "Point", coordinates: [-87.69, 42.04] },
        }}
      />,
    );
    await waitFor(() => expect(maps).toHaveLength(1));
    const [map] = maps;
    await waitFor(() => expect(placeData(map)?.features).toHaveLength(1));
    expect(placeData(map).features[0].properties.title).toBe("Evanston");
    expect(map.jumpTo).toHaveBeenCalledWith({
      center: [-87.69, 42.04],
      zoom: 8,
    });
    // Wheel zoom stays off, and the default basemap loses its roads.
    expect(map.options.scrollZoom).toBe(false);
    expect(map.getLayer("road-primary")).toBeUndefined();
  });

  it("maps a Root's places; pressing one names it and opens its Canvas", async () => {
    render(
      <Clover.Root iiifContent={canvasesJson}>
        <Clover.Label of="canvas" data-testid="canvas" />
        <CloverMap />
      </Clover.Root>,
    );
    await waitFor(() => expect(maps).toHaveLength(1));
    const [map] = maps;
    await waitFor(() => expect(placeData(map)?.features).toHaveLength(2));
    expect(map.fitBounds).toHaveBeenCalled();

    const second = placeData(map).features[1];
    act(() =>
      map.fire(
        "click",
        { features: [second], lngLat: { lng: 0, lat: 0 } },
        "geomap-navplace-point",
      ),
    );
    expect(popups.at(-1)?.text).toBe("Current Location of Painting");
    expect(popups.at(-1)?.node?.lang).toBe("en");
    await waitFor(() =>
      expect(screen.getByTestId("canvas")).toHaveTextContent(
        canvasesJson.items[1].label.en[0],
      ),
    );
  });

  it("lists its places; pressing one frames and names it, and opens its Canvas", async () => {
    const onSelect = vi.fn();
    render(
      <Clover.Root iiifContent={canvasesJson}>
        <Clover.Label of="canvas" data-testid="canvas" />
        <CloverMap onSelect={onSelect} />
      </Clover.Root>,
    );
    await waitFor(() => expect(maps).toHaveLength(1));
    const [map] = maps;
    await waitFor(() => expect(map.fitBounds).toHaveBeenCalledTimes(1));

    const list = screen.getByRole("list");
    const [bronze, painting] = within(list).getAllByRole("button");
    expect(bronze).toHaveAccessibleName(
      "Current Location of the Laocoön Bronze",
    );
    expect(bronze).toHaveAttribute("lang", "en");
    // The first Canvas is in view, so its place is the current one.
    expect(bronze).toHaveAttribute("aria-current", "true");
    expect(painting).not.toHaveAttribute("aria-current");

    fireEvent.click(painting);
    expect(map.jumpTo).toHaveBeenLastCalledWith({
      center: [-77.0199025, 38.8920717],
      zoom: 8,
    });
    expect(popups.at(-1)?.text).toBe("Current Location of Painting");
    expect(popups.at(-1)?.at).toEqual([-77.0199025, 38.8920717]);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          canvasId: canvasesJson.items[1].id,
        }),
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("canvas")).toHaveTextContent(
        canvasesJson.items[1].label.en[0],
      ),
    );
    expect(painting).toHaveAttribute("aria-current", "true");
    expect(bronze).not.toHaveAttribute("aria-current");
    // The view it opened draws nothing new, so the place stays framed.
    expect(map.fitBounds).toHaveBeenCalledTimes(1);

    // One popup at a time.
    fireEvent.click(bronze);
    expect(popups.at(-2)?.removed).toBe(true);
  });

  it("standalone, marks no place current: nothing shows a Canvas", async () => {
    const onSelect = vi.fn();
    render(<CloverMap iiifContent={canvasesJson} onSelect={onSelect} />);
    const painting = await screen.findByRole("button", {
      name: "Current Location of Painting",
    });
    await waitFor(() => expect(maps[0]?.fitBounds).toHaveBeenCalled());
    const buttons = within(screen.getByRole("list")).getAllByRole("button");
    for (const button of buttons)
      expect(button).not.toHaveAttribute("aria-current");
    // Nor once one is chosen: its popup names it, and nothing goes to a view.
    fireEvent.click(painting);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(popups.at(-1)?.text).toBe("Current Location of Painting");
    for (const button of buttons)
      expect(button).not.toHaveAttribute("aria-current");
  });

  it("names places in their own language, in the list and the popup", async () => {
    render(
      <Clover.Root iiifContent={canvasesJson} language="it">
        <CloverMap />
      </Clover.Root>,
    );
    const bronze = await screen.findByRole("button", {
      name: "Ubicazione attuale del Bronzo Laocoonte e i suoi figli",
    });
    expect(bronze).toHaveAttribute("lang", "it");
    await waitFor(() => expect(maps[0].fitBounds).toHaveBeenCalled());
    fireEvent.click(bronze);
    expect(popups.at(-1)?.node?.lang).toBe("it");
    expect(popups.at(-1)?.node?.textContent).toBe(
      "Ubicazione attuale del Bronzo Laocoonte e i suoi figli",
    );
  });

  it("is one region, named in the reader's language and described by a count of its places", async () => {
    const { container } = render(
      <Clover.Root iiifContent={canvasesJson}>
        <CloverMap />
      </Clover.Root>,
    );
    await waitFor(() => expect(maps).toHaveLength(1));
    const [map] = maps;
    expect(map.options.locale).toMatchObject({
      "Map.Title": "Map",
      "AttributionControl.ToggleAttribution": "Map credits",
    });
    const region = screen.getByRole("region");
    expect(region).toBe(map.canvas);
    expect(region).toHaveAccessibleName("Map");
    // A count, short whatever the number: the list after it names them.
    await waitFor(() =>
      expect(region).toHaveAccessibleDescription(
        "Places listed after the map: 2",
      ),
    );
    const about = document.getElementById(
      region.getAttribute("aria-describedby")!,
    )!;
    expect(about).not.toBeVisible();
    expect(
      within(screen.getByRole("list")).getAllByRole("button"),
    ).toHaveLength(2);

    // A new language renames MapLibre's own controls, title and all.
    act(() => {
      initCloverI18n({
        lng: "fr",
        resources: {
          fr: { clover: { mapLabel: "Carte", mapAttribution: "Crédits" } },
        },
      });
    });
    await waitFor(() => expect(region).toHaveAccessibleName("Carte"));
    const credits = container.querySelector(".maplibregl-ctrl-attrib-button")!;
    expect(credits).toHaveAttribute("aria-label", "Crédits");
    expect(credits).toHaveAttribute("title", "Crédits");
  });

  it("lists the georeferenced images it draws, by their Canvas's name", async () => {
    const manifest = evanston();
    (manifest.items[0] as any).label = { en: ["Township map"] };
    render(
      <Clover.Root iiifContent={manifest}>
        <CloverMap />
      </Clover.Root>,
    );
    const button = await screen.findByRole("button", {
      name: "Township map Georeferenced image",
    });
    expect(within(button).getByText("Township map")).toHaveAttribute(
      "lang",
      "en",
    );
    const [map] = maps;
    map.fitBounds.mockClear();
    fireEvent.click(button);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    const [[west, south], [east, north]] = map.fitBounds.mock.calls[0][0];
    expect(west).toBeGreaterThan(-88);
    expect(east).toBeLessThan(-87.5);
    expect(south).toBeGreaterThan(41.9);
    expect(north).toBeLessThan(42.2);
  });

  it("warps a georeferenced image onto the map by its control points", async () => {
    render(<CloverMap georeferences={[georeferenceOnService()]} />);
    await waitFor(() => expect(maps).toHaveLength(1));
    const [map] = maps;
    await waitFor(() =>
      expect(
        Object.values(map.sources).find((source) => source.type === "canvas"),
      ).toBeTruthy(),
    );
    const overlay = Object.values(map.sources).find(
      (source) => source.type === "canvas",
    );
    expect(overlay.coordinates).toHaveLength(4);
    for (const [lng, lat] of overlay.coordinates) {
      expect(lng).toBeGreaterThan(-88);
      expect(lng).toBeLessThan(-87.5);
      expect(lat).toBeGreaterThan(41.9);
      expect(lat).toBeLessThan(42.2);
    }
    // Drawn as a raster layer, under the places.
    const raster = map.layers.findIndex((l) => l.type === "raster");
    expect(raster).toBeGreaterThanOrEqual(0);
    expect(map.fitBounds).toHaveBeenCalled();
  });

  it("overlays the view's georeferenced Canvas inside a Root", async () => {
    render(
      <Clover.Root iiifContent={evanston()}>
        <CloverMap />
      </Clover.Root>,
    );
    await waitFor(() => expect(maps).toHaveLength(1));
    await waitFor(() =>
      expect(
        Object.values(maps[0].sources).some((s) => s.type === "canvas"),
      ).toBe(true),
    );
  });

  it("says so when MapLibre cannot start (no WebGL), and still lists its places", async () => {
    failNext = true;
    render(<CloverMap navPlace={{ type: "Point", coordinates: [0, 0] }} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The map could not be shown.",
    );
    expect(screen.getByRole("button", { name: "Place 1" })).toBeInTheDocument();
  });

  it("holds a popup's ground and tip to the theme over MapLibre's unlayered white", () => {
    // Layered (`dist`), only `!important` beats MapLibre's own `background: #fff`.
    const css = readFileSync(resolve(__dirname, "Map.css"), "utf8");
    expect(css).toMatch(
      /\.clover-geomap-popup \.maplibregl-popup-content \{[^}]*background-color: var\(--clover-color-secondary, #fff\) !important;[^}]*color: var\(--clover-color-primary, #1a1d1e\);/,
    );
    for (const side of ["top", "bottom", "left", "right"])
      expect(css).toMatch(
        new RegExp(
          `border-${side}-color: var\\(--clover-color-secondary, #fff\\) !important;`,
        ),
      );
  });
});

describe("the Map tab", () => {
  it("is offered by itself when the Manifest has places, and not otherwise", async () => {
    const { unmount } = render(
      <Clover.Root
        iiifContent={{
          ...canvasesJson,
          // The same Canvases, their navPlace taken away.
          items: canvasesJson.items.map((canvas) => ({
            ...canvas,
            navPlace: undefined,
          })),
        }}
      >
        <Clover.Panel />
      </Clover.Root>,
    );
    await screen.findByRole("tab", { name: "About" });
    expect(screen.queryByRole("tab", { name: "Map" })).toBeNull();
    unmount();

    render(
      <Clover.Root iiifContent={canvasesJson}>
        <Clover.Panel />
      </Clover.Root>,
    );
    fireEvent.click(await screen.findByRole("tab", { name: "Map" }));
    // The places, under the map in its tab.
    expect(
      await screen.findByRole("button", {
        name: "Current Location of Painting",
      }),
    ).toBeInTheDocument();
  });

  it("is no second region named Map inside the accordion's Map section", async () => {
    render(
      <Clover.Root iiifContent={canvasesJson}>
        <Clover.Panel layout="accordion" />
      </Clover.Root>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Map" }));
    await waitFor(() => expect(maps).toHaveLength(1));
    const [map] = maps;
    // A group, so the section is the one landmark named Map.
    expect(map.canvas).toHaveAttribute("role", "group");
    await waitFor(() =>
      expect(map.canvas).toHaveAccessibleDescription(
        "Places listed after the map: 2",
      ),
    );
    const section = screen.getByRole("region", { name: "Map" });
    expect(section).toHaveClass("clover-sections-panel");
    expect(within(section).queryByRole("region")).toBeNull();
    expect(within(section).getByRole("group", { name: "Map" })).toBe(
      map.canvas,
    );
  });
});

function georeferenceOnService() {
  return {
    ...DC_GEOREF_ANNOTATION_CANVAS,
    target: {
      ...DC_GEOREF_ANNOTATION_CANVAS.target,
      source: {
        id: DC_IMAGE_SERVICE_V3_ID,
        type: "ImageService3",
        profile: "level2",
        width: 7337,
        height: 9833,
      },
    },
  };
}
