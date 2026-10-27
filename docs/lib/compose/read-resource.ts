import { type Structure, structureOf } from "docs/lib/compose/structure";
import {
  decodeContentState,
  resolveContentState,
} from "../../../packages/clover/src/core/content-state-reader";

/**
 * A IIIF resource, read for its structure only (WEBMCP.md, phase 3): from the address an
 * agent gives, or the content state, as Clover reads one (`core/content-state.ts`).
 * Bounded, as what an agent asks the reader's browser to fetch should be: an address on
 * the web only (`http:` or `https:`), sent without the reader's cookies or the page's
 * address, waited for so long, and read to so many bytes. What comes back is untrusted:
 * only its structure leaves this module (`structure.ts`), never its words.
 */

/** How long to wait for it, in ms, and how much of it to read, in bytes. */
export const WAIT = 10_000;
export const MOST_BYTES = 8_000_000;

export type ReadResource =
  | { ok: true; address: string; structure: Structure }
  | { ok: false; says: string };

const isWebAddress = (value: string) => {
  try {
    const { protocol, hostname } = new URL(value);
    return (protocol === "http:" || protocol === "https:") && hostname !== "";
  } catch {
    return false;
  }
};

/** The address to read: as given, or what a content state opens. */
export function addressOf(given: string) {
  const trimmed = given.trim();
  if (isWebAddress(trimmed)) return trimmed;
  const state = decodeContentState(trimmed);
  const id = state ? resolveContentState(state)?.id : undefined;
  return id && isWebAddress(id) ? id : undefined;
}

/** Its text, to `most` bytes; past that, nothing. */
async function textOf(response: Response, most: number) {
  if (Number(response.headers.get("content-length")) > most) return undefined;
  if (!response.body) {
    const text = await response.text();
    return text.length > most ? undefined : text;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > most) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** A resource's structure, or why it could not be read. */
export async function readResource(
  given: string,
  {
    fetch = globalThis.fetch,
    signal,
    wait = WAIT,
    most = MOST_BYTES,
  }: {
    fetch?: typeof globalThis.fetch;
    signal?: AbortSignal;
    wait?: number;
    most?: number;
  } = {},
): Promise<ReadResource> {
  const address = addressOf(given);
  if (!address)
    return {
      ok: false,
      says: "Give a IIIF resource's address on the web (https://…), or a content state.",
    };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), wait);
  const stop = () => controller.abort();
  signal?.addEventListener("abort", stop, { once: true });
  try {
    signal?.throwIfAborted();
    const response = await fetch(address, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok)
      return { ok: false, says: `The resource answered ${response.status}.` };
    const text = await textOf(response, most);
    if (text === undefined)
      return {
        ok: false,
        says: `The resource is larger than ${most / 1_000_000} MB, more than this reads.`,
      };
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, says: "The resource is not JSON." };
    }
    const structure = structureOf(json);
    if (!structure)
      return {
        ok: false,
        says: "The resource is not a IIIF Manifest, Collection, Canvas, Timeline or Scene.",
      };
    return { ok: true, address, structure };
  } catch (error) {
    // The caller's own cancel is theirs to hear.
    if (signal?.aborted) throw error;
    if (controller.signal.aborted)
      return {
        ok: false,
        says: `The resource did not answer within ${wait / 1000} seconds.`,
      };
    return {
      ok: false,
      says: "The resource could not be read: its server refused, or does not let other sites read it (CORS).",
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
  }
}
