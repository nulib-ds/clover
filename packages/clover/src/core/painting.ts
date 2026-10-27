import { asArray } from "../lib/asArray";

type Json = Record<string, any>;

/*
 * What paints, read one way wherever Clover reads it: the walk over a container's bodies
 * (`painted-bodies.ts`), a region's image, the Canvas's layout, the Map's overlay and the
 * Scene's models. A leaf, so a part that reads only a thumbnail loads nothing of
 * annotations.
 */

/** Presentation 4's groups of several targets (or bodies), each item one of its own. */
export const GROUPS = ["Independents", "Composite", "List"];

/** An annotation's bodies, with Presentation 4's groups unwrapped. */
export function bodiesOf(annotation: Json): Json[] {
  return (asArray(annotation?.body) as Json[]).flatMap((body) =>
    GROUPS.includes(body?.type) ? (asArray(body.items) as Json[]) : [body],
  );
}

/** Whether an annotation paints: `painting` among its motivations, or none said. */
export function isPainting(annotation: Json | undefined): boolean {
  const motivations = asArray(annotation?.motivation);
  return !motivations.length || motivations.includes("painting");
}
