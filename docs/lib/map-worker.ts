import { useEffect, useState } from "react";

/**
 * MapLibre's worker, as the docs serve it. Next's bundler moves MapLibre's files, so its
 * worker cannot find the module it imports; the docs bundle one of their own
 * (`npm run build:maplibre-worker`, into `maplibre-worker.generated.ts` beside this file)
 * and set it once for every map with `setMapWorkerUrl`.
 *
 * The worker is about 500 kB, so it is loaded only where a map can appear, and only once:
 * every caller shares the one promise.
 */
let loading: Promise<void> | undefined;

export const loadMapWorker = () =>
  (loading ??= Promise.all([
    import("@nulib/clover"),
    import("docs/lib/maplibre-worker.generated"),
  ]).then(([{ setMapWorkerUrl }, worker]) => {
    setMapWorkerUrl(
      URL.createObjectURL(
        new Blob([worker.default], { type: "text/javascript" }),
      ),
    );
  }));

/** `true` once the worker is set. Pass `false` to wait without loading it. */
export function useMapWorker(enabled = true) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadMapWorker().then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, [enabled]);
  return ready;
}
