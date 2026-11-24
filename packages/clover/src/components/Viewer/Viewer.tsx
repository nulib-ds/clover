import React, { Suspense, lazy } from "react";

import type { Default } from "../../templates/default/Default";

/**
 * A layout the Viewer draws: one from `@nulib/clover/templates`, or a component of your
 * own that takes the `Clover.Root` props.
 */
export type ViewerTemplate = React.ComponentType<any>;

/**
 * The Viewer's props are its template's: `Default`'s when there is none, and those of the
 * one passed otherwise, so `template={Document}` brings `defaultSidebarOpen` with it.
 */
export type ViewerProps<T extends ViewerTemplate = typeof Default> = {
  /** The layout. Default `Default`, Clover 3.x's Viewer, loaded when first needed. */
  template?: T;
} & React.ComponentProps<T>;

/*
 * Default, only when a Viewer is given no template. Imported statically, every page
 * using the Viewer would carry Default and every part it uses, whatever template it
 * passes, since a bundler cannot tell which it will be.
 */
const LazyDefault = lazy(() =>
  import("../../templates/default/Default").then((module) => ({
    default: module.Default,
  })),
);

/**
 * Clover's Viewer: a Manifest (or Collection, or content state) in a layout. The default
 * export of `@nulib/clover`.
 *
 * ```jsx
 * import Viewer from "@nulib/clover";
 * import { Document } from "@nulib/clover/templates";
 *
 * <Viewer iiifContent={url} />
 * <Viewer iiifContent={url} template={Document} />
 * ```
 *
 * The Viewer is a shell that holds no layout of its own, so a page ships only the
 * template it passes. With none it loads `Default` on first render: one request more,
 * and nothing drawn on the server. Pass `template={Default}` to have it up front.
 */
export function Viewer<T extends ViewerTemplate = typeof Default>({
  template,
  ...props
}: ViewerProps<T>) {
  const Template: ViewerTemplate = template ?? LazyDefault;
  const drawn = <Template {...props} />;
  // Nothing shows while Default's code loads.
  return template ? drawn : <Suspense fallback={null}>{drawn}</Suspense>;
}
