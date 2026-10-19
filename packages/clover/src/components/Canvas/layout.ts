import { bodiesOf, parseAnnotationTarget } from "../../core/annotations";
import type { Rect, SceneImage } from "../../lib/renderer";
import { findImageServiceId } from "../../lib/renderer";
import { type ViewingDirection, resolveDirection } from "../../core/sequence";

export { type ViewingDirection, resolveDirection };

/**
 * What `Canvas` draws: the IIIF Canvases it is handed, each with the images, video and
 * sound it paints.
 *
 * Pure and React-free. It reads Presentation 4 Canvases and Timelines (Clover's one data
 * shape; see `core/presentation.ts`), with their annotation pages embedded, and turns them
 * into scene images placed in the world. Which Canvases to hand over — one, or a spread —
 * is the host's decision; see `core/sequence.ts`.
 */

/** The parts of a Presentation 4 Canvas (or Timeline) this module reads. */
export interface IIIFCanvas {
  id: string;
  type?: string;
  width?: number;
  height?: number;
  behavior?: string[] | string;
  label?: unknown;
  /** Descriptive text and label/value pairs, shown from the Canvas's information control. */
  summary?: unknown;
  metadata?: Array<{ label?: unknown; value?: unknown }>;
  /** Seconds, on a time-based Canvas. */
  duration?: number;
  items?: Array<{ items?: Array<IIIFAnnotation> }>;
  /** Non-painting annotations, embedded: captions are `supplementing` WebVTT here. */
  annotations?: Array<{ items?: Array<IIIFAnnotation> }>;
  /** Other forms of it: a transcript as plain text, among them. */
  rendering?: unknown;
  /** Shown before the Canvas is opened, and before playback begins. */
  placeholderContainer?: IIIFCanvas;
  /** Shown while sound plays, which has no picture of its own. */
  accompanyingContainer?: IIIFCanvas;
}

interface IIIFAnnotation {
  id?: string;
  motivation?: string | string[];
  body?: unknown;
  target?: unknown;
}

/**
 * A painting annotation whose body is a `Choice`: alternative images of the same thing
 * (natural light and X-ray, say). One is painted at a time, the first by default.
 */
export interface ChoiceGroup {
  /** Identifies this Choice across renders: the selection is keyed by it. */
  key: string;
  canvasId: string;
  /** The Choice's own `label`, when the Manifest gives it one. */
  label?: unknown;
  /** Each item, and a small picture of it where its menu shows one (a frame's). */
  items: Array<{ label?: unknown; id?: string; image?: string }>;
}

/** Which item of each Choice to paint, by `ChoiceGroup.key`. Missing means the first. */
export type ChoiceSelections = Record<string, number>;

/** One image painted on a Canvas, and the area of the Canvas it paints. */
export interface PaintedImage {
  body: Record<string, any>;
  /** Canvas coordinates. The whole Canvas when the target names no region. */
  target: Rect;
  /** A region of the image itself (an Image API selector or `body.region`). */
  region?: string;
  /** Which frame it is, on an animation Canvas painted with every frame. */
  frame?: number;
}

/** Video or sound painted on a Canvas: one media element plays it. */
export interface PaintedMedia {
  kind: "video" | "audio";
  body: Record<string, any>;
  /** Canvas coordinates. The whole Canvas when the target names no region. */
  target: Rect;
}

/** A WebVTT file supplementing a Canvas: captions or subtitles. */
export interface CaptionTrack {
  id: string;
  label?: unknown;
  language?: string;
}

/** The media of the Canvases handed in, placed in the world. */
export interface MediaPlacement {
  /** Stable for a Canvas and its chosen source. */
  id: string;
  kind: "video" | "audio";
  src: string;
  format?: string;
  /** World units. */
  placement: Rect;
  duration?: number;
  /** A still to show before playback: the placeholder Canvas's first image. */
  poster?: string;
  captions: CaptionTrack[];
}

/** A Timeline (sound) has no size; it is laid out at this one, 16:9. */
const TIME_BASED_CANVAS = { width: 1600, height: 900 };

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value];

/**
 * Where each Canvas sits in the world.
 *
 * One Canvas fills the world. Several are laid along the reading axis — horizontally for
 * `left-to-right` and `right-to-left`, vertically for `top-to-bottom` and `bottom-to-top`
 * — in reading order, so a right-to-left spread puts its first page on the right. Across
 * the axis they are matched in size (a common height in a row, a common width in a
 * column), as the pages of an open book are, at the first Canvas's own size. World units
 * are therefore the first Canvas's coordinates, which is what an `xywh` refers to.
 */
export function arrangeCanvases(
  canvases: IIIFCanvas[],
  direction: ViewingDirection,
): Rect[] {
  const placements: Rect[] = new Array(canvases.length);
  if (!canvases.length) return placements;
  const sizes = canvases.map(canvasSize);
  const horizontal =
    direction === "left-to-right" || direction === "right-to-left";
  const reversed =
    direction === "right-to-left" || direction === "bottom-to-top";
  const common = horizontal ? sizes[0].height : sizes[0].width;

  const order = canvases.map((_, index) => index);
  if (reversed) order.reverse();

  let along = 0;
  for (const index of order) {
    const size = sizes[index];
    const scale = common / (horizontal ? size.height : size.width);
    const width = size.width * scale;
    const height = size.height * scale;
    placements[index] = horizontal
      ? { x: along, y: 0, width, height }
      : { x: 0, y: along, width, height };
    along += horizontal ? width : height;
  }
  return placements;
}

/**
 * A Canvas's coordinate space. One without dimensions — sound has only a duration —
 * takes its accompanying or placeholder Canvas's, then its first image's or video's, then
 * a 16:9 frame.
 */
export function canvasSize(canvas: IIIFCanvas): {
  width: number;
  height: number;
} {
  if (canvas.width && canvas.height) {
    return { width: canvas.width, height: canvas.height };
  }
  const companion = companionCanvas(canvas);
  if (companion?.width && companion.height) {
    return { width: companion.width, height: companion.height };
  }
  const first = paintedImages(canvas)[0]?.body ?? paintedMedia(canvas)[0]?.body;
  const width = Number(first?.width);
  const height = Number(first?.height);
  return width > 0 && height > 0 ? { width, height } : TIME_BASED_CANVAS;
}

/**
 * The Canvas whose images stand in for sound's missing picture: the accompanying Canvas
 * (meant to be shown during playback), else the placeholder.
 */
function companionCanvas(canvas: IIIFCanvas): IIIFCanvas | undefined {
  return canvas.accompanyingContainer ?? canvas.placeholderContainer;
}

/** A stable key for the `Choice` in one body of one painting annotation. */
function choiceKey(
  canvas: IIIFCanvas,
  annotation: IIIFAnnotation,
  page: number,
  index: number,
  body: number,
): string {
  return `${canvas.id}|${annotation.id ?? `${page}:${index}`}|${body}`;
}

/** Every painting annotations' `Choice` across the Canvases, in painting order. */
export function findChoices(canvases: IIIFCanvas[]): ChoiceGroup[] {
  const groups: ChoiceGroup[] = [];
  for (const canvas of canvases) {
    eachPaintingBody(canvas, (raw, key) => {
      const body = raw as Record<string, any> | null;
      if (body?.type !== "Choice") return;
      const items = asArray(body.items).filter(
        (item): item is Record<string, any> =>
          Boolean(item) && typeof item === "object",
      );
      if (items.length > 1) {
        groups.push({
          key,
          canvasId: canvas.id,
          label: body.label,
          items: items.map((item) => ({ label: item.label, id: item.id })),
        });
      }
    });
  }
  return groups;
}

/** One frame of an animation Canvas: a painting annotation shown for a span of time. */
export interface AnimationFrame {
  annotation: IIIFAnnotation;
  /** Seconds, from its target's `#t=start,end`. */
  start: number;
  end: number;
}

const framesOf = new WeakMap<object, AnimationFrame[]>();
const NO_FRAMES: AnimationFrame[] = [];

/**
 * An animation Canvas's frames: its painting annotations that target a time
 * (`canvas#t=0,0.5`), in time order. Fewer than two is no animation. Read as a timeline:
 * each frame shows from its start until the next one starts, and the last until the
 * Canvas's `duration` ends (or its own end, or an even share).
 */
export function animationFrames(canvas: IIIFCanvas): AnimationFrame[] {
  const cached = framesOf.get(canvas);
  if (cached) return cached;
  const frames: AnimationFrame[] = [];
  for (const page of canvas.items ?? []) {
    for (const annotation of page.items ?? []) {
      const motivations = asArray(annotation.motivation);
      if (motivations.length && !motivations.includes("painting")) continue;
      const t = annotation.target
        ? parseAnnotationTarget(annotation.target as any)?.t
        : undefined;
      if (!t) continue;
      const [start, end] = t.split(",").map(Number);
      if (!Number.isFinite(start)) continue;
      frames.push({ annotation, start, end: Number.isFinite(end) ? end : NaN });
    }
  }
  frames.sort((a, b) => a.start - b.start);
  // A timeline: each frame shows until the next starts, the last until the Canvas ends.
  const duration = Number((canvas as { duration?: number }).duration);
  const share = (Number.isFinite(duration) && duration / frames.length) || 0.5;
  frames.forEach((frame, index) => {
    const next = frames[index + 1]?.start;
    if (next != null) {
      frame.end = next > frame.start ? next : frame.start + share;
    } else if (Number.isFinite(duration) && duration > frame.start) {
      frame.end = duration;
    } else if (!(frame.end > frame.start)) {
      frame.end = frame.start + share;
    }
  });
  const result = frames.length > 1 ? frames : NO_FRAMES;
  framesOf.set(canvas, result);
  return result;
}

/** The `ChoiceSelections` key that holds an animation Canvas's current frame. */
export const frameKey = (canvas: IIIFCanvas) => `frame:${canvas.id}`;

function eachPaintingBody(
  canvas: IIIFCanvas,
  visit: (body: unknown, key: string, annotation: IIIFAnnotation) => void,
) {
  (canvas.items ?? []).forEach((page, p) => {
    (page.items ?? []).forEach((annotation, a) => {
      const motivations = asArray(annotation.motivation);
      if (motivations.length && !motivations.includes("painting")) return;
      bodiesOf(annotation as Record<string, any>).forEach((body, b) =>
        visit(body, choiceKey(canvas, annotation, p, a, b), annotation),
      );
    });
  });
}

/**
 * The images a Canvas paints, in painting order (later paints over earlier).
 *
 * - A `Choice` paints the item `selections` names, or its first — the spec's default.
 * - A `SpecificResource` body paints its `source`, cropped by an Image API selector's
 *   `region` when it has one.
 * - The target's `#xywh=` places the image on part of the Canvas — one photograph inset
 *   in another (Cookbook recipe 0036) — and the image is scaled to fill that area.
 * - Non-image bodies (sound, video, text) are skipped here.
 */
export function paintedImages(
  canvas: IIIFCanvas,
  selections: ChoiceSelections = {},
  /** An animation's every frame, each marked with its number, not just the one shown. */
  { allFrames = false }: { allFrames?: boolean } = {},
): PaintedImage[] {
  const images: PaintedImage[] = [];
  eachPainted(
    canvas,
    selections,
    (resolved, target, frame) => {
      if (resolved.body.type !== "Image") return;
      images.push({
        body: resolved.body,
        region: resolved.region,
        target,
        ...(frame >= 0 ? { frame } : {}),
      });
    },
    allFrames,
  );
  return images;
}

/**
 * The video or sound a Canvas paints. A `Choice` of sources (two qualities, say) plays
 * the selected one. Only the first is played: one Canvas, one media element.
 */
export function paintedMedia(
  canvas: IIIFCanvas,
  selections: ChoiceSelections = {},
): PaintedMedia[] {
  const media: PaintedMedia[] = [];
  eachPainted(canvas, selections, (resolved, target) => {
    const type = resolved.body.type;
    if (type !== "Video" && type !== "Sound") return;
    media.push({
      kind: type === "Video" ? "video" : "audio",
      body: resolved.body,
      target,
    });
  });
  return media;
}

function eachPainted(
  canvas: IIIFCanvas,
  selections: ChoiceSelections,
  visit: (
    resolved: { body: Record<string, any>; region?: string },
    target: Rect,
    /** The frame it belongs to, or -1 when it is no animation's frame. */
    frame: number,
  ) => void,
  allFrames = false,
) {
  const width = canvas.width ?? 0;
  const height = canvas.height ?? 0;
  // An animation paints one frame, the selected one (the first by default), unless all
  // are asked for.
  const frames = animationFrames(canvas);
  const selected = Math.min(
    selections[frameKey(canvas)] ?? 0,
    Math.max(0, frames.length - 1),
  );
  eachPaintingBody(canvas, (rawBody, key, annotation) => {
    const frame = frames.findIndex((f) => f.annotation === annotation);
    if (!allFrames && frame >= 0 && frame !== selected) return;
    const resolved = resolveBody(rawBody, selections[key] ?? 0);
    if (!resolved) return;
    const parsed = annotation.target
      ? parseAnnotationTarget(annotation.target as any)
      : undefined;
    const rect = parsed?.rect;
    visit(
      resolved,
      rect
        ? { x: rect.x, y: rect.y, width: rect.w, height: rect.h }
        : {
            x: 0,
            y: 0,
            width: width || Number(resolved.body.width) || 0,
            height: height || Number(resolved.body.height) || 0,
          },
      frame,
    );
  });
}

/**
 * WebVTT captions supplementing a Canvas, from its `annotations` (and, leniently, its
 * `items`). A `Choice` of caption files — one per language — offers them all.
 */
export function canvasCaptions(canvas: IIIFCanvas): CaptionTrack[] {
  const tracks: CaptionTrack[] = [];
  const pages = [...(canvas.annotations ?? []), ...(canvas.items ?? [])];
  for (const page of pages) {
    for (const annotation of page.items ?? []) {
      if (!asArray(annotation.motivation).includes("supplementing")) continue;
      for (const raw of asArray(annotation.body)) {
        const body = raw as Record<string, any>;
        const bodies = body?.type === "Choice" ? asArray(body.items) : [body];
        for (const candidate of bodies as Array<Record<string, any>>) {
          const id = candidate?.id;
          const isVtt =
            candidate?.format === "text/vtt" ||
            (typeof id === "string" && /\.vtt(\?|$)/i.test(id));
          if (!isVtt || typeof id !== "string") continue;
          tracks.push({
            id,
            label: candidate.label,
            language: asArray(candidate.language)[0] as string | undefined,
          });
        }
      }
    }
  }
  return tracks;
}

/** A transcript of a Canvas as plain text, untimed: a file of the words, in a language. */
export interface TextTranscript {
  id: string;
  label?: unknown;
  language?: string;
}

/**
 * A time-based Canvas's transcripts as plain text (`text/plain`), in order: from its
 * `supplementing` annotations (Presentation 4's `provides: transcript`, Cookbook 0253),
 * then its `rendering` (Cookbook 0017). Each file once. Only a Canvas with a `duration`:
 * the plain text of a page's image is its text, not a transcript of something heard.
 */
export function canvasTextTranscripts(canvas: IIIFCanvas): TextTranscript[] {
  if (!(Number(canvas.duration) > 0)) return [];
  const found: TextTranscript[] = [];
  const add = (raw: unknown) => {
    const candidate = raw as Record<string, any> | undefined;
    const id = candidate?.id;
    if (typeof id !== "string" || found.some((each) => each.id === id)) return;
    const format = candidate?.format;
    if (format ? format !== "text/plain" : !/\.txt(\?|$)/i.test(id)) return;
    found.push({
      id,
      label: candidate?.label,
      language: asArray(candidate?.language)[0] as string | undefined,
    });
  };
  const pages = [...(canvas.annotations ?? []), ...(canvas.items ?? [])];
  for (const page of pages) {
    for (const annotation of page.items ?? []) {
      if (!asArray(annotation.motivation).includes("supplementing")) continue;
      for (const raw of asArray(annotation.body)) {
        const body = raw as Record<string, any>;
        (body?.type === "Choice" ? asArray(body.items) : [body]).forEach(add);
      }
    }
  }
  asArray(canvas.rendering).forEach(add);
  return found;
}

export function resolveBody(
  raw: unknown,
  choice = 0,
): { body: Record<string, any>; region?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, any>;

  if (body.type === "Choice") {
    const items = asArray(body.items);
    return resolveBody(items[choice] ?? items[0]);
  }
  if (body.type === "SpecificResource" && body.source) {
    const source =
      typeof body.source === "string" ? { id: body.source } : body.source;
    const selector = asArray(body.selector).find(
      (s: any) => s?.type === "ImageApiSelector" && s.region,
    ) as { region?: string } | undefined;
    const inner = resolveBody({ type: "Image", ...source });
    return inner
      ? { ...inner, region: selector?.region ?? inner.region }
      : null;
  }
  if (body.type !== "Image" && body.type !== "Video" && body.type !== "Sound") {
    return null;
  }
  return {
    body,
    region: typeof body.region === "string" ? body.region : undefined,
  };
}

/**
 * The scene for the Canvases handed in: every image each one paints, placed in the
 * world. Ids are stable per Canvas and image, so a host moving between pages keeps
 * decoded tiles for any Canvas it shows again.
 */
export function canvasScene(
  canvases: IIIFCanvas[],
  direction: ViewingDirection,
  selections: ChoiceSelections = {},
): {
  images: SceneImage[];
  media: MediaPlacement[];
  placements: Rect[];
  /**
   * For each animation Canvas (by `frameKey`), the ids of the images each frame paints.
   * Every frame is in `images`, all but the selected one `hidden`, so a frame is shown by
   * `setHidden` and nothing is loaded again.
   */
  frames: Record<string, string[][]>;
} {
  const placements = arrangeCanvases(canvases, direction);
  const images: SceneImage[] = [];
  const media: MediaPlacement[] = [];
  const frames: Record<string, string[][]> = {};

  canvases.forEach((canvas, index) => {
    const place = placements[index];
    const size = canvasSize(canvas);
    const kx = place.width / size.width;
    const ky = place.height / size.height;
    const toWorld = (target: Rect): Rect => ({
      x: place.x + target.x * kx,
      y: place.y + target.y * ky,
      width: target.width * kx,
      height: target.height * ky,
    });

    const sounds = paintedMedia(canvas, selections);
    const painted = paintedImages(canvas, selections, {
      allFrames: true,
    }).map((image) => ({
      ...image,
      canvas,
    }));

    /*
     * Sound has no picture, so the Canvas shows its accompanying (or placeholder)
     * Canvas's images instead, stretched over it — as the Player shows a poster.
     */
    const companion = companionCanvas(canvas);
    if (
      !painted.length &&
      sounds.some((m) => m.kind === "audio") &&
      companion
    ) {
      const companionSize = canvasSize(companion);
      for (const image of paintedImages(companion)) {
        painted.push({
          ...image,
          canvas: companion,
          target: {
            x: (image.target.x / companionSize.width) * size.width,
            y: (image.target.y / companionSize.height) * size.height,
            width: (image.target.width / companionSize.width) * size.width,
            height: (image.target.height / companionSize.height) * size.height,
          },
        });
      }
    }

    const selectedFrame = selections[frameKey(canvas)] ?? 0;
    painted.forEach(({ body, target, region, frame, canvas: owner }, n) => {
      const service = findImageServiceId(body.service);
      if (!service && !body.id) return;
      const id = `${owner.id}|${n}|${body.id ?? service}|${region ?? ""}`;
      /*
       * A region read through a service is in the service's own coordinates (Image API
       * §4.1), so the service's size counts, not the body's: a body may declare the size
       * of a cropped derivative while carrying the whole image's service (Cookbook-style
       * 0688, a stereo card cropped to each eye).
       */
      const declared = !(service && region);
      images.push({
        id,
        service,
        url: body.id,
        width: (declared && Number(body.width)) || undefined,
        height: (declared && Number(body.height)) || undefined,
        region,
        placement: toWorld(target),
        ...(frame != null && frame !== selectedFrame ? { hidden: true } : {}),
      });
      if (frame != null) {
        const list = (frames[frameKey(canvas)] ??= []);
        (list[frame] ??= []).push(id);
      }
    });

    const [first] = sounds;
    if (first?.body.id) {
      media.push({
        id: `${canvas.id}|media|${first.body.id}`,
        kind: first.kind,
        src: first.body.id,
        format: first.body.format,
        placement: toWorld(first.target),
        duration: Number(first.body.duration ?? canvas.duration) || undefined,
        poster: posterFor(canvas),
        captions: canvasCaptions(canvas),
      });
    }
  });
  return { images, media, placements, frames };
}

/** The placeholder Canvas's first image, as a still for a video's poster frame. */
function posterFor(canvas: IIIFCanvas): string | undefined {
  return placeholderStill(canvas)?.src;
}

/**
 * A Canvas's placeholder, as one still image: its placeholder Canvas's first painted
 * image, asked of its image service at a size that fills a stage, or else its `id`.
 * Shown fitted before the Canvas itself is opened, and as a video's poster frame.
 */
export function placeholderStill(
  canvas: IIIFCanvas,
): { src: string; width: number; height: number } | undefined {
  const placeholder = canvas.placeholderContainer;
  if (!placeholder) return undefined;
  const body = paintedImages(placeholder)[0]?.body;
  if (!body) return undefined;
  const service = findImageServiceId(body.service);
  const src = service
    ? `${service}/full/!1280,1280/0/default.jpg`
    : (body.id as string | undefined);
  if (!src) return undefined;
  const { width, height } = canvasSize(placeholder);
  return { src, width, height };
}

/** A rectangle in a Canvas's own coordinates, in world units. */
export function canvasRectToWorld(
  canvas: IIIFCanvas,
  placement: Rect,
  rect: Rect,
): Rect {
  const size = canvasSize(canvas);
  const kx = placement.width / size.width;
  const ky = placement.height / size.height;
  return {
    x: placement.x + rect.x * kx,
    y: placement.y + rect.y * ky,
    width: rect.width * kx,
    height: rect.height * ky,
  };
}
