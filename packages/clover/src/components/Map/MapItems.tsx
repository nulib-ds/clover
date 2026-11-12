import React, { useMemo } from "react";

import { overlayItems } from "./overlayItems";
import type { Georeference, MapFeature } from "../../core/geo";
import type { ItemModel } from "../../core/items";
import type { CloverRequest } from "../../core/request";
import type { LanguageMapLike } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { ItemsView } from "../Items/Items";

/** The layouts the map's list takes: Items', but the pager's. */
export type MapItemsLayout = "list" | "grid" | "slider" | "masonry";

/**
 * A map's list (`items`, `MapView`): its places, then its georeferenced images, drawn by
 * Items in one of its layouts, the map's text and the keyboard's way to each. A place is
 * named, dated (Cookbook 0318) and pictured as on the map; an image is its picture, cut to
 * the map it is (`overlayItems`). Each is keyed `place-<index>` or `overlay-<id>`. Its own
 * module, with Items', loaded only for a map that lists something.
 */
export default function MapItems({
  places,
  overlays,
  layout,
  selected,
  pointed,
  language,
  request,
  onChoose,
  onPoint,
}: {
  places: MapFeature[];
  overlays: Georeference[];
  layout: MapItemsLayout;
  /** The key of the item chosen, or current. */
  selected: string | null;
  /** The key of the item pointed at on the map, or elsewhere. */
  pointed: string | null;
  language?: string;
  request?: CloverRequest;
  onChoose: (key: string) => void;
  onPoint: (key: string | null) => void;
}) {
  const { t, langOf } = useCloverTranslation();
  const items = useMemo<ItemModel[]>(() => {
    // Unnamed, numbered in the list's order: a place by its own, an image after them.
    const untitled = (number: number) => ({
      text: t("mapPlaceUntitled", { number }),
      lang: langOf("mapPlaceUntitled"),
    });
    const placed = places.map((feature, index): ItemModel => {
      const { title, titleLang, navDate, thumbnail } = feature.properties;
      const name = title
        ? { text: title, lang: titleLang }
        : untitled(index + 1);
      const label: LanguageMapLike = { [name.lang ?? "none"]: [name.text] };
      return {
        id: `place-${index}`,
        label,
        navDate,
        parts: [
          {
            id: `place-${index}`,
            type: "Place",
            label,
            // What its owner's picture is made from, as the map's popup shows it.
            resource: thumbnail ? JSON.parse(thumbnail) : {},
          },
        ],
      };
    });
    return [
      ...placed,
      ...overlayItems(
        overlays,
        language,
        (index) => untitled(places.length + index + 1),
        "overlay-",
      ),
    ];
  }, [places, overlays, language, t, langOf]);
  const index = (key: string | null) =>
    key === null ? -1 : items.findIndex((item) => item.id === key);
  return (
    <ItemsView
      forwardedRef={null}
      // No landmark of its own: the map is the region, its list what follows it.
      as="div"
      className="clover-geomap-items"
      items={items}
      selected={index(selected)}
      pointed={index(pointed)}
      navigation="id"
      layout={layout}
      // Small as a row's picture shows; Items' own size in its other layouts.
      thumbnailSize={layout === "list" ? 104 : undefined}
      language={language}
      request={request}
      showSummary
      secondary="navDate"
      nameKey="mapItemsLabel"
      onActivate={(item) => onChoose(item.id)}
      onPoint={(item) => onPoint(item?.id ?? null)}
    />
  );
}
