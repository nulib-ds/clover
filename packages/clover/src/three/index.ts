/*
 * @nulib/clover/three: the Scene's three.js engine (`engine="three"`), opt-in. Install
 * `three` beside Clover and register it once, before a Scene draws:
 *
 *   import { registerThreeEngine } from "@nulib/clover/three";
 *   registerThreeEngine();
 *
 * three.js then loads the first time a Scene with `engine="three"` comes near the window;
 * a page that never registers it never installs or carries it. Clover's own engine is the
 * default and needs none of this.
 */
import { registerSceneEngine } from "../components/Scene/engines";

/** Register three.js as the Scene's `three` engine, for every Clover on the page. */
export function registerThreeEngine(): void {
  registerSceneEngine("three", () => import("../components/Scene/engine"));
}
