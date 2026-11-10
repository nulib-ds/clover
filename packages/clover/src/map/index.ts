/*
 * @nulib/clover/map: where IIIF resources are, on a map. A navPlace layer (Collection,
 * Manifest, Canvas and annotation) and georeferenced images, warped by their control
 * points. In the same module graph as `@nulib/clover`, so a `Map` inside a `Clover.Root`
 * maps the Root's resource and follows its view. `@nulib/clover` exports the same, as
 * `<Clover.Map />`, which the docs write; this entry stays for pages that import from it.
 *
 * MapLibre GL is loaded when a map is first shown, its worker and stylesheet with it (the
 * stylesheet only where the page has none); importing this entry loads none of it. A
 * Viewer's Map tab needs no import of this entry: it appears by itself.
 *
 *   import { Map } from "@nulib/clover/map";
 */

export { CloverMap as Map } from "../components/Map/Map";
export type { MapProps } from "../components/Map/Map";
export { setMapWorkerUrl } from "../core/map-config";
export {
  affineTransform,
  boundsOf,
  canvasHasMapData,
  cornersOf,
  georeferencesOf,
  hasMapData,
  navPlaceOf,
  readGeoreference,
} from "../core/geo";
export type {
  Georeference,
  MapFeature,
  MapFeatureCollection,
} from "../core/geo";
