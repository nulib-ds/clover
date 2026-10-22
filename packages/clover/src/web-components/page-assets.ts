/*
 * What both entries hand the elements (`index.ts`, `viewer.ts`): the stylesheet's runs,
 * MapLibre's worker and its stylesheet, each loaded when first needed. Not `assets.ts`:
 * TypeScript would read `assets.d.ts`, the virtual modules' declarations, as its own.
 */
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

export const assets: ElementAssets = {
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
