import React, { useMemo, useSyncExternalStore } from "react";

import {
  type Forwarded,
  type ItemsProps,
  ItemsView,
  Pager,
  stepsOf,
} from "./Items";
import { type Georeference, georeferencesOf } from "../../core/geo";
import type { ItemModel } from "../../core/items";
import { selectVisibleCanvases } from "../../core/selectors";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { useClover, useCloverSelector } from "../../react/context";
import { overlayItems } from "../Map/overlayItems";

/**
 * The Root's georeferenced images (`georeferencesOf`), as Items lists a Collection's
 * members: each the map it is, cut from its image, named by its label (a sheet's several
 * told apart, "Sheet 21 2 / 3"). The one on a Canvas in view is selected; choosing one goes
 * to its Canvas. Pointing at one tells the Root (`highlight`), so a `Map` beside it outlines
 * it at half strength and lights its own item; one pointed at on the map is lit here. Its
 * own chunk, loaded only where the Manifest georeferences something.
 */
export default function GeoreferenceItems({
  onSelect,
  forwardedRef,
  ...rest
}: ItemsProps & Forwarded) {
  const { clover, language } = useClover("Items");
  const { t, langOf } = useCloverTranslation();
  const overlays = useCloverSelector((state) =>
    georeferencesOf(state.manifest),
  );
  const shown = useCloverSelector((state) =>
    selectVisibleCanvases(state.manifest, state.canvasId),
  );
  const highlighted = useSyncExternalStore(
    clover.highlight.subscribe,
    clover.highlight.get,
    clover.highlight.get,
  );
  const items = useMemo(
    () =>
      overlayItems(overlays, language, (index) => ({
        text: t("mapPlaceUntitled", { number: index + 1 }),
        lang: langOf("mapPlaceUntitled"),
      })),
    [overlays, language, t, langOf],
  );
  if (!items.length) return null;
  const overlayOf = (item: ItemModel): Georeference | undefined =>
    overlays[items.indexOf(item)];
  const selected = overlays.findIndex((overlay) =>
    shown.some((canvas) => canvas.id === overlay.canvasId),
  );
  const choose = (item: ItemModel, event: React.SyntheticEvent) => {
    onSelect?.(item, event);
    const canvasId = overlayOf(item)?.canvasId;
    if (canvasId) clover.goTo(canvasId);
  };
  if (rest.layout === "pager")
    return (
      <Pager
        {...rest}
        forwardedRef={forwardedRef}
        steps={stepsOf(items, selected, "left-to-right", choose)}
      />
    );
  return (
    <ItemsView
      {...rest}
      forwardedRef={forwardedRef}
      items={items}
      selected={selected}
      pointed={overlays.findIndex((overlay) => overlay.id === highlighted)}
      navigation="id"
      language={language}
      request={clover.request}
      onActivate={choose}
      onPoint={(item) =>
        clover.highlight.emit((item && overlayOf(item)?.id) ?? null)
      }
    />
  );
}
