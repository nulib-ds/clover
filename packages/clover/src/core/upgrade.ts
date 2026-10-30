import { keepFragments } from "./keep-fragments";

/*
 * How a resource older than Presentation 4 is upgraded, loaded with the upgrader so a
 * page reading Presentation 4 never carries it, nor a part that upgrades nothing: first
 * the fix for the upgrader's reading of fragmented targets (`keep-fragments.ts`); then,
 * for Presentation 2 alone, `@iiif/parser`'s reader of 2 (`convertPresentation2`), loaded
 * only for it; then its upgrade from 3 (`upgradePresentation3To4`). The steps its
 * `upgradeToPresentation4` takes, held to it by `presentation.test.ts` over every
 * resource here and, by `CLOVER_UPGRADE_RESOURCES`, Mirador's fixtures and the Universal
 * Viewer's examples (`build/upgrade-resources.mjs`).
 */

const PRESENTATION_2 = "http://iiif.io/api/presentation/2/context.json";

/**
 * Whether `@iiif/parser` reads `resource` as Presentation 2 (`convertPresentation2`, as
 * it decides): its context, or Presentation 2's `@id` and `sc:` types.
 */
function isPresentation2(resource: unknown): boolean {
  const value = resource as Record<string, unknown> | null;
  const context = value?.["@context"];
  return Boolean(
    (context &&
      (context === PRESENTATION_2 ||
        (Array.isArray(context) && context.includes(PRESENTATION_2)) ||
        context === "http://www.shared-canvas.org/ns/context.json")) ||
      context === "http://iiif.io/api/image/2/context.json" ||
      (value?.["@id"] &&
        (value["@type"] === "sc:Collection" ||
          value["@type"] === "sc:Manifest")),
  );
}

/**
 * `resource` upgraded by `toFour` (`upgradePresentation3To4`), read as Presentation 3
 * first where it is 2, on a copy, as `@iiif/parser` reads it, so the caller's object is
 * never changed.
 */
export async function upgrade(
  resource: unknown,
  toFour: (resource: unknown) => unknown,
): Promise<unknown> {
  const kept = keepFragments(resource);
  if (!isPresentation2(resource)) return toFour(kept);
  const { convertPresentation2 } = await import("@iiif/parser/presentation-2");
  return toFour(
    convertPresentation2(
      typeof structuredClone < "u"
        ? structuredClone(kept)
        : JSON.parse(JSON.stringify(kept)),
    ),
  );
}
