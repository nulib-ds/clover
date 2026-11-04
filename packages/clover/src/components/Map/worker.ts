import { source, version } from "./maplibre-worker";

// Loaded with it, MapLibre's stylesheet for a page that has none.
export { mapLibreSheet } from "./sheet";

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

let allowed: Promise<boolean> | undefined;

/**
 * Whether the page lets a worker start from a `blob:` URL, as Clover's starts: a strict
 * Content Security Policy's `worker-src` keeps workers to the page's own hosts, and its
 * Trusted Types refuse a worker from a string. Asked once, of a worker of nothing, before
 * MapLibre is handed a worker that starts from one (Clover's, or one on another host,
 * which MapLibre wraps in one); where it is refused, the map says it could not be shown,
 * and the console how to serve the worker (`setMapWorkerUrl`).
 */
export function blobWorkersAllowed(): Promise<boolean> {
  return (allowed ??= new Promise((resolve) => {
    const probe = URL.createObjectURL(
      new Blob(["postMessage(0)"], { type: "text/javascript" }),
    );
    const done = (ok: boolean, worker?: Worker) => {
      worker?.terminate();
      URL.revokeObjectURL(probe);
      if (!ok)
        console.warn(
          "Clover: this page's Content Security Policy refuses a worker from a blob: URL, as MapLibre's map needs one. Serve maplibre-gl/dist/maplibre-gl-worker.mjs from your site and name it with setMapWorkerUrl.",
        );
      resolve(ok);
    };
    try {
      const worker = new Worker(probe);
      worker.onmessage = () => done(true, worker);
      worker.onerror = () => done(false, worker);
    } catch {
      done(false);
    }
  }));
}
