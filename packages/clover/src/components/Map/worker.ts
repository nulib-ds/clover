import { source, version } from "./maplibre-worker";

let url: string | undefined;
let warned = false;

/**
 * The worker Clover brings, as a blob URL made once for every map. Nothing where it has
 * none (in source, as the docs and tests run it), or where it was built from another
 * MapLibre than the one running, whose messages it may not read. Loaded with MapLibre.
 */
export function bundledWorkerUrl(running: string | undefined) {
  if (!source || typeof URL.createObjectURL !== "function") return;
  if (version && running && version !== running) {
    if (!warned) {
      warned = true;
      console.warn(
        `Clover: its map worker is MapLibre ${version}'s, and MapLibre ${running} is running; serve ${running}'s worker with setMapWorkerUrl.`,
      );
    }
    return;
  }
  return (url ??= URL.createObjectURL(
    new Blob([source], { type: "text/javascript" }),
  ));
}
