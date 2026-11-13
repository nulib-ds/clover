import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Tip } from "../../ui/Tip";

/**
 * The Map's link to Allmaps Viewer (`allmaps`, `MapView.tsx`): a control of the map's own,
 * at its lower corner at its start, where a basemap's mark sits (a MapLibre control group
 * that React draws into, as the map's options are), holding a link named by its Tip, in a
 * new tab. Its own module, loaded only for a map that offers the link.
 */
export default function AllmapsLink({
  map,
  href,
  label,
  lang,
}: {
  /** The MapLibre map. */
  map: any;
  href: string;
  label: string;
  lang?: string;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const group = document.createElement("div");
    group.className = "maplibregl-ctrl maplibregl-ctrl-group";
    const control = { onAdd: () => group, onRemove: () => group.remove() };
    map.addControl(control, "bottom-left");
    setSlot(group);
    return () => {
      map.removeControl?.(control);
      setSlot(null);
    };
  }, [map]);
  return (
    slot &&
    createPortal(
      <a
        className="clover-geomap-allmaps"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        lang={lang}
      >
        <AllmapsMark />
        <Tip label={label} lang={lang} />
      </a>,
      slot,
    )
  );
}

/**
 * Allmaps' mark, in one color: the inverted logo `@allmaps/ui` ships
 * (`allmaps-logo-inverted.svg`, MIT, © Allmaps), its polygons joined in one path and
 * rounded to whole units, drawn in the control's glyph color on the control's fill.
 */
const AllmapsMark = () => (
  <svg
    className="clover-geomap-allmaps-mark"
    viewBox="150 66 1140 1308"
    fill="currentColor"
    focusable="false"
    aria-hidden="true"
  >
    <path d="M1275 1032 720 1360 165 1032l65-39 490 289 490-289zM1275 876 720 1204 165 876l65-39 490 289 490-289zM1275 720 720 1048 165 720l65-39 490 290 490-290zM1275 564 720 892 165 564l65-38 490 289 490-289zM720 81 165 408l555 328 555-328zm-43 559-94-54 69-71-138-80-123 40-93-54 608-179 80 47zM827 334 706 459l-95-55z" />
  </svg>
);
