import type * as P4 from "@iiif/parser/presentation-4/types";

/**
 * Clover's one data shape: IIIF Presentation 4.
 *
 * Every resource is upgraded to Presentation 4 on the way in, so no part is written for
 * several shapes. Presentation 2.1 and 3.0 are upgraded by `@iiif/parser`; Presentation 4
 * passes through untouched. The upgrader is imported on demand, so it costs nothing until
 * the first resource that needs it arrives, and its reader of Presentation 2 only with
 * the first resource in 2.
 */

/*
 * Declared here under the names Clover exports them by, never `Canvas` or `Collection`:
 * the parts have those names, and the bundled declarations (`build:types`) would hold
 * both, which TypeScript rejects.
 */
export type Manifest = P4.Manifest;
export type Presentation4Canvas = P4.Canvas;
export type Presentation4Collection = P4.Collection;
export type Presentation4Scene = P4.Scene;
export type Presentation4Timeline = P4.Timeline;

/**
 * A IIIF resource Clover can show directly, a Manifest's item: a Canvas (`Canvas`), a
 * Timeline (`Timeline`, sound) or a Scene (`Scene`, 3D).
 */
export type Container =
  | Presentation4Canvas
  | Presentation4Timeline
  | Presentation4Scene;

const PRESENTATION_4 = /iiif\.io\/api\/presentation\/4\/context\.json/;

/** Whether `resource` declares the Presentation 4 context. */
export function isPresentation4(resource: unknown): boolean {
  const context = (resource as { "@context"?: unknown } | null)?.["@context"];
  const contexts = Array.isArray(context) ? context : [context];
  return contexts.some(
    (value) => typeof value === "string" && PRESENTATION_4.test(value),
  );
}

/**
 * `@iiif/parser`'s upgrade from Presentation 3 (`upgradePresentation3To4`), the step its
 * `upgradeToPresentation4` takes after it has read Presentation 2 as 3. Taken alone, so a
 * page reading Presentation 3 never loads the reader of 2 (Mat, 2026-10-30: the Default
 * template's first view under 95 kB; it was 5 kB gzip of every first view). The two
 * agree for every fixture (`presentation.test.ts`).
 */
let upgrader: Promise<(resource: unknown) => unknown> | null = null;

/**
 * Starts loading the upgrader. Call it as a fetch begins, so the two arrive together and
 * upgrading adds no round trip.
 */
export function preloadUpgrader() {
  upgrader ??= import("@iiif/parser/presentation-4/upgrader").then(
    ({ upgradePresentation3To4 }) => upgradePresentation3To4,
  );
  return upgrader;
}

/**
 * `resource` as Presentation 4: a Manifest, Collection, Canvas, Timeline or Scene from any
 * supported version. Presentation 4 input is returned as it is; the rest is upgraded as
 * `upgrade.ts` reads it, loaded with the upgrader.
 */
export async function toPresentation4<
  T = Manifest | Presentation4Collection | Container,
>(resource: unknown): Promise<T> {
  if (isPresentation4(resource)) return resource as T;
  const [toFour, { upgrade }] = await Promise.all([
    preloadUpgrader(),
    import("./upgrade"),
  ]);
  return (await upgrade(resource, toFour)) as T;
}
