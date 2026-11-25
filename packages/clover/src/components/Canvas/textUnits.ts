import type { CanvasAnnotation, AnnotationPlacer } from "./Annotations";
import { parseAnnotationTarget, supplementsOnly } from "../../core/annotations";
import { bodiesOf } from "../../core/painting";
import { toPlainText } from "../../core/text";
import { asArray } from "../../lib/asArray";
import type { Rect } from "../../lib/renderer";

/**
 * The text granularities a Canvas makes selectable, finest first: IIIF's Text Granularity
 * extension (https://iiif.io/api/extension/text-granularity/) also names `page`, `block`
 * and `glyph`, which are left alone for now (Mat, 2026-11-16: "paragraph, line, and word
 * at first").
 */
export const GRANULARITIES = ["word", "line", "paragraph"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

const isGranularity = (value: unknown): value is Granularity =>
  GRANULARITIES.includes(value as Granularity);

/**
 * An annotation's `textGranularity`, where it is one Clover selects: the annotation's own,
 * else its body's, where the extension allows it too.
 */
export function granularityOf(annotation: unknown): Granularity | null {
  const given = (annotation as { textGranularity?: unknown })?.textGranularity;
  if (isGranularity(given)) return given;
  for (const body of bodiesOf(annotation as never)) {
    if (isGranularity(body?.textGranularity)) return body.textGranularity;
  }
  return null;
}

/**
 * An annotation's text as plain text, from its first textual body: its HTML's text for
 * `text/html`, else as written, with its runs of white space made one space. The
 * language its body says, if any.
 */
export function plainTextOf(
  annotation: unknown,
): { text: string; lang?: string } | null {
  for (const body of bodiesOf(annotation as never)) {
    const value = body?.value;
    if (typeof value !== "string") continue;
    const format = String(body.format ?? "").toLowerCase();
    const plain = format.startsWith("text/html") ? toPlainText(value) : value;
    const text = plain.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const lang = asArray(body.language).find(
      (each): each is string => typeof each === "string" && each !== "none",
    );
    return lang ? { text, lang } : { text };
  }
  return null;
}

/** One run of text on the picture, in reading order: what a selection takes. */
export interface TextUnit {
  id: string;
  text: string;
  lang?: string;
  /** Its `textGranularity`, where it gives one Clover reads; else unsaid. */
  granularity: Granularity | null;
  /** In world units. */
  world: Rect;
}

interface Read {
  id: string;
  text: string;
  lang?: string;
  granularity: Granularity | null;
  world: Rect;
  target: string;
}

/**
 * The Canvas's selectable text, placed in the world: every `supplementing` annotation on
 * a region (and no time) with words in its body, trusted to transcribe what is painted
 * there (Mat, 2026-11-16: "let's not limit to text granularity … trust it"), and any
 * other with a text granularity. Where a Canvas's say their granularity (IIIF's Text
 * Granularity extension), only its finest are drawn, so its lines and its words are
 * never both taken; what says none is drawn where nothing on its Canvas says one.
 */
export function readTextUnits(
  annotations: CanvasAnnotation[],
  place: AnnotationPlacer,
): TextUnit[] {
  const byTarget = new Map<string, Read[]>();
  for (const { annotation, targetIndex } of annotations) {
    const granularity = granularityOf(annotation);
    if (!granularity && !supplementsOnly(annotation?.motivation)) continue;
    const target = parseAnnotationTarget(annotation?.target as never);
    if (!target?.rect || target.t) continue;
    const read = plainTextOf(annotation);
    if (!read) continue;
    const { x, y, w, h } = target.rect;
    if (!(w > 0 && h > 0)) continue;
    const world = place({ x, y, width: w, height: h }, target.id, targetIndex);
    if (!world) continue;
    const key = target.id ?? String(targetIndex);
    const list = byTarget.get(key) ?? [];
    list.push({ id: annotation.id, ...read, granularity, world, target: key });
    byTarget.set(key, list);
  }
  const units: TextUnit[] = [];
  for (const reads of byTarget.values()) {
    // Those that say none are drawn only where none on the Canvas does.
    const finest =
      GRANULARITIES.find((level) =>
        reads.some((read) => read.granularity === level),
      ) ?? null;
    for (const read of reads) {
      if (read.granularity !== finest) continue;
      units.push({
        id: read.id,
        text: read.text,
        ...(read.lang ? { lang: read.lang } : {}),
        granularity: finest,
        world: read.world,
      });
    }
  }
  return units;
}

/** A piece of a selection: one unit's text it covers, and that unit's language. */
export interface SelectedPiece {
  text: string;
  lang?: string;
}

/**
 * What a selection over the text covers, piece by piece: each unit's text it covers
 * (part of one where it starts or ends inside it), in order, with that unit's language,
 * so what shows it marks each (WCAG 3.1.2). Empty where it covers none.
 */
export function selectedPieces(
  range: Pick<
    Range,
    | "intersectsNode"
    | "startContainer"
    | "startOffset"
    | "endContainer"
    | "endOffset"
  >,
  elements: { element: HTMLElement; unit: TextUnit }[],
): SelectedPiece[] {
  const pieces: SelectedPiece[] = [];
  for (const { element, unit } of elements) {
    if (!range.intersectsNode(element)) continue;
    const node = element.firstChild;
    const text = unit.text;
    let start = 0;
    let end = text.length;
    if (range.startContainer === node || range.startContainer === element)
      start = range.startContainer === node ? range.startOffset : 0;
    if (range.endContainer === node) end = range.endOffset;
    else if (range.endContainer === element && range.endOffset === 0) end = 0;
    const piece = text.slice(start, end);
    if (piece) pieces.push({ text: piece, lang: unit.lang });
  }
  return pieces;
}

/**
 * What a selection over the text copies, as plain text: its pieces (`selectedPieces`)
 * strung together with a space, no line breaks (Mat, 2026-11-16: "do not worry about
 * retaining formatting"). Null where it covers none.
 */
export function selectedText(
  range: Parameters<typeof selectedPieces>[0],
  elements: { element: HTMLElement; unit: TextUnit }[],
): string | null {
  const pieces = selectedPieces(range, elements);
  return pieces.length ? pieces.map((piece) => piece.text).join(" ") : null;
}
