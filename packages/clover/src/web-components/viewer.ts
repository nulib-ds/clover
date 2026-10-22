/*
 * @nulib/clover/web-components/viewer: `<clover-viewer>` alone, built whole, for a page
 * that shows a Viewer and nothing else of Clover's. Its code comes with this module, not
 * cut into the chunks the other elements share, so such a page loads fewer, larger files,
 * gzipped together. Load one entry on a page, this one or `@nulib/clover/web-components`:
 * each brings its own host.
 *
 *   <script type="module" src=".../web-components/viewer/index.mjs"></script>
 *   <clover-viewer iiif-content="https://example.org/manifest.json"></clover-viewer>
 */
import { defineElement } from "./base";
import { ViewerElement } from "./elements/viewer";
import { initCloverI18n } from "./i18n";
import { assets } from "./page-assets";
import { viewer } from "./specs/viewer";
import { setMapWorkerUrl } from "../core/map-config";

if (assets.mapWorkerUrl) setMapWorkerUrl(assets.mapWorkerUrl);
defineElement(viewer, () => Promise.resolve(ViewerElement), assets);

export { initCloverI18n };
