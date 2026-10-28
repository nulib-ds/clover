/**
 * MapLibre's worker as source text, with what it imports bundled in, and the MapLibre
 * version it was built from. Empty here: the package's build fills it
 * (`build/maplibre-worker.mjs`), so an app's bundler never has to find MapLibre's worker.
 * Loaded only with MapLibre, when a map is first shown.
 */
export const source: string | undefined = undefined;
export const version: string | undefined = undefined;
