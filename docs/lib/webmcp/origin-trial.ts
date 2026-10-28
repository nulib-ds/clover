/**
 * Chrome's origin trial for WebMCP (AGENTS.md, "Agent tools (WebMCP)"): the token
 * registered for the site's origin, which every page gives Chrome in a `<meta
 * http-equiv="origin-trial">` (`app/layout.tsx`), so its readers' browsers offer
 * `document.modelContext` to the page. Empty until it is registered: Mat registers it, at
 * https://developer.chrome.com/origintrials, for the origin the site is served from
 * (`https://nulib-ds.github.io` today), and pastes it here. A token is public, written
 * into every page, and works only on its origin and until its trial ends.
 */
export const WEBMCP_ORIGIN_TRIAL = "";
