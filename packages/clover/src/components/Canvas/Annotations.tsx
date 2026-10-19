import type { Annotation } from "@iiif/presentation-3";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import type { IIIFCanvas } from "./layout";
import type { SvgReader } from "./useSvgReader";
import { bodiesOf, parseAnnotationTarget } from "../../core/annotations";
import { type AnnotationLink, readLink } from "../../core/link";
import type { SvgShape } from "../../core/svg-shape";
import { markdownToPlainText, readAs } from "../../core/text";
import { parseTime } from "../../core/ranges";
import { type LanguageMapLike, localize } from "../../core/value";
import { Tip } from "../../ui/Tip";
import type { CanvasRenderer, Rect } from "../../lib/renderer";

export interface CanvasAnnotation {
  annotation: Annotation;
  /** Which image in the scene the annotation targets (its index in `body`/`src`). */
  targetIndex: number;
  /** Its AnnotationPage's `label`, which the menu and a recording's cues show it under. */
  pageLabel?: LanguageMapLike;
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
  /** Where a `linking` annotation leads (Cookbook 0022): pressing it follows. */
  link?: AnnotationLink;
  /** An image it carries (Cookbook 0377), shown in its popover above its text. */
  image?: string;
  /** Its AnnotationPage's label, read: the menu lists it under it. */
  page?: { text: string; lang?: string };
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
}

/** What the Canvas's annotations menu lists: those on its picture, and on its time. */
export type ListedAnnotation = PlacedAnnotation | TimedAnnotation;

export const isTimed = (
  annotation: ListedAnnotation,
): annotation is TimedAnnotation => "start" in annotation;

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
  for (const { annotation, pageLabel } of annotations) {
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
  for (const { annotation, targetIndex, pageLabel } of annotations) {
    const target = parseAnnotationTarget(annotation?.target as any);
    if (!target) continue;
    let rect: Rect | null = null;
    let shape: PlacedAnnotation["shape"];
    if (target.rect) {
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
    const world = place(rect, target.id, targetIndex);
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
      ...(link ? { link } : {}),
      ...(image ? { image } : {}),
      ...pageOf(pageLabel, language),
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
    return own > (rank.get(current) ?? 0) && within(entry.world, current.world)
      ? placed.length + 1 + own
      : own;
  };

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
          // Beneath the active one, its lines stop where that one lies.
          mask={
            current && entry !== current && depthOf(entry) < placed.length
              ? maskUnder(entry, current)
              : null
          }
          renderer={renderer}
          active={active === entry.id}
          selected={selected === entry.id}
          onActivate={onActivate}
          onSelect={onSelect}
          onFollow={onFollow}
        />
      ))}
    </>,
    renderer.overlays.container,
  );
};

/** What keeps a hotspot reached by Tab clear of the chrome, loaded with the first focus. */
let panning: Promise<typeof import("./panClearOfChrome")> | undefined;
const loadPanning = () => (panning ??= import("./panClearOfChrome"));

const AnnotationButton: React.FC<{
  entry: PlacedAnnotation;
  /** Its accessible name, which its popover shows: its text, or its number. */
  name: string;
  /** The language of its text, for its name and its popover alike (WCAG 3.1.2). */
  lang?: string;
  /** Where it stacks among the hotspots, higher over lower. */
  depth: number;
  /** What of it shows beneath the active hotspot (`maskUnder`), or null for all of it. */
  mask: string | null;
  renderer: CanvasRenderer;
  active: boolean;
  selected: boolean;
  onActivate: (id: string | null) => void;
  onSelect: (annotation: PlacedAnnotation) => void;
  onFollow?: (annotation: PlacedAnnotation) => void;
}> = ({
  entry,
  name,
  lang,
  depth,
  mask,
  renderer,
  active,
  selected,
  onActivate,
  onSelect,
  onFollow,
}) => {
  const [element, setElement] = useState<HTMLElement | null>(null);
  // Re-pinned when the numbers change, not whenever a new object carries the same ones.
  const { x, y, width, height } = entry.world;

  useEffect(() => {
    if (!element) return;
    const unpin = renderer.overlays.add(element, { x, y, width, height });
    renderer.invalidate();
    return unpin;
  }, [element, renderer, x, y, width, height]);

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
      ref={setElement as React.Ref<HTMLButtonElement>}
      {...(web
        ? { href: web, target: "_blank", rel: "noopener noreferrer" }
        : { type: "button" })}
      id={entry.id}
      className="clover-canvas-annotation"
      data-active={active ? "true" : "false"}
      data-shape={entry.shape?.kind ?? "rect"}
      data-link={web || follow ? "true" : undefined}
      aria-label={name}
      // A command (zoom to it), not a toggle: pressing the picked one again frames it
      // again, so it is current rather than pressed.
      aria-current={selected ? "true" : undefined}
      lang={lang}
      style={
        {
          "--clover-annotation-depth": depth,
          "--clover-annotation-mask": mask ?? undefined,
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
      // A hotspot reached by Tab is brought clear of the chrome (the Tab's keyup comes
      // to the hotspot it focused), unless focus has moved on meanwhile. A click or
      // `zoomToAnnotation` frames it anyway.
      onKeyUp={(event) => {
        if (event.key !== "Tab") return;
        const hotspot = event.currentTarget;
        void loadPanning().then(({ panClearOfChrome }) => {
          if (document.activeElement === hotspot)
            panClearOfChrome(renderer, hotspot);
        });
      }}
      onBlur={() => onActivate(null)}
      // A note longer than the stage scrolls, by the keys that scroll a box (WCAG 1.4.10).
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
      <Tip label={name} scrolls image={entry.image} />
    </Hotspot>
  );
};

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
 * The annotation's text, as plain text. A body may be HTML (`text/html`, or no format at
 * all, as annotations often come); it is read for its text only, never injected as
 * markup. Markdown (`text/markdown`) is read without its syntax. A body that names
 * another format is text as written, a "<" included.
 */
export function annotationText(annotation: Annotation): string | undefined {
  return annotationLabel(annotation).text;
}

/**
 * The annotation's text and the language its body declares. Of bodies in several
 * languages, the one closest to `language` (the reader's by default), as any IIIF text
 * is chosen. An image with no text beside it is named by its label, or its annotation's.
 */
export function annotationLabel(
  annotation: Annotation,
  language?: string,
): { text?: string; lang?: string } {
  const all = bodiesOf(annotation as any);
  const bodies = all.filter(
    (candidate) => typeof candidate?.value === "string",
  );
  if (!bodies.length) {
    const image = all.find((candidate) => candidate?.type === "Image");
    if (!image) return {};
    const { text, lang } = localize(
      image.label ?? (annotation as any).label,
      language,
    );
    return text.trim() ? { text: text.trim(), ...(lang ? { lang } : {}) } : {};
  }
  const tagOf = (body: Record<string, any>) => {
    const tag = [body.language].flat()[0];
    return typeof tag === "string" && tag && tag !== "none" ? tag : "none";
  };
  // The first body in each language, chosen between by `localize`.
  const byTag: Record<string, string[]> = {};
  bodies.forEach((body, index) => {
    byTag[tagOf(body)] ??= [String(index)];
  });
  const body = bodies[Number(localize(byTag, language).text) || 0];
  const value: string = body.value;
  if (!value.trim()) return {};
  const tag = tagOf(body);
  const lang = tag === "none" ? undefined : tag;
  // Read by its format (`readAs`). Markdown's syntax is taken off, so neither the name
  // nor the tip reads it out; HTML is read for its text.
  const kind = readAs(body.format, value);
  if (kind === "markdown") {
    const text = markdownToPlainText(value);
    return text ? { text, lang } : {};
  }
  if (kind === "plain" || typeof DOMParser === "undefined")
    return { text: value, lang };
  const text = new DOMParser()
    .parseFromString(value, "text/html")
    .body.textContent?.trim();
  return text ? { text, lang } : {};
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
 * From its hotspot, the keys that scroll a note longer than the stage (its `Tip`, which
 * `scrolls`), as they would a scrolling box: the arrows, the page keys, Home and End. Returns whether the key was
 * taken, which it is only while there is more to scroll that way.
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
