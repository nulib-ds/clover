import { parseAnnotationTarget } from "./annotations";

/**
 * IIIF Content State: a link that opens a resource at a place — a Canvas, a region of it,
 * a moment in it. Clover reads the forms the spec gives (an annotation with the
 * `contentState` motivation, or its bare target) as JSON or base64url-encoded, and turns
 * them into what to load and where to go once it has.
 *
 * @see https://iiif.io/api/content-state/
 */

/** Where to go once a resource has loaded. Consumed once it has been applied. */
export interface Target {
  canvasId: string;
  /** In the Canvas's own coordinates. */
  region?: { x: number; y: number; w: number; h: number };
  /** Seconds into a time-based Canvas. */
  time?: number;
  /** Start playback on arrival (auto-advance from the previous Canvas). */
  autoplay?: boolean;
}

export interface ResolvedContentState {
  /** The resource to load: a Manifest or Collection id, or a Canvas id with no `partOf`. */
  id: string;
  type?: string;
  /** With a Collection to load, the member to open in it rather than its first. */
  manifestId?: string;
  target?: Target;
  /**
   * The content state annotation itself, where it carries a body (a note its sharer
   * wrote, as Digital Collections' shared links do) and targets a Canvas: shown on the
   * Canvas as an annotation, and picked.
   */
  annotation?: Json;
}

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

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

/** Whether JSON is a content state, rather than a IIIF resource to show. */
export function isContentState(json: unknown): boolean {
  const value = json as Json | null;
  if (!value || typeof value !== "object") return false;
  if (value.type === "Annotation") {
    return asArray(value.motivation).includes("contentState");
  }
  return value.type === "SpecificResource";
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

/** A content state as a link carries it: base64url of the URI-encoded JSON, unpadded. */
export function encodeContentState(json: unknown): string {
  return btoa(encodeURIComponent(JSON.stringify(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface ContentStateOutput {
  /** The content state annotation. */
  json: Record<string, unknown>;
  /** The same, encoded for a URL. */
  encoded: string;
}

/**
 * Where the reader is, as a content state: the Canvas within its Manifest, and the
 * visible region (`xywh=`) or the media time (`t=`) when there is one. Regions are
 * rounded to whole pixels.
 */
export function buildContentState({
  manifestId,
  canvasId,
  region,
  time,
}: {
  manifestId: string;
  canvasId: string;
  region?: { x: number; y: number; w: number; h: number } | null;
  time?: number | null;
}): ContentStateOutput {
  const source = {
    id: canvasId,
    type: "Canvas",
    partOf: [{ id: manifestId, type: "Manifest" }],
  };
  const fragment =
    time != null && time > 0
      ? `t=${Math.round(time * 100) / 100}`
      : region
        ? `xywh=${[region.x, region.y, region.w, region.h].map(Math.round).join(",")}`
        : null;
  const json = {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: `${canvasId}#content-state`,
    type: "Annotation",
    motivation: ["contentState"],
    target: fragment
      ? {
          type: "SpecificResource",
          source,
          selector: { type: "FragmentSelector", value: fragment },
        }
      : source,
  };
  return { json, encoded: encodeContentState(json) };
}
