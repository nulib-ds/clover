/*
 * The compose helpers (WEBMCP.md): Clover's catalog, a layout's checks and its code, in
 * React or as HTML, for the docs' agent tools. Plain modules with no React and no DOM, so
 * the tools load them when first called, and tests run them as they are.
 */
export {
  type Catalog,
  type PartInfo,
  type PropInfo,
  type TemplateInfo,
  capabilities,
  catalog,
  findPart,
  findTemplate,
} from "docs/lib/compose/catalog";
export { CAPABILITIES, type Capability } from "docs/lib/compose/capabilities";
export {
  type Checked,
  type Issue,
  type Layout,
  type LayoutNode,
  ELEMENTS,
  checkLayout,
  layoutSchema,
} from "docs/lib/compose/layout";
export {
  type Composed,
  type Written,
  DEFAULT_RESOURCE,
  compose,
  writeLayout,
} from "docs/lib/compose/write";
