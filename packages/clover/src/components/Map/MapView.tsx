import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useUniqueId } from "../../ui/useUniqueId";

import { DEFAULT_STYLE_URL, applyDefaultBasemap } from "./basemap";
import {
  type Georeference,
  type MapFeature,
  type MapFeatureCollection,
  boundsOf,
  cornersOf,
  georeferencesOf,
  navPlaceOf,
  overlayImageUrl,
  type Position,
  readGeoreference,
} from "../../core/geo";
import type { IIIFContent } from "../../core/load";
import { type CloverRequest, sendsCredentials } from "../../core/request";
import { selectVisibleCanvases } from "../../core/selectors";
import { localize } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import {
  useOptionalClover,
  useOptionalCloverSelector,
} from "../../react/context";
import { HostLanguageContext } from "../../i18n/hostLanguage";
import { useRootLanguage } from "../../react/language";
import { getMapWorkerUrl } from "../../core/map-config";

export interface MapProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "onSelect"> {
  /**
   * Standalone: a IIIF resource (URL or object) to map: its navPlace, and its Canvases'
   * georeferenced images. Inside a `Root`, leave it out to map the Root's.
   */
  iiifContent?: IIIFContent;
  /** GeoJSON to draw (a FeatureCollection, Feature or geometry), as navPlace is. */
  navPlace?: unknown;
  /** Georeference Extension annotations to overlay, on a Canvas or an image service. */
  georeferences?: unknown[];
  /** Draw georeferenced images over the basemap. Default true. */
  overlay?: boolean;
  /** The overlays' opacity, 0 to 1. Default 0.75. */
  overlayOpacity?: number;
  /** A MapLibre style URL, used as it is. Default: Clover's relief basemap (OpenFreeMap). */
  styleUrl?: string;
  /**
   * Where MapLibre's worker is served from, if your bundler moves MapLibre's files (see
   * the Map docs). By default MapLibre finds its own.
   */
  workerUrl?: string;
  /** Zoom with the wheel or trackpad. Default false, so an embedded map never traps page scroll. */
  scrollZoom?: boolean;
  /**
   * A place was chosen, on the map or in its list. Inside a `Root`, choosing one on a
   * Canvas also goes there.
   */
  onSelect?: (feature: MapFeature) => void;
  /** Standalone: credentials, headers and `fetch`. */
  request?: CloverRequest;
  /** Standalone: the language to read IIIF text in. */
  language?: string;
  as?: React.ElementType;
}

export type Forwarded = { forwardedRef: React.ForwardedRef<HTMLElement> };

/**
 * The Root's map, for a panel tab: the Root's places and the view's overlays. Its module
 * imports no `Root`, so a lazy chunk of it shares nothing a standalone Canvas loads.
 */
export const RootMap = forwardRef<
  HTMLElement,
  Omit<
    MapProps,
    "iiifContent" | "navPlace" | "georeferences" | "request" | "language"
  >
>(function RootMap(props, ref) {
  // Its panel's section is the landmark, under the same name: the map is not another.
  return (
    <ConnectedMap {...props} scope="view" landmark={false} forwardedRef={ref} />
  );
});

/** The Root's places, and the overlays of the view (or, standalone, every Canvas). */
export function ConnectedMap({
  scope,
  onSelect,
  ...rest
}: Omit<MapProps, "iiifContent" | "request" | "language"> &
  Forwarded & { scope: "view" | "all"; landmark?: boolean }) {
  const context = useOptionalClover()!;
  const features = useOptionalCloverSelector(
    (state) => navPlaceOf(state.manifest, state.collection, context.language),
    navPlaceOf(null),
  );
  const all = useOptionalCloverSelector(
    (state) => georeferencesOf(state.manifest),
    NONE,
  );
  const shown = useOptionalCloverSelector(
    (state) => selectVisibleCanvases(state.manifest, state.canvasId),
    NO_CANVASES,
  );
  // The same array while the view holds, so the map is not re-framed under the reader.
  const overlays = useMemo(
    () =>
      scope === "all"
        ? all
        : all.filter((overlay) =>
            shown.some((canvas) => canvas.id === overlay.canvasId),
          ),
    [scope, all, shown],
  );
  // Only a view's Canvases are current: standalone, nothing shows the Root's first one.
  const current = useMemo(
    () => (scope === "view" ? shown.map((canvas) => canvas.id) : undefined),
    [scope, shown],
  );
  return (
    <MapView
      {...rest}
      features={features}
      overlays={overlays}
      current={current}
      language={context.language}
      request={context.clover.request}
      onSelect={(feature) => {
        onSelect?.(feature);
        const canvasId = feature.properties.canvasId;
        if (canvasId) context.clover.goTo(canvasId);
      }}
    />
  );
}

const NONE: Georeference[] = [];
const NO_CANVASES: ReturnType<typeof selectVisibleCanvases> = [];
const NO_IDS: ReadonlySet<string> = new Set();

/** GeoJSON and annotations handed in, with no Root to read. */
export function GivenMap({
  navPlace,
  georeferences,
  ...rest
}: Omit<MapProps, "iiifContent" | "request" | "language"> & Forwarded) {
  const features = useGiven(navPlace, (value) =>
    navPlaceOf(
      {
        id: "geomap:given",
        type: "Manifest",
        navPlace: value,
        items: [],
      } as never,
      null,
    ),
  );
  const overlays = useGiven(georeferences, (value) =>
    ((value as unknown[]) ?? [])
      .map((annotation) => readGeoreference(annotation as never))
      .filter((overlay): overlay is Georeference => Boolean(overlay)),
  );
  return <MapView {...rest} features={features} overlays={overlays} />;
}

/** A value read from a prop, recomputed only when the prop's identity changes. */
function useGiven<T>(value: unknown, read: (value: unknown) => T): T {
  const memo = useRef<{ value: unknown; result: T } | null>(null);
  if (!memo.current || memo.current.value !== value) {
    memo.current = { value, result: read(value) };
  }
  return memo.current.result;
}

/** Longer side, in pixels, of the image an overlay draws. */
const OVERLAY_SIZE = 2048;

/** The zoom a lone point is framed at. */
const POINT_ZOOM = 8;

const NAVPLACE = "geomap-navplace";
const FILL = "geomap-navplace-fill";
const LINE = "geomap-navplace-line";
const CASING = "geomap-navplace-casing";
const POINT = "geomap-navplace-point";
const CLICKABLE = [FILL, LINE, POINT];

interface ViewProps
  extends Omit<
      MapProps,
      "iiifContent" | "navPlace" | "georeferences" | "language"
    >,
    Forwarded {
  features: MapFeatureCollection;
  overlays: Georeference[];
  /** The Canvases in view: their places are the current ones. */
  current?: string[];
  /** The language to name overlays in. */
  language?: string;
  /** A region of its own. Default true; false in a panel, whose section is one. */
  landmark?: boolean;
}

function MapView({
  features,
  overlays,
  current,
  language,
  landmark = true,
  overlay = true,
  overlayOpacity = 0.75,
  styleUrl,
  workerUrl,
  scrollZoom = false,
  onSelect,
  request,
  forwardedRef,
  as: Tag = "div",
  className,
  style,
  ...rest
}: ViewProps) {
  const { t } = useCloverTranslation();
  const aboutId = useUniqueId();
  // Outside a Root, the map reads the page's language itself, for its strings to mark.
  const root = useRootLanguage(forwardedRef, rest.lang);
  const { langOf } = root;
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  // The overlays on the map, by id, once their images are drawn.
  const [drawnIds, setDrawnIds] = useState<ReadonlySet<string>>(NO_IDS);
  const latest = useRef({ onSelect, t });
  latest.current = { onSelect, t };
  // Names a place in a popup at a point, once MapLibre is up.
  const name = useRef<((feature: MapFeature, at: unknown) => void) | null>(
    null,
  );
  // The extent last framed.
  const framed = useRef("");

  // MapLibre, loaded and started once.
  useEffect(() => {
    let live = true;
    let instance: any = null;
    let observer: ResizeObserver | null = null;
    import("maplibre-gl")
      .then((module) => {
        // ES builds export `Map` by name; a CommonJS interop may wrap it in `default`.
        const maplibre: any =
          "Map" in module ? module : (module as any).default;
        if (!live || !container.current) return;
        const worker = workerUrl ?? getMapWorkerUrl();
        if (worker) maplibre.setWorkerUrl(worker);
        const { t } = latest.current;
        instance = new maplibre.Map({
          container: container.current,
          style: styleUrl ?? DEFAULT_STYLE_URL,
          center: [0, 20],
          zoom: 1,
          maxPitch: 0,
          dragRotate: false,
          scrollZoom,
          attributionControl: { compact: true },
          // MapLibre's own names, in Clover's words; kept current below.
          locale: {
            "Map.Title": t("mapLabel"),
            "NavigationControl.ZoomIn": t("imageZoomIn"),
            "NavigationControl.ZoomOut": t("imageZoomOut"),
            "AttributionControl.ToggleAttribution": t("mapAttribution"),
          },
        });
        if (!landmark) instance.getCanvas().setAttribute("role", "group");
        instance.addControl(
          new maplibre.NavigationControl({ showCompass: false }),
          "top-right",
        );
        instance.on("load", () => {
          if (!live) return;
          if (!styleUrl) applyDefaultBasemap(instance);
          // Credits behind their ⓘ, so they do not cover a small map; one press away.
          // Closed as well as hidden, so the toggle says it is collapsed.
          const attrib = container.current?.querySelector(
            ".maplibregl-ctrl-attrib",
          );
          attrib?.classList.remove("maplibregl-compact-show");
          attrib?.removeAttribute("open");
          addPlaceLayers(instance, accentOf(container.current));
          let popup: any = null;
          name.current = (feature, at) => {
            popup?.remove();
            popup = null;
            const title = feature.properties?.title;
            if (!title) return;
            // Text in a span, never markup, so the title can carry its language.
            const text = document.createElement("span");
            text.textContent = String(title);
            const lang = feature.properties?.titleLang;
            if (lang !== undefined) text.lang = String(lang);
            popup = new maplibre.Popup({
              closeButton: false,
              offset: 8,
              className: "clover-geomap-popup",
            })
              .setLngLat(at)
              .setDOMContent(text)
              .addTo(instance);
          };
          for (const layer of CLICKABLE) {
            instance.on("click", layer, (event: any) => {
              const feature = event.features?.[0] as MapFeature | undefined;
              if (!feature) return;
              name.current?.(feature, event.lngLat);
              latest.current.onSelect?.(feature);
            });
            instance.on("mouseenter", layer, () => {
              instance.getCanvas().style.cursor = "pointer";
            });
            instance.on("mouseleave", layer, () => {
              instance.getCanvas().style.cursor = "";
            });
          }
          setMap(instance);
        });
        // A map in a tab or panel is sized late: keep MapLibre's canvas in step.
        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() => instance?.resize());
          observer.observe(container.current);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
      observer?.disconnect();
      instance?.remove();
      name.current = null;
      framed.current = "";
      setMap(null);
    };
    // Style, worker and wheel are read once: a new map would be a new viewer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The places.
  useEffect(() => {
    map?.getSource(NAVPLACE)?.setData(features);
  }, [map, features]);

  // What the list names: every place, and each overlay drawn.
  const listed = overlay
    ? overlays.filter((item) => drawnIds.has(item.id))
    : NONE;
  const count = features.features.length + listed.length;
  const described = count > 0;

  // MapLibre's canvas is the map's one region (in a panel, a group in its section's):
  // named in the reader's language, and described by how many places follow it.
  useEffect(() => {
    if (!map) return;
    const canvas = map.getCanvas();
    canvas.setAttribute("role", landmark ? "region" : "group");
    // Each name carries its language where it is not the page's (WCAG 3.1.2).
    const mark = (element: Element, lang: string | undefined) => {
      if (lang === undefined) element.removeAttribute("lang");
      else element.setAttribute("lang", lang);
    };
    canvas.setAttribute("aria-label", t("mapLabel"));
    mark(canvas, langOf("mapLabel"));
    if (described) canvas.setAttribute("aria-describedby", aboutId);
    else canvas.removeAttribute("aria-describedby");
    const rename = (selector: string, key: string) => {
      const control = container.current?.querySelector(selector);
      if (!control) return;
      control.setAttribute("aria-label", t(key));
      if (control.hasAttribute("title")) control.setAttribute("title", t(key));
      mark(control, langOf(key));
    };
    rename(".maplibregl-ctrl-zoom-in", "imageZoomIn");
    rename(".maplibregl-ctrl-zoom-out", "imageZoomOut");
    rename(".maplibregl-ctrl-attrib-button", "mapAttribution");
    // The credits are the basemap's: English for Clover's own, unknown for yours.
    const credits = container.current?.querySelector(
      ".maplibregl-ctrl-attrib-inner",
    );
    if (credits) mark(credits, styleUrl ? undefined : "en");
  }, [map, t, langOf, described, aboutId, landmark, styleUrl]);

  // The overlays: one canvas source each, under the places.
  const drawn = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!map) return;
    let live = true;
    const wanted = overlay ? overlays : [];
    const ids = new Set(wanted.map((item) => item.id));
    for (const [id, layer] of Object.entries(drawn.current)) {
      if (ids.has(id)) continue;
      if (map.getLayer(layer)) map.removeLayer(layer);
      if (map.getSource(layer)) map.removeSource(layer);
      delete drawn.current[id];
    }
    setDrawnIds((before) =>
      [...before].every((id) => ids.has(id))
        ? before
        : new Set([...before].filter((id) => ids.has(id))),
    );
    wanted.forEach((item, index) => {
      if (drawn.current[item.id]) return;
      const layer = `geomap-overlay-${index}-${hash(item.id)}`;
      drawn.current[item.id] = layer;
      void drawOverlay(item, request).then((canvas) => {
        if (!live || !canvas || drawn.current[item.id] !== layer) return;
        const corners = cornersOf(item);
        if (!corners || map.getSource(layer)) return;
        map.addSource(layer, {
          type: "canvas",
          canvas,
          coordinates: corners,
          animate: false,
        });
        map.addLayer(
          {
            id: layer,
            type: "raster",
            source: layer,
            paint: {
              "raster-opacity": overlayOpacity,
              "raster-fade-duration": 0,
            },
          },
          map.getLayer(FILL) ? FILL : undefined,
        );
        setDrawnIds((before) => new Set(before).add(item.id));
      });
    });
    return () => {
      live = false;
    };
    // `overlayOpacity` is applied below without redrawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, overlays, overlay, request]);

  useEffect(() => {
    if (!map) return;
    for (const layer of Object.values(drawn.current)) {
      if (map.getLayer(layer)) {
        map.setPaintProperty(layer, "raster-opacity", overlayOpacity);
      }
    }
  }, [map, overlayOpacity]);

  // Frame what there is, once for each extent: a place chosen stays framed when the
  // view it opens draws nothing new.
  useEffect(() => {
    if (!map) return;
    const bounds = boundsOf(features.features, overlay ? overlays : []);
    if (!bounds) return;
    const extent = bounds.flat().join();
    if (extent === framed.current) return;
    framed.current = extent;
    frame(map, bounds, POINT_ZOOM);
  }, [map, features, overlays, overlay]);

  // A place from the list: framed and named as on the map, then chosen.
  const choose = (feature: MapFeature) => {
    const bounds = boundsOf([feature]);
    if (map && bounds) {
      frame(map, bounds, Math.max(map.getZoom(), POINT_ZOOM));
      name.current?.(feature, center(bounds));
    }
    onSelect?.(feature);
  };
  const show = (item: Georeference) => {
    const bounds = boundsOf([], [item]);
    if (map && bounds) frame(map, bounds, POINT_ZOOM);
  };

  return (
    <HostLanguageContext.Provider value={root.hostLanguage}>
      <Tag
        ref={root.ref}
        className={join("clover-geomap", className)}
        data-status={failed ? "error" : map ? "ready" : "loading"}
        style={style}
        {...rest}
      >
        {/* Functional: the map needs a box to draw in, with or without the stylesheet. */}
        <div
          style={{
            position: "relative",
            height: "var(--clover-map-height, 24rem)",
          }}
        >
          <div
            ref={container}
            className="clover-geomap-canvas"
            style={{ position: "absolute", inset: 0 }}
          />
          {failed && (
            <p
              className="clover-geomap-error"
              role="alert"
              lang={langOf("mapUnavailable")}
            >
              {t("mapUnavailable")}
            </p>
          )}
        </div>
        {described && (
          <>
            {/* The map's description: a count, not the names, which the list reads next. */}
            <span id={aboutId} hidden lang={langOf("mapPlacesListed")}>
              {t("mapPlacesListed", { count })}
            </span>
            {/* What the map shows, as text, and the keyboard's way to each place. */}
            <ul className="clover-geomap-places">
              {features.features.map((feature, index) => {
                const { title, titleLang, canvasId } = feature.properties;
                return (
                  <li key={`place-${index}`}>
                    <button
                      type="button"
                      lang={title ? titleLang : langOf("mapPlaceUntitled")}
                      aria-current={
                        canvasId && current?.includes(canvasId)
                          ? "true"
                          : undefined
                      }
                      onClick={() => choose(feature)}
                    >
                      {title || t("mapPlaceUntitled", { number: index + 1 })}
                    </button>
                  </li>
                );
              })}
              {listed.map((item) => {
                const label = localize(item.label, language);
                return (
                  <li key={item.id}>
                    <button type="button" onClick={() => show(item)}>
                      {label.text && (
                        <>
                          <span lang={label.lang}>{label.text}</span>{" "}
                        </>
                      )}
                      <span lang={langOf("mapOverlay")}>{t("mapOverlay")}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Tag>
    </HostLanguageContext.Provider>
  );
}

/** Frame a box: a lone point centered at `zoom`, anything else to its bounds. */
function frame(map: any, bounds: [Position, Position], zoom: number) {
  const [[west, south], [east, north]] = bounds;
  if (west === east && south === north) {
    map.jumpTo({ center: [west, south], zoom });
  } else {
    map.fitBounds(bounds, { padding: 32, maxZoom: 12, duration: 0 });
  }
}

/** The middle of a box. */
function center([[west, south], [east, north]]: [Position, Position]) {
  return [(west + east) / 2, (south + north) / 2];
}

/** The accent token, resolved: MapLibre paints with WebGL, which cannot read `var()`. */
function accentOf(element: Element | null): string {
  const value = element
    ? getComputedStyle(element).getPropertyValue("--clover-color-accent").trim()
    : "";
  return value || "#0065c3";
}

/** The places' source and layers: areas, lines and points, honouring simplestyle. */
function addPlaceLayers(map: any, color: string) {
  map.addSource(NAVPLACE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: FILL,
    type: "fill",
    source: NAVPLACE,
    filter: [
      "match",
      ["geometry-type"],
      ["Polygon", "MultiPolygon"],
      true,
      false,
    ],
    paint: {
      "fill-color": ["coalesce", ["get", "fill"], color],
      "fill-opacity": ["coalesce", ["get", "fill-opacity"], 0.18],
    },
  });
  const lines = [
    "match",
    ["geometry-type"],
    ["LineString", "MultiLineString", "Polygon", "MultiPolygon"],
    true,
    false,
  ];
  // A white casing under each line and outline, as points have a white ring, so the
  // accent holds its contrast over water, relief or a scan.
  map.addLayer({
    id: CASING,
    type: "line",
    source: NAVPLACE,
    filter: lines,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#ffffff",
      "line-width": ["+", ["coalesce", ["get", "stroke-width"], 2], 2],
      "line-opacity": ["coalesce", ["get", "stroke-opacity"], 1],
    },
  });
  map.addLayer({
    id: LINE,
    type: "line",
    source: NAVPLACE,
    filter: lines,
    paint: {
      "line-color": ["coalesce", ["get", "stroke"], color],
      "line-width": ["coalesce", ["get", "stroke-width"], 2],
      "line-opacity": ["coalesce", ["get", "stroke-opacity"], 1],
    },
  });
  map.addLayer({
    id: POINT,
    type: "circle",
    source: NAVPLACE,
    filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
    paint: {
      "circle-radius": 6,
      "circle-color": ["coalesce", ["get", "marker-color"], color],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });
}

/**
 * An overlay's picture: the image (about 2048 px), clipped to its mask, on a canvas for
 * MapLibre's canvas source. Null if the image will not load (or, without CORS, cannot be
 * drawn into WebGL).
 */
async function drawOverlay(
  overlay: Georeference,
  request: CloverRequest | undefined,
): Promise<HTMLCanvasElement | null> {
  const url = overlayImageUrl(overlay.image, OVERLAY_SIZE);
  if (!url) return null;
  const image = await new Promise<HTMLImageElement | null>((done) => {
    const element = new Image();
    element.crossOrigin = sendsCredentials(request)
      ? "use-credentials"
      : "anonymous";
    element.onload = () => done(element);
    element.onerror = () => done(null);
    element.src = url;
  });
  if (!image?.naturalWidth) return null;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;
  if (overlay.mask) {
    const sx = canvas.width / overlay.width;
    const sy = canvas.height / overlay.height;
    context.beginPath();
    overlay.mask.forEach(([x, y], index) =>
      index ? context.lineTo(x * sx, y * sy) : context.moveTo(x * sx, y * sy),
    );
    context.closePath();
    context.clip();
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** A short, stable token for an id, for a layer name. */
function hash(text: string): string {
  let value = 0;
  for (let i = 0; i < text.length; i++) {
    value = (value * 31 + text.charCodeAt(i)) | 0;
  }
  return (value >>> 0).toString(36);
}
