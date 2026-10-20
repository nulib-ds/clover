import type { Container, Manifest } from "./presentation";
import { isPresentation4, toPresentation4 } from "./presentation";
import { type CloverRequest, fetchJson } from "./request";

/**
 * Annotation pages a Manifest only references, fetched when their Canvas is shown and
 * embedded where the reference was.
 *
 * The Manifest is never mutated. Embedding copies the path to the page (Manifest → its
 * `items` → the Canvas → its page list) and shares everything else, so selectors memoized
 * on object identity recompute for that Canvas and nothing more.
 */

type Page = { id?: string; type?: string; items?: unknown[] };
type PageList = "items" | "annotations";

const isReference = (page: Page) =>
  Boolean(page?.id) && page.type === "AnnotationPage" && !page.items;

/** The referenced pages of some Canvases, as `[canvasId, list, pageId]`. */
export function referencedPages(
  canvases: Container[],
): Array<[string, PageList, string]> {
  const found: Array<[string, PageList, string]> = [];
  for (const canvas of canvases) {
    for (const list of ["items", "annotations"] as PageList[]) {
      for (const page of ((canvas as Record<string, any>)[list] ??
        []) as Page[]) {
        if (isReference(page)) found.push([canvas.id, list, page.id!]);
      }
    }
  }
  return found;
}

/**
 * A fetched page in Clover's shape. The upgrader works on containers, so the page is
 * upgraded inside a Canvas of its own and taken back out.
 */
export async function fetchPage(
  id: string,
  canvasId: string,
  request: CloverRequest | undefined,
  signal?: AbortSignal,
): Promise<Page> {
  return upgradePage(await fetchJson(request, id, signal), canvasId);
}

/** A page as Clover holds it: upgraded to Presentation 4, inside a Canvas of its own. */
export async function upgradePage(
  json: unknown,
  canvasId = "urn:clover:annotation-page",
): Promise<Page> {
  const page = json as Page & { "@context"?: unknown };
  if (isPresentation4(page)) return page;
  const canvas = await toPresentation4<Record<string, any>>({
    "@context":
      page["@context"] ?? "http://iiif.io/api/presentation/3/context.json",
    id: canvasId,
    type: "Canvas",
    items: [{ ...page, "@context": undefined }],
  });
  return canvas.items?.[0] ?? page;
}

/** The Manifest with one page embedded in place of its reference. */
export function embedPage(
  manifest: Manifest,
  canvasId: string,
  list: PageList,
  page: Page,
): Manifest {
  let changed = false;
  const items = ((manifest.items ?? []) as Array<Record<string, any>>).map(
    (canvas) => {
      if (canvas.id !== canvasId || !Array.isArray(canvas[list])) return canvas;
      const pages = (canvas[list] as Page[]).map((existing) => {
        if (existing.id !== page.id || !isReference(existing)) return existing;
        changed = true;
        return page;
      });
      return changed ? { ...canvas, [list]: pages } : canvas;
    },
  );
  return changed ? ({ ...manifest, items } as Manifest) : manifest;
}
