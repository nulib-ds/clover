import { type AnnotationSet, readPage } from "./annotation-sets";
import { upgradePage } from "./pages";
import { type CloverRequest, fetchJson } from "./request";

/**
 * Annotations a host adds to what the Manifest carries: an AnnotationPage, an
 * AnnotationCollection (its pages followed from `first` through `next`), or a list of
 * either, as URLs or objects. Each page becomes one set.
 */

export type AnnotationsInput = string | Record<string, unknown> | unknown[];

/** Pages followed in one collection, at most: a guard against a `next` loop. */
const MAX_PAGES = 100;

type Json = Record<string, any>;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

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
  let next: unknown = collection ? json.first : json.next;
  while (next && pages.length < MAX_PAGES) {
    const page = await resolve(next, request, signal);
    pages.push(page);
    next = page.next;
  }
  return pages;
}

/**
 * The Manifest an annotation's target says its Canvas is `partOf`, as annotations made
 * apart from any Manifest name it (a shared link, a page of tags across a collection).
 */
export function manifestOfAnnotation(annotation: Json): string | undefined {
  for (const target of asArray(annotation?.target) as Json[]) {
    const source = target?.type === "SpecificResource" ? target.source : target;
    const part = asArray(source?.partOf).find(
      (each: any) => each?.id && (!each.type || each.type === "Manifest"),
    ) as Json | undefined;
    if (part) return part.id;
  }
  return undefined;
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
          label: page.label ?? json.label,
          source: "added",
          entries,
        });
      }
    }
  }
  return sets;
}
