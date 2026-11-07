/**
 * How Clover asks for things: one setting for every request it makes — the IIIF resource,
 * referenced annotation pages, `info.json`, tiles, captions and HLS segments.
 *
 * A `<video>` or `<img>` element cannot send headers, so where Clover must use one (media
 * without HLS, an image served without CORS) only `credentials` applies.
 */
export interface CloverRequest {
  /** Cookies and HTTP authentication: `"include"` sends them cross-origin. */
  credentials?: RequestCredentials;
  /** Extra headers, such as `Authorization`. They force a CORS preflight. */
  headers?: Record<string, string>;
  /** Your own `fetch`, to sign, log or proxy requests. */
  fetch?: typeof fetch;
}

/** `fetch`, with the request's credentials and headers applied. */
export function cloverFetch(
  request: CloverRequest | undefined,
  url: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): Promise<Response> {
  const run = request?.fetch ?? globalThis.fetch;
  return run(url, {
    credentials: request?.credentials ?? "same-origin",
    ...init,
    headers: { ...init.headers, ...request?.headers },
  });
}

/**
 * Let go of an answer's body that nothing will read: an error's. Left alone, the browser
 * holds the request open until the response is collected, and over HTTP/1.1 a long one
 * keeps one of the six connections a page has to that host.
 */
export function discardBody(response: Response): void {
  response.body?.cancel().catch(() => {});
}

/** Whether elements (`crossOrigin`) and XHR (`withCredentials`) should send cookies. */
export const sendsCredentials = (request: CloverRequest | undefined) =>
  request?.credentials === "include";

/** A stable key for a request setting, to tell when it really changed. */
export const requestKey = (request: CloverRequest | undefined) =>
  JSON.stringify([request?.credentials, request?.headers]);

export class CloverRequestError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CloverRequestError";
  }
}

/** Fetch and parse JSON with the request applied; a non-2xx status rejects. */
export async function fetchJson(
  request: CloverRequest | undefined,
  url: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await cloverFetch(request, url, {
    signal,
    headers: { Accept: "application/ld+json, application/json" },
  });
  if (!response.ok) {
    discardBody(response);
    throw new CloverRequestError(
      `${url} answered ${response.status}`,
      url,
      response.status,
    );
  }
  return response.json();
}
