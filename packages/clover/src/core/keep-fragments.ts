/**
 * A workaround for `@iiif/parser`'s upgrader, which reads a target written as an object
 * with a fragment in its id (`{ "id": "…/canvas/1#xywh=1,2,3,4", "type": "Canvas" }`,
 * valid Presentation 3) as `…/canvas/1/xywh=1,2,3,4`: the fragment is lost, and the
 * annotation names no Canvas. Such a target is rewritten first as the SpecificResource it
 * means (its source, and a FragmentSelector), which the upgrader keeps intact. Loaded with
 * the upgrader, so Presentation 4 content never carries it; returns the input itself
 * when there is nothing to rewrite.
 */

type Json = Record<string, unknown>;

const fragmented = (target: unknown): target is Json =>
  Boolean(target) &&
  typeof target === "object" &&
  !Array.isArray(target) &&
  typeof (target as Json).id === "string" &&
  ((target as Json).id as string).includes("#") &&
  (target as Json).type !== "SpecificResource";

/** Whether anything under `value` has a target to rewrite. */
function needs(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(needs);
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value as Json)) {
    if (key === "target") {
      const targets = Array.isArray(child) ? child : [child];
      if (targets.some(fragmented)) return true;
    }
    if (needs(child)) return true;
  }
  return false;
}

function asSpecificResource(target: Json): Json {
  const { id, ...rest } = target;
  const [source, fragment] = (id as string).split("#");
  return {
    type: "SpecificResource",
    source: { ...rest, id: source },
    selector: { type: "FragmentSelector", value: fragment },
  };
}

function rewrite(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rewrite);
  if (!value || typeof value !== "object") return value;
  const out: Json = {};
  for (const [key, child] of Object.entries(value as Json)) {
    out[key] =
      key === "target"
        ? Array.isArray(child)
          ? child.map((each) =>
              fragmented(each) ? asSpecificResource(each) : rewrite(each),
            )
          : fragmented(child)
            ? asSpecificResource(child)
            : rewrite(child)
        : rewrite(child);
  }
  return out;
}

/** `resource` with every fragmented object target as a SpecificResource; else itself. */
export function keepFragments<T>(resource: T): T {
  return needs(resource) ? (rewrite(resource) as T) : resource;
}
