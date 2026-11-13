import { convertPresentation2 } from "@iiif/parser/presentation-2";

/*
 * Presentation 2, read as 3 by `@iiif/parser`'s reader of 2, in a chunk loaded only for
 * it, so a page reading Presentation 3 or 4 carries none of this. It imports nothing of
 * `upgrade.ts`, which would put that in a chunk of its own on every page that upgrades.
 */

const PRESENTATION_2 = "http://iiif.io/api/presentation/2/context.json";

/**
 * A Presentation 2 resource as the reader of 2 is given it: with 2's context alone where it
 * lists others. The reader names a resource by its `profile` and `@context` before its
 * `@type`, so a Manifest whose context lists the Image API's beside 2's (valid JSON-LD,
 * where its images' services are Image 2) would be read as an image service (#423). 2's
 * context is all the reader reads it for.
 */
export const forReader = (resource: unknown) =>
  resource && Array.isArray((resource as Record<string, unknown>)["@context"])
    ? { ...(resource as object), "@context": PRESENTATION_2 }
    : resource;

/** `resource`, Presentation 2, read as 3, on a copy, so the caller's object is never changed. */
export function readPresentation2(resource: unknown): unknown {
  const given = forReader(resource);
  return convertPresentation2(
    typeof structuredClone < "u"
      ? structuredClone(given)
      : JSON.parse(JSON.stringify(given)),
  );
}
