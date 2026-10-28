/**
 * Where MapLibre's worker is served from, for every map: MapLibre's own `setWorkerUrl` is
 * global, and so is this. Clover brings the worker itself (`components/Map/worker.ts`), so
 * a page sets one only to serve its own, as a Content Security Policy that refuses `blob:`
 * workers needs; see the Map docs.
 */
let workerUrl: string | undefined;

/** Serve MapLibre's worker from `url` for every map Clover draws (a Viewer's Map tab included). */
export function setMapWorkerUrl(url: string | undefined): void {
  workerUrl = url;
}

export function getMapWorkerUrl(): string | undefined {
  return workerUrl;
}
