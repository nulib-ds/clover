import { parseAnnotationTarget } from "./annotations";
import type { ResolvedContentState, Target } from "./content-state";
import { asArray } from "../lib/asArray";

/**
 * Reading a content state: what a Root handed one (JSON or base64url, not a URL) loads
 * and where it goes. Its own chunk, loaded only for a content state (`loadContent`): a
 * page that opens a URL never carries it. Writing one stays in `content-state.ts`.
 */

type Json = Record<string, any>;

/** A base64url string as text, undoing the spec's `encodeURIComponent` step. */
function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  try {
    return decodeURIComponent(binary);
  } catch {
    // Encoded without the `encodeURIComponent` step: read the bytes as UTF-8.
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
}

/** A content state string (JSON, or base64url-encoded JSON) as JSON; null if neither. */
export function decodeContentState(value: string): Json | null {
  const trimmed = value.trim();
  for (const read of [
    () => JSON.parse(trimmed),
    () => JSON.parse(decodeBase64Url(trimmed)),
  ]) {
    try {
      const json = read();
      if (json && typeof json === "object") return json;
    } catch {
      // Try the next form.
    }
  }
  return null;
}

function startTime(t: string | undefined): number | undefined {
  if (!t) return undefined;
  const seconds = Number(t.split(",")[0]);
  return Number.isFinite(seconds) ? seconds : undefined;
}

/** The Collection a Manifest declares itself `partOf`, if it names one. */
const collectionOf = (resource: Json | undefined) =>
  asArray(resource?.partOf).find(
    (part: any) => part?.id && part.type === "Collection",
  ) as Json | undefined;

/**
 * What a content state asks for. A target naming a Canvas loads the Manifest it is
 * `partOf`, then goes to the Canvas (and its region or time); one naming a Manifest or
 * Collection loads it. A Manifest that is itself `partOf` a Collection, the target's or
 * its Canvas's, loads that Collection and opens on the Manifest, so the reader arrives
 * among its members. The first target is used when there are several.
 */
export function resolveContentState(json: Json): ResolvedContentState | null {
  const target = (
    json.type === "Annotation" ? asArray(json.target)[0] : json
  ) as Json | string | undefined;
  if (!target) return null;

  const parsed = parseAnnotationTarget(target as any);
  const resource: Json =
    typeof target === "string"
      ? { id: parsed.id }
      : target.type === "SpecificResource"
        ? typeof target.source === "string"
          ? { id: target.source }
          : (target.source ?? {})
        : target;
  const type = resource.type as string | undefined;

  if (type === "Manifest" || type === "Collection") {
    const collection = type === "Manifest" ? collectionOf(resource) : undefined;
    return collection
      ? { id: collection.id, type: "Collection", manifestId: parsed.id }
      : { id: parsed.id, type };
  }

  // A point in time can come as a PointSelector's `t`.
  const pointTime = asArray((target as Json).selector).find(
    (selector: any) => selector?.type === "PointSelector" && selector.t != null,
  ) as { t?: number } | undefined;

  const canvasTarget: Target = { canvasId: parsed.id };
  if (parsed.rect) canvasTarget.region = parsed.rect;
  const time = pointTime?.t ?? startTime(parsed.t);
  if (time !== undefined) canvasTarget.time = Number(time);

  const partOf = asArray(resource.partOf).find(
    (part: any) => part?.id && (!part.type || part.type === "Manifest"),
  ) as Json | undefined;
  const collection = collectionOf(partOf);
  // Its note, as an annotation on the Canvas: the body as given, on its own target.
  const annotation =
    json.type === "Annotation" && asArray(json.body).length
      ? {
          id: json.id ?? `${parsed.id}#content-state`,
          type: "Annotation",
          motivation: asArray(json.motivation),
          body: json.body,
          target,
        }
      : undefined;
  const shared = annotation ? { annotation } : {};
  return collection && partOf
    ? {
        id: collection.id,
        type: "Collection",
        manifestId: partOf.id,
        target: canvasTarget,
        ...shared,
      }
    : partOf
      ? { id: partOf.id, type: "Manifest", target: canvasTarget, ...shared }
      : {
          id: parsed.id,
          type: type ?? "Canvas",
          target: canvasTarget,
          ...shared,
        };
}
