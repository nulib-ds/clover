/*
 * @nulib/clover/timeline: `Timeline` on its own, as `@nulib/clover` exports it, for a
 * bundler that counts a module's re-exports as reached (esbuild's code splitting;
 * `src/viewer/index.ts` says why).
 *
 *   import { Timeline } from "@nulib/clover/timeline";
 */

export { Timeline } from "../components/Timeline/Timeline";
export type { TimelineProps } from "../components/Timeline/Timeline";
