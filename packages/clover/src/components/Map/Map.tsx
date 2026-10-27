import React, { Suspense, forwardRef, lazy } from "react";

import { ConnectedMap, GivenMap, type MapProps } from "./MapView";
import { useOptionalClover } from "../../react/context";
import { join } from "../../lib/classnames";

/*
 * A map that loads its own resource, in a Root of its own: its own chunk, so a map handed
 * its places, or inside a Root, never carries the Root's loader.
 */
const LoadedMap = lazy(() => import("./LoadedMap"));

export type { MapProps } from "./MapView";

/**
 * A map of where a IIIF resource is: its navPlace features (Collection, Manifest, Canvas
 * and annotation), and the georeferenced images of the Canvases in view, warped onto the
 * map by their control points. Pressing a place names it, and inside a `Root` goes to its
 * Canvas. Under the map, a list names each place and overlay, as buttons that do the same:
 * the map's text, and the keyboard's way to its places.
 *
 * MapLibre GL loads when a map is first shown, and nothing of it before. Its stylesheet is yours to import: `maplibre-gl/dist/maplibre-gl.css`.
 */
export const CloverMap = forwardRef<HTMLElement, MapProps>(
  function CloverMap(props, ref) {
    const root = useOptionalClover();
    // The Root's own props, left out of the map's.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { iiifContent, request, language, ...rest } = props;
    if (iiifContent !== undefined) {
      return (
        // Its box, while the Root's code loads: the page holds still around it.
        <Suspense
          fallback={
            <div
              className={join("clover-geomap", rest.className)}
              data-status="loading"
              style={rest.style}
            >
              <div style={{ height: "var(--clover-map-height, 24rem)" }} />
            </div>
          }
        >
          <LoadedMap {...props} forwardedRef={ref} />
        </Suspense>
      );
    }
    const given =
      props.navPlace !== undefined || props.georeferences !== undefined;
    return root && !given ? (
      <ConnectedMap {...rest} scope="view" forwardedRef={ref} />
    ) : (
      <GivenMap {...rest} forwardedRef={ref} />
    );
  },
);
