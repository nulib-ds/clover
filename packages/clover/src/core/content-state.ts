import { asArray } from "../lib/asArray";

/**
 * IIIF Content State: a link that opens a resource at a place — a Canvas, a region of it,
 * a moment in it. Clover reads the forms the spec gives (an annotation with the
 * `contentState` motivation, or its bare target) as JSON or base64url-encoded, and turns
 * them into what to load and where to go once it has (`content-state-reader.ts`, loaded
 * only for one), and writes where the reader is as one (here).
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
  /**
   * Every target, where a content state names two or more (Cookbook 0540: two Canvases
   * from two Manifests, to compare): opened on the first, each to be gone to in turn.
   */
  targets?: ContentTargets;
}

/** One of a content state's several targets: a Manifest, and a place in it. */
export interface ContentTarget {
  /** Its own id: the content state's, with its place among the targets. */
  id: string;
  /** Where its Manifest is: the address it is loaded from. */
  manifestId: string;
  /**
   * The id its Manifest gives itself, once loaded, where it is not that address (Cookbook
   * 0540's are `…/manifest.json/manifest.json`, served at `…/manifest.json`).
   */
  manifestAs?: string;
  canvasId?: string;
  /** In the Canvas's own coordinates. */
  region?: { x: number; y: number; w: number; h: number };
  /** Seconds into a time-based Canvas. */
  time?: number;
}

/** A content state's targets, in its order, and its own `label` where it gives one. */
export interface ContentTargets {
  id: string;
  label?: Record<string, string[]>;
  items: ContentTarget[];
}

type Json = Record<string, any>;

/** Whether JSON is a content state, rather than a IIIF resource to show. */
export function isContentState(json: unknown): boolean {
  const value = json as Json | null;
  if (!value || typeof value !== "object") return false;
  if (value.type === "Annotation") {
    return asArray(value.motivation).includes("contentState");
  }
  return value.type === "SpecificResource";
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
