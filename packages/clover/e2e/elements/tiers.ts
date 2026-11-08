/*
 * `?css=base`: base.css alone in place of Clover's styles; `?css=spacing`: base.css then
 * spacing.css (`build/tiers.mjs`), derived from the source. In the page before any element
 * connects, as a page links them before the elements' script, so the elements' registry
 * finds base.css's mark and brings none of Clover's sheets (`src/web-components/styles.ts`).
 */
import tiers from "virtual:clover-tiers";

const css = new URLSearchParams(location.search).get("css");
const wanted =
  css === "base" ? ["base"] : css === "spacing" ? ["base", "spacing"] : [];
for (const tier of wanted) {
  const style = document.createElement("style");
  style.dataset.tier = tier;
  style.textContent = `@layer clover{${tiers[tier]}}`;
  document.head.append(style);
}
