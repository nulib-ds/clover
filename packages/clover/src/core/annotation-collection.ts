import { type AnnotationSet, pageLabel, readPage } from "./annotation-sets";
import { upgradePage } from "./pages";
import { type CloverRequest, fetchJson } from "./request";
import { asArray } from "../lib/asArray";

/**
 * Annotations a host adds to what the Manifest carries: an AnnotationPage, an
 * AnnotationCollection (its pages followed from `first` through `next`), or a list of
 * either, as URLs or objects. Each page becomes one set.
 */

export type AnnotationsInput = string | Record<string, unknown> | unknown[];

/**
 * Pages followed in one collection, at most, and never one twice: guards against a `next`
 * that leads back, which would read its annotations again.
 */
const MAX_PAGES = 100;

type Json = Record<string, any>;

async function resolve(
  item: unknown,
  request: CloverRequest | undefined,
  signal?: AbortSignal,
): Promise<Json> {
  if (typeof item === "string") {
    return (await fetchJson(request, item, signal)) as Json;
  }
  const json = item as Json;
  // A reference to a page: fetch it.
  if (json?.id && json.type === "AnnotationPage" && !json.items) {
    return (await fetchJson(request, json.id, signal)) as Json;
  }
  return json;
}

/** The pages: a collection's from `first`, or a page and those its `next` leads to. */
async function pagesOf(
  json: Json,
  request: CloverRequest | undefined,
  signal?: AbortSignal,
): Promise<Json[]> {
  const type = String(json?.type ?? json?.["@type"] ?? "");
  const collection = /AnnotationCollection/.test(type);
  const pages: Json[] = collection ? [] : [json];
  const seen = new Set<unknown>(collection ? [] : [json.id]);
  let next: unknown = collection ? json.first : json.next;
  while (next && pages.length < MAX_PAGES) {
    const id = typeof next === "string" ? next : (next as Json).id;
    if (seen.has(id ?? next)) break;
    seen.add(id ?? next);
    const page = await resolve(next, request, signal);
    pages.push(page);
    next = page.next;
  }
  return pages;
}

export async function loadAnnotationSets(
  input: AnnotationsInput,
  { request, signal }: { request?: CloverRequest; signal?: AbortSignal } = {},
): Promise<AnnotationSet[]> {
  const sets: AnnotationSet[] = [];
  for (const item of asArray(input)) {
    const json = await resolve(item, request, signal);
    for (const raw of await pagesOf(json, request, signal)) {
      const page = (await upgradePage(raw)) as Json;
      const id = page.id ?? `added-${sets.length}`;
      const entries = readPage(page, id);
      if (entries.length) {
        sets.push({
          id,
          // Its own name, its Collection's (from the reference too), or the content's.
          label:
            pageLabel(page, raw === json ? (item as Json) : undefined) ??
            json.label,
          source: "added",
          entries,
        });
      }
    }
  }
  return sets;
}
