import { type CloverRequest, cloverFetch } from "./request";

/** The name to save a file under: the last part of its address, else "download". */
export function fileName(url: string): string {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : "download";
  } catch {
    return "download";
  }
}

/**
 * Saves a file rather than opening it (Mat, 2026-10-28: "rendering clicks should download
 * and not open in a new tab if possible"): fetched with the Root's request (its
 * credentials and headers) and no referrer, as its link would send none, then handed to
 * the browser as a download under its own name. A link's `download` alone is honored only
 * on the page's own origin, and a rendering is almost always elsewhere. True once saved;
 * false where it cannot be fetched (a server without CORS), for the caller to open it
 * as a link does. Loaded on the first press (`Download.tsx`).
 */
export async function saveFile(
  url: string,
  request?: CloverRequest,
): Promise<boolean> {
  try {
    const response = await cloverFetch(request, url, {
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) return false;
    const href = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName(url);
    document.body.append(link);
    link.click();
    link.remove();
    // Kept a while: some browsers read it after the click returns.
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return true;
  } catch {
    return false;
  }
}
