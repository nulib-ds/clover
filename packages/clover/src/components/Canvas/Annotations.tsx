import type { Annotation } from "@iiif/presentation-3";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import type { IIIFCanvas } from "./layout";
import { type TrackKey, annotationTargets, boxAt, orderKeys } from "./track";
import type { SvgReader } from "./useSvgReader";
import { readBodies } from "../../core/annotation-bodies";
import { annotationName } from "../../core/annotation-name";
import { parseAnnotationTarget } from "../../core/annotations";
import { bodiesOf } from "../../core/painting";
import { type AnnotationLink, readLink } from "../../core/link";
import type { SvgShape } from "../../core/svg-shape";
import { parseTime } from "../../lib/time";
import { type LanguageMapLike, localize } from "../../core/value";
import { Tip } from "../../ui/Tip";
import type { CanvasRenderer, Rect } from "../../lib/renderer";
import { overlaysOf } from "../../lib/renderer/overlays/OverlayLayer";
import { languageProps } from "../../i18n/direction";

export interface CanvasAnnotation {
  annotation: Annotation;
  /** Which image in the scene the annotation targets (its index in `body`/`src`). */
  targetIndex: number;
  /** Its AnnotationPage's `label`, which the menu and a recording's cues show it under. */
  pageLabel?: LanguageMapLike;
  /** Its AnnotationPage's `id`, by which the menu hides its page (`hiddenPages`). */
  pageId?: string;
  /** A Range's region: its place among the Range's parts (`AnnotationEntry`'s). */
  place?: { index: number; total: number };
  /**
   * An annotation of one item of a `Choice` (Cookbook 0326): drawn while that item is the
   * one chosen, by the choice's key and the item's place (`AnnotationEntry`'s).
   */
  layer?: { key: string; item: number };
}

/**
 * Where an annotation's rectangle sits in the world, or null if it is not on screen.
 * `rect` is in its target's own coordinates (an image, or a IIIF Canvas).
 */
export type AnnotationPlacer = (
  rect: Rect,
  targetId: string | undefined,
  targetIndex: number,
) => Rect | null;

/** An annotation placed in the world: its box, and the shape drawn in it. */
export interface PlacedAnnotation {
  id: string;
  /** Its text, if it has any: what its hotspot and its menu item are called. */
  label?: string;
  /** The language its text is in, as its body says; undefined when it says none. */
  lang?: string;
  /**
   * In world units: the rectangle, the box an SVG shape fills, or the box around a point
   * (what zooming to it frames).
   */
  world: Rect;
  /** A point's marker, or an SVG shape drawn in `world`; a rectangle needs neither. */
  shape?: { kind: "point" } | { kind: "svg"; svg: SvgShape };
  /** A Range's region: its place among the Range's parts, shown after its name. */
  place?: { index: number; total: number };
  /**
   * Where it is through a recording, for one whose targets give a region and a time each
   * (`xywh=…&t=…`): its keys in time order, in world units. Its hotspot follows the
   * recording there, and is gone between them; `world` is the first key's region.
   */
  track?: TrackKey[];
  /** Where a `linking` annotation leads (Cookbook 0022): pressing it follows. */
  link?: AnnotationLink;
  /** An image it carries (Cookbook 0377), shown in its popover above its text. */
  image?: string;
  /** Its AnnotationPage's label, read: the menu lists it under it. */
  page?: { text: string; lang?: string };
  /** Its AnnotationPage's id, by which the menu hides and shows its page. */
  pageId?: string;
}

/**
 * An annotation on a stretch of a recording's time (`#t=`, Cookbook 0103): its cue shows
 * while that stretch plays, as a caption's does, and picking it goes there.
 */
export interface TimedAnnotation {
  id: string;
  label?: string;
  lang?: string;
  /** In seconds. */
  start: number;
  end?: number;
  page?: { text: string; lang?: string };
  pageId?: string;
}

/** What the Canvas's annotations menu lists: those on its picture, and on its time. */
export type ListedAnnotation = PlacedAnnotation | TimedAnnotation;

export const isTimed = (
  annotation: ListedAnnotation,
): annotation is TimedAnnotation => "start" in annotation;

/** Where an annotation on a recording's time starts: its own start, or its track's. */
export const startOf = (annotation: ListedAnnotation): number | undefined =>
  isTimed(annotation) ? annotation.start : annotation.track?.[0]?.start;

/**
 * Whether a tracked annotation is on the recording at `time`; true for any other, whose
 * hotspot does not come and go.
 */
export const onAt = (annotation: PlacedAnnotation, time: number): boolean =>
  !annotation.track || boxAt(annotation.track, time) !== null;

/**
 * Goes to a tracked annotation on its recording: to where it starts, unless it is on the
 * recording now. Whether the recording was moved.
 */
export function goToTrack(
  annotation: PlacedAnnotation,
  media: HTMLMediaElement,
): boolean {
  if (onAt(annotation, media.currentTime)) return false;
  media.currentTime = annotation.track![0].start;
  return true;
}

/**
 * Its keys, placed: each target with a region and a time, in time order. None for an
 * annotation whose first target is not one, which is drawn as it is (a region, a point
 * or a shape) and follows nothing.
 */
function trackOf(
  annotation: Annotation,
  place: AnnotationPlacer,
  targetIndex: number,
): TrackKey[] | null {
  const targets = annotationTargets(annotation?.target);
  if (!targets[0]?.rect || !targets[0]?.t) return null;
  const keys: TrackKey[] = [];
  for (const target of targets) {
    const time = parseTime(target.t?.replace(/^npt:/, ""));
    if (!target.rect || !time) continue;
    const { x, y, w, h } = target.rect;
    const world = place({ x, y, width: w, height: h }, target.id, targetIndex);
    if (world)
      keys.push({ start: time.start, end: time.end ?? Infinity, world });
  }
  return keys.length ? orderKeys(keys) : null;
}

/** An AnnotationPage's label, in the reader's language; none for one without. */
function pageOf(
  label: LanguageMapLike | undefined,
  language?: string,
): { page?: { text: string; lang?: string } } {
  const { text, lang } = localize(label as any, language);
  return text ? { page: { text, ...(lang ? { lang } : {}) } } : {};
}

/** The annotations on a stretch of time (`#t=start,end`), in the order given. */
export function timeAnnotations(
  annotations: CanvasAnnotation[],
  language?: string,
): TimedAnnotation[] {
  const timed: TimedAnnotation[] = [];
  for (const { annotation, pageLabel, pageId } of annotations) {
    const target = parseAnnotationTarget([annotation?.target].flat()[0] as any);
    const time = parseTime(target?.t?.replace(/^npt:/, ""));
    if (!time || target.rect || target.point || target.svg) continue;
    const { text, lang } = annotationLabel(annotation, language);
    timed.push({
      id: annotation.id,
      ...(text ? { label: text } : {}),
      ...(lang ? { lang } : {}),
      ...time,
      ...pageOf(pageLabel, language),
      ...(pageId ? { pageId } : {}),
    });
  }
  return timed;
}

/** The box framed around a point, in its target's own units, as 3.x frames one. */
const POINT_BOX = 40;

/**
 * The annotations that can be drawn — a rectangle (`xywh`), a point (PointSelector) or a
 * shape (SvgSelector) on something in the scene — in the order they were given.
 */
export function placeAnnotations(
  annotations: CanvasAnnotation[],
  place: AnnotationPlacer,
  /** Reads SVG shapes; until it has loaded, shapes wait (see `useSvgReader`). */
  readSvg: SvgReader | null = null,
  /** The language to read annotations in, when their bodies offer several. */
  language?: string,
): PlacedAnnotation[] {
  const placed: PlacedAnnotation[] = [];
  for (const {
    annotation,
    targetIndex,
    pageLabel,
    pageId,
    place: partOf,
  } of annotations) {
    const target = parseAnnotationTarget(annotation?.target as any);
    if (!target) continue;
    let rect: Rect | null = null;
    let shape: PlacedAnnotation["shape"];
    const track = trackOf(annotation, place, targetIndex);
    if (track) {
      const { x, y, w, h } = target.rect!;
      rect = { x, y, width: w, height: h };
    } else if (target.rect) {
      const { x, y, w, h } = target.rect;
      rect = { x, y, width: w, height: h };
    } else if (target.point) {
      const { x, y } = target.point;
      rect = {
        x: x - POINT_BOX / 2,
        y: y - POINT_BOX / 2,
        width: POINT_BOX,
        height: POINT_BOX,
      };
      shape = { kind: "point" };
    } else if (target.svg && readSvg) {
      const svg = readSvg(target.svg);
      if (svg) {
        rect = svg.box;
        shape = { kind: "svg", svg };
      }
    }
    if (!rect) continue;
    const world = track ? track[0].world : place(rect, target.id, targetIndex);
    if (!world) continue;
    const { text, lang } = annotationLabel(annotation, language);
    const link = readLink(annotation);
    const image = bodiesOf(annotation as any).find(
      (body) => body?.type === "Image" && /^https?:\/\//i.test(body.id ?? ""),
    )?.id as string | undefined;
    placed.push({
      id: annotation.id,
      label: text,
      ...(lang ? { lang } : {}),
      world,
      ...(shape ? { shape } : {}),
      ...(track ? { track } : {}),
      ...(link ? { link } : {}),
      ...(image ? { image } : {}),
      ...pageOf(pageLabel, language),
      ...(pageId ? { pageId } : {}),
      ...(partOf ? { place: partOf } : {}),
    });
  }
  return placed;
}

interface AnnotationsProps {
  renderer: CanvasRenderer;
  placed: PlacedAnnotation[];
  /** Bumped when the scene is laid out again, so targets are re-placed. */
  sceneVersion: number;
  /** The highlighted annotation: hovered, focused, or picked from the menu. */
  active: string | null;
  /** The picked annotation, exposed as current (WCAG 4.1.2). */
  selected: string | null;
  onActivate: (id: string | null) => void;
  /** A hotspot clicked: zoom to it, and it becomes the menu's current annotation. */
  onSelect: (annotation: PlacedAnnotation) => void;
  /**
   * A linking hotspot pressed, to a Canvas or a Manifest: show it. Without it, such a
   * hotspot is picked as any other. A link to a web page is a link, and needs none.
   */
  onFollow?: (annotation: PlacedAnnotation) => void;
  /**
   * The recording the Canvas plays, whose time a tracked hotspot follows: null while it
   * is on its way, when tracked hotspots wait. Undefined on a Canvas with none, where a
   * track stands at its first region.
   */
  media?: HTMLMediaElement | null;
}

const area = ({ world }: PlacedAnnotation) => world.width * world.height;

/** Whether `inner` lies wholly within `outer`. */
const within = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/** A number for a mask's SVG, to a thousandth (so never in exponent form). */
const unit = (value: number) => String(Math.round(value * 1000) / 1000 || 0);

/**
 * What of `entry` shows while `over`, the active hotspot, stacks above it: all of it but
 * where `over` lies (its rectangle, or its shape), as a vector editor hides what a shape
 * covers, so no other hotspot's lines cross the one picked. Nothing is laid over the
 * picture to do it. An SVG image for `mask-image`, drawn in `entry`'s own world units and
 * stretched to its box, so it holds at any zoom with no work from frame to frame; its
 * box with a tenth to spare on each side, for a shape's edge drawn past it. Null where
 * the two do not meet, and under a point, whose marker covers what it crosses.
 */
export function maskUnder(
  entry: PlacedAnnotation,
  over: PlacedAnnotation,
): string | null {
  const a = entry.world;
  const b = over.world;
  if (
    over.shape?.kind === "point" ||
    b.x >= a.x + a.width ||
    b.x + b.width <= a.x ||
    b.y >= a.y + a.height ||
    b.y + b.height <= a.y
  )
    return null;
  const [w, h] = [a.width, a.height];
  const [x, y] = [b.x - a.x, b.y - a.y];
  const view = `${unit(-w / 10)} ${unit(-h / 10)} ${unit(w * 1.2)} ${unit(h * 1.2)}`;
  const all = `M${unit(-w / 10)} ${unit(-h / 10)}h${unit(w * 1.2)}v${unit(h * 1.2)}h${unit(-w * 1.2)}Z`;
  let body: string;
  if (over.shape?.kind === "svg") {
    // The shape, in black, cut from white: geometry already validated, numbers only.
    const { box, shapes } = over.shape.svg;
    const drawn = shapes
      .map(
        ({ tag, attributes }) =>
          `<${tag} ${Object.entries(attributes)
            .map(([name, value]) => `${name}="${value}"`)
            .join(" ")}/>`,
      )
      .join("");
    body =
      `<mask id="m"><path fill="#fff" d="${all}"/>` +
      `<svg x="${unit(x)}" y="${unit(y)}" width="${unit(b.width)}" height="${unit(b.height)}" ` +
      `viewBox="${box.x} ${box.y} ${Math.max(box.width, 1)} ${Math.max(box.height, 1)}" ` +
      `preserveAspectRatio="none" overflow="visible"><g fill="#000">${drawn}</g></svg>` +
      `</mask><path d="${all}" mask="url(#m)"/>`;
  } else {
    body = `<path fill-rule="evenodd" d="${all}M${unit(x)} ${unit(y)}h${unit(b.width)}v${unit(b.height)}h${unit(-b.width)}Z"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" preserveAspectRatio="none">${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Annotation hotspots: a focusable button over each rectangular target, as `Image` draws
 * them — named by the annotation's text, which its popover (`Tip`) shows on hover and
 * focus (with an image it carries above it), marked active on hover or focus, and zoomed
 * to (with OpenSeadragon's padding) on click, Enter or Space. A linking annotation's
 * follows its link instead (`onFollow`), and one to a web page is a link.
 *
 * Rendered by React into the renderer's overlay layer, which pins each button to its
 * world rectangle every frame.
 */
const Annotations: React.FC<AnnotationsProps> = ({
  renderer,
  placed,
  sceneVersion,
  active,
  selected,
  onActivate,
  onSelect,
  onFollow,
  media,
}) => {
  // Each hotspot's rank by size, largest first, and of two alike the later over the
  // earlier (the sort is stable): the order they stack in.
  const rank = useMemo(() => {
    const ranks = new Map<PlacedAnnotation, number>();
    [...placed]
      .sort((a, b) => area(b) - area(a))
      .forEach((entry, index) => ranks.set(entry, index));
    return ranks;
  }, [placed]);
  const current = placed.find((entry) => entry.id === active);

  /*
   * A pick that follows the recording, not gone to yet (a host's, or one made behind the
   * placeholder), is gone to once its hotspot is placed: to where it starts, unless it is
   * on the recording already. Once for each pick, so a reader's own seeking stays theirs.
   */
  const sought = useRef<string | null>(null);
  useEffect(() => {
    const picked = placed.find((entry) => entry.id === selected && entry.track);
    if (!selected) sought.current = null;
    if (!picked || !media || sought.current === selected) return;
    sought.current = selected;
    goToTrack(picked, media);
  }, [placed, selected, media]);

  /*
   * In the given order, which Tab and a screen reader follow, as the menu lists them
   * (WCAG 2.4.3, 1.3.2). Stacked smaller over larger, so a hotspot inside another stays
   * within reach. The active one goes over them all, so its popover takes the pointer,
   * but those inside it that stack over it at rest stay over it. Only those: if the
   * active one raised its twin (one on the same region), the pointer would land on the
   * twin, which would raise the first, and so on.
   */
  const depthOf = (entry: PlacedAnnotation) => {
    const own = rank.get(entry) ?? 0;
    if (!current) return own;
    if (entry === current) return placed.length;
    // Where either moves, the active one wins: none is raised over it.
    return own > (rank.get(current) ?? 0) &&
      !entry.track &&
      !current.track &&
      within(entry.world, current.world)
      ? placed.length + 1 + own
      : own;
  };

  /*
   * Beneath the active one, each hotspot it meets is masked where it lies (`maskUnder`),
   * set on the element, not rendered: where both stand still, once for each change of
   * active; where either follows a recording, again each frame either moves, from where
   * each is then (`moved`). Nothing is masked under an active one not on the recording
   * now. A mask is written only when it changes.
   */
  const elements = useRef(new Map<string, HTMLElement>());
  const now = useRef(new Map<string, Rect | null>());
  const written = useRef(new WeakMap<HTMLElement, string>());
  const latest = useRef({ placed, current, depthOf });
  latest.current = { placed, current, depthOf };
  const remask = useCallback((only?: PlacedAnnotation) => {
    const { placed, current, depthOf } = latest.current;
    const at = (entry: PlacedAnnotation) => now.current.get(entry.id);
    const over = current && at(current) !== null ? current : undefined;
    const apply = (entry: PlacedAnnotation) => {
      const element = elements.current.get(entry.id);
      if (!element) return;
      const world = at(entry);
      const mask =
        over &&
        entry !== over &&
        world !== null &&
        depthOf(entry) < placed.length
          ? maskUnder(
              { ...entry, world: world ?? entry.world },
              { ...over, world: at(over) ?? over.world },
            )
          : null;
      if ((written.current.get(element) ?? "") === (mask ?? "")) return;
      written.current.set(element, mask ?? "");
      if (mask) element.style.setProperty("--clover-annotation-mask", mask);
      else element.style.removeProperty("--clover-annotation-mask");
    };
    // The active one moved, or went: every other again; another, only that one.
    if (only && only !== current) apply(only);
    else placed.forEach(apply);
  }, []);
  useLayoutEffect(() => remask());
  const register = useCallback((id: string, element: HTMLElement | null) => {
    if (element) elements.current.set(id, element);
    else elements.current.delete(id);
  }, []);
  const moved = useCallback(
    (entry: PlacedAnnotation, world: Rect | null) => {
      now.current.set(entry.id, world);
      remask(entry);
    },
    [remask],
  );

  return createPortal(
    <>
      {placed.map((entry, index) => (
        <AnnotationButton
          key={`${entry.id}|${sceneVersion}`}
          entry={entry}
          // Without text of its own, named by its number, as the menu lists it.
          name={entry.label ?? String(index + 1)}
          lang={entry.label ? entry.lang : undefined}
          depth={depthOf(entry)}
          register={register}
          onMove={moved}
          renderer={renderer}
          active={active === entry.id}
          selected={selected === entry.id}
          onActivate={onActivate}
          onSelect={onSelect}
          onFollow={onFollow}
          media={media}
        />
      ))}
    </>,
    overlaysOf(renderer).container,
  );
};

/** What keeps a hotspot reached by Tab clear of the controls, loaded with the first focus. */
let panning: Promise<typeof import("./panClearOfControls")> | undefined;
const loadPanning = () => (panning ??= import("./panClearOfControls"));

const AnnotationButton: React.FC<{
  entry: PlacedAnnotation;
  /** Its accessible name, which its popover shows: its text, or its number. */
  name: string;
  /** The language of its text, for its name and its popover alike (WCAG 3.1.2). */
  lang?: string;
  /** Where it stacks among the hotspots, higher over lower. */
  depth: number;
  /** Hands the layer its element, which masks it beneath the active one. */
  register: (id: string, element: HTMLElement | null) => void;
  /** Where one that follows a recording is now, or null while it is not there. */
  onMove: (entry: PlacedAnnotation, world: Rect | null) => void;
  renderer: CanvasRenderer;
  active: boolean;
  selected: boolean;
  onActivate: (id: string | null) => void;
  onSelect: (annotation: PlacedAnnotation) => void;
  onFollow?: (annotation: PlacedAnnotation) => void;
  media?: HTMLMediaElement | null;
}> = ({
  entry,
  name,
  lang,
  depth,
  register,
  onMove,
  renderer,
  active,
  selected,
  onActivate,
  onSelect,
  onFollow,
  media,
}) => {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const { id, place } = entry;
  const shownPlace = place && `${place.index} / ${place.total}`;
  const attach = useCallback(
    (node: HTMLElement | null) => {
      setElement(node);
      register(id, node);
    },
    [id, register],
  );
  // Re-pinned when the numbers change, not whenever a new object carries the same ones.
  const { x, y, width, height } = entry.world;

  useEffect(() => {
    if (!element) return;
    const unpin = overlaysOf(renderer).add(element, { x, y, width, height });
    renderer.invalidate();
    return unpin;
  }, [element, renderer, x, y, width, height]);
  // After pinning, so a tracked one is moved from its first region to where it is now.
  const shown = useFollow(
    element,
    entry.track,
    renderer,
    media,
    () => onActivate(null),
    (world) => onMove(entry, world),
  );

  /*
   * A link to a web page is a link (`<a>`), opening it beside the viewer; one to a Canvas
   * or a Manifest, a button that shows it here. Anything else zooms to it.
   */
  const { link } = entry;
  const web = link && !link.canvasId && !link.manifestId ? link.id : undefined;
  const follow = link && !web && onFollow ? () => onFollow(entry) : undefined;
  const Hotspot = (web ? "a" : "button") as "button";
  return (
    <Hotspot
      ref={attach as React.Ref<HTMLButtonElement>}
      {...(web
        ? { href: web, target: "_blank", rel: "noopener noreferrer" }
        : { type: "button" })}
      id={entry.id}
      className="clover-canvas-annotation"
      // A tracked one, away from the recording's present moment, is not there at all.
      hidden={!shown}
      data-active={active ? "true" : "false"}
      data-shape={entry.shape?.kind ?? "rect"}
      data-track={entry.track ? "" : undefined}
      data-link={web || follow ? "true" : undefined}
      // A Range's region's place too, as its popover shows it, in no language (WCAG 2.5.3).
      aria-label={shownPlace ? `${name} ${shownPlace}` : name}
      // A command (zoom to it), not a toggle: pressing the picked one again frames it
      // again, so it is current rather than pressed.
      aria-current={selected ? "true" : undefined}
      {...languageProps(lang)}
      style={
        {
          "--clover-annotation-depth": depth,
        } as React.CSSProperties
      }
      // Enter and leave, not over and out: the pointer crossing onto its own marker or
      // popover keeps it active.
      onMouseEnter={() => onActivate(entry.id)}
      onMouseLeave={() => onActivate(null)}
      onFocus={() => {
        onActivate(entry.id);
        void loadPanning();
      }}
      // A hotspot reached by Tab is brought clear of the controls (the Tab's keyup comes
      // to the hotspot it focused), unless focus has moved on meanwhile. A click or
      // `zoomToAnnotation` frames it anyway.
      onKeyUp={(event) => {
        if (event.key !== "Tab") return;
        const hotspot = event.currentTarget;
        void loadPanning().then(({ panClearOfControls }) => {
          if (document.activeElement === hotspot)
            panClearOfControls(renderer, hotspot);
        });
      }}
      onBlur={() => onActivate(null)}
      // A note longer than the Body scrolls, by the keys that scroll a box (WCAG 1.4.10).
      onKeyDown={scrollNote}
      onClick={(event) => {
        event.stopPropagation();
        if (web) return;
        if (follow) follow();
        else onSelect(entry);
      }}
    >
      {entry.shape?.kind === "point" && (
        <span className="clover-canvas-annotation-point" aria-hidden="true" />
      )}
      {entry.shape?.kind === "svg" && <ShapeOutline svg={entry.shape.svg} />}
      <Tip label={name} scrolls image={entry.image} after={shownPlace} />
    </Hotspot>
  );
};

/**
 * A tracked hotspot follows its recording: moved where its region is in each frame shown
 * while it plays (`requestVideoFrameCallback`, or each display frame for sound), and at
 * each seek while it is paused, by the overlay layer, never a render; and shown only
 * while the recording is within one of its keys. Returns whether it is shown. As its
 * region goes, one that holds focus hands it to the viewport, which holds the hotspots
 * and takes the recording's keys, so focus is never lost (WCAG 2.4.3), and one under the
 * pointer lets go of the highlight (`onGone`).
 */
function useFollow(
  element: HTMLElement | null,
  track: TrackKey[] | undefined,
  renderer: CanvasRenderer,
  media: HTMLMediaElement | null | undefined,
  onGone: () => void,
  /** Where it is now, each time it moves, or null as it goes. */
  onMove: (world: Rect | null) => void,
): boolean {
  const follows = Boolean(track) && media !== undefined;
  const [shown, setShown] = useState(
    () =>
      !follows || (media ? boxAt(track!, media.currentTime) !== null : false),
  );
  const onGoneRef = useRef(onGone);
  onGoneRef.current = onGone;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!track || media === undefined) {
      setShown(true);
      return;
    }
    if (!media) {
      setShown(false);
      return;
    }
    let last: boolean | undefined;
    const update = (time: number) => {
      const box = boxAt(track, time);
      if (box && element) renderer.overlays?.move(element, box);
      onMoveRef.current(box);
      const now = box !== null;
      if (now === last) return;
      last = now;
      if (!now && element) {
        const hovered = element.matches(":hover");
        if (element.contains(document.activeElement)) {
          renderer.overlays?.container.parentElement?.focus({
            preventScroll: true,
          });
        } else if (hovered) onGoneRef.current();
      }
      setShown(now);
    };

    // Frame by frame, at the time of the frame shown; sound has no frames, so each
    // display frame, at the playback position.
    const video = media as HTMLVideoElement;
    const byFrame = () =>
      typeof video.requestVideoFrameCallback === "function" &&
      video.videoWidth > 0;
    let frame = 0;
    let videoFrame = 0;
    const onVideoFrame: VideoFrameRequestCallback = (_, { mediaTime }) => {
      update(mediaTime);
      videoFrame = video.requestVideoFrameCallback(onVideoFrame);
    };
    const tick = () => {
      update(media.currentTime);
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      if (videoFrame) video.cancelVideoFrameCallback(videoFrame);
      frame = videoFrame = 0;
    };
    const start = () => {
      stop();
      if (byFrame()) videoFrame = video.requestVideoFrameCallback(onVideoFrame);
      else frame = requestAnimationFrame(tick);
    };
    const now = () => update(media.currentTime);
    // While it plays, the frames move it; a time reported between them would jump it back.
    const paused = () => media.paused && now();
    const halt = () => {
      stop();
      now();
    };
    const events: Array<[string, () => void]> = [
      ["play", start],
      ["pause", halt],
      ["ended", halt],
      ["seeking", now],
      ["seeked", now],
      ["loadeddata", now],
      ["timeupdate", paused],
    ];
    events.forEach(([type, listener]) =>
      media.addEventListener(type, listener),
    );
    now();
    if (!media.paused) start();
    return () => {
      stop();
      events.forEach(([type, listener]) =>
        media.removeEventListener(type, listener),
      );
    };
  }, [element, track, media, renderer]);

  return shown;
}

/**
 * An SvgSelector's shapes, drawn to fill the hotspot: the viewBox is their box, so they
 * scale with the pinned element. Rebuilt from their read geometry, never the markup.
 *
 * Drawn three times over, for an outline in tones that reads over any picture: a dark
 * edge, a light line on it, and the accent mark the active hotspot shows on that.
 */
const ShapeOutline: React.FC<{ svg: SvgShape }> = ({ svg }) => {
  const { x, y, width, height } = svg.box;
  const shapes = svg.shapes.map(({ tag, attributes }, index) =>
    React.createElement(tag, {
      key: index,
      ...attributes,
      vectorEffect: "non-scaling-stroke",
    }),
  );
  return (
    <svg
      className="clover-canvas-annotation-shape"
      viewBox={`${x} ${y} ${Math.max(width, 1)} ${Math.max(height, 1)}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <g>{shapes}</g>
      <g>{shapes}</g>
      <g>{shapes}</g>
    </svg>
  );
};

/**
 * The annotation's name and the language it is in, as the Annotations list names it
 * (`annotationName`): for its hotspot, the Canvas's menu and a recording's cues.
 */
export function annotationLabel(
  annotation: Annotation,
  language?: string,
): { text?: string; lang?: string } {
  return annotationName(readBodies(annotation as any), language);
}

export default Annotations;

/** How far a key scrolls a popover that scrolls: a line, a page, or to an end. */
const SCROLL_KEYS: Record<string, (tip: HTMLElement) => number> = {
  ArrowDown: () => 32,
  ArrowUp: () => -32,
  PageDown: (tip) => tip.clientHeight - 32,
  PageUp: (tip) => 32 - tip.clientHeight,
  End: (tip) => tip.scrollHeight,
  Home: (tip) => -tip.scrollHeight,
};

/**
 * From its hotspot, the keys that scroll a note longer than the Body (its `Tip`, which
 * `scrolls`), as they would a scrolling box: the arrows, the page keys, Home and End.
 * Returns whether the key was taken, which it is only while there is more to scroll
 * that way.
 */
export function scrollNote(event: React.KeyboardEvent<HTMLElement>): boolean {
  const tip = event.currentTarget.querySelector<HTMLElement>(
    ":scope > .clover-tip",
  );
  const by = SCROLL_KEYS[event.key];
  if (!tip || !by || event.altKey || event.ctrlKey || event.metaKey)
    return false;
  const delta = by(tip);
  const room =
    delta > 0
      ? tip.scrollHeight - tip.clientHeight - tip.scrollTop
      : tip.scrollTop;
  if (room < 1) return false;
  event.preventDefault();
  tip.scrollBy({ top: delta });
  return true;
}

/**
 * The annotations on a whole Canvas, by Canvas (Cookbook 0266): a target with no region,
 * point, shape or time, and a body with something to read or see. The Canvas's caption
 * shows them.
 */
export function wholeCanvasComments(
  annotations: CanvasAnnotation[] | undefined,
  canvases: IIIFCanvas[] | undefined,
): Map<string, CanvasAnnotation["annotation"][]> {
  const byCanvas = new Map<string, CanvasAnnotation["annotation"][]>();
  for (const { annotation, targetIndex } of annotations ?? []) {
    const target = parseAnnotationTarget(
      [annotation?.target].flat()[0] as Parameters<
        typeof parseAnnotationTarget
      >[0],
    );
    if (target.rect || target.point || target.svg || target.t) continue;
    if (
      !bodiesOf(annotation as Record<string, any>).some(
        (body) => typeof body?.value === "string" || body?.type === "Image",
      )
    )
      continue;
    const canvas =
      canvases?.find((each) => each.id === target.id) ??
      (target.id ? undefined : canvases?.[targetIndex]);
    if (!canvas) continue;
    byCanvas.set(canvas.id, [...(byCanvas.get(canvas.id) ?? []), annotation]);
  }
  return byCanvas;
}
