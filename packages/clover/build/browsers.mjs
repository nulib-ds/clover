/**
 * The browsers Clover is built for, its stylesheets and its script alike: the first of each
 * with cascade layers (Chrome and Edge 99, Firefox 97, Safari 15.4, all March 2022). Every
 * rule of Clover's is in `@layer clover`, so a browser before these draws none of them, and
 * the script needs nothing older (Mat, 2026-11-20: "Yes, raise it"; Vite's default target,
 * 2020's browsers, until then). The package's build, the elements', and the measuring of
 * what a page loads (`consumer-bundle.mjs`, `first-view.mjs`) all read it from here.
 */
export const BROWSERS = ["chrome99", "edge99", "firefox97", "safari15.4"];
