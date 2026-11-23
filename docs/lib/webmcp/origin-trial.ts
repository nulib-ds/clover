/**
 * The origin trials for WebMCP (AGENTS.md, "Agent tools (WebMCP)"): the tokens registered
 * for the site's origin, which every page gives the browser in a `<meta
 * http-equiv="origin-trial">` (`app/layout.tsx`), so its readers' browsers offer
 * `document.modelContext` to the page. Each is empty until it is registered: Mat
 * registers them for the origin the site is served from
 * (`https://clover.iiif.library.northwestern.edu`), and pastes them here. A token is
 * public, written into every page, and works only on its origin and until it expires, so
 * a trial extended past it needs a token renewed.
 */

/**
 * Chrome's ("WebMCP", https://developer.chrome.com/origintrials): Chrome 149 to 162, as
 * extended on 2026-09-28.
 */
export const WEBMCP_ORIGIN_TRIAL = "";

/**
 * Edge's, registered apart from Chrome's, on Microsoft's own portal ("WebMCP",
 * https://developer.microsoft.com/microsoft-edge/origin-trials, to 2027-03-30).
 */
export const WEBMCP_EDGE_ORIGIN_TRIAL = "";
