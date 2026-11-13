import React, { forwardRef, useMemo } from "react";

import { MapList } from "./MapList";
import { type Forwarded, type MapProps, MapView } from "./MapView";
import { type Georeference, georeferencesOf, navPlaceOf } from "../../core/geo";
import { selectShownId, selectVisibleCanvases } from "../../core/selectors";
import { isGeoreferencedContent } from "../../core/geo-detect";
import {
  useOptionalClover,
  useOptionalCloverSelector,
} from "../../react/context";

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
  const context = useOptionalClover()!;
  const features = useOptionalCloverSelector(
    (state) => navPlaceOf(state.manifest, state.collection, context.language),
    navPlaceOf(null),
  );
  const all = useOptionalCloverSelector(
    (state) => georeferencesOf(state.manifest),
    NONE,
  );
  const shown = useOptionalCloverSelector(
    (state) => selectVisibleCanvases(state.manifest, state.canvasId),
    NO_CANVASES,
  );
  // The same array while the view holds, so the map is not re-framed under the reader.
  // Georeference annotations given as the content: every sheet, unless asked for the view's.
  const atlas = useOptionalCloverSelector(
    (state) => isGeoreferencedContent(state.manifest),
    false,
  );
  const every =
    scope === "all" || whose === "all" || (atlas && whose !== "view");
  const overlays = useMemo(
    () =>
      every
        ? all
        : all.filter((overlay) =>
            shown.some((canvas) => canvas.id === overlay.canvasId),
          ),
    [every, all, shown],
  );
  // The annotations pointed at and picked, as the Canvas's hotspots show them.
  const picked = useOptionalCloverSelector((state) => state.annotationId, null);
  const highlighted = React.useSyncExternalStore(
    context.clover.highlight.subscribe,
    context.clover.highlight.get,
    context.clover.highlight.get,
  );
  const active = useMemo(
    () =>
      [picked, highlighted].filter(
        (id): id is string => typeof id === "string",
      ),
    [picked, highlighted],
  );
  // Only a view's Canvases are current, with the member open among its Collection's (or
  // asked for, while it loads): standalone, nothing shows the Root's first one.
  const manifestId = useOptionalCloverSelector(selectShownId, null);
  const current = useMemo(
    () =>
      scope === "view"
        ? [
            ...shown.map((canvas) => canvas.id),
            ...(manifestId ? [manifestId] : []),
          ]
        : undefined,
    [scope, shown, manifestId],
  );
  return (
    <MapView
      {...rest}
      List={MapList}
      features={features}
      overlays={overlays}
      current={current}
      activeAnnotations={active}
      picked={picked}
      highlighted={highlighted}
      onHighlight={(feature) =>
        context.clover.highlight.emit(feature?.properties.annotationId ?? null)
      }
      // An image pointed at, on the map or in its list: the Root's, as an annotation's
      // is, so a list of the page's own (or Items') lights it too.
      onPointOverlay={(id) => context.clover.highlight.emit(id)}
      // An image chosen: its Canvas, where the Root has it and is not there.
      onChooseOverlay={(item) => {
        const { canvasId } = item;
        if (canvasId && !shown.some((canvas) => canvas.id === canvasId))
          context.clover.goTo(canvasId);
      }}
      language={context.language}
      request={context.clover.request}
      onSelect={(feature) => {
        onSelect?.(feature);
        // An annotation's place: the annotation, so its region is framed (Cookbook 0139).
        // One the annotations do not list (it has no name): its Canvas, as before.
        const {
          annotationId,
          canvasId,
          manifestId: member,
        } = feature.properties;
        // Another member's place: that member, as its row in the Collection opens it.
        if (member && member !== context.clover.store.get().manifest?.id) {
          void context.clover.goToManifest(member);
          return;
        }
        if (annotationId) context.clover.selectAnnotation(annotationId);
        const selected =
          annotationId !== undefined &&
          context.clover.store.get().annotationId === annotationId;
        if (!selected && canvasId) context.clover.goTo(canvasId);
      }}
    />
  );
}

const NONE: Georeference[] = [];
const NO_CANVASES: ReturnType<typeof selectVisibleCanvases> = [];
