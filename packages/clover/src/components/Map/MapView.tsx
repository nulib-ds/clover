import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { useNearViewport } from "../Body/useNearViewport";
import { directionOf, languageProps } from "../../core/direction";
import { Tip } from "../../ui/Tip";
import { NavDate } from "../../ui/NavDate";
import { formatNavDate, navDateTime, readNavDate } from "../../core/nav-date";
import { cloverI18n, langWithin } from "../../i18n/config";

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
   * Where MapLibre's worker is served from, to serve your own (see the Map docs). By
   * default Clover brings it, from a `blob:` URL.
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
  /**
   * The basemap's credits, behind an ⓘ in the map's lower corner. Default true. A basemap's license
   * may ask for its credits: give them on the page yourself before setting this false.
   */
  credits?: boolean;
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
  // The annotations pointed at and picked, as the Canvas's hotspots show them.
  const picked = useOptionalCloverSelector((state) => state.annotationId, null);
  const highlighted = React.useSyncExternalStore(
    context.clover.highlight.subscribe,
    context.clover.highlight.get,
    context.clover.highlight.get,
  );
  const active = useMemo(
    () =>
      [picked, highlighted].filter(
        (id): id is string => typeof id === "string",
      ),
    [picked, highlighted],
  );
  // Only a view's Canvases are current, with the member open among its Collection's:
  // standalone, nothing shows the Root's first one.
  const manifestId = useOptionalCloverSelector(
    (state) => state.manifest?.id ?? null,
    null,
  );
  const current = useMemo(
    () =>
      scope === "view"
        ? [
            ...shown.map((canvas) => canvas.id),
            ...(manifestId ? [manifestId] : []),
          ]
        : undefined,
    [scope, shown, manifestId],
  );
  return (
    <MapView
      {...rest}
      features={features}
      overlays={overlays}
      current={current}
      activeAnnotations={active}
      onHighlight={(feature) =>
        context.clover.highlight.emit(feature?.properties.annotationId ?? null)
      }
      language={context.language}
      request={context.clover.request}
      onSelect={(feature) => {
        onSelect?.(feature);
        // An annotation's place: the annotation, so its region is framed (Cookbook 0139).
        // One the annotations do not list (it has no name): its Canvas, as before.
        const {
          annotationId,
          canvasId,
          manifestId: member,
        } = feature.properties;
        // Another member's place: that member, as its row in the Collection opens it.
        if (member && member !== context.clover.store.get().manifest?.id) {
          void context.clover.goToManifest(member);
          return;
        }
        if (annotationId) context.clover.selectAnnotation(annotationId);
        const selected =
          annotationId !== undefined &&
          context.clover.store.get().annotationId === annotationId;
        if (!selected && canvasId) context.clover.goTo(canvasId);
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
}: Omit<MapProps, "iiifContent" | "request" | "language"> &
  Forwarded & {
    /** A region of its own; false inside a box that names it (`Canvas/PlaceBox`). */
    landmark?: boolean;
    language?: string;
    /** Its places listed under it; false where what holds it names its one place. */
    list?: boolean;
  }) {
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
const ACCENT = "geomap-navplace-accent";
const POINT = "geomap-navplace-point";
const POINT_EDGE = "geomap-navplace-point-edge";
const POINT_HIT = "geomap-navplace-point-hit";
const CLICKABLE = [FILL, CASING, LINE, POINT_HIT, POINT];

interface ViewProps
  extends Omit<
      MapProps,
      "iiifContent" | "navPlace" | "georeferences" | "language"
    >,
    Forwarded {
  features: MapFeatureCollection;
  overlays: Georeference[];
  /** The Canvases in view, and the Manifest open among its Collection's: their places are the current ones. */
  current?: string[];
  /** The language to name overlays in. */
  language?: string;
  /** A region of its own. Default true; false in a panel, whose section is one. */
  landmark?: boolean;
  /** The annotations pointed at or picked beside it: their places show active. */
  activeAnnotations?: string[];
  /**
   * Its places listed under it, the map's text and the keyboard's way to each. Default
   * true; false where what holds the map names its one place (`Canvas/PlaceBox`).
   */
  list?: boolean;
  /** The place pointed at on the map, and null as the pointer leaves the places. */
  onHighlight?: (feature: MapFeature | null) => void;
}

function MapView({
  features,
  overlays,
  current,
  activeAnnotations,
  onHighlight,
  list = true,
  credits = true,
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
  /*
   * MapLibre (290 kB) loads only as the map comes within half a screen of view, as a
   * Canvas's images do: a map far down a page, or in a tab not yet open, loads none.
   */
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const near = useNearViewport(box);
  const [map, setMap] = useState<any>(null);
  // MapLibre's controls, each with Clover's popover in it.
  const [tips, setTips] = useState<{ element: Element; key: string }[]>([]);
  const [failed, setFailed] = useState(false);
  // The overlays on the map, by id, once their images are drawn.
  const [drawnIds, setDrawnIds] = useState<ReadonlySet<string>>(NO_IDS);
  const latest = useRef({
    onSelect,
    onHighlight,
    t,
    features,
    host: root.hostLanguage,
  });
  latest.current = {
    onSelect,
    onHighlight,
    t,
    features,
    host: root.hostLanguage,
  };
  // Names a place in a popup at a point, once MapLibre is up.
  const name = useRef<((feature: MapFeature, at: unknown) => void) | null>(
    null,
  );
  // Reads new places: what was named, pointed at or picked among the old ones let go.
  const reread = useRef<((next: MapFeatureCollection) => void) | null>(null);
  // The extent last framed.
  const framed = useRef("");

  // MapLibre, loaded and started once, near the window.
  useEffect(() => {
    if (!near) return;
    let live = true;
    let instance: any = null;
    let observer: ResizeObserver | null = null;
    // Its listener on the page for Escape, let go with the map.
    let letGo: (() => void) | null = null;
    // MapLibre and its worker together: a page that sets no worker gets Clover's.
    Promise.all([import("maplibre-gl"), import("./worker")])
      .then(([module, bundled]) => {
        // ES builds export `Map` by name; a CommonJS interop may wrap it in `default`.
        const maplibre: any =
          "Map" in module ? module : (module as any).default;
        if (!live || !container.current) return;
        const worker =
          workerUrl ??
          getMapWorkerUrl() ??
          bundled.bundledWorkerUrl(maplibre.getVersion?.());
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
          // Its credits behind their ⓘ, in the lower corner; none where left out.
          attributionControl: credits ? { compact: true } : false,
          // MapLibre's own names, in Clover's words; kept current below.
          locale: {
            "Map.Title": t("mapLabel"),
            "NavigationControl.ZoomIn": t("imageZoomIn"),
            "NavigationControl.ZoomOut": t("imageZoomOut"),
            "AttributionControl.ToggleAttribution": t("mapAttribution"),
          },
        });
        if (!landmark) instance.getCanvas().setAttribute("role", "group");
        // Zoom in and out in a row at its lower left, the credits' ⓘ at its lower right
        // (Mat, 2026-10-29: "move these controls to bottom left. align them
        // horizontally").
        instance.addControl(
          new maplibre.NavigationControl({ showCompass: false }),
          "bottom-left",
        );
        instance.on("load", () => {
          if (!live) return;
          if (!styleUrl) applyDefaultBasemap(instance);
          /*
           * Credits behind their ⓘ, one press away, as the Canvas's information is: closed
           * as well as hidden, so the toggle says it is collapsed.
           */
          const attrib = container.current?.querySelector(
            ".maplibregl-ctrl-attrib",
          );
          attrib?.classList.remove("maplibregl-compact-show");
          attrib?.removeAttribute("open");
          addPlaceLayers(instance, colorsOf(container.current));
          /*
           * A place's name, as a hotspot's on the Canvas names it (`ui/Tip.css`, "A
           * hotspot's"): the popover's look, no arrow, hung `xs` off the side of the place
           * with more room, below or above, centered on it and kept `xs` inside the map as
           * it moves. Shown while the pointer is over the place; the one picked (pressed,
           * or chosen from the list) stays named until another is pointed at, a press off
           * the places, or Escape (WCAG 1.4.13).
           */
          let popup: any = null;
          let picked: MapFeature | null = null;
          let shown = "";
          // Which place is pointed at, and which picked, by its place in the data.
          let hovered: number | undefined;
          let pickedId: number | undefined;
          const idOf = (feature: MapFeature) =>
            typeof feature.id === "number" && feature.id >= 0
              ? feature.id
              : latest.current.features.features.indexOf(feature);
          const mark = (id: number | undefined, key: string, on: boolean) => {
            if (id !== undefined && id >= 0)
              instance.setFeatureState?.(
                { source: NAVPLACE, id },
                { [key]: on },
              );
          };
          const pick = (feature: MapFeature | null) => {
            mark(pickedId, "picked", false);
            pickedId = feature ? idOf(feature) : undefined;
            mark(pickedId, "picked", true);
          };
          const keyOf = (feature: MapFeature) =>
            JSON.stringify(feature.properties ?? {});
          const gap = () =>
            0.382 *
            (parseFloat(getComputedStyle(document.documentElement).fontSize) ||
              16);
          const unname = () => {
            popup?.remove();
            popup = null;
            shown = "";
          };
          const show = (feature: MapFeature) => {
            if (shown === keyOf(feature) && popup) return;
            unname();
            const title = feature.properties?.title;
            const bounds = boundsOf([feature]);
            if (!title || !bounds) return;
            // Text in a span, never markup, so the title can carry its language.
            const text = document.createElement("span");
            text.textContent = String(title);
            const lang = feature.properties?.titleLang;
            const marked = (element: HTMLElement, tag: string | undefined) => {
              if (tag === undefined) return;
              element.lang = tag;
              const dir = directionOf(tag);
              if (dir) element.dir = dir;
            };
            const nameLang = lang === undefined ? undefined : String(lang);
            marked(text, nameLang);
            // Its owner's date under it, as the list gives it (Cookbook 0318), marked
            // where its language is not the name's.
            const date = readNavDate(feature.properties?.navDate);
            if (date) {
              const locale = cloverI18n.language;
              const time = document.createElement("time");
              time.className = "clover-geomap-popup-date";
              time.dateTime = navDateTime(
                date,
                String(feature.properties.navDate),
              );
              time.textContent = formatNavDate(date, locale);
              marked(time, langWithin(locale, nameLang ?? latest.current.host));
              text.append(time);
            }
            const [[west, south], [east, north]] = bounds;
            const middle = (west + east) / 2;
            const room = instance.getContainer?.()?.clientHeight ?? 0;
            const top = instance.project?.([middle, north])?.y ?? 0;
            const foot = instance.project?.([middle, south])?.y ?? 0;
            const below = room - foot >= top;
            const away = gap();
            hangs = below ? away : -away;
            popup = new maplibre.Popup({
              closeButton: false,
              closeOnClick: false,
              anchor: below ? "top" : "bottom",
              offset: [0, hangs],
              maxWidth: "none",
              className: "clover-geomap-popup",
            })
              .setLngLat(below ? [middle, south] : [middle, north])
              .setDOMContent(text)
              .addTo(instance);
            shown = keyOf(feature);
            keepInside();
          };
          /*
           * `xs` inside the map, wherever the place is moved to: across, and down, where
           * the side it hangs on has too little room (a place as tall as the map), over
           * the place, to its edge in sight, as a hotspot's name moves.
           */
          let hangs = 0;
          const keepInside = () => {
            const element = popup?.getElement?.();
            const box = instance.getContainer?.()?.getBoundingClientRect?.();
            if (!element || !box || !popup.setOffset) return;
            const away = gap();
            popup.setOffset([0, hangs]);
            const own = element.getBoundingClientRect();
            const across =
              own.left < box.left + away
                ? box.left + away - own.left
                : own.right > box.right - away
                  ? box.right - away - own.right
                  : 0;
            const down =
              own.top < box.top + away
                ? box.top + away - own.top
                : own.bottom > box.bottom - away
                  ? box.bottom - away - own.bottom
                  : 0;
            if (across || down) popup.setOffset([across, hangs + down]);
          };
          instance.on("move", keepInside);
          /*
           * New places (another Canvas, another member): a name, a pointer's place and a
           * pick belong to the places they were made for (Mat, 2026-10-29: "toggling between
           * collection items still leaves remnant popover. clear these on canvas
           * changes"). Every place's state goes, as ids are their places in the data; the
           * one picked is kept only where the new places hold it, the same place under the
           * same name, picked again there, its name as it was.
           */
          reread.current = (next) => {
            instance.removeFeatureState?.({ source: NAVPLACE });
            hovered = undefined;
            const placeOf = (feature: MapFeature) =>
              JSON.stringify([feature.properties, feature.geometry]);
            const kept = picked
              ? next.features.find((f) => placeOf(f) === placeOf(picked!))
              : undefined;
            picked = kept ?? null;
            pickedId = undefined;
            if (!kept) return unname();
            pick(kept);
            show(kept);
          };
          name.current = (feature) => {
            picked = feature;
            pick(feature);
            show(feature);
          };
          for (const layer of CLICKABLE) {
            instance.on("click", layer, (event: any) => {
              const feature = event.features?.[0] as MapFeature | undefined;
              if (!feature) return;
              name.current?.(feature, event.lngLat);
              latest.current.onSelect?.(feature);
            });
            instance.on("mousemove", layer, (event: any) => {
              instance.getCanvas().style.cursor = "pointer";
              const feature = event.features?.[0] as MapFeature | undefined;
              if (!feature) return;
              show(feature);
              const id = idOf(feature);
              if (id === hovered) return;
              mark(hovered, "hover", false);
              hovered = id;
              mark(hovered, "hover", true);
              latest.current.onHighlight?.(feature);
            });
            instance.on("mouseleave", layer, () => {
              instance.getCanvas().style.cursor = "";
              mark(hovered, "hover", false);
              hovered = undefined;
              latest.current.onHighlight?.(null);
              if (picked) show(picked);
              else unname();
            });
          }
          // A press off the places lets go of the one picked.
          instance.on("click", (event: any) => {
            const under = instance.queryRenderedFeatures?.(event.point, {
              layers: CLICKABLE.filter((layer) => instance.getLayer?.(layer)),
            });
            if (under?.length) return;
            picked = null;
            pick(null);
            unname();
          });
          const escape = (event: KeyboardEvent) => {
            if (event.key !== "Escape" || !popup) return;
            picked = null;
            pick(null);
            unname();
          };
          document.addEventListener("keydown", escape);
          letGo = () => document.removeEventListener("keydown", escape);
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
      letGo?.();
      observer?.disconnect();
      instance?.remove();
      name.current = null;
      reread.current = null;
      framed.current = "";
      setMap(null);
    };
    // Style, worker and wheel are read once: a new map would be a new viewer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near]);

  // The places, and what was named among the last ones let go.
  useEffect(() => {
    map?.getSource(NAVPLACE)?.setData(features);
    reread.current?.(features);
  }, [map, features]);

  /*
   * A place whose annotation is pointed at or picked beside the map (its hotspot, the
   * Annotations list) shows active, as that hotspot does (Mat, 2026-10-29: "make it so
   * hover/active rules apply for annotations on maps too").
   */
  const linked = useRef<number[]>([]);
  const activeKey = activeAnnotations?.join("\n") ?? "";
  useEffect(() => {
    if (!map?.setFeatureState) return;
    const ids = features.features.flatMap((feature, index) =>
      feature.properties.annotationId &&
      activeKey.split("\n").includes(feature.properties.annotationId)
        ? [index]
        : [],
    );
    for (const id of linked.current)
      map.setFeatureState({ source: NAVPLACE, id }, { linked: false });
    for (const id of ids)
      map.setFeatureState({ source: NAVPLACE, id }, { linked: true });
    linked.current = ids;
  }, [map, features, activeKey]);
  // What the list names: every place, and each overlay drawn.
  const listed = overlay
    ? overlays.filter((item) => drawnIds.has(item.id))
    : NONE;
  const count = features.features.length + listed.length;
  // Its places listed under it, but where what holds it names them (`list={false}`).
  const described = list && count > 0;

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
    /*
     * Named in Clover's words, its popover Clover's (`Tip`, below) rather than the
     * browser's tooltip, which MapLibre's `title` would show (Mat, 2026-10-29: "override
     * all maplibre labels in favor of Clover flavored ones").
     */
    const part = container.current?.closest(".clover-geomap");
    const rename = (selector: string, key: string) => {
      const control = part?.querySelector(selector);
      if (!control) return null;
      control.setAttribute("aria-label", t(key));
      control.removeAttribute("title");
      mark(control, langOf(key));
      return { element: control, key };
    };
    setTips(
      [
        rename(".maplibregl-ctrl-zoom-in", "imageZoomIn"),
        rename(".maplibregl-ctrl-zoom-out", "imageZoomOut"),
        rename(".maplibregl-ctrl-attrib-button", "mapAttribution"),
      ].filter((tip): tip is { element: Element; key: string } => tip !== null),
    );
    // The credits are the basemap's: English for Clover's own, unknown for yours.
    const words = part?.querySelector(".maplibregl-ctrl-attrib-inner");
    if (words) mark(words, styleUrl ? undefined : "en");
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
          ref={setBox}
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
          {map &&
            tips.map(({ element, key }) =>
              createPortal(
                <Tip label={t(key)} lang={langOf(key)} />,
                element,
                key,
              ),
            )}
          {failed && (
            <p
              className="clover-geomap-error"
              role="alert"
              {...languageProps(langOf("mapUnavailable"))}
            >
              {t("mapUnavailable")}
            </p>
          )}
        </div>
        {described && (
          <>
            {/* The map's description: a count, not the names, which the list reads next. */}
            <span
              id={aboutId}
              hidden
              {...languageProps(langOf("mapPlacesListed"))}
            >
              {t("mapPlacesListed", { count })}
            </span>
            {/* What the map shows, as text, and the keyboard's way to each place. */}
            <ul className="clover-geomap-places">
              {features.features.map((feature, index) => {
                const { title, titleLang, canvasId, manifestId, navDate } =
                  feature.properties;
                const nameLang = title ? titleLang : langOf("mapPlaceUntitled");
                return (
                  <li key={`place-${index}`}>
                    <button
                      type="button"
                      {...languageProps(nameLang)}
                      aria-current={
                        current?.includes(canvasId ?? manifestId ?? "")
                          ? "true"
                          : undefined
                      }
                      onClick={() => choose(feature)}
                    >
                      {title || t("mapPlaceUntitled", { number: index + 1 })}
                      {/* Its owner's date, under its name (Cookbook 0318). */}
                      <NavDate
                        value={navDate}
                        className="clover-geomap-place-date"
                        within={nameLang}
                      />
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
                          <span {...languageProps(label.lang)}>
                            {label.text}
                          </span>{" "}
                        </>
                      )}
                      <span {...languageProps(langOf("mapOverlay"))}>
                        {t("mapOverlay")}
                      </span>
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

/** Clover's colors, resolved: MapLibre paints with WebGL, which cannot read `var()`. */
function colorsOf(element: Element | null) {
  const token = (name: string, fallback: string) =>
    (element ? getComputedStyle(element).getPropertyValue(name).trim() : "") ||
    fallback;
  const unit =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return {
    accent: token("--clover-color-accent", "#0065c3"),
    dark: token("--clover-color-primary", "#1a1d1e"),
    light: token("--clover-color-secondary", "#ffffff"),
    // A point's dot, `m` across, as a hotspot's is.
    dot: unit / 2,
  };
}

/** Whether a place is active: pointed at, picked, or its annotation so elsewhere. */
const ACTIVE = [
  "any",
  ["boolean", ["feature-state", "hover"], false],
  ["boolean", ["feature-state", "picked"], false],
  ["boolean", ["feature-state", "linked"], false],
];

/**
 * The places' source and layers: areas, lines and points, drawn as the Canvas draws a
 * hotspot (`Canvas/Annotations.css`): at rest a dark edge under a light line, nothing laid
 * over what it marks; active (pointed at, picked, or its annotation pointed at or picked
 * beside it) a wider dark edge, a wider light line, and the accent on it. A point is an
 * accent dot in a light ring with a dark edge, an accent band round the ring while active,
 * and a circle of 24px around it that a press finds (WCAG 2.5.8). Simplestyle's keys
 * (`fill`, `stroke`, `marker-color`) still color what they name.
 */
function addPlaceLayers(map: any, colors: ReturnType<typeof colorsOf>) {
  const { accent, dark, light, dot } = colors;
  map.addSource(NAVPLACE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    // Each feature its place in the data as its id, for its state (`ACTIVE`).
    generateId: true,
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
      // Clear but for a fill its feature asks for: still found by the pointer inside.
      "fill-color": ["coalesce", ["get", "fill"], accent],
      "fill-opacity": [
        "case",
        ["has", "fill"],
        ["coalesce", ["get", "fill-opacity"], 0.18],
        0,
      ],
    },
  });
  const lines = [
    "match",
    ["geometry-type"],
    ["LineString", "MultiLineString", "Polygon", "MultiPolygon"],
    true,
    false,
  ];
  const round = { "line-join": "round", "line-cap": "round" };
  map.addLayer({
    id: CASING,
    type: "line",
    source: NAVPLACE,
    filter: lines,
    layout: round,
    paint: {
      "line-color": dark,
      "line-width": ["case", ACTIVE, 6, 3],
    },
  });
  map.addLayer({
    id: LINE,
    type: "line",
    source: NAVPLACE,
    filter: lines,
    layout: round,
    paint: {
      "line-color": light,
      "line-width": ["case", ACTIVE, 4, 1],
    },
  });
  map.addLayer({
    id: ACCENT,
    type: "line",
    source: NAVPLACE,
    filter: lines,
    layout: round,
    paint: {
      "line-color": ["coalesce", ["get", "stroke"], accent],
      "line-width": [
        "case",
        ACTIVE,
        2,
        ["has", "stroke"],
        ["coalesce", ["get", "stroke-width"], 2],
        0,
      ],
      "line-opacity": ["coalesce", ["get", "stroke-opacity"], 1],
    },
  });
  const points = [
    "match",
    ["geometry-type"],
    ["Point", "MultiPoint"],
    true,
    false,
  ];
  map.addLayer({
    id: POINT_HIT,
    type: "circle",
    source: NAVPLACE,
    filter: points,
    paint: { "circle-radius": 12, "circle-opacity": 0 },
  });
  map.addLayer({
    id: POINT_EDGE,
    type: "circle",
    source: NAVPLACE,
    filter: points,
    paint: {
      // Active, the accent band round the light ring, then the dark edge round that.
      "circle-radius": ["case", ACTIVE, dot + 2 + 2, dot + 2],
      "circle-color": accent,
      "circle-stroke-width": 1,
      "circle-stroke-color": dark,
    },
  });
  map.addLayer({
    id: POINT,
    type: "circle",
    source: NAVPLACE,
    filter: points,
    paint: {
      "circle-radius": dot,
      "circle-color": ["coalesce", ["get", "marker-color"], accent],
      "circle-stroke-width": 2,
      "circle-stroke-color": light,
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
  const { overlayImageUrl } = await import("./overlayImage");
  const url = await overlayImageUrl(overlay.image, OVERLAY_SIZE, request);
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
