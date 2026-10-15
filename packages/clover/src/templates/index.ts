/*
 * @nulib/clover/templates: layouts for the Viewer, each built only from the parts
 * `@nulib/clover` exports, so any of them can be copied and changed. Their styles are
 * `@nulib/clover/templates.css`, beside `@nulib/clover/styles.css`.
 *
 *   import Viewer from "@nulib/clover";
 *   import { Document } from "@nulib/clover/templates";
 *
 *   <Viewer iiifContent={url} template={Document} />
 *
 * `Default` is the Viewer's own, drawn when no template is given; its styles are in
 * `styles.css`.
 */

export { Default } from "./default/Default";
export type { DefaultProps } from "./default/Default";
export { Document } from "./document/Document";
export type { DocumentProps } from "./document/Document";
export { Gallery } from "./gallery/Gallery";
export type { GalleryProps } from "./gallery/Gallery";
export { Lightbox } from "./shared/Lightbox";
export type { LightboxProps } from "./shared/Lightbox";
