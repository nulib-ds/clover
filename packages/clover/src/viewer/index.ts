/*
 * @nulib/clover/viewer: the Viewer, the shell that draws a template, on its own: the same
 * Viewer as `@nulib/clover`'s default export. For a bundler that counts a module's
 * re-exports as reached even where it drops them, as esbuild's code splitting does:
 * through `@nulib/clover`, such a bundler loads up front every part the Default template
 * draws, as the template's lazy chunk shares them with the entry. Vite and webpack split
 * by what is used, so either entry serves them alike.
 *
 *   import Viewer from "@nulib/clover/viewer";
 *   import { Document } from "@nulib/clover/templates";
 */

export { Viewer, Viewer as default } from "../components/Viewer/Viewer";
export type { ViewerProps, ViewerTemplate } from "../components/Viewer/Viewer";
