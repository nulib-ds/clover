import sanbornPage from "../../fixtures/mocks/sanborn/annotation-page.json";
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
  DC_CANVAS_ID,
  DC_GEOREF_ANNOTATION_CANVAS,
  DC_IMAGE_SERVICE_V3_ID,
  evanston,
} from "../../fixtures/georef";
import canvasesJson from "../../fixtures/iiif-cookbook/0240-navPlace-on-canvases.json";
import placeJson from "../../fixtures/iiif-cookbook/0139-geolocate-canvas-fragment.json";
import romeJson from "../../fixtures/iiif-cookbook/0318-navPlace-navDate-collection.json";
import castelJson from "../../fixtures/iiif-cookbook/0318-navPlace-navDate-manifest-1.json";
import colosseumJson from "../../fixtures/iiif-cookbook/0318-navPlace-navDate-manifest-2.json";
import { initCloverI18n } from "../../i18n";
import { clearInfoCache } from "../../lib/renderer/sources/imageService";
import * as Clover from "../../index";
import {
  Map as CloverMap,
  boundsOf,
  georeferencesOf,
  readGeoreference,
} from "../../map";
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
  easeTo = vi.fn();
  /** The places under the pointer, as `queryRenderedFeatures` reports them. */
  under: any[] = [];
  queryRenderedFeatures = vi.fn(() => this.under);
  setPaintProperty = vi.fn();
  setFeatureState = vi.fn();
  removeFeatureState = vi.fn();
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
  // Laid before the layer named, as MapLibre lays it, else over the rest.
  addLayer(layer: any, before?: string) {
    const at = before
      ? this.layers.findIndex((each) => each.id === before)
      : -1;
    if (at >= 0) this.layers.splice(at, 0, layer);
    else this.layers.push(layer);
  }
  getLayer(id: string) {
    return this.layers.find((layer) => layer.id === id);
  }
  removeLayer(id: string) {
    this.layers = this.layers.filter((layer) => layer.id !== id);
  }
  // A control of Clover's own (Outlines) is laid in the map's box, as MapLibre lays it.
  addControl(control: any) {
    const element = control?.onAdd?.(this);
    if (element) this.options.container?.append?.(element);
  }
  removeControl(control: any) {
    control?.onRemove?.(this);
  }
  // The handlers whose rotation Clover turns off (WCAG 2.5.1).
  touchZoomRotate = { disableRotation: vi.fn() };
  keyboard = { disableRotation: vi.fn() };
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
  const sources = new WeakMap<HTMLImageElement, string>();
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    get(this: HTMLImageElement) {
      return sources.get(this) ?? "";
    },
    set(this: HTMLImageElement, value: string) {
      sources.set(this, value);
      Object.defineProperty(this, "naturalWidth", {
        value: 1528,
        configurable: true,
      });
      Object.defineProperty(this, "naturalHeight", {
        value: 2048,
        configurable: true,
      });
      queueMicrotask(() => this.onload?.(new Event("load")));
    },
  });
});

// Every map on screen, as the suite's own observer reports none: MapLibre loads near view.
let viewport: ReturnType<typeof stubViewport>;
beforeEach(() => {
  clearInfoCache();
  // The overlay reads its service's capabilities; the unit suite never needs the network.
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    expect(url).toBe(`${DC_IMAGE_SERVICE_V3_ID}/info.json`);
    return new Response(
      JSON.stringify({
        "@context": "http://iiif.io/api/image/3/context.json",
        id: DC_IMAGE_SERVICE_V3_ID,
        type: "ImageService3",
        profile: "level2",
        width: 7337,
        height: 9833,
      }),
    );
  });
  initCloverI18n({ lng: "en" });
  maps.length = 0;
  popups.length = 0;
  viewport = stubViewport();
});
afterEach(() => {
  viewport.restore();
  vi.mocked(globalThis.fetch).mockRestore();
  clearInfoCache();
});

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
    expect(
      await screen.findByRole("option", { name: "Place 1" }),
    ).toBeInTheDocument();
  });

  it("keeps north up: no two-finger twist or Shift+arrow turns it (WCAG 2.5.1)", async () => {
    render(
      <CloverMap
        navPlace={{
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [-87.69, 42.04] },
        }}
      />,
    );
    await waitFor(() => expect(maps).toHaveLength(1));
    expect(maps[0].options.dragRotate).toBe(false);
    expect(maps[0].touchZoomRotate.disableRotation).toHaveBeenCalled();
    expect(maps[0].keyboard.disableRotation).toHaveBeenCalled();
  });

  it("keeps its credits over the map, and none where asked to leave them out", async () => {
    const place = {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [-87.69, 42.04] },
    };
    const { container, unmount } = render(<CloverMap navPlace={place} />);
    await waitFor(() => expect(maps).toHaveLength(1));
    expect(maps[0].options.attributionControl).toEqual({ compact: true });
    // In the map's own box, where MapLibre puts it, over the map.
    const attrib = container.querySelector(".maplibregl-ctrl-attrib");
    expect(attrib).not.toBeNull();
    expect(maps[0].options.container).toContainElement(attrib as HTMLElement);
    unmount();
    render(<CloverMap navPlace={place} credits={false} />);
    await waitFor(() => expect(maps).toHaveLength(2));
    expect(maps[1].options.attributionControl).toBe(false);
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

  // Mat, 2026-11-08: "it's okay to rerender but can we smooth it out?"
  it("eases to another place it is given, and at once where motion is reduced", async () => {
    const point = (lng: number) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [lng, 42.04] },
    });
    const { rerender } = render(<CloverMap navPlace={point(-87.69)} />);
    await waitFor(() => expect(maps).toHaveLength(1));
    const [map] = maps;
    await waitFor(() => expect(map.jumpTo).toHaveBeenCalledTimes(1));
    rerender(<CloverMap navPlace={point(-87.6)} />);
    await waitFor(() =>
      expect(map.easeTo).toHaveBeenCalledWith({
        center: [-87.6, 42.04],
        zoom: 8,
        duration: 600,
      }),
    );
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
    })) as never;
    try {
      rerender(<CloverMap navPlace={point(-87.5)} />);
      await waitFor(() =>
        expect(map.jumpTo).toHaveBeenLastCalledWith({
          center: [-87.5, 42.04],
          zoom: 8,
        }),
      );
      expect(map.easeTo).toHaveBeenCalledTimes(1);
    } finally {
      window.matchMedia = matchMedia;
    }
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

  // Cookbook 0318: a Collection of Manifests, each with its place.
  // Mat, 2026-11-08: "for navPlace items, show a thumbnail for the respective item".
  it("shows a place's picture over its name: its Canvas's image, sized from its info.json", async () => {
    const manifest = evanston() as any;
    manifest.items[0].navPlace = {
      type: "Feature",
      properties: { label: { en: ["Evanston"] } },
      geometry: { type: "Point", coordinates: [-87.69, 42.04] },
    };
    render(
      <Clover.Root iiifContent={manifest}>
        <CloverMap />
      </Clover.Root>,
    );
    await waitFor(() => expect(maps).toHaveLength(1));
    await waitFor(() => expect(placeData(maps[0])?.features).toHaveLength(1));
    const list = await screen.findByRole("listbox", { name: "On the map" });
    fireEvent.click(
      await within(list).findByRole("option", { name: /Evanston/ }),
    );
    const named = popups.at(-1)!.node!;
    expect(named).toHaveTextContent("Evanston");
    // Decorative, as its name says what it is; shown once it has loaded.
    const picture = await waitFor(() => {
      const image = named.querySelector("img.clover-tip-image");
      expect(image).not.toBeNull();
      return image as HTMLImageElement;
    });
    expect(picture).toHaveAttribute("alt", "");
    expect(picture.src).toMatch(
      new RegExp(`^${DC_IMAGE_SERVICE_V3_ID}/full/\\d+,\\d+/0/default\\.jpg$`),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${DC_IMAGE_SERVICE_V3_ID}/info.json`,
      expect.anything(),
    );
    await waitFor(() => expect(picture.hidden).toBe(false));
  });

  // Mat, 2026-11-08: "as if hover turns off/on/off/on over and over".
  it("keeps the place it names while it is under the pointer, across layers and places that overlap", async () => {
    render(
      <Clover.Root iiifContent={canvasesJson}>
        <CloverMap />
      </Clover.Root>,
    );
    await waitFor(() => expect(maps).toHaveLength(1));
    const [map] = maps;
    await waitFor(() => expect(placeData(map)?.features).toHaveLength(2));
    const [first, second] = placeData(map).features;
    const move = (...under: unknown[]) => {
      map.under = under;
      act(() => map.fire("mousemove", { point: { x: 0, y: 0 } }));
    };
    move(first);
    expect(popups).toHaveLength(1);
    // The other place under it too, first: the one named stays, never named again.
    move(second, first);
    move(first, first);
    expect(popups).toHaveLength(1);
    expect(popups[0].removed).toBe(false);
    // Off every place, the name goes; onto the other, it is named.
    move();
    expect(popups[0].removed).toBe(true);
    move(second);
    expect(popups).toHaveLength(2);
  });

  // Mat, 2026-11-08: "blinking is still regularly occurring", as a Collection's members
  // load beside the map and the same places are handed in again.
  it("keeps a place named under the pointer when the same places are handed in again", async () => {
    const place = (lng: number, name: string) => ({
      type: "Feature",
      properties: { label: { en: [name] } },
      geometry: { type: "Point", coordinates: [lng, 41.89] },
    });
    const collection = () => ({
      type: "FeatureCollection",
      features: [place(12.48, "Arch of Titus"), place(12.49, "Trajan's Forum")],
    });
    const { rerender } = render(<CloverMap navPlace={collection()} />);
    await waitFor(() => expect(maps).toHaveLength(1));
    const [map] = maps;
    await waitFor(() => expect(placeData(map)?.features).toHaveLength(2));
    map.under = [placeData(map).features[0]];
    act(() => map.fire("mousemove", { point: { x: 0, y: 0 } }));
    expect(popups).toHaveLength(1);
    // The same places, as new objects: the name stays, never put away and made again.
    rerender(<CloverMap navPlace={collection()} />);
    await waitFor(() =>
      expect(map.sources["geomap-navplace"].setData).toHaveBeenCalledTimes(2),
    );
    expect(popups).toHaveLength(1);
    expect(popups[0].removed).toBe(false);
    act(() => map.fire("mousemove", { point: { x: 0, y: 0 } }));
    expect(popups).toHaveLength(1);
    // Another set without it: its name goes.
    rerender(
      <CloverMap
        navPlace={{
          type: "FeatureCollection",
          features: [place(12.5, "Elsewhere")],
        }}
      />,
    );
    await waitFor(() => expect(popups[0].removed).toBe(true));
  });

  // Mat, 2026-11-08: "I see image services on the manifest" (Cookbook 0318, whose
  // members carry no thumbnail).
  it("loads a member's Manifest for its picture only as its place is named", async () => {
    const service =
      "https://iiif.io/api/image/3.0/example/reference/71b9228e087f15c75b628214cd9f647d-The_Colosseum";
    const table: Record<string, unknown> = {
      [castelJson.id]: castelJson,
      [colosseumJson.id]: colosseumJson,
      [`${service}/info.json`]: {
        "@context": "http://iiif.io/api/image/3/context.json",
        id: service,
        type: "ImageService3",
        profile: "level1",
        width: 3000,
        height: 2000,
      },
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
      <Clover.Root iiifContent={romeJson} request={{ fetch }}>
        <CloverMap />
      </Clover.Root>,
    );
    await waitFor(() => expect(maps).toHaveLength(1));
    await waitFor(() => expect(placeData(maps[0])?.features).toHaveLength(5));
    // Not asked for until its place is named.
    expect(fetch).not.toHaveBeenCalledWith(colosseumJson.id, expect.anything());
    const colosseum = placeData(maps[0]).features[1];
    maps[0].under = [colosseum];
    act(() => maps[0].fire("mousemove", { point: { x: 0, y: 0 } }));
    const named = popups.at(-1)!.node!;
    expect(named).toHaveTextContent("The Colosseum");
    const picture = await waitFor(() => {
      const image = named.querySelector("img.clover-tip-image");
      expect(image).not.toBeNull();
      return image as HTMLImageElement;
    });
    expect(picture.src).toMatch(
      new RegExp(`^${service}/full/\\d+,\\d*/0/default\\.jpg$`),
    );
    expect(fetch).toHaveBeenCalledWith(colosseumJson.id, expect.anything());
  });

  it("maps a Collection's members; pressing another's place opens that member", async () => {
    const table: Record<string, unknown> = {
      [castelJson.id]: castelJson,
      [colosseumJson.id]: colosseumJson,
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
      <Clover.Root iiifContent={romeJson} request={{ fetch }}>
        <Clover.Label as="h1" />
        <CloverMap />
      </Clover.Root>,
    );
    await screen.findByRole("heading", { name: "Castel Sant'Angelo, Rome" });
    const list = await screen.findByRole("listbox", { name: "On the map" });
    await waitFor(() =>
      expect(within(list).getAllByRole("option")).toHaveLength(
        romeJson.items.length,
      ),
    );
    const places = within(list).getAllByRole("option");
    // Each named, its member's date under the name.
    for (const [index, member] of romeJson.items.entries()) {
      expect(places[index]).toHaveTextContent(member.label.en[0]);
      expect(places[index]).toHaveTextContent(member.navDate.slice(0, 4));
    }
    expect(places[2].querySelector("time")).toHaveAttribute("datetime", "1725");
    // The member open is the place selected.
    expect(places[0]).toHaveAttribute("aria-selected", "true");
    expect(places[1]).toHaveAttribute("aria-selected", "false");

    places[1].focus();
    fireEvent.click(places[1]);
    // Named on the map as in the list: its name, and its date under it.
    const named = popups.at(-1)!.node!;
    expect(named).toHaveAttribute("lang", "en");
    expect(named.firstChild).toHaveTextContent("The Colosseum");
    expect(
      named.querySelector("time.clover-geomap-popup-date"),
    ).toHaveTextContent(/^1776$/);
    await screen.findByRole("heading", { name: "The Colosseum" });
    // The same list, so focus stays on the place pressed (WCAG 2.4.3), now selected.
    const after = within(list).getAllByRole("option");
    expect(after[1]).toBe(places[1]);
    expect(after[1]).toHaveFocus();
    expect(after[1]).toHaveAttribute("aria-selected", "true");
    expect(after[0]).toHaveAttribute("aria-selected", "false");
  });

  it("lets go of a name and a pick as its places change, keeping one still there", async () => {
    const [castel, colosseum, arch] = romeJson.items.map(
      (member) => member.navPlace,
    );
    const { rerender } = render(<CloverMap navPlace={arch} />);
    await waitFor(() => expect(maps).toHaveLength(1));
    const [map] = maps;
    await waitFor(() => expect(placeData(map)?.features).toHaveLength(1));
    fireEvent.click(
      await screen.findByRole("option", {
        name: arch.features[0].properties.label.en[0],
      }),
    );
    const named = popups.at(-1)!;
    expect(named.removed).toBe(false);

    // Another Canvas's place (Cookbook 0318, a member opened): the old name goes with it,
    // and every place's state, kept by its place in the data.
    rerender(<CloverMap navPlace={castel} />);
    await waitFor(() => expect(named.removed).toBe(true));
    expect(map.removeFeatureState).toHaveBeenCalledWith({
      source: "geomap-navplace",
    });
    expect(popups.filter((popup) => !popup.removed)).toHaveLength(0);

    // A place the new places still hold stays picked, and named.
    const both = {
      type: "FeatureCollection",
      features: [...castel.features, ...colosseum.features],
    };
    rerender(<CloverMap navPlace={both} />);
    fireEvent.click(
      await screen.findByRole("option", { name: "The Colosseum" }),
    );
    const kept = popups.at(-1)!;
    rerender(
      <CloverMap
        navPlace={{
          ...both,
          features: [colosseum.features[0], arch.features[0]],
        }}
      />,
    );
    await waitFor(() =>
      expect(map.setFeatureState).toHaveBeenLastCalledWith(
        { source: "geomap-navplace", id: 0 },
        { picked: true },
      ),
    );
    expect(kept.removed).toBe(false);
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

    const list = await screen.findByRole("listbox", { name: "On the map" });
    const bronze = await within(list).findByRole("option", {
      name: "Current Location of the Laocoön Bronze",
    });
    const [, painting] = within(list).getAllByRole("option");
    // Named in its own language, marked on its name.
    expect(
      within(bronze).getByText("Current Location of the Laocoön Bronze"),
    ).toHaveAttribute("lang", "en");
    // The first Canvas is in view, so its place is the one selected.
    expect(bronze).toHaveAttribute("aria-selected", "true");
    expect(painting).toHaveAttribute("aria-selected", "false");

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
    expect(painting).toHaveAttribute("aria-selected", "true");
    expect(bronze).toHaveAttribute("aria-selected", "false");
    // The view it opened draws nothing new, so the place stays framed.
    expect(map.fitBounds).toHaveBeenCalledTimes(1);

    // One popup at a time.
    fireEvent.click(bronze);
    expect(popups.at(-2)?.removed).toBe(true);
  });

  // Cookbook 0139: a map on the page tagged with where it shows.
  it("selects the annotation whose place is pressed, so its region is framed", async () => {
    let root: any;
    const Spy = () => {
      root = Clover.useClover("test");
      return null;
    };
    render(
      <Clover.Root iiifContent={placeJson}>
        <Spy />
        <CloverMap />
      </Clover.Root>,
    );
    await waitFor(() => expect(maps).toHaveLength(1));
    const list = await screen.findByRole("listbox", { name: "On the map" });
    fireEvent.click(
      await within(list).findByRole("option", {
        name: "Targeted Map from Chesapeake and Ohio Canal Pamphlet",
      }),
    );
    expect(root.clover.store.get().annotationId).toBe(
      placeJson.items[0].annotations[0].items[0].id,
    );
  });

  // As a hotspot does: active while its annotation is pointed at or picked beside it.
  it("shows a place active while its annotation is pointed at elsewhere", async () => {
    let root: any;
    const Spy = () => {
      root = Clover.useClover("test");
      return null;
    };
    render(
      <Clover.Root iiifContent={placeJson}>
        <Spy />
        <CloverMap />
      </Clover.Root>,
    );
    await waitFor(() => expect(maps).toHaveLength(1));
    const list = await screen.findByRole("listbox", { name: "On the map" });
    const [map] = maps;
    const id = placeJson.items[0].annotations[0].items[0].id;
    act(() => root.clover.highlight.emit(id));
    await waitFor(() =>
      expect(map.setFeatureState).toHaveBeenLastCalledWith(
        { source: "geomap-navplace", id: 0 },
        { linked: true },
      ),
    );
    // Its item lit too, as the pointer lights one.
    expect((await within(list).findAllByRole("option"))[0]).toHaveAttribute(
      "data-highlighted",
      "true",
    );
    act(() => root.clover.highlight.emit(null));
    await waitFor(() =>
      expect(map.setFeatureState).toHaveBeenLastCalledWith(
        { source: "geomap-navplace", id: 0 },
        { linked: false },
      ),
    );
  });

  it("standalone, marks no place current: nothing shows a Canvas", async () => {
    const onSelect = vi.fn();
    render(<CloverMap iiifContent={canvasesJson} onSelect={onSelect} />);
    const painting = await screen.findByRole("option", {
      name: "Current Location of Painting",
    });
    await waitFor(() => expect(maps[0]?.fitBounds).toHaveBeenCalled());
    const options = within(
      screen.getByRole("listbox", { name: "On the map" }),
    ).getAllByRole("option");
    for (const option of options)
      expect(option).toHaveAttribute("aria-selected", "false");
    // Once one is chosen, it alone: its popup names it, and nothing goes to a view.
    fireEvent.click(painting);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(popups.at(-1)?.text).toBe("Current Location of Painting");
    expect(painting).toHaveAttribute("aria-selected", "true");
  });

  it("names places in their own language, in the list and the popup", async () => {
    render(
      <Clover.Root iiifContent={canvasesJson} language="it">
        <CloverMap />
      </Clover.Root>,
    );
    const bronze = await screen.findByRole("option", {
      name: "Ubicazione attuale del Bronzo Laocoonte e i suoi figli",
    });
    expect(
      within(bronze).getByText(
        "Ubicazione attuale del Bronzo Laocoonte e i suoi figli",
      ),
    ).toHaveAttribute("lang", "it");
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
      within(
        await screen.findByRole("listbox", { name: "On the map" }),
      ).getAllByRole("option"),
    ).toHaveLength(2);
    // The list is no landmark of its own: the map is the one region.
    expect(screen.getAllByRole("region")).toHaveLength(1);

    // A new language renames MapLibre's own controls, title and all.
    act(() => {
      void initCloverI18n({
        resources: {
          fr: { clover: { mapLabel: "Carte", mapAttribution: "Crédits" } },
        },
      }).chooseInterfaceLanguage("fr");
    });
    await waitFor(() => expect(region).toHaveAccessibleName("Carte"));
    const credits = container.querySelector(".maplibregl-ctrl-attrib-button")!;
    expect(credits).toHaveAttribute("aria-label", "Crédits");
    // Named by Clover's popover, not the browser's tooltip.
    expect(credits).not.toHaveAttribute("title");
    await waitFor(() =>
      expect(credits.querySelector(".clover-tip")).toHaveTextContent("Crédits"),
    );
  });

  it("lists the georeferenced images it draws, by their Canvas's name", async () => {
    const manifest = evanston();
    (manifest.items[0] as any).label = { en: ["Township map"] };
    render(
      <Clover.Root iiifContent={manifest}>
        <CloverMap />
      </Clover.Root>,
    );
    // Listed once its georeference loads, on demand: past a second on CI.
    const button = await screen.findByRole(
      "option",
      { name: "Township map" },
      { timeout: 4000 },
    );
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

  it("tells apart maps of one name by their place among it", async () => {
    // A sheet of three maps, each georeferenced on its own, none named but by the sheet.
    const sheet = { en: ["Sheet 21"] };
    const three = [1, 2, 3].map((n) => ({
      ...georeferenceOnService(),
      id: `https://example.org/sheet-21/map-${n}`,
      label: sheet,
    }));
    render(<CloverMap georeferences={three} />);
    for (const n of [1, 2, 3])
      expect(
        await screen.findByRole(
          "option",
          { name: `Sheet 21 ${n} / 3` },
          { timeout: 4000 },
        ),
      ).toBeInTheDocument();
  });

  it("pictures a georeferenced image's row by the map it is, small, as its info.json allows", async () => {
    const one = {
      ...georeferenceOnService(),
      label: { en: ["Township map"] },
      target: {
        ...georeferenceOnService().target,
        selector: {
          type: "SvgSelector",
          value:
            '<svg><polygon points="1000,2000 5000,2000 5000,8000 1000,8000" /></svg>',
        },
      },
    };
    render(<CloverMap georeferences={[one]} />);
    const row = await screen.findByRole(
      "option",
      { name: "Township map" },
      { timeout: 4000 },
    );
    const picture = await waitFor(() => {
      const found = row.querySelector(".clover-items-picture img");
      expect(found).not.toBeNull();
      return found!;
    });
    // Decorative, as its name says what it is; cut to its mask's box, asked small.
    expect(picture).toHaveAttribute("alt", "");
    const src = picture.getAttribute("src")!;
    expect(
      src.startsWith(`${DC_IMAGE_SERVICE_V3_ID}/1000,2000,4000,6000/`),
    ).toBe(true);
    const [width] = src.split("/").at(-3)!.split(",").map(Number);
    expect(width).toBeLessThanOrEqual(104);
  });

  it("outlines a georeferenced image at half strength while its row is pointed at, whole once chosen", async () => {
    const one = { ...georeferenceOnService(), label: { en: ["Township map"] } };
    render(<CloverMap georeferences={[one]} />);
    const row = await screen.findByRole(
      "option",
      { name: "Township map" },
      { timeout: 4000 },
    );
    const [map] = maps;
    const outline = () =>
      map.sources["geomap-overlay-outline"]?.setData.mock.calls.at(-1)?.[0] ??
      map.sources["geomap-overlay-outline"]?.data;
    fireEvent.mouseEnter(row);
    await waitFor(() =>
      expect(outline().features).toMatchObject([
        { properties: { hover: true } },
      ]),
    );
    fireEvent.mouseLeave(row);
    await waitFor(() => expect(outline().features).toEqual([]));
    fireEvent.click(row);
    await waitFor(() =>
      expect(outline().features).toMatchObject([
        { properties: { hover: false } },
      ]),
    );
  });

  it("lights a georeferenced image's row while the pointer is over it on the map", async () => {
    const one = { ...georeferenceOnService(), label: { en: ["Township map"] } };
    render(<CloverMap georeferences={[one]} />);
    const row = await screen.findByRole(
      "option",
      { name: "Township map" },
      { timeout: 4000 },
    );
    const [map] = maps;
    const [[west, south], [east, north]] = boundsOf(
      [],
      [readGeoreference(one)!],
    )!;
    const point = (lng: number, lat: number) =>
      act(() =>
        map.fire("mousemove", { point: { x: 0, y: 0 }, lngLat: { lng, lat } }),
      );
    map.under = [];
    point((west + east) / 2, (south + north) / 2);
    expect(row).toHaveAttribute("data-highlighted", "true");
    point(east + 1, north + 1);
    expect(row).not.toHaveAttribute("data-highlighted");
  });

  it("lists nothing with items={false}, and is then described by no count", async () => {
    render(
      <CloverMap
        navPlace={{ type: "Point", coordinates: [0, 0] }}
        items={false}
      />,
    );
    await waitFor(() => expect(maps).toHaveLength(1));
    await waitFor(() => expect(placeData(maps[0])?.features).toHaveLength(1));
    expect(screen.queryByRole("listbox")).toBeNull();
    // Its text is the page's own list, then: the map points to no count of its own.
    expect(maps[0].canvas).not.toHaveAttribute("aria-describedby");
  });

  it("lays out its list as Items does: list by default, or another of its layouts", async () => {
    const place = { type: "Point", coordinates: [0, 0] };
    const { rerender } = render(<CloverMap navPlace={place} />);
    const list = await screen.findByRole("listbox", { name: "On the map" });
    expect(list.closest(".clover-items")).toHaveAttribute(
      "data-layout",
      "list",
    );
    rerender(<CloverMap navPlace={place} items="grid" />);
    await waitFor(() =>
      expect(
        screen
          .getByRole("listbox", { name: "On the map" })
          .closest(".clover-items"),
      ).toHaveAttribute("data-layout", "grid"),
    );
  });

  it("lays every Canvas's georeferenced images inside a Root with overlays=\"all\", the view's otherwise", async () => {
    const drawn = () =>
      Object.values(maps[0].sources).filter(
        (source: any) => source.type === "canvas",
      ).length;
    const { unmount: gone } = render(
      <Clover.Root iiifContent={twoSheets()}>
        <CloverMap />
      </Clover.Root>,
    );
    await waitFor(() => expect(drawn()).toBe(1), { timeout: 4000 });
    gone();
    maps.length = 0;
    render(
      <Clover.Root iiifContent={twoSheets()}>
        <CloverMap overlays="all" />
      </Clover.Root>,
    );
    await waitFor(() => expect(drawn()).toBe(2), { timeout: 4000 });
  });

  it("links to Items of georeferences beside it, through the Root: pointing lights both, choosing goes to its Canvas", async () => {
    let root: any;
    const Spy = () => {
      root = Clover.useClover("test");
      return null;
    };
    render(
      <Clover.Root iiifContent={twoSheets()}>
        <Spy />
        <CloverMap overlays="all" items={false} />
        <Clover.Items of="georeferences" layout="list" />
      </Clover.Root>,
    );
    const [first, second] = await waitFor(
      () => {
        const options = screen.getAllByRole("option");
        expect(options).toHaveLength(2);
        return options;
      },
      { timeout: 4000 },
    );
    expect(first).toHaveAccessibleName("First sheet");
    // The sheet on the Canvas in view is the one selected; the map lists none of its own.
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("listbox", { name: "On the map" })).toBeNull();
    const [map] = maps;
    const outline = () =>
      map.sources["geomap-overlay-outline"]?.setData.mock.calls.at(-1)?.[0] ??
      map.sources["geomap-overlay-outline"]?.data;
    await waitFor(
      () =>
        expect(
          Object.values(map.sources).filter(
            (source: any) => source.type === "canvas",
          ),
        ).toHaveLength(2),
      { timeout: 4000 },
    );

    // Pointing at an item: the Root hears of it, and the map outlines it at half strength.
    fireEvent.mouseEnter(second);
    expect(root.clover.highlight.get()).toBe(SECOND_SHEET);
    await waitFor(() =>
      expect(outline().features).toContainEqual(
        expect.objectContaining({ properties: { hover: true } }),
      ),
    );
    fireEvent.mouseLeave(second);
    expect(root.clover.highlight.get()).toBeNull();

    // Pointing at a sheet on the map: its item lights.
    const [[west, south], [east, north]] = boundsOf(
      [],
      georeferencesOf(twoSheets()).slice(0, 1),
    )!;
    map.under = [];
    act(() =>
      map.fire("mousemove", {
        point: { x: 0, y: 0 },
        lngLat: { lng: (west + east) / 2, lat: (south + north) / 2 },
      }),
    );
    await waitFor(() =>
      expect(screen.getAllByRole("option")[0]).toHaveAttribute(
        "data-highlighted",
        "true",
      ),
    );
    act(() => map.fire("mouseout", {}));

    // Choosing one goes to its Canvas, which outlines it whole.
    fireEvent.click(second);
    await waitFor(() =>
      expect(root.clover.store.get().canvasId).toBe(`${DC_CANVAS_ID}/2`),
    );
    await waitFor(() =>
      expect(screen.getAllByRole("option")[1]).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
  });

  it("zooms to a sheet chosen in Items beside it, or pressed on the map, and opens its Canvas", async () => {
    let root: any;
    const Spy = () => {
      root = Clover.useClover("test");
      return null;
    };
    render(
      <Clover.Root iiifContent={twoSheets()}>
        <Spy />
        <CloverMap overlays="all" items={false} />
        <Clover.Items of="georeferences" layout="list" />
      </Clover.Root>,
    );
    const [, second] = await waitFor(
      () => {
        const options = screen.getAllByRole("option");
        expect(options).toHaveLength(2);
        return options;
      },
      { timeout: 4000 },
    );
    const [map] = maps;
    await waitFor(
      () =>
        expect(
          Object.values(map.sources).filter(
            (source: any) => source.type === "canvas",
          ),
        ).toHaveLength(2),
      { timeout: 4000 },
    );
    const [firstSheet, secondSheet] = georeferencesOf(twoSheets()).map(
      (sheet) => boundsOf([], [sheet])!,
    );
    // The box the map last framed, as near as rounding allows.
    const framedOn = (bounds: number[][]) =>
      bounds.every((corner, i) =>
        corner.every(
          (value, j) =>
            Math.abs(map.fitBounds.mock.calls.at(-1)?.[0]?.[i]?.[j] - value) <
            1e-9,
        ),
      );
    // It opens on every sheet, not the one in view.
    expect(framedOn(secondSheet)).toBe(false);

    // Chosen in Items: the view goes to its Canvas, and the map follows it there.
    fireEvent.click(second);
    await waitFor(() =>
      expect(root.clover.store.get().canvasId).toBe(`${DC_CANVAS_ID}/2`),
    );
    await waitFor(() => expect(framedOn(secondSheet)).toBe(true));

    // Pressed on the map: chosen as its row would be, framed, and its Canvas opened.
    const [[west, south], [east, north]] = firstSheet;
    map.under = [];
    act(() =>
      map.fire("click", {
        point: { x: 0, y: 0 },
        lngLat: { lng: (west + east) / 2, lat: (south + north) / 2 },
      }),
    );
    await waitFor(() =>
      expect(root.clover.store.get().canvasId).toBe(DC_CANVAS_ID),
    );
    expect(framedOn(firstSheet)).toBe(true);
    await waitFor(() =>
      expect(screen.getAllByRole("option")[0]).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );

    // The view moved on elsewhere: the sheet pressed on the map gives way to the view's,
    // the one sheet outlined whole.
    fireEvent.click(screen.getAllByRole("option")[1]);
    await waitFor(() =>
      expect(root.clover.store.get().canvasId).toBe(`${DC_CANVAS_ID}/2`),
    );
    const whole = () =>
      (
        map.sources["geomap-overlay-outline"]?.setData.mock.calls.at(-1)?.[0] ??
        map.sources["geomap-overlay-outline"]?.data
      ).features.filter((feature: any) => !feature.properties.hover);
    await waitFor(() => expect(whole()).toHaveLength(1));
    await waitFor(() => expect(framedOn(secondSheet)).toBe(true));
  });

  it("offers its outline options behind a gear where asked: Outlines draws every sheet's edge, Selection outline puts the accent's away", async () => {
    const { unmount: gone } = render(
      <Clover.Root iiifContent={twoSheets()}>
        <CloverMap overlays="all" />
      </Clover.Root>,
    );
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2), {
      timeout: 4000,
    });
    // Not offered by default.
    expect(
      screen.queryByRole("button", { name: "Expand map options" }),
    ).toBeNull();
    gone();
    maps.length = 0;

    render(
      <Clover.Root iiifContent={twoSheets()}>
        <CloverMap overlays="all" outlines />
      </Clover.Root>,
    );
    const gear = await screen.findByRole(
      "button",
      { name: "Expand map options" },
      { timeout: 4000 },
    );
    const [map] = maps;
    const edges = () =>
      map.sources["geomap-overlay-outlines"]?.setData.mock.calls.at(-1)?.[0] ??
      map.sources["geomap-overlay-outlines"]?.data;
    // Closed, its tray is out of sight and reach.
    expect(gear).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Outlines" })).toBeNull();

    // Open: the tray, named, holds Outlines; the gear is its close.
    fireEvent.click(gear);
    expect(gear).toHaveAttribute("aria-expanded", "true");
    expect(gear).toHaveAccessibleName("Collapse map options");
    const tray = screen.getByRole("group", { name: "Map options" });
    expect(gear).toHaveAttribute("aria-controls", tray.id);
    const toggle = within(tray).getByRole("button", { name: "Outlines" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(edges()).toBeUndefined();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(edges().features).toHaveLength(2));
    // Over the images, under the outline of those chosen.
    const order = map.layers.map((layer) => layer.id);
    expect(order.indexOf("geomap-overlay-outlines")).toBeLessThan(
      order.indexOf("geomap-overlay-outline"),
    );

    // Selection outline, on to start: pressed, the accent's ring round the one chosen goes.
    const selection = within(tray).getByRole("button", {
      name: "Selection outline",
    });
    expect(selection).toHaveAttribute("aria-pressed", "true");
    const whole = () =>
      (
        map.sources["geomap-overlay-outline"]?.setData.mock.calls.at(-1)?.[0] ??
        map.sources["geomap-overlay-outline"]?.data
      ).features.filter((feature: any) => !feature.properties.hover);
    await waitFor(() => expect(whole()).toHaveLength(1));
    fireEvent.click(selection);
    expect(selection).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(whole()).toHaveLength(0));
    fireEvent.click(selection);
    await waitFor(() => expect(whole()).toHaveLength(1));

    // Escape in the tray: the first puts the focused option's Tip away, the next closes
    // the tray, focus to the gear; the outlines stay (one Escape closes one thing).
    toggle.focus();
    fireEvent.keyDown(toggle, { key: "Escape" });
    expect(gear).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(toggle, { key: "Escape" });
    expect(gear).toHaveAttribute("aria-expanded", "false");
    expect(gear).toHaveFocus();
    expect(edges().features).toHaveLength(2);

    // Pressed again, they are put away.
    fireEvent.click(gear);
    fireEvent.click(screen.getByRole("button", { name: "Outlines" }));
    await waitFor(() => expect(edges().features).toHaveLength(0));
  });

  it("lays every sheet where georeference annotations are the content, the one in view outlined", async () => {
    let root: any;
    const Spy = () => {
      root = Clover.useClover("test");
      return null;
    };
    const { unmount: gone } = render(
      <Clover.Root iiifContent={sanbornPage}>
        <Spy />
        <CloverMap items={false} />
      </Clover.Root>,
    );
    await waitFor(() => expect(maps[0]?.fitBounds).toHaveBeenCalled(), {
      timeout: 4000,
    });
    const sheets = georeferencesOf(root.clover.store.get().manifest);
    expect(sheets).toHaveLength(sanbornPage.items.length);
    const framed = () => maps.at(-1)!.fitBounds.mock.calls[0][0];
    // Framed on them all, not the view's one.
    expect(framed()).toEqual(boundsOf([], sheets));
    const outline = () =>
      maps
        .at(-1)!
        .sources["geomap-overlay-outline"]?.setData.mock.calls.at(-1)?.[0] ??
      maps.at(-1)!.sources["geomap-overlay-outline"]?.data;
    await waitFor(() => expect(outline().features).toHaveLength(1));
    gone();

    // Asked for the view's, the view's.
    render(
      <Clover.Root iiifContent={sanbornPage}>
        <CloverMap items={false} overlays="view" />
      </Clover.Root>,
    );
    await waitFor(() => expect(maps.at(-1)!.fitBounds).toHaveBeenCalled(), {
      timeout: 4000,
    });
    expect(framed()).toEqual(boundsOf([], sheets.slice(0, 1)));
  });

  it("warps a georeferenced image onto the map by its control points", async () => {
    render(<CloverMap georeferences={[georeferenceOnService()]} />);
    await waitFor(() => expect(maps).toHaveLength(1));
    const [map] = maps;
    // The overlay's warp loads on demand: past a second on CI and under the whole suite.
    await waitFor(
      () =>
        expect(
          Object.values(map.sources).find((source) => source.type === "canvas"),
        ).toBeTruthy(),
      { timeout: 4000 },
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
    expect(
      await screen.findByRole("option", { name: "Place 1" }),
    ).toBeInTheDocument();
  });

  it("draws a popup as Clover's popover, over MapLibre's unlayered white", () => {
    // Layered (`dist`), only `!important` beats MapLibre's own `background: #fff`.
    const css = readFileSync(resolve(__dirname, "Map.css"), "utf8");
    expect(css).toMatch(
      /\.clover-geomap-popup \.maplibregl-popup-content \{[^}]*background-color: var\(--clover-color-primary, #1a1d1e\) !important;[^}]*color: var\(--clover-color-secondary, #fff\);/,
    );
    // No arrow, as a hotspot's popover has none.
    expect(css).toMatch(
      /\.clover-geomap-popup \.maplibregl-popup-tip \{[^}]*display: none !important;/,
    );
    // The page's type, over MapLibre's own on the map.
    expect(css).toMatch(
      /\.clover-geomap \.maplibregl-map \{[^}]*font: inherit !important;/,
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
      await screen.findByRole("option", {
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

const SECOND_SHEET = "https://example.org/evanston/georef/2";

/**
 * The township map twice over, as an atlas of two sheets: two Canvases, each with its own
 * georeference on the same image, named apart, the second laid a degree east.
 */
function twoSheets() {
  const manifest = JSON.parse(JSON.stringify(evanston())) as any;
  const [canvas] = manifest.items;
  canvas.label = { en: ["First sheet"] };
  const second = JSON.parse(JSON.stringify(canvas));
  second.id = `${DC_CANVAS_ID}/2`;
  second.label = { en: ["Second sheet"] };
  for (const page of second.annotations ?? [])
    for (const annotation of page.items ?? []) {
      annotation.id = SECOND_SHEET;
      delete annotation.label;
      // A degree east, so the two sheets lie apart.
      for (const body of [annotation.body].flat())
        for (const feature of body?.features ?? [])
          feature.geometry.coordinates[0] += 1;
    }
  for (const page of second.items ?? [])
    for (const annotation of page.items ?? []) {
      annotation.id = `${annotation.id}/2`;
      annotation.target = second.id;
    }
  manifest.items = [canvas, second];
  return manifest;
}

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
