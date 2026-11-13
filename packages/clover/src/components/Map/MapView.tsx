import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUniqueId } from "../../ui/useUniqueId";
import {
  highContrastProps,
  useHighContrast,
} from "../../hooks/useHighContrast";

import { DEFAULT_STYLE_URL, applyDefaultBasemap } from "./basemap";
import type MapItems from "./MapItems";
import type { MapItemsLayout } from "./MapItems";
import {
  type Georeference,
  type MapFeature,
  type MapFeatureCollection,
  boundsOf,
  cornersOf,
  groundOf,
  navPlaceOf,
  pictureOf,
  type Position,
  readGeoreference,
} from "../../core/geo";
import type { IIIFContent } from "../../core/load";
import { type CloverRequest, sendsCredentials } from "../../core/request";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { HostLanguageContext } from "../../i18n/hostLanguage";
import { useRootLanguage } from "../../i18n/useRootLanguage";
import { getMapWorkerUrl } from "../../core/map-config";
import { useNearViewport } from "../Body/useNearViewport";
import { directionOf, languageProps } from "../../i18n/direction";
import { Tip } from "../../ui/Tip";
import { useOneOpen } from "../../ui/useOneOpen";
import { useContainerName } from "../../i18n/useContainerName";
import { ZoomIn, ZoomOut } from "../../ui/controlGlyphs";
import { Information } from "../Body/glyphs";
import { readDate } from "../../core/dates";
import { dateTimeOf, formatDate } from "../../core/dates-format";
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
  /**
   * Inside a `Root`: whose georeferenced images it lays, the Canvases' in view (`view`, the
   * default) or every Canvas's (`all`), an atlas's sheets at once. Standalone, every one.
   */
  overlays?: "view" | "all";
  /**
   * Its places and georeferenced images listed under it, by Items, in one of its layouts:
   * `list` (the default), `grid`, `slider` or `masonry`. `false` lists none, where the page
   * lists them itself (`georeferencesOf`, `navPlaceOf`, or Items' `of="georeferences"`):
   * that list is then the map's text and the keyboard's way to each.
   */
  items?: MapItemsLayout | false;
  /**
   * Offers the map's outline options, behind a gear after its zoom controls: Outlines,
   * pressed to outline every georeferenced image on the map, and Selection outline,
   * pressed to put away the accent's outline round the one chosen. Default false.
   */
  outlines?: boolean;
  /** The overlays' opacity, 0 to 1. Default 1: a georeferenced map shows whole. */
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
   * How close it frames its places: a lone point at this zoom, and several no closer.
   * Default 8 for a point, a region around it, and 12 for several; 15 shows a point's
   * streets (Mat, 2026-11-04: "zoom map to street level").
   */
  zoom?: number;
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
   * Clover's higher-contrast mode: the accent kept to rings, outlines and marks, and never
   * under words or a glyph, where the controls' dark fill takes its place, edged in the
   * accent. Inside a `Root`, the Root's too; on wherever the reader's system asks for more
   * contrast. Default `false`.
   */
  highContrast?: boolean;
  /**
   * The basemap's credits, behind an ⓘ in the map's lower corner. Default true. A basemap's license
   * may ask for its credits: give them on the page yourself before setting this false.
   */
  credits?: boolean;
  as?: React.ElementType;
}

export type Forwarded = { forwardedRef: React.ForwardedRef<HTMLElement> };

const NONE: Georeference[] = [];
const NO_IDS: ReadonlySet<string> = new Set();

/** GeoJSON and annotations handed in, with no Root to read. */
export function GivenMap({
  navPlace,
  georeferences,
  read,
  owner,
  // Every one given is laid: there is no view to narrow them to.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  overlays: whose,
  ...rest
}: Omit<MapProps, "iiifContent" | "request" | "language"> &
  Forwarded & {
    /** A region of its own; false inside a box that names it (`Canvas/PlaceBox`). */
    landmark?: boolean;
    language?: string;
    /** Overlays already read, with their Canvases (`Canvas/PlaceBox`), over `georeferences`. */
    read?: Georeference[];
    /** The Canvases in view, where it lays more than theirs: outlined, and followed. */
    current?: string[];
    /** What lists them (`MapList`): the Map's own hands it; the Canvas's map box never. */
    List?: ViewProps["List"];
    reframe?: unknown;
    /**
     * What the places given belong to (`Canvas/PlaceBox`: its Canvas), whose picture each
     * shows over its name where it has none of its own.
     */
    owner?: unknown;
  }) {
  const given = useGiven(navPlace, (value) =>
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
  // Each place given its owner's picture, where it names none of its own.
  const features = useMemo(() => {
    const picture = pictureOf(owner);
    if (!picture) return given;
    const thumbnail = JSON.stringify(picture);
    return {
      ...given,
      features: given.features.map((feature) =>
        feature.properties.thumbnail
          ? feature
          : { ...feature, properties: { ...feature.properties, thumbnail } },
      ),
    };
  }, [given, owner]);
  const overlays = useGiven(georeferences, (value) =>
    ((value as unknown[]) ?? [])
      .map((annotation) => readGeoreference(annotation as never))
      .filter((overlay): overlay is Georeference => Boolean(overlay)),
  );
  return <MapView {...rest} features={features} overlays={read ?? overlays} />;
}

/** A value read from a prop, recomputed only when the prop's identity changes. */
function useGiven<T>(value: unknown, read: (value: unknown) => T): T {
  const memo = useRef<{ value: unknown; result: T } | null>(null);
  if (!memo.current || memo.current.value !== value) {
    memo.current = { value, result: read(value) };
  }
  return memo.current.result;
}

/**
 * A place's picture, as large as a chapter's (`PICTURE_SIZE`, `ui/EntryThumbnail`): a copy,
 * as importing it would bring that module, and what it reads pictures with, into every
 * map's first load (the overlays' rows load it lazily, `OverlayPicture`).
 */
const PICTURE_SIZE = 336;

/** Longer side, in pixels, of the image an overlay draws. */
const OVERLAY_SIZE = 2048;

/**
 * Longer side, in pixels, of each overlay's image where several are drawn together: as
 * large as four at most would be, all told (a sheet of an atlas, many at once), never
 * under 768.
 */
const overlaySize = (count: number) =>
  count <= 4
    ? OVERLAY_SIZE
    : Math.max(768, Math.round((OVERLAY_SIZE * 2) / Math.sqrt(count)));

/** The zoom a lone point is framed at. */
const POINT_ZOOM = 8;

/**
 * The closest a georeferenced image is framed: whole, however small its ground (a fire
 * insurance map's few blocks), where places stop at 12 (`frame`).
 */
const OVERLAY_ZOOM = 19;

const NAVPLACE = "geomap-navplace";
const FILL = "geomap-navplace-fill";
const LINE = "geomap-navplace-line";
const CASING = "geomap-navplace-casing";
const ACCENT = "geomap-navplace-accent";
/** The outline round the georeferenced images chosen. */
const OUTLINE = "geomap-overlay-outline";
/** Every overlay's edge, while Outlines is pressed (`outlines`). */
const OUTLINES = "geomap-overlay-outlines";
const POINT = "geomap-navplace-point";
const POINT_EDGE = "geomap-navplace-point-edge";
const POINT_HIT = "geomap-navplace-point-hit";
const CLICKABLE = [FILL, CASING, LINE, POINT_HIT, POINT];

interface ViewProps
  extends Omit<
      MapProps,
      "iiifContent" | "navPlace" | "georeferences" | "language" | "overlays"
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
  /** The annotation picked in the Root: a georeferenced image so is outlined, whole. */
  picked?: string | null;
  /**
   * The annotation pointed at in the Root (in Items, Annotations, a list of the page's
   * own): a georeferenced image so is outlined at half strength, and its item lit.
   */
  highlighted?: string | null;
  /** A georeferenced image is pointed at, on the map or in its list; null as it leaves. */
  onPointOverlay?: (id: string | null) => void;
  /** A georeferenced image is chosen in its list. */
  onChooseOverlay?: (overlay: Georeference) => void;
  /**
   * What lists its places and images (`MapList`), handed in by the maps that list, so a
   * map that never lists (the Canvas's map box) cannot reach Items' code.
   */
  List?: React.LazyExoticComponent<typeof MapItems>;
  /** The place pointed at on the map, and null as the pointer leaves the places. */
  onHighlight?: (feature: MapFeature | null) => void;
  /**
   * A value whose change frames what there is again, once the map has its new size: the
   * place box's swap, as its map fills the Body and goes back (`Canvas/PlaceBox`).
   */
  reframe?: unknown;
}

export function MapView({
  features,
  overlays,
  current,
  activeAnnotations,
  picked = null,
  highlighted = null,
  onPointOverlay,
  onChooseOverlay,
  List,
  onHighlight,
  reframe,
  items = "list",
  outlines = false,
  credits = true,
  language,
  highContrast,
  landmark = true,
  overlay = true,
  overlayOpacity = 1,
  styleUrl,
  workerUrl,
  scrollZoom = false,
  zoom,
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
  // Standalone, the higher-contrast mode is the map's own: the page's, or the reader's.
  const contrast = useHighContrast(highContrast);
  const container = useRef<HTMLDivElement>(null);
  /*
   * MapLibre (290 kB) loads only as the map comes within half a screen of view, as a
   * Canvas's images do: a map far down a page, or in a tab not yet open, loads none.
   */
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const near = useNearViewport(box);
  const [map, setMap] = useState<any>(null);
  // MapLibre's controls, each with Clover's glyph and popover in it.
  const [tips, setTips] = useState<{ element: Element; key: string }[]>([]);
  const [failed, setFailed] = useState(false);
  // The overlays on the map, by id, once their images are drawn.
  const [drawnIds, setDrawnIds] = useState<ReadonlySet<string>>(NO_IDS);
  // The item last chosen in the list: `place-<index>` or `overlay-<id>`.
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const chosen = chosenKey?.startsWith("overlay-")
    ? chosenKey.slice("overlay-".length)
    : null;
  // The row of what is under the pointer on the map, lit as the pointer lights a row:
  // `place-<index>` or `overlay-<id>`.
  const [pointed, setPointed] = useState<string | null>(null);
  // The overlay whose row is under the pointer, or focused.
  const [rowHover, setRowHover] = useState<string | null>(null);
  // The accent outline round those chosen, which the options' Selection outline turns off.
  const [selectionShown, setSelectionShown] = useState(true);
  // Outlined at half strength, as Items rings an item under the pointer: the overlay
  // whose item is pointed at or focused, else the one under the pointer on the map, else
  // one pointed at elsewhere in the Root.
  const hovered =
    rowHover ??
    (pointed?.startsWith("overlay-")
      ? pointed.slice("overlay-".length)
      : overlays.some((item) => item.id === highlighted)
        ? highlighted
        : null);
  // Where each overlay drawn shows, for finding the one under the pointer.
  const grounds = useMemo(
    () =>
      (overlay ? overlays : [])
        .filter((item) => drawnIds.has(item.id))
        .map((item) => ({ id: item.id, ring: groundOf(item) })),
    [overlay, overlays, drawnIds],
  );
  const latest = useRef({
    onSelect,
    onHighlight,
    t,
    features,
    host: root.hostLanguage,
    request,
    grounds,
    point: setPointed,
    pointOverlay: onPointOverlay,
  });
  latest.current = {
    onSelect,
    onHighlight,
    t,
    features,
    host: root.hostLanguage,
    request,
    grounds,
    point: setPointed,
    pointOverlay: onPointOverlay,
  };
  // Names a place in a popup at a point, once MapLibre is up.
  const name = useRef<((feature: MapFeature, at: unknown) => void) | null>(
    null,
  );
  // Reads new places: what was named, pointed at or picked among the old ones let go.
  const reread = useRef<((next: MapFeatureCollection) => void) | null>(null);
  // Chooses an image pressed on the map, as its row in the list chooses it.
  const chooseSheet = useRef<((id: string) => void) | null>(null);
  // The extent last framed.
  const framed = useRef("");
  // Frames what there is: kept current, for a `reframe` to call once the map is resized.
  const frameAll = useRef<(() => void) | null>(null);
  const reframeWanted = useRef(false);

  // MapLibre, loaded and started once, near the window.
  useEffect(() => {
    if (!near) return;
    let live = true;
    let instance: any = null;
    let observer: ResizeObserver | null = null;
    // Its listener on the page for Escape, let go with the map.
    let letGo: (() => void) | null = null;
    // MapLibre and what Clover brings with it: its worker, for a page that sets none, and
    // its stylesheet, for a page that has none, in before the map draws.
    Promise.all([
      import("maplibre-gl"),
      import("./worker").then((bundled) =>
        bundled.mapLibreSheet().then(() => bundled),
      ),
    ])
      .then(async ([module, bundled]) => {
        // ES builds export `Map` by name; a CommonJS interop may wrap it in `default`.
        const maplibre: any =
          "Map" in module ? module : (module as any).default;
        if (!live || !container.current) return;
        const worker =
          workerUrl ??
          getMapWorkerUrl() ??
          bundled.bundledWorkerUrl(maplibre.getVersion?.());
        /*
         * A worker that starts from a `blob:` URL (Clover's own, or one on another host,
         * as a CDN's, which MapLibre wraps in one), where the page's policy lets it
         * start: else no map.
         */
        const viaBlob =
          !!worker &&
          (worker.startsWith("blob:") ||
            new URL(worker, location.href).origin !== location.origin);
        if (viaBlob && !(await bundled.blobWorkersAllowed())) {
          if (live) setFailed(true);
          return;
        }
        if (!live || !container.current) return;
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
          // MapLibre's own names, in Clover's interface words; kept current below.
          locale: {
            "Map.Title": t("mapLabel"),
            "NavigationControl.ZoomIn": t("imageZoomIn"),
            "NavigationControl.ZoomOut": t("imageZoomOut"),
            "AttributionControl.ToggleAttribution": t("mapAttribution"),
          },
        });
        if (!landmark) instance.getCanvas().setAttribute("role", "group");
        // Zoom in and out in a row at its top right, the credits' ⓘ at its lower right
        // (Mat, 2026-11-08: "they should be top right in all cases"; at its lower left
        // from 2026-10-29).
        instance.addControl(
          new maplibre.NavigationControl({ showCompass: false }),
          "top-right",
        );
        /*
         * A map of places keeps north up: a two-finger twist or Shift+arrows would turn
         * it with no control or single pointer to turn it back (WCAG 2.5.1). The arrows
         * still pan, + and - still zoom.
         */
        instance.touchZoomRotate?.disableRotation?.();
        instance.keyboard?.disableRotation?.();
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
          // Each picture's URL, by its source, resolved once for the map's life.
          const pictures: Record<string, Promise<string | undefined>> = {};
          let picked: MapFeature | null = null;
          let shown = "";
          // The place named, as the places last handed in hold it.
          let named: MapFeature | null = null;
          // The name Escape put away, kept away until the pointer leaves its place.
          let dismissed = "";
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
            named = null;
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
            const date = readDate(feature.properties?.navDate);
            if (date) {
              const locale = cloverI18n.language;
              const time = document.createElement("time");
              time.className = "clover-geomap-popup-date";
              time.dateTime = dateTimeOf(
                date,
                String(feature.properties.navDate),
              );
              time.textContent = formatDate(date, locale);
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
            // Its picture over its words, as the seek bar's popover shows a chapter's: in
            // the same element, which keeps its language.
            const content = text;
            popup = new maplibre.Popup({
              closeButton: false,
              closeOnClick: false,
              anchor: below ? "top" : "bottom",
              offset: [0, hangs],
              maxWidth: "none",
              className: "clover-geomap-popup",
            })
              .setLngLat(below ? [middle, south] : [middle, north])
              .setDOMContent(content)
              .addTo(instance);
            const key = keyOf(feature);
            shown = key;
            named = feature;
            keepInside();
            picture(feature, content, key);
          };
          /*
           * A place's picture (its owner's, `core/geo.ts`, `placePicture.ts`): sized from
           * its own `info.json` as Items' are, a member's Manifest loaded first where it is
           * not yet, all only as a place is named, the code with it. Decorative, as the name under it says what it is. Laid in once
           * it has loaded, while that place is still named, the popover kept inside the map.
           */
          const picture = (
            feature: MapFeature,
            content: HTMLElement,
            key: string,
          ) => {
            const source = feature.properties?.thumbnail;
            if (typeof source !== "string") return;
            void (pictures[source] ??= import("./placePicture")
              .then(({ placePicture }) =>
                placePicture(
                  JSON.parse(source),
                  PICTURE_SIZE,
                  latest.current.request,
                ),
              )
              .catch(() => undefined)).then((url) => {
              if (!url || shown !== key) return;
              // Hidden until it has loaded, so the popover never shows an empty box;
              // one that cannot load goes.
              const image = document.createElement("img");
              image.className = "clover-tip-image";
              image.alt = "";
              image.decoding = "async";
              image.hidden = true;
              image.onload = () => {
                if (shown !== key) return;
                image.hidden = false;
                popup?.getElement?.()?.setAttribute("data-picture", "");
                keepInside();
              };
              image.onerror = () => image.remove();
              image.src = url;
              content.prepend(image);
            });
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
            const placeOf = (feature: MapFeature) =>
              JSON.stringify([feature.properties, feature.geometry]);
            const find = (feature: MapFeature | null) =>
              feature
                ? next.features.find((f) => placeOf(f) === placeOf(feature))
                : undefined;
            const kept = find(picked);
            /*
             * The place named stays named while the new places hold it, the pointer still
             * over it or not, so the same places handed in again (a Collection's members
             * loading beside the map) never put its name away and back (Mat, 2026-11-08:
             * "blinking is still regularly occurring").
             */
            const still = find(named);
            const pointed = hovered !== undefined ? still : undefined;
            picked = kept ?? null;
            pickedId = undefined;
            hovered = undefined;
            if (kept) pick(kept);
            if (pointed) {
              hovered = idOf(pointed);
              mark(hovered, "hover", true);
            }
            if (still) {
              named = still;
              return;
            }
            if (!kept) return unname();
            show(kept);
          };
          name.current = (feature) => {
            dismissed = "";
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
          }
          /*
           * The place under the pointer, read across every layer of places at once, so
           * moving between a point and its larger area to press, or across places that
           * overlap, never names it, puts it away and names it again (Mat, 2026-11-08:
           * "as if hover turns off/on/off/on over and over"): the place already named
           * stays while it is still under the pointer, and the name goes only when no
           * place is.
           */
          const leave = () => {
            if (hovered === undefined && !shown) return;
            instance.getCanvas().style.cursor = "";
            dismissed = "";
            mark(hovered, "hover", false);
            hovered = undefined;
            latest.current.onHighlight?.(null);
            if (picked) show(picked);
            else unname();
          };
          // The image under the pointer, as last told: told again only as it changes.
          let sheetPointed: string | null = null;
          const pointSheet = (sheet: string | null) => {
            if (sheet === sheetPointed) return;
            sheetPointed = sheet;
            latest.current.pointOverlay?.(sheet);
          };
          instance.on("mousemove", (event: any) => {
            const under = (instance.queryRenderedFeatures?.(event.point, {
              layers: CLICKABLE.filter((layer) => instance.getLayer?.(layer)),
            }) ?? []) as MapFeature[];
            if (!under.length) {
              if (hovered !== undefined) leave();
              // Off the places, the image under the pointer lights its item, and a press
              // chooses it.
              const sheet = overlayAt(latest.current.grounds, event.lngLat);
              instance.getCanvas().style.cursor = sheet ? "pointer" : "";
              latest.current.point(sheet ? `overlay-${sheet}` : null);
              pointSheet(sheet);
              return;
            }
            pointSheet(null);
            instance.getCanvas().style.cursor = "pointer";
            const feature =
              under.find((each) => idOf(each) === hovered) ?? under[0];
            if (keyOf(feature) !== dismissed) show(feature);
            const id = idOf(feature);
            latest.current.point(`place-${id}`);
            if (id === hovered) return;
            mark(hovered, "hover", false);
            hovered = id;
            mark(hovered, "hover", true);
            latest.current.onHighlight?.(feature);
          });
          instance.on("mouseout", () => {
            if (hovered !== undefined) leave();
            instance.getCanvas().style.cursor = "";
            latest.current.point(null);
            pointSheet(null);
          });
          // A press off the places lets go of the one picked, and one on an image chooses
          // it, as its row in the list does: framed, and its Canvas gone to.
          instance.on("click", (event: any) => {
            const under = instance.queryRenderedFeatures?.(event.point, {
              layers: CLICKABLE.filter((layer) => instance.getLayer?.(layer)),
            });
            if (under?.length) return;
            picked = null;
            pick(null);
            unname();
            const sheet = overlayAt(latest.current.grounds, event.lngLat);
            if (sheet) chooseSheet.current?.(sheet);
          });
          /*
           * Escape puts the name away and lets go of the place: from the map (focus in it,
           * or the pointer over it), before the page's own handlers, and only where
           * nothing inside has taken it, so one Escape closes one thing (DESIGN.md §0).
           */
          const escape = (event: KeyboardEvent) => {
            if (event.key !== "Escape" || event.defaultPrevented || !popup)
              return;
            // Nothing named or picked: the Escape is another's (the options' tray).
            if (!shown && !picked) return;
            const own = container.current?.closest(".clover-geomap");
            const target = event.target as Node | null;
            if (!own?.contains(target) && !own?.matches(":hover")) return;
            event.preventDefault();
            dismissed = shown;
            picked = null;
            pick(null);
            unname();
          };
          document.addEventListener("keydown", escape, true);
          letGo = () => document.removeEventListener("keydown", escape, true);
          setMap(instance);
        });
        // A map in a tab or panel is sized late: keep MapLibre's canvas in step.
        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() => {
            instance?.resize();
            if (!reframeWanted.current) return;
            reframeWanted.current = false;
            frameAll.current?.();
          });
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
  // Its places listed under it, but where what holds it, or the page, lists them
  // (`items={false}`).
  const described = items !== false && count > 0 && Boolean(List);

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
     * Named in Clover's interface words, its popover Clover's (`Tip`, below) rather than the
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
      void drawOverlay(item, request, overlaySize(wanted.length)).then(
        (canvas) => {
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
            // Under the outlines, the places and the outline, however late it arrives.
            map.getLayer(OUTLINES)
              ? OUTLINES
              : map.getLayer(FILL)
                ? FILL
                : map.getLayer(OUTLINE)
                  ? OUTLINE
                  : undefined,
          );
          setDrawnIds((before) => new Set(before).add(item.id));
        },
      );
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

  /*
   * The images chosen, outlined in the accent a little clear of their edge, as Items rings
   * the item chosen (Mat, 2026-11-12): the one last chosen from the list, those on a
   * Canvas in view, and one whose annotation is picked. Each is outlined where it shows,
   * round its mask, else its corners, over everything else on the map.
   */
  const outlined = useMemo(
    () =>
      (overlay ? overlays : []).filter(
        (item) =>
          item.id === chosen ||
          (item.canvasId && current?.includes(item.canvasId)) ||
          item.id === picked,
      ),
    [overlay, overlays, chosen, current, picked],
  );
  useEffect(() => {
    if (!map) return;
    // Those chosen, unless the options' Selection outline is off (`outlines`).
    const whole = !outlines || selectionShown ? outlined : [];
    const half = overlays.filter(
      (item) => item.id === hovered && !outlined.includes(item),
    );
    const data = {
      type: "FeatureCollection",
      features: [...whole, ...half].flatMap((item) => {
        const ring = outlineOf(item);
        return ring
          ? [
              {
                type: "Feature",
                properties: { hover: half.includes(item) },
                geometry: ring,
              },
            ]
          : [];
      }),
    };
    const source = map.getSource(OUTLINE);
    if (source) return void source.setData(data);
    map.addSource(OUTLINE, { type: "geojson", data });
    map.addLayer(
      {
        id: OUTLINE,
        type: "line",
        source: OUTLINE,
        layout: { "line-join": "round" },
        paint: {
          "line-color": colorsOf(container.current).accent,
          "line-width": 3,
          // Its middle 2.5px outside the edge: 3px wide, 1px clear.
          "line-offset": 2.5,
          // Under the pointer, at half strength (`--clover-accent-ring-hover`).
          "line-opacity": [
            "case",
            ["boolean", ["get", "hover"], false],
            0.5,
            1,
          ],
        },
      },
      // Over everything else on the map: the images (each added under it, however
      // late), the places and the basemap's labels.
    );
  }, [map, outlined, overlays, hovered, outlines, selectionShown]);

  // Frame what there is, once for each extent: a place chosen stays framed when the
  // view it opens draws nothing new, and a map given another place (a Collection's next
  // member) eases to it (Mat, 2026-11-08).
  useEffect(() => {
    if (!map) return;
    const bounds = boundsOf(features.features, overlay ? overlays : []);
    if (!bounds) return;
    // Images laid over the map are framed whole; places alone, no closer than 12.
    const most =
      zoom ?? (overlay && overlays.length ? OVERLAY_ZOOM : undefined);
    frameAll.current = () => frame(map, bounds, zoom ?? POINT_ZOOM, most);
    const extent = bounds.flat().join();
    if (extent === framed.current) return;
    // The first framing is at once; each one after glides there from where it was.
    const glide = framed.current !== "";
    framed.current = extent;
    frame(map, bounds, zoom ?? POINT_ZOOM, most, glide);
  }, [map, features, overlays, overlay, zoom]);

  // Asked to frame again: once the map has its new size, which its observer reports.
  const reframed = useRef(reframe);
  useEffect(() => {
    if (Object.is(reframed.current, reframe)) return;
    reframed.current = reframe;
    reframeWanted.current = true;
  }, [reframe]);

  /*
   * The list's items by key: `place-<index>` a place, `overlay-<id>` an image. The one
   * selected is the one last chosen, else the first on a Canvas in view; the one lit is
   * the one under the pointer on the map, else one pointed at elsewhere in the Root (an
   * image, or the annotation a place is).
   */
  const keyed = (key: string | null) => {
    if (key?.startsWith("place-"))
      return { place: features.features[Number(key.slice("place-".length))] };
    if (key?.startsWith("overlay-")) {
      const id = key.slice("overlay-".length);
      return { overlay: listed.find((item) => item.id === id) };
    }
    return {};
  };
  const onCanvas = (id: string | undefined) =>
    Boolean(id && current?.includes(id));
  const firstCurrent = () => {
    const place = features.features.findIndex((feature) =>
      onCanvas(feature.properties.canvasId ?? feature.properties.manifestId),
    );
    if (place >= 0) return `place-${place}`;
    const image = listed.find((item) => onCanvas(item.canvasId));
    return image ? `overlay-${image.id}` : null;
  };
  // The one chosen while it is still listed, else the first on a Canvas in view.
  const stillChosen =
    chosenKey && (keyed(chosenKey).place || keyed(chosenKey).overlay)
      ? chosenKey
      : null;
  const selectedKey = stillChosen ?? firstCurrent();
  const highlightedPlace = highlighted
    ? features.features.findIndex(
        (feature) => feature.properties.annotationId === highlighted,
      )
    : -1;
  const pointedKey =
    pointed ??
    (listed.some((item) => item.id === highlighted)
      ? `overlay-${highlighted}`
      : highlightedPlace >= 0
        ? `place-${highlightedPlace}`
        : null);

  // A place from the list: framed and named as on the map, then chosen.
  const choose = (feature: MapFeature) => {
    const bounds = boundsOf([feature]);
    if (map && bounds) {
      frame(map, bounds, Math.max(map.getZoom(), zoom ?? POINT_ZOOM), zoom);
      name.current?.(feature, center(bounds));
    }
    onSelect?.(feature);
  };
  const show = (item: Georeference) => {
    setChosenKey(`overlay-${item.id}`);
    const bounds = boundsOf([], [item]);
    if (map && bounds)
      frame(map, bounds, zoom ?? POINT_ZOOM, zoom ?? OVERLAY_ZOOM);
  };
  // An image pressed on the map: chosen, as its row would be.
  chooseSheet.current = (id) => {
    const item = overlays.find((each) => each.id === id);
    if (!item) return;
    show(item);
    onChooseOverlay?.(item);
  };

  /*
   * The view gone to elsewhere (Items beside it, a Body's Next) supersedes what was last
   * chosen here, so the view's alone is selected and outlined (Mat, 2026-11-12: "clicking
   * one and then hitting next shows multiple"). A choice made here goes to its own view
   * first, and keeps it.
   */
  const viewKey = current?.join(" ") ?? "";
  useEffect(() => {
    if (!current || !chosenKey) return;
    const { place, overlay: image } = keyed(chosenKey);
    const where =
      image?.canvasId ??
      place?.properties.canvasId ??
      place?.properties.manifestId;
    if (where && !current.includes(where)) setChosenKey(null);
    // Only as the view changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  /*
   * The map's options, behind a gear after its zoom controls, as a Canvas's controls wait
   * behind More (`Canvas/ImageControls.tsx`; Mat, 2026-11-12: "can it be a pop out menu
   * like Controls are for image canvas? I want more options. maybe do a gear?"), zoom
   * kept apart, always in sight ("do not include the + - in this tray"). A group of its
   * own MapLibre places beside theirs, offered where an option is; React draws it (below).
   * The gear is a disclosure (`aria-expanded`, `aria-controls`): pressed, by Enter or
   * Space too, its tray opens to its start on one ground, the gear its close at the
   * tray's end, focus staying on it, and Shift+Tab goes back through the tray; Escape in
   * it closes it, focus to the gear. Opening, it closes Clover's popup open (`useOneOpen`).
   *
   * Its options, offered by `outlines`: Outlines (Mat, 2026-11-12: "add ability to toggle
   * on/off annotation outlines, default it false"), off to start, pressed to draw every
   * overlay's edge in the controls' dark color, over the images and under the places and
   * the outline of those chosen; and Selection outline ("add ability to turn off the
   * accent outline on selected item as well"), on to start, the accent's ring round those
   * chosen, which a press takes away.
   */
  const offered = outlines;
  const optionsId = useUniqueId();
  const [optionsSlot, setOptionsSlot] = useState<HTMLElement | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsKey = optionsOpen ? "mapCollapseOptions" : "mapExpandOptions";
  const optionsName = useContainerName(
    t("mapOptions"),
    langOf("mapOptions"),
    false,
    root.hostLanguage,
  );
  useOneOpen(offered && optionsOpen, () => undefined);
  useEffect(() => {
    if (!map || !offered) return;
    const group = document.createElement("div");
    group.className = "maplibregl-ctrl maplibregl-ctrl-group";
    const control = { onAdd: () => group, onRemove: () => group.remove() };
    map.addControl(control, "top-right");
    setOptionsSlot(group);
    return () => {
      map.removeControl?.(control);
      setOptionsSlot(null);
      setOptionsOpen(false);
    };
  }, [map, offered]);
  const [edgesShown, setEdgesShown] = useState(false);
  const edges = outlines && edgesShown && overlay;
  useEffect(() => {
    if (!map) return;
    const data = {
      type: "FeatureCollection",
      features: (edges ? overlays : []).flatMap((item) => {
        const ring = outlineOf(item);
        return ring
          ? [{ type: "Feature", properties: {}, geometry: ring }]
          : [];
      }),
    };
    const source = map.getSource(OUTLINES);
    if (source) return void source.setData(data);
    if (!edges) return;
    map.addSource(OUTLINES, { type: "geojson", data });
    map.addLayer(
      {
        id: OUTLINES,
        type: "line",
        source: OUTLINES,
        layout: { "line-join": "round" },
        paint: {
          "line-color": colorsOf(container.current).dark,
          "line-width": 1.5,
        },
      },
      // Over the images, under the places and the outline of those chosen.
      map.getLayer(FILL) ? FILL : map.getLayer(OUTLINE) ? OUTLINE : undefined,
    );
  }, [map, edges, overlays]);

  /*
   * Laying more than the view's images (`overlays="all"`), the map follows the view: as
   * the images on the Canvas in view change, it eases to them, so one chosen beside it,
   * in Items, is framed as one chosen in its own list is (Mat, 2026-11-12: "document how
   * the user would click to zoom"). It opens on every image; laying the view's alone, its
   * extent's change frames them already.
   */
  const inView = useMemo(
    () =>
      overlays.filter(
        (item) => item.canvasId && current?.includes(item.canvasId),
      ),
    [overlays, current],
  );
  const inViewKey = inView.map((item) => item.id).join(" ");
  const followed = useRef<string | null>(null);
  useEffect(() => {
    if (!map || !overlay || !inView.length) return;
    const before = followed.current;
    followed.current = inViewKey;
    if (before === null || before === inViewKey) return;
    if (inView.length === overlays.length) return;
    const bounds = boundsOf([], inView);
    if (bounds)
      frame(map, bounds, zoom ?? POINT_ZOOM, zoom ?? OVERLAY_ZOOM, true);
    // Only as the view's images change: the rest is read as it is then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, inViewKey]);

  return (
    <HostLanguageContext.Provider value={root.hostLanguage}>
      <Tag
        ref={root.ref}
        className={join("clover-geomap", className)}
        data-status={failed ? "error" : map ? "ready" : "loading"}
        style={style}
        {...highContrastProps(contrast)}
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
          {optionsSlot &&
            createPortal(
              <div
                className="clover-geomap-options"
                data-open={optionsOpen || undefined}
                onKeyDown={(event) => {
                  // One Escape closes one thing, and nothing around it.
                  if (!optionsOpen || event.key !== "Escape") return;
                  if (event.defaultPrevented) return;
                  event.preventDefault();
                  setOptionsOpen(false);
                  document.getElementById(optionsId)?.focus();
                }}
              >
                {/* Its tray first, to the gear's start: the gear stays where it is. */}
                <div
                  className="clover-geomap-options-list"
                  id={`${optionsId}-list`}
                  role="group"
                  hidden={!optionsOpen}
                  {...optionsName.props}
                >
                  {outlines && (
                    <button
                      type="button"
                      className="clover-geomap-outlines"
                      aria-label={t("mapOutlines")}
                      aria-pressed={edgesShown}
                      lang={langOf("mapOutlines")}
                      onClick={() => setEdgesShown((shown) => !shown)}
                    >
                      <MapGlyph name="mapOutlines" />
                      <Tip
                        label={t("mapOutlines")}
                        lang={langOf("mapOutlines")}
                      />
                    </button>
                  )}
                  {outlines && (
                    <button
                      type="button"
                      className="clover-geomap-selection-outline"
                      aria-label={t("mapSelectionOutline")}
                      aria-pressed={selectionShown}
                      lang={langOf("mapSelectionOutline")}
                      onClick={() => setSelectionShown((shown) => !shown)}
                    >
                      <MapGlyph name="mapSelectionOutline" />
                      <Tip
                        label={t("mapSelectionOutline")}
                        lang={langOf("mapSelectionOutline")}
                      />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  id={optionsId}
                  className="clover-geomap-options-toggle"
                  aria-label={t(optionsKey)}
                  aria-expanded={optionsOpen}
                  aria-controls={`${optionsId}-list`}
                  lang={langOf(optionsKey)}
                  onClick={() => setOptionsOpen((open) => !open)}
                >
                  <MapGlyph name={optionsOpen ? "close" : "gear"} />
                  <Tip label={t(optionsKey)} lang={langOf(optionsKey)} />
                </button>
                {optionsName.node}
              </div>,
              optionsSlot,
            )}
          {map &&
            tips.map(({ element, key }) =>
              createPortal(
                <>
                  <MapGlyph name={key} />
                  <Tip label={t(key)} lang={langOf(key)} />
                </>,
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
        {described && List && (
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
            <Suspense fallback={null}>
              <List
                places={features.features}
                overlays={listed}
                layout={items}
                selected={selectedKey}
                pointed={pointedKey}
                language={language}
                request={request}
                onChoose={(key) => {
                  setChosenKey(key);
                  const item = keyed(key);
                  if (item.place) return choose(item.place);
                  if (!item.overlay) return;
                  show(item.overlay);
                  onChooseOverlay?.(item.overlay);
                }}
                onPoint={(key) => {
                  const { overlay: image } = keyed(key);
                  setRowHover(image?.id ?? null);
                  onPointOverlay?.(image?.id ?? null);
                }}
              />
            </Suspense>
          </>
        )}
      </Tag>
    </HostLanguageContext.Provider>
  );
}

/**
 * Frame a box: a lone point centered at `zoom`, anything else to its bounds, no closer
 * than `most` (the Map's `zoom`, or `OVERLAY_ZOOM` for a georeferenced image), else 12.
 */
function frame(
  map: any,
  bounds: [Position, Position],
  zoom: number,
  most = 12,
  glide = false,
) {
  // A map moving from one place to the next eases there, never where motion is reduced.
  const duration = glide && !reducedMotion() ? GLIDE : 0;
  const [[west, south], [east, north]] = bounds;
  if (west === east && south === north) {
    const view = { center: [west, south], zoom };
    if (duration) map.easeTo({ ...view, duration });
    else map.jumpTo(view);
  } else {
    map.fitBounds(bounds, { padding: 32, maxZoom: most, duration });
  }
}

/** How long a map takes to ease from one place to the next, in ms. */
const GLIDE = 600;

const reducedMotion = () =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/**
 * Where an overlay shows, as a ring round it, counter-clockwise on the ground (as a
 * north-up map reads it), its inside on the left, so a line offset to its right lies
 * outside it. Null where it has no fit.
 */
function outlineOf(item: Georeference) {
  const ground = groundOf(item);
  if (ground.length < 3) return null;
  const area = ground.reduce((sum, [x, y], i) => {
    const [nx, ny] = ground[(i + 1) % ground.length];
    return sum + x * ny - nx * y;
  }, 0);
  const ring = area < 0 ? [...ground].reverse() : ground;
  return { type: "LineString", coordinates: [...ring, ring[0]] };
}

/**
 * The overlay under a point, by where each shows: the last drawn that holds it, as the
 * last drawn shows on top. Ray casting, on longitude and latitude.
 */
function overlayAt(
  grounds: { id: string; ring: Position[] }[],
  at: { lng: number; lat: number } | undefined,
): string | null {
  if (!at) return null;
  for (let i = grounds.length - 1; i >= 0; i--) {
    const { ring } = grounds[i];
    let inside = false;
    for (let j = 0, k = ring.length - 1; j < ring.length; k = j++) {
      const [x1, y1] = ring[j];
      const [x2, y2] = ring[k];
      if (
        y1 > at.lat !== y2 > at.lat &&
        at.lng < ((x2 - x1) * (at.lat - y1)) / (y2 - y1) + x1
      )
        inside = !inside;
    }
    if (inside) return grounds[i].id;
  }
  return null;
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
 * An overlay's picture: the image (about `size` px, `overlaySize`), clipped to its mask,
 * on a canvas for MapLibre's canvas source. Null if the image will not load (or, without
 * CORS, cannot be drawn into WebGL).
 */
async function drawOverlay(
  overlay: Georeference,
  request: CloverRequest | undefined,
  size: number,
): Promise<HTMLCanvasElement | null> {
  const { overlayImageUrl } = await import("./overlayImage");
  const url = await overlayImageUrl(overlay.image, size, request);
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

/** Clover's glyph for each of MapLibre's controls it names. */
/**
 * Every sheet's edge: sheets laid askew on the ground, two by two, as Outlines draws them
 * (Mat, 2026-11-12: "make this one appear as multiple"), apart from Selection outline's
 * one sheet.
 */
const Outlines = () => (
  <path
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="36"
    d="M152 96l264 48-48 272-264-48zM284 120l-48 272M128 232l264 48"
  />
);

/** The sheet chosen: an edge round a sheet filled in, as the accent rings it. */
const SelectionOutline = () => (
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="40"
      d="M152 96l264 48-48 272-264-48z"
    />
    <path stroke="none" d="M204 176l132 24-24 136-132-24z" />
  </>
);

/** The options' gear: a cog of eight teeth round a hub. */
const Gear = () => (
  <path
    fill="none"
    stroke="currentColor"
    strokeLinejoin="round"
    strokeWidth="36"
    d="M217.2 111.1L224.7 58.5L287.3 58.5L294.8 111.1L331 126.1L373.6 94.2L417.8 138.4L385.9 181L400.9 217.2L453.5 224.7L453.5 287.3L400.9 294.8L385.9 331L417.8 373.6L373.6 417.8L331 385.9L294.8 400.9L287.3 453.5L224.7 453.5L217.2 400.9L181 385.9L138.4 417.8L94.2 373.6L126.1 331L111.1 294.8L58.5 287.3L58.5 224.7L111.1 217.2L126.1 181L94.2 138.4L138.4 94.2L181 126.1ZM320 256a64 64 0 1 1-128 0a64 64 0 1 1 128 0Z"
  />
);

/** The open tray's close, a cross, as Document's map's Close draws it. */
const Close = () => (
  <path
    fill="none"
    strokeLinecap="round"
    strokeWidth="45"
    d="M154 154L358 358M358 154L154 358"
  />
);

const GLYPHS: Record<string, () => React.ReactElement> = {
  imageZoomIn: ZoomIn,
  imageZoomOut: ZoomOut,
  mapAttribution: Information,
  mapOutlines: Outlines,
  mapSelectionOutline: SelectionOutline,
  gear: Gear,
  close: Close,
};

/**
 * A control's glyph, drawn as Clover's controls draw theirs, in place of MapLibre's
 * (`Map.css`): an svg of its own, never a CSS image, which a strict Content Security
 * Policy refuses as `data:` (`img-src`).
 */
function MapGlyph({ name }: { name: string }) {
  const Glyph = GLYPHS[name];
  if (!Glyph) return null;
  return (
    <svg
      className="clover-geomap-glyph"
      viewBox="0 0 512 512"
      fill="currentColor"
      stroke="currentColor"
      focusable="false"
      aria-hidden="true"
    >
      <Glyph />
    </svg>
  );
}
