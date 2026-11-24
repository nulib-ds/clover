import React, { forwardRef, useEffect, useRef, useState } from "react";

import { MapList } from "./MapList";
import { type Forwarded, type MapProps, MapView, useRootMap } from "./MapView";
import { useOptionalClover } from "../../react/context";

/*
 * The maps that follow a Root, and list what they map (`MapList`): the Panel's, a `Map`
 * inside a Root, and one that loads its own (`LoadedMap`). Apart from `MapView`, which the
 * Canvas's map box draws with, so that box, which lists nothing, never reaches Items' code
 * (2026-11-12). Like `MapView`, it imports no `Root`.
 */

/**
 * The Root's map, for a panel tab: the Root's places and the view's overlays. Its module
 * imports no `Root`, so a lazy chunk of it shares nothing a standalone Canvas loads.
 */
export const RootMap = forwardRef<
  HTMLElement,
  Omit<
    MapProps,
    "iiifContent" | "navPlace" | "georeferences" | "request" | "language"
  >
>(function RootMap(props, ref) {
  // Its panel's section is the landmark, under the same name: the map is not another.
  return (
    <ConnectedMap {...props} scope="view" landmark={false} forwardedRef={ref} />
  );
});

/** The Root's places, and the overlays of the view (or, standalone, every Canvas). */
export function ConnectedMap({
  scope,
  overlays: whose,
  onSelect,
  ...rest
}: Omit<MapProps, "iiifContent" | "request" | "language"> &
  Forwarded & { scope: "view" | "all"; landmark?: boolean }) {
  const root = useRootMap(scope, whose, onSelect);
  const asked = useAskedPlace();
  // The Root's gestures, where the map leaves them unset (`Root`'s `gestures`).
  const gestures = useOptionalClover()?.gestures;
  return (
    <MapView
      {...rest}
      cooperative={rest.cooperative ?? gestures?.cooperative}
      scrollZoom={rest.scrollZoom ?? gestures?.scrollToZoom}
      {...root}
      focus={asked}
      List={MapList}
    />
  );
}

/**
 * The place asked for in the Root (About's places, Annotations' georeferenced images: its
 * `place`), framed and marked on the map, as on the map over the Body: Document's over its
 * pages is a `Map`. Counted, so the same place asked again is framed again; the last one
 * asked stays framed as its map is put away.
 */
function useAskedPlace() {
  const context = useOptionalClover();
  const place = context && context.clover.place;
  const count = useRef(1);
  const [asked, setAsked] = useState(() => {
    const key = place && place.get();
    return key ? { key, n: count.current } : null;
  });
  useEffect(
    () =>
      place
        ? place.subscribe((key) => {
            if (key) setAsked({ key, n: (count.current += 1) });
          })
        : undefined,
    [place],
  );
  return asked;
}
