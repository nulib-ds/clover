import type {
  Canvas,
  Collection,
  Manifest,
  Scene,
  Timeline,
} from "@iiif/parser/presentation-4/types";

/**
 * Clover's one data shape: IIIF Presentation 4.
 *
 * Every resource is upgraded to Presentation 4 on the way in, so no part is written for
 * several shapes. Presentation 2.1 and 3.0 are upgraded by `@iiif/parser`; Presentation 4
 * passes through untouched. The upgrader is imported on demand, so it costs nothing until
 * the first resource that needs it arrives.
 */

export type { Canvas, Collection, Manifest, Scene, Timeline };

/**
 * A IIIF resource Clover can show directly, a Manifest's item: a Canvas (`Canvas`), a
 * Timeline (`Timeline`, sound) or a Scene (`Scene`, 3D).
 */
export type Container = Canvas | Timeline | Scene;

const PRESENTATION_4 = /iiif\.io\/api\/presentation\/4\/context\.json/;

/** Whether `resource` declares the Presentation 4 context. */
export function isPresentation4(resource: unknown): boolean {
  const context = (resource as { "@context"?: unknown } | null)?.["@context"];
  const contexts = Array.isArray(context) ? context : [context];
  return contexts.some(
    (value) => typeof value === "string" && PRESENTATION_4.test(value),
  );
}

let upgrader: Promise<
  typeof import("@iiif/parser/presentation-4/upgrader")
> | null = null;

/**
 * Starts loading the upgrader. Call it as a fetch begins, so the two arrive together and
 * upgrading adds no round trip.
 */
export function preloadUpgrader() {
  upgrader ??= import("@iiif/parser/presentation-4/upgrader");
  return upgrader;
}

/**
 * `resource` as Presentation 4: a Manifest, Collection, Canvas, Timeline or Scene from any
 * supported version. Presentation 4 input is returned as it is.
 */
export async function toPresentation4<T = Manifest | Collection | Container>(
  resource: unknown,
): Promise<T> {
  if (isPresentation4(resource)) return resource as T;
  // With the upgrader, a fix for its reading of fragmented targets (`keep-fragments.ts`).
  const [{ upgradeToPresentation4 }, { keepFragments }] = await Promise.all([
    preloadUpgrader(),
    import("./keep-fragments"),
  ]);
  return upgradeToPresentation4(keepFragments(resource)) as T;
}
