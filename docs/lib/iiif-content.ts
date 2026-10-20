import type { DocsRouter } from "docs/lib/router";
import { decodeContentState } from "@iiif/helpers";

/**
 * The query parameter the docs use to hand a resource to a component, and the one the IIIF
 * Content State API reserves for the same job.
 */
export const IIIF_CONTENT_PARAM = "iiif-content";

const isHttpUrl = (value: string) => {
  try {
    const { protocol, hostname } = new URL(value);
    return (protocol === "http:" || protocol === "https:") && hostname !== "";
  } catch {
    return false;
  }
};

/**
 * `iiif-content` may also carry a base64url-encoded IIIF Content State instead of a URL,
 * which Clover decodes itself. `decodeContentState` throws on malformed input but happily
 * returns junk for text that merely looks like base64, so the result has to parse as JSON.
 */
const isEncodedContentState = (value: string) => {
  try {
    const state = JSON.parse(decodeContentState(value));
    return typeof state === "object" && state !== null;
  } catch {
    return false;
  }
};

/**
 * Returns the trimmed value when Clover can load it, otherwise `undefined`.
 *
 * A usable value is an absolute `http(s)` URL — a Manifest or Collection — or an encoded
 * Content State. Anything else (a `javascript:` URL, a relative path, stray text) would
 * leave the Viewer stuck on "Loading", so it is rejected here instead.
 */
export const validIiifContent = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return isHttpUrl(trimmed) || isEncodedContentState(trimmed)
    ? trimmed
    : undefined;
};

/** For a form field: a message when `value` is not loadable, nothing when it is. */
export const iiifContentError = (value: string) =>
  validIiifContent(value)
    ? undefined
    : "Enter the web address of a IIIF Manifest or Collection, starting with https://";

/**
 * Sets, or with no value clears, `iiif-content` in the URL, leaving any other parameters.
 *
 * Shallow and without scrolling: only the query changes, so Next skips data loading and the
 * page stays where it is. A deep link into a long page would otherwise jump to the top.
 */
export const pushIiifContent = (
  router: Pick<DocsRouter, "pathname" | "push" | "query">,
  value?: string,
) => {
  const query = { ...router.query };
  delete query[IIIF_CONTENT_PARAM];
  return router.push(
    {
      pathname: router.pathname,
      query: value ? { ...query, [IIIF_CONTENT_PARAM]: value } : query,
    },
    undefined,
    { shallow: true, scroll: false },
  );
};
