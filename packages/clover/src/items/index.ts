/*
 * @nulib/clover/items: `Items`, and the pager's `Previous`, `Next` and `Position`, as
 * `@nulib/clover` exports them, for a bundler that counts a module's re-exports as
 * reached (esbuild's code splitting; `src/viewer/index.ts` says why). Items lists a
 * resource on its own (`iiifContent`) or a `Root`'s views.
 *
 *   import { Items } from "@nulib/clover/items";
 */

export { Items } from "../components/Items/Items";
export type { ItemsLayout, ItemsProps } from "../components/Items/Items";
export { Next, Previous } from "../components/Items/Pager";
export { Position } from "../components/Items/Position";
export type { StepProps } from "../components/Items/Pager";
export type { PositionProps, StepsOf } from "../components/Items/Position";
