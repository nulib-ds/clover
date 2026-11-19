import type { AnnotationBodyEntry } from "./annotation-bodies";
import { bodyInLanguage } from "./annotation-name";

/*
 * Apart from `annotation-name.ts`, which the hotspots load with a recording's first view:
 * these only the lists that show an annotation's bodies read (`EntryBodies`, the Canvas's
 * annotations menu), each loaded on demand.
 */

/** Whether there is text, which describes any image beside it (Cookbook 0377). */
export const hasText = (bodies: AnnotationBodyEntry[]) =>
  bodies.some((body) => body.value?.trim());

/**
 * Of each `Choice`, the item in the language to read (Cookbook 0346); the rest as given:
 * the bodies an entry shows, in the Annotations section and the Canvas's menu alike.
 */
export function shownBodies(
  bodies: AnnotationBodyEntry[],
  language?: string,
): AnnotationBodyEntry[] {
  const choices = new Map<number, AnnotationBodyEntry[]>();
  for (const body of bodies)
    if (body.choice !== undefined)
      choices.set(body.choice, [...(choices.get(body.choice) ?? []), body]);
  if (!choices.size) return bodies;
  const shown = new Set(
    [...choices.values()].map((items) => bodyInLanguage(items, language)),
  );
  return bodies.filter((body) => body.choice === undefined || shown.has(body));
}
