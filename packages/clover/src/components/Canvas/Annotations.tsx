import type { Annotation } from "@iiif/presentation-3";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import type { SvgReader } from "./useSvgReader";
import { bodiesOf, parseAnnotationTarget } from "../../core/annotations";
import type { SvgShape } from "../../core/svg-shape";
import { markdownToPlainText } from "../../core/text";
import { localize } from "../../core/value";
import { Tip } from "../../ui/Tip";
import type { CanvasRenderer, Rect } from "../../lib/renderer";

export interface CanvasAnnotation {
  annotation: Annotation;
  /** Which image in the scene the annotation targets (its index in `body`/`src`). */
  targetIndex: number;
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
  for (const { annotation, targetIndex } of annotations) {
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
    placed.push({
      id: annotation.id,
      label: text,
      ...(lang ? { lang } : {}),
      world,
      ...(shape ? { shape } : {}),
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
}

const area = ({ world }: PlacedAnnotation) => world.width * world.height;

/** Whether `inner` lies wholly within `outer`. */
const within = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/**
 * Annotation hotspots: a focusable button over each rectangular target, as `Image` draws
 * them — named by the annotation's text, which its popover (`Tip`) shows on hover and
 * focus, marked active on hover or focus, and zoomed to (with OpenSeadragon's padding)
 * on click, Enter or Space.
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
          renderer={renderer}
          active={active === entry.id}
          selected={selected === entry.id}
          onActivate={onActivate}
          onSelect={onSelect}
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
  renderer: CanvasRenderer;
  active: boolean;
  selected: boolean;
  onActivate: (id: string | null) => void;
  onSelect: (annotation: PlacedAnnotation) => void;
}> = ({
  entry,
  name,
  lang,
  depth,
  renderer,
  active,
  selected,
  onActivate,
  onSelect,
}) => {
  const [element, setElement] = useState<HTMLButtonElement | null>(null);
  // Re-pinned when the numbers change, not whenever a new object carries the same ones.
  const { x, y, width, height } = entry.world;

  useEffect(() => {
    if (!element) return;
    const unpin = renderer.overlays.add(element, { x, y, width, height });
    renderer.invalidate();
    return unpin;
  }, [element, renderer, x, y, width, height]);

  return (
    <button
      ref={setElement}
      type="button"
      id={entry.id}
      className="clover-canvas-annotation"
      data-active={active ? "true" : "false"}
      data-shape={entry.shape?.kind ?? "rect"}
      aria-label={name}
      // A command (zoom to it), not a toggle: pressing the picked one again frames it
      // again, so it is current rather than pressed.
      aria-current={selected ? "true" : undefined}
      lang={lang}
      style={{ "--clover-annotation-depth": depth } as React.CSSProperties}
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
        onSelect(entry);
      }}
    >
      {entry.shape?.kind === "point" && (
        <span className="clover-canvas-annotation-point" aria-hidden="true" />
      )}
      {entry.shape?.kind === "svg" && <ShapeOutline svg={entry.shape.svg} />}
      <Tip label={name} scrolls />
    </button>
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
  // Markdown's syntax is taken off, so neither the name nor the tip reads it out.
  if (body.format === "text/markdown") {
    const text = markdownToPlainText(value);
    return text ? { text, lang } : {};
  }
  const html =
    typeof body.format === "string"
      ? /html/i.test(body.format)
      : /[<&]/.test(value);
  if (!html || typeof DOMParser === "undefined") return { text: value, lang };
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
