import React, { forwardRef } from "react";

import { ConnectedMap, GivenMap, type MapProps } from "./MapView";
import { useOptionalClover } from "../../react/context";
import { Root } from "../Root/Root";

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
    const { iiifContent, request, language, ...rest } = props;
    if (iiifContent !== undefined) {
      return (
        <Root
          iiifContent={iiifContent}
          request={request}
          language={language}
          annotationPages="all"
          style={{ display: "contents" }}
        >
          <ConnectedMap {...rest} scope="all" forwardedRef={ref} />
        </Root>
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
