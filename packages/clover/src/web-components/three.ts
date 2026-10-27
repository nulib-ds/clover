/*
 * The elements' three.js engine (`<clover-scene engine="three">`), opt-in: a module a
 * page loads once, beside the elements, with three.js bundled in. It registers the engine
 * for every Clover element on the page; three.js itself loads the first time a Scene that
 * asks for it comes near the window.
 *
 *   <script type="module" src=".../web-components/three.mjs"></script>
 */
import { registerSceneEngine } from "../components/Scene/engines";

registerSceneEngine("three", () => import("../components/Scene/engine"));
