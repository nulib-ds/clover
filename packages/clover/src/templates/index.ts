/*
 * @nulib/clover/templates: layouts for the Viewer, each built only from the parts
 * `@nulib/clover` exports and the helpers below, so any of them can be copied and changed.
 * Their styles are `@nulib/clover/templates.css`, beside `@nulib/clover/styles.css`.
 *
 *   import Viewer from "@nulib/clover";
 *   import { Document } from "@nulib/clover/templates";
 *
 *   <Viewer iiifContent={url} template={Document} />
 *
 * `Default` is the Viewer's own, drawn when no template is given; its styles are in
 * `styles.css`.
 *
 * The helpers are what the templates share (`shared/`), exported so a copy of a template
 * imports them from here where it imported `../shared/…` (issue #391). Every name a
 * template imports from `../shared/` is exported here: `exports.test.ts` holds it.
 */

export { Default } from "./default/Default";
export type { DefaultProps } from "./default/Default";
export { Document } from "./document/Document";
export type { DocumentProps } from "./document/Document";
export { Gallery } from "./gallery/Gallery";
export type { GalleryProps } from "./gallery/Gallery";

// The information panel every template shares.
export { PanelPane, usePanelPane } from "./shared/PanelPane";
export type { PanelPaneOptions, PanelPaneState } from "./shared/PanelPane";

// Panes beside the page, or drawers over it.
export { useDrawer } from "./shared/useDrawer";
export type { DrawerOptions } from "./shared/useDrawer";
export { preloadDrag } from "./shared/useDragToClose";
export { useFollowFocus } from "./shared/useFollowFocus";
export {
  BESIDE_REM,
  PAGE_MIN,
  PANEL_MIN,
  useWideEnough,
} from "./shared/useSlide";

// The Gallery's lightbox, and the annotations it walks.
export { Lightbox, preloadLightbox } from "./shared/Lightbox";
export type { LightboxProps } from "./shared/Lightbox";
export { useGivenAnnotations } from "./shared/givenAnnotations";
