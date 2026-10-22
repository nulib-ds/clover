/*
 * @nulib/clover/web-components: `<clover-viewer>`, and the parts to compose a layout of
 * your own (`<clover-root>`, `<clover-label>`, `<clover-content>`, `<clover-items>`),
 * built standalone with Preact standing in for React (`build/web-components.config.mjs`),
 * for pages without React. Load it as a module, or with `index.umd.js` from a classic
 * `<script>` (a CDN):
 *
 *   <script type="module" src=".../web-components/index.mjs"></script>
 *   <clover-viewer iiif-content="https://example.org/manifest.json"></clover-viewer>
 *
 *   <clover-root iiif-content="https://example.org/manifest.json">
 *     <clover-label as="h2"></clover-label>
 *     <clover-content></clover-content>
 *     <clover-items></clover-items>
 *   </clover-root>
 *
 * It defines every element, each a stub until one connects: then its code, the host and
 * the stylesheet load, once for the page, so a page loads only the elements it uses. What
 * only media and maps need of the stylesheet loads with them, as MapLibre's stylesheet and
 * worker do. `initCloverI18n` sets the language of Clover's own strings, which otherwise
 * follows the page's `<html lang>`, then the reader's browser:
 *
 *   import { initCloverI18n } from ".../web-components/index.mjs";
 *   initCloverI18n({ lng: document.documentElement.lang });
 */
import { defineCloverElements } from "./define";
import { initCloverI18n } from "./i18n";
import type { ElementAssets, StyleRun } from "./styles";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

/*
 * The runs of the stylesheet that only media, maps and the templates need, each fetched
 * as what needs it draws: the Canvas marks a recording, a video or an animation before its
 * player loads, and a viewer names its template, so the two load side by side.
 */
const DEFERRED: Record<string, Omit<StyleRun, "key">> = {
  media: {
    when: ".clover-canvas:is([data-media], [data-animated])",
    load: () =>
      import("virtual:clover-styles/media").then((module) => module.default),
  },
  map: {
    when: ".clover-geomap",
    load: () =>
      import("virtual:clover-styles/map").then((module) => module.default),
  },
  // A `<clover-viewer>` in Document or Gallery asks for it, beside its template's code.
  templates: {
    when: 'clover-viewer:is([template="document" i], [template="gallery" i])',
    load: () =>
      import("virtual:clover-styles/templates").then(
        (module) => module.default,
      ),
  },
};

const assets: ElementAssets = {
  // The stylesheet's runs, loaded with the first element to connect.
  styles: () =>
    import("virtual:clover-styles").then(({ default: parts }) =>
      parts.map((part) =>
        part.css === undefined ? { ...part, ...DEFERRED[part.key] } : part,
      ),
    ),
  mapWorkerUrl,
  mapStyles: () =>
    import("maplibre-gl/dist/maplibre-gl.css?inline").then(
      (module) => module.default,
    ),
};

defineCloverElements(assets);

export { defineCloverElements, initCloverI18n };
