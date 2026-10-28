/**
 * The docs' searchable mocks' Content Search services, answered in the browser: the site
 * is static (GitHub Pages), which cannot read `?q=`. The newspaper (`content-search`) and
 * the bicycle catalog (`paged`; Mat, 2026-10-26) each answer from their own generator, by
 * the engine they share (`docs/mocks/ocr-search.mjs`), loaded only when a search is made:
 * the catalog's words are 276 kB, never loaded for a reader who does not search.
 *
 * Give it to any example's Root or Viewer as `request` (`MOCK_SEARCH`): everything that is
 * not one of these searches goes to the network as ever. In `npm run dev` the mocks open
 * live, their services under the dev server, which answers them itself.
 */

/** Where each mock is published, as its generator's `PUBLIC_BASE` (`mock-search.test.ts`). */
export const SEARCHABLE = {
  "content-search":
    "https://clover.iiif.library.northwestern.edu/mocks/content-search",
  paged: "https://clover.iiif.library.northwestern.edu/mocks/paged",
} as const;

const load = {
  "content-search": () => import("docs/mocks/content-search/index.mjs"),
  paged: () => import("docs/mocks/paged/index.mjs"),
};

const hrefOf = (input: RequestInfo | URL) =>
  typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;

/** A `fetch` that answers the mocks' searches and passes everything else on. */
export const mockSearchFetch: typeof fetch = async (input, init) => {
  const href = hrefOf(input);
  const name = (Object.keys(SEARCHABLE) as Array<keyof typeof SEARCHABLE>).find(
    (key) => href.startsWith(`${SEARCHABLE[key]}/search`),
  );
  if (!name) return fetch(input, init);
  const { mockFetch } = await load[name]();
  return (mockFetch() as typeof fetch)(input, init);
};

/** The `request` an example passes its Root or Viewer: one object, so it never changes. */
export const MOCK_SEARCH = { fetch: mockSearchFetch };
