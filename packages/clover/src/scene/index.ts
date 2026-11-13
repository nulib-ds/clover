/*
 * @nulib/clover/scene: `Scene` on its own, as `@nulib/clover` exports it, for a bundler
 * that counts a module's re-exports as reached (esbuild's code splitting;
 * `src/viewer/index.ts` says why). Its three.js engine stays opt-in, from
 * `@nulib/clover/three`.
 *
 *   import { Scene } from "@nulib/clover/scene";
 */

export { Scene } from "../components/Scene/Scene";
export type {
  SceneControlsConfig,
  SceneProps,
} from "../components/Scene/Scene";
