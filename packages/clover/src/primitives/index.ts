/*
 * @nulib/clover/primitives: the parts that draw one IIIF property each (Primitives' pages,
 * `Label` to `Value`), as `@nulib/clover` exports them, for a bundler that counts a
 * module's re-exports as reached (esbuild's code splitting; `src/viewer/index.ts` says
 * why). Each draws a resource's property in a `Root`, or the `value` it is given.
 *
 *   import { Label, Metadata, Summary } from "@nulib/clover/primitives";
 */

export { Label } from "../components/Label/Label";
export type { LabelProps } from "../components/Label/Label";
export {
  Homepage,
  Id,
  Metadata,
  PartOf,
  Rendering,
  RequiredStatement,
  Rights,
  SeeAlso,
  Summary,
  Thumbnail,
  Value,
} from "../components/Primitives/Primitives";
export { Logo, Provider } from "../components/Provider/Provider";
export type { LogoProps, ProviderProps } from "../components/Provider/Provider";
