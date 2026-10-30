import { isSound, parseAnnotationTarget } from "../../core/annotations";
import { bodiesOf, isPainting } from "../../core/painting";
import type { Rect, SceneImage } from "../../lib/renderer";
import { findImageServiceId } from "../../lib/renderer/sources/imageService";
import { parseTime } from "../../lib/time";
import { choiceKey as keyOf } from "../../core/choice-key";
import { type ViewingDirection, resolveDirection } from "../../core/sequence";
import type { ThumbnailSource } from "../../core/thumbnail";
import { asArray } from "../../lib/asArray";
import { isHls } from "../../lib/hls";

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
  /**
   * Each item, and a small picture of it where its menu shows one (a frame's); its
   * `type` and `format`, by which a recording's first playable item is found.
   */
  items: Array<{
    label?: unknown;
    id?: string;
    image?: string;
    type?: string;
    format?: string;
  }>;
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
  /** Its turn, as an Image API selector's `rotation` writes it (`90`, `!180`). */
  rotation?: string;
  /** Which frame it is, on an animation Canvas painted with every frame. */
  frame?: number;
}

/** Video or sound painted on a Canvas: one media element plays it. */
export interface PaintedMedia {
  kind: "video" | "audio";
  body: Record<string, any>;
  /** Canvas coordinates. The whole Canvas when the target names no region. */
  target: Rect;
  /** Where on the Canvas's time it is painted (`#t=3971.24`), when its target says. */
  time?: { start: number; end?: number };
}

/**
 * One of the files a Canvas paints one after another on its time (Cookbook 0064: an
 * opera's two acts, each a video, the second from where the first ends).
 */
export interface MediaSegment {
  src: string;
  format?: string;
  /** Where on the Canvas's time it starts, in seconds. */
  start: number;
  /** Its own length, as its body or its target gives it. */
  duration?: number;
}

/** A WebVTT file supplementing a Canvas: captions or subtitles. */
export interface CaptionTrack {
  id: string;
  label?: unknown;
  language?: string;
  /** What it is for, as its annotation `provides` it (`timedTextKind`): a track's kind. */
  kind: "captions" | "subtitles";
}

/** A WebVTT file supplementing a Canvas: a caption track, or a transcript alone. */
export interface TimedText extends Omit<CaptionTrack, "kind"> {
  kind: CaptionTrack["kind"] | "transcript";
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
  /**
   * Its files one after another on the Canvas's time, where it paints two or more at
   * different starts: one element plays them as one (`media/sequence.ts`), `src` the
   * first, `duration` the Canvas's.
   */
  segments?: MediaSegment[];
  /**
   * A still to show before playback: the placeholder Canvas's first image, its URL made
   * once its service's `info.json` is read (`useMediaElement`).
   */
  poster?: ThumbnailSource;
  captions: CaptionTrack[];
}

/** A Timeline (sound) has no size; it is laid out at this one, 16:9. */
const TIME_BASED_CANVAS = { width: 1600, height: 900 };

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
  return keyOf(canvas.id, annotation.id, page, index, body);
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
          items: items.map((item) => ({
            label: item.label,
            id: item.id,
            ...(typeof item.type === "string" ? { type: item.type } : {}),
            ...(typeof item.format === "string" ? { format: item.format } : {}),
          })),
        });
      }
    });
  }
  return groups;
}

/** One `audio` and one `video` element, made once, to ask what this browser plays. */
const testers: Partial<Record<"audio" | "video", HTMLMediaElement>> = {};

/**
 * Whether a Choice's item is offered: not a recording this browser says it cannot play
 * (`canPlayType` answering "", neither "probably" nor "maybe"; Mat, 2026-10-29), which
 * the Choice menu lists disabled. Where nothing can be asked (no `format`, no
 * `canPlayType`, a server), it is offered; and HLS, which Clover's own player plays
 * whatever the browser answers.
 */
export function playsHere(item: ChoiceGroup["items"][number]): boolean {
  if (item.type !== "Video" && !isSound(item.type)) return true;
  if (!item.format || isHls(item.id, item.format)) return true;
  if (typeof document === "undefined") return true;
  const kind = item.type === "Video" ? "video" : "audio";
  const tester = (testers[kind] ??= document.createElement(kind));
  if (typeof tester.canPlayType !== "function") return true;
  return tester.canPlayType(item.format) !== "";
}

/**
 * Which item of each Choice starts: its first, as the Choice orders them; where that one
 * is disabled (`playsHere`), the next that is not, walking the menu down (Cookbook 0434;
 * Mat, 2026-10-29). Only those not the first, by key; none where every item is disabled.
 */
export function startingChoices(groups: ChoiceGroup[]): ChoiceSelections {
  const chosen: ChoiceSelections = {};
  for (const group of groups) {
    const first = group.items.findIndex(playsHere);
    if (first > 0) chosen[group.key] = first;
  }
  return chosen;
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

/** Whether a painting paints video or sound, its `Choice`'s items among its bodies. */
function paintsMedia(annotation: IIIFAnnotation): boolean {
  return bodiesOf(annotation as Record<string, any>).some((body) => {
    const items =
      (body as Record<string, any>)?.type === "Choice"
        ? asArray((body as Record<string, any>).items)
        : [body];
    return (items as Array<Record<string, any>>).some(
      (item) => item?.type === "Video" || isSound(item?.type),
    );
  });
}

/**
 * An animation Canvas's frames: its painting annotations that target a time
 * (`canvas#t=0,0.5`), in time order. Fewer than two is no animation, nor are a Canvas's
 * timed paintings when every one is video or sound: those are its recording in files,
 * played one after another (`mediaSegments`; Cookbook 0064). Read as a timeline: each
 * frame shows from its start until its own end, so several may show at once (Cookbook
 * 0489: an image and a video over it, from 11 s to 42 s); one with no end until the next
 * one starts, and the last until the Canvas's `duration` ends (or an even share).
 */
export function animationFrames(canvas: IIIFCanvas): AnimationFrame[] {
  const cached = framesOf.get(canvas);
  if (cached) return cached;
  const frames: AnimationFrame[] = [];
  for (const page of canvas.items ?? []) {
    for (const annotation of page.items ?? []) {
      if (!isPainting(annotation)) continue;
      const t = annotation.target
        ? parseAnnotationTarget(annotation.target as any)?.t
        : undefined;
      if (!t) continue;
      const [start, end] = t.split(",").map(Number);
      if (!Number.isFinite(start)) continue;
      frames.push({ annotation, start, end: Number.isFinite(end) ? end : NaN });
    }
  }
  if (frames.every((frame) => paintsMedia(frame.annotation))) {
    framesOf.set(canvas, NO_FRAMES);
    return NO_FRAMES;
  }
  frames.sort((a, b) => a.start - b.start);
  // A timeline: each frame shows until the next starts, the last until the Canvas ends.
  const duration = Number((canvas as { duration?: number }).duration);
  const share = (Number.isFinite(duration) && duration / frames.length) || 0.5;
  frames.forEach((frame, index) => {
    const next = frames[index + 1]?.start;
    if (frame.end > frame.start) return;
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
      if (!isPainting(annotation)) return;
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
        ...(resolved.rotation ? { rotation: resolved.rotation } : {}),
        target,
        ...(frame >= 0 ? { frame } : {}),
      });
    },
    allFrames,
  );
  return images;
}

/**
 * The video or sound a Canvas or Timeline paints: `Video`, and `Audio` (Presentation 4's
 * name) or `Sound` (Presentation 3's, which the upgrader keeps). A `Choice` of sources (two
 * qualities, say) plays the selected one. One Canvas, one media element: the first is
 * played, or, where they are painted one after another on its time, each in turn
 * (`mediaSegments`).
 */
export function paintedMedia(
  canvas: IIIFCanvas,
  selections: ChoiceSelections = {},
): PaintedMedia[] {
  const media: PaintedMedia[] = [];
  eachPainted(canvas, selections, (resolved, target, _frame, t) => {
    const type = resolved.body.type;
    if (type !== "Video" && !isSound(type)) return;
    const time = parseTime(t);
    media.push({
      kind: type === "Video" ? "video" : "audio",
      body: resolved.body,
      target,
      ...(time ? { time } : {}),
    });
  });
  return media;
}

/**
 * The files a Canvas paints one after another on its time, in order: two or more, each
 * with an address and a start of its own (Cookbook 0064). None for a Canvas that paints
 * one, or several at once.
 */
export function mediaSegments(
  media: PaintedMedia[],
): MediaSegment[] | undefined {
  const timed = media.filter(
    (item) => item.time && typeof item.body.id === "string",
  );
  const starts = new Set(timed.map((item) => item.time!.start));
  if (timed.length < 2 || starts.size !== timed.length) return undefined;
  return timed
    .sort((a, b) => a.time!.start - b.time!.start)
    .map((item) => {
      const own =
        Number(item.body.duration) ||
        (item.time!.end !== undefined
          ? item.time!.end - item.time!.start
          : undefined);
      return {
        src: item.body.id,
        ...(item.body.format ? { format: item.body.format } : {}),
        start: item.time!.start,
        ...(own ? { duration: own } : {}),
      };
    });
}

function eachPainted(
  canvas: IIIFCanvas,
  selections: ChoiceSelections,
  visit: (
    resolved: ResolvedBody,
    target: Rect,
    /** The frame it belongs to, or -1 when it is no animation's frame. */
    frame: number,
    /** Its target's time fragment, as written (`0,3971.24`). */
    time?: string,
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
      parsed?.t,
    );
  });
}

/**
 * WebVTT captions and subtitles supplementing a Canvas, which its media shows and its
 * Captions menu offers: its timed text, but a transcript alone.
 */
export function canvasCaptions(canvas: IIIFCanvas): CaptionTrack[] {
  return canvasTimedText(canvas).filter(
    (each): each is CaptionTrack => each.kind !== "transcript",
  );
}

/**
 * What a WebVTT file is for, as its annotation `provides` it (Presentation 4: clients
 * "should process" it): `subtitles` (or `translation`), what is said, in a language, for
 * a reader who hears it; `closedCaptions`, what is heard, for one who does not, speech
 * and the sounds that carry meaning; `transcript` alone, the words without those sounds,
 * read in the Transcript and never offered as captions, which they are not. Where it
 * provides nothing (Presentation 3), or only what timed text is not (`audioDescription`),
 * captions, as before.
 */
function timedTextKind(annotation: Record<string, any>): TimedText["kind"] {
  const provides = asArray(annotation.provides);
  if (provides.includes("closedCaptions")) return "captions";
  if (provides.includes("subtitles") || provides.includes("translation"))
    return "subtitles";
  if (provides.includes("transcript")) return "transcript";
  return "captions";
}

/**
 * The WebVTT files supplementing a Canvas, from its `annotations` (and, leniently, its
 * `items`), each with what it is for (`timedTextKind`). A `Choice` of files, one per
 * language, offers them all.
 */
export function canvasTimedText(canvas: IIIFCanvas): TimedText[] {
  const tracks: TimedText[] = [];
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
            kind: timedTextKind(annotation),
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
 * A Canvas's transcripts as plain text (`text/plain`), in order: from its `supplementing`
 * annotations (Presentation 4's `provides: transcript`, Cookbook 0253), then its
 * `rendering` (Cookbook 0017). Each file once. Of a recording, what is said; of an
 * image, what is written on it (a page's OCR, a letter's transcription).
 */
export function canvasTextTranscripts(canvas: IIIFCanvas): TextTranscript[] {
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

/** A painting body, as painted: the resource, and the part of it shown and how turned. */
type ResolvedBody = {
  body: Record<string, any>;
  region?: string;
  rotation?: string;
};

export function resolveBody(raw: unknown, choice = 0): ResolvedBody | null {
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
      (s: any) => s?.type === "ImageApiSelector",
    ) as { region?: string; rotation?: string | number } | undefined;
    const inner = resolveBody({ type: "Image", ...source });
    if (!inner) return null;
    // Turned by the selector (Cookbook 0040), never by a stylesheet (0045's rule).
    const rotation =
      selector?.rotation != null ? String(selector.rotation) : undefined;
    return {
      ...inner,
      region: selector?.region || inner.region,
      ...(rotation ? { rotation } : {}),
    };
  }
  if (body.type !== "Image" && body.type !== "Video" && !isSound(body.type)) {
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
  {
    standIns = true,
  }: {
    /**
     * Sound's accompanying or placeholder images in the scene, in place of its picture.
     * Off for a lone recording, which plays as a player and shows them as its artwork
     * (`media/Player.tsx`), so the renderer draws nothing for it.
     */
    standIns?: boolean;
  } = {},
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
      standIns &&
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
    painted.forEach(
      ({ body, target, region, rotation, frame, canvas: owner }, n) => {
        const service = findImageServiceId(body.service);
        if (!service && !body.id) return;
        const id = `${owner.id}|${n}|${body.id ?? service}|${region ?? ""}|${rotation ?? ""}`;
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
          ...(rotation ? { rotation } : {}),
          placement: toWorld(target),
          ...(frame != null && frame !== selectedFrame ? { hidden: true } : {}),
        });
        if (frame != null) {
          const list = (frames[frameKey(canvas)] ??= []);
          (list[frame] ??= []).push(id);
        }
      },
    );

    const [first] = sounds;
    if (first?.body.id) {
      // Files one after another on its time play as one, from the earliest.
      const segments = mediaSegments(sounds);
      const lead = segments ? segments[0] : undefined;
      media.push({
        id: `${canvas.id}|media|${first.body.id}`,
        kind: first.kind,
        src: lead?.src ?? first.body.id,
        format: lead ? lead.format : first.body.format,
        placement: toWorld(first.target),
        duration: segments
          ? Number(canvas.duration) || undefined
          : Number(first.body.duration ?? canvas.duration) || undefined,
        ...(segments ? { segments } : {}),
        poster: posterFor(canvas),
        captions: canvasCaptions(canvas),
      });
    }
  });
  return { images, media, placements, frames };
}

/** The placeholder Canvas's first image, as a still for a video's poster frame. */
function posterFor(canvas: IIIFCanvas): ThumbnailSource | undefined {
  return placeholderStill(canvas)?.source;
}

/** The size a placeholder's still is asked at: one that fills a Body, never more than it has. */
export const STILL_SIZE = 1280;

/**
 * A Canvas's placeholder, as one still image: its placeholder Canvas's first painted
 * image, as a source (`ThumbnailSource`): its image service, asked for a size that fills
 * a Body only once its own `info.json` is read and as that allows (`resolveThumbnail`,
 * `STILL_SIZE`; Mat, 2026-10-24: never a URL written from the service's id), or else the
 * image itself. Shown fitted before the Canvas is opened, and as a video's poster frame.
 */
export function placeholderStill(
  canvas: IIIFCanvas,
): { source: ThumbnailSource; width: number; height: number } | undefined {
  const placeholder = canvas.placeholderContainer;
  if (!placeholder) return undefined;
  const body = paintedImages(placeholder)[0]?.body;
  if (!body) return undefined;
  const service = findImageServiceId(body.service);
  const id = typeof body.id === "string" ? body.id : undefined;
  const source = service
    ? { service, fallback: id }
    : id
      ? { src: id }
      : undefined;
  if (!source) return undefined;
  const { width, height } = canvasSize(placeholder);
  return { source, width, height };
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
