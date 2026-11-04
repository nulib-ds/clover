import { adoptSheet } from "../../ui/adoptSheet";

/**
 * MapLibre's stylesheet, brought as a map is first shown where the page has none, so no
 * page has to import it: loaded beside MapLibre, and adopted (`adoptSheet`) in a layer of
 * its own after Clover's, so it outranks Clover's rules as it does unlayered, and the
 * page's own rules outrank it. Where the page has it already (its own import, the
 * elements', the docs'), nothing more loads, and the page's rules over it keep their
 * place. Nothing in source (the docs, the tests), where `maplibre-sheet.ts` is empty.
 */
export async function mapLibreSheet(): Promise<void> {
  if (typeof document === "undefined" || hasMapLibreSheet()) return;
  const { css } = await import("./maplibre-sheet");
  if (css) adoptSheet("maplibre", css);
}

/** Whether the page has MapLibre's stylesheet: it clips a map's box, and places it. */
function hasMapLibreSheet() {
  const probe = document.createElement("div");
  probe.className = "maplibregl-map";
  probe.hidden = true;
  document.body.append(probe);
  const { overflow, position } = getComputedStyle(probe);
  probe.remove();
  return overflow === "hidden" && position === "relative";
}
