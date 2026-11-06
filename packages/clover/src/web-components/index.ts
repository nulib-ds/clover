/*
 * @nulib/clover/web-components: `<clover-viewer>`, and the parts to compose a layout of
 * your own (`<clover-root>`, `<clover-label>`, `<clover-body>`, `<clover-items>`),
 * built standalone with Preact standing in for React (`build/web-components.config.mjs`),
 * for pages without React. Load it as a module, or with `index.umd.js` from a classic
 * `<script>` (a CDN):
 *
 *   <script type="module" src=".../web-components/index.mjs"></script>
 *   <clover-viewer iiif-content="https://example.org/manifest.json"></clover-viewer>
 *
 *   <clover-root iiif-content="https://example.org/manifest.json">
 *     <clover-label as="h2"></clover-label>
 *     <clover-body></clover-body>
 *     <clover-items></clover-items>
 *   </clover-root>
 *
 * It defines every element, each a stub until one connects: then its code, the host and
 * the stylesheet load, once for the page, so a page loads only the elements it uses. What
 * only media and maps need of the stylesheet loads with them, as MapLibre's stylesheet and
 * worker do. `initCloverI18n` configures Clover's interface language, which is otherwise
 * the visitor's where Clover has strings for it, else the site's (those configured, then
 * the page's `<html lang>`):
 *
 *   import { initCloverI18n } from ".../web-components/index.mjs";
 *   initCloverI18n({ languages: ["fr", "en"] });
 */
import { defineCloverElements } from "./define";
import { initCloverI18n } from "./i18n";
import { assets } from "./page-assets";

defineCloverElements(assets);

export { defineCloverElements, initCloverI18n };
