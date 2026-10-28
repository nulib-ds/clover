import {
  type AnnotationEntry,
  type AnnotationSet,
  CONTENTS_SET_ID,
  regionEntryId,
} from "./annotation-sets";
import { parseAnnotationTarget } from "./annotations";
import type { Manifest } from "./presentation";
import { rangeItemTarget } from "./ranges";
import { asArray } from "../lib/asArray";

/*
 * The regions the Manifest's Ranges name, drawn on the Canvas as annotations are. Loaded
 * by the Root only for a Manifest with Ranges (`clover.ts`, `regions`), apart from the
 * Ranges' reader (`ranges.ts`), which only Contents needs.
 */

type Json = Record<string, any>;

/** A Range's label as an annotation's text, a body per language. */
const bodiesOf = (label: unknown) =>
  label && typeof label === "object"
    ? Object.entries(label as Record<string, unknown>).flatMap(
        ([language, values]) =>
          asArray(values as unknown)
            .filter((value): value is string => typeof value === "string")
            .map((value) => ({
              value,
              ...(language !== "none" ? { language } : {}),
            })),
      )
    : typeof label === "string"
      ? [{ value: label }]
      : [];

const regionSets = new WeakMap<Manifest, AnnotationSet | null>();

/**
 * The regions the Manifest's Ranges name (Cookbook 0025: an article's columns), as a set
 * of annotations the Canvas draws as it draws any (Mat, 2026-10-28: "always draw xywh
 * regions like annotations if we have them"), each named for its Range. Contents lists
 * them and steps through them, so the Annotations list and the Canvas's menu leave the set
 * out, as they leave a search's hits. A Range marked `no-nav` draws none, as Contents
 * lists none. Null where no Range names a region.
 */
export function contentsSet(manifest: Manifest | null): AnnotationSet | null {
  if (!manifest) return null;
  if (regionSets.has(manifest)) return regionSets.get(manifest)!;
  const entries: AnnotationEntry[] = [];
  const visited = new Set<unknown>();
  const walk = (range: Json) => {
    if (!range || visited.has(range.id ?? range)) return;
    visited.add(range.id ?? range);
    const drawn =
      typeof range.id === "string" &&
      !asArray(range.behavior).includes("no-nav");
    const bodies = bodiesOf(range.label);
    // Its parts, its own Canvases and their regions, counted as Contents counts them.
    const total = (asArray(range.items) as Json[]).filter(
      (item) =>
        item?.type !== "Range" &&
        parseAnnotationTarget(rangeItemTarget(item) as any).id,
    ).length;
    let index = 0;
    for (const item of asArray(range.items) as Json[]) {
      if (item?.type === "Range") {
        walk(item);
        continue;
      }
      const parsed = parseAnnotationTarget(rangeItemTarget(item) as any);
      if (!parsed.id) continue;
      const at = index++;
      if (!drawn || !parsed.rect) continue;
      const { x, y, w, h } = parsed.rect;
      const id = regionEntryId(range.id, at);
      entries.push({
        id,
        setId: CONTENTS_SET_ID,
        canvasId: parsed.id,
        target: { id: parsed.id, rect: parsed.rect },
        motivation: ["highlighting"],
        bodies,
        ...(total > 1 ? { place: { index: at + 1, total } } : {}),
        annotation: {
          id,
          type: "Annotation",
          motivation: ["highlighting"],
          // Its text in each language its Range names it in, as the hotspot reads one.
          ...(bodies.length && {
            body: bodies.map(({ value, language }) => ({
              type: "TextualBody",
              value,
              ...(language ? { language } : {}),
            })),
          }),
          target: `${parsed.id}#xywh=${x},${y},${w},${h}`,
        },
      });
    }
  };
  (asArray((manifest as Json).structures) as Json[]).forEach(walk);
  const set: AnnotationSet | null = entries.length
    ? { id: CONTENTS_SET_ID, source: "contents", entries }
    : null;
  regionSets.set(manifest, set);
  return set;
}
