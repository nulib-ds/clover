/** Vite's asset queries, used by the web-components build entry. */
declare module "*?inline" {
  const css: string;
  export default css;
}
declare module "*?worker&url" {
  const url: string;
  export default url;
}
/**
 * The element's stylesheet in its runs, in order: each shown run's CSS, and the name of
 * each deferred one, which loads with media or a map (`build/web-components.config.mjs`).
 */
declare module "virtual:clover-styles" {
  const parts: { key: string; css?: string }[];
  export default parts;
}
declare module "virtual:clover-styles/*" {
  const css: string;
  export default css;
}
