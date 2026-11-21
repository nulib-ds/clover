import {
  type CloverRequest,
  CloverRequestError,
  cloverFetch,
  discardBody,
} from "./request";

/**
 * Why a request that never answered failed. A browser keeps the reason from scripts: a
 * server down, a page offline and an answer without CORS headers all reject alike. So the
 * URL is asked again in `no-cors` mode, whose answer the page cannot read but which
 * arrives wherever the server answers at all: then CORS is what stood in the way. Where
 * that fails too (offline, an unknown host, mixed content, a Content Security Policy), the
 * browser's own error stands.
 */
export async function explainFailure(
  request: CloverRequest | undefined,
  url: string,
  error: unknown,
  signal?: AbortSignal,
): Promise<never> {
  if (signal?.aborted) throw error;
  try {
    const probe = await cloverFetch(request, url, { mode: "no-cors", signal });
    discardBody(probe);
  } catch {
    throw error;
  }
  throw new CloverRequestError(
    /*
     * Clover's words, true of a header missing or not matching, which the page cannot
     * tell apart. In English alone, as an error's own words are (Mat, 2026-11-20): never
     * an interface string, so no locale carries it.
     */
    "There was an issue with the provider's CORS headers.",
    url,
    undefined,
    "cors",
  );
}
