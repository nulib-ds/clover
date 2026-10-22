/*
 * What both entries hand the elements (`index.ts`, `viewer.ts`): where MapLibre's worker
 * is. Clover's stylesheet is not among it: each sheet comes with the code that draws what
 * it styles (`build/clover-sheets.mjs`). Not `assets.ts`: TypeScript would read
 * `assets.d.ts`, the virtual modules' declarations, as its own.
 */
import type { ElementAssets } from "./styles";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

export const assets: ElementAssets = { mapWorkerUrl };
