/*
 * @nulib/clover/web-components: `<clover-viewer>`, built standalone with Preact standing in
 * for React (`build/web-components.config.mjs`), for pages without React. Load it as a
 * module, or with `index.umd.js` from a classic `<script>` (a CDN):
 *
 *   <script type="module" src=".../web-components/index.mjs"></script>
 *   <clover-viewer iiif-content="https://example.org/manifest.json"></clover-viewer>
 *
 * The stylesheet comes with it. What only media and maps need of it loads with them, as
 * MapLibre's stylesheet and worker do.
 * `initCloverI18n` sets the language of Clover's own strings, which otherwise follows the
 * page's `<html lang>`, then the reader's browser:
 *
 *   import { initCloverI18n } from ".../web-components/index.mjs";
 *   initCloverI18n({ lng: document.documentElement.lang });
 */
import { type StyleRun, defineCloverViewer } from "./element";
import { initCloverI18n } from "../i18n/config";
import parts from "virtual:clover-styles";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

/*
 * The runs of the stylesheet that only media and maps need, each fetched as what needs it
 * draws: the Canvas marks a recording, a video or an animation before its player loads,
 * so the two load side by side.
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
};

defineCloverViewer({
  styles: parts.map((part) =>
    part.css === undefined ? { ...part, ...DEFERRED[part.key] } : part,
  ),
  mapWorkerUrl,
  mapStyles: () =>
    import("maplibre-gl/dist/maplibre-gl.css?inline").then(
      (module) => module.default,
    ),
});

export { defineCloverViewer, initCloverI18n };
