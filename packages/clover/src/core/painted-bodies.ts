import { bodiesOf, isPainting } from "./painting";
import { asArray } from "../lib/asArray";

type Json = Record<string, any>;

/*
 * Apart from `painting.ts`, which a Canvas loads up front for its layout: what walks a
 * container whole (a thumbnail, Items' kind of each, the Body's renderer) loads this with
 * it, so a Canvas alone defers it with its thumbnail.
 */

/**
 * The bodies a container's painting annotations paint, in painting order, each with its
 * annotation: a group's items, a `Choice`'s first, a `SpecificResource`'s source (a
 * bare URI as `{ id }`).
 */
export function paintedBodies(
  container: Json | undefined,
): Array<{ body: Json; annotation: Json }> {
  const painted: Array<{ body: Json; annotation: Json }> = [];
  for (const page of asArray(container?.items) as Json[])
    for (const annotation of asArray(page?.items) as Json[]) {
      if (!isPainting(annotation)) continue;
      for (let body of bodiesOf(annotation)) {
        if (body?.type === "Choice") body = asArray(body.items)[0] as Json;
        if (body?.type === "SpecificResource")
          body =
            typeof body.source === "string" ? { id: body.source } : body.source;
        if (body) painted.push({ body, annotation });
      }
    }
  return painted;
}
