"use client";

import React, { useCallback, useRef } from "react";
import { useRouter } from "docs/lib/router";

import CookbookCoverageTable from "docs/components/CookbookRecipes/CookbookCoverageTable";
import FeaturedGrid from "docs/components/CookbookRecipes/FeaturedGrid";
import CookbookViewerPanel from "docs/components/CookbookRecipes/CookbookViewerPanel";
import CustomManifest from "docs/components/CustomManifest/CustomManifest";
import { preloadViewer } from "docs/components/DynamicImports/Viewer";
import {
  IIIF_CONTENT_PARAM,
  iiifContentError,
  pushIiifContent,
  validIiifContent,
} from "docs/lib/iiif-content";
import { inertWhen } from "docs/lib/inert";
import styles from "docs/components/CookbookRecipes/ViewerDemo.module.css";

/**
 * The Viewer's demo page: a field for trying any IIIF resource, with the IIIF Cookbook's
 * recipes, and whether Clover covers each, tucked beneath it, and a grid of featured items
 * between the two. `intro` sits above the field, and `children` follow the grid, which is where the Cookbook section's heading
 * and introduction go.
 *
 * `iiif-content` in the URL decides what is on screen. With a loadable value the Viewer
 * slides in over the page, so a link such as `?iiif-content=<manifest>` lands straight on
 * that resource; without one, or with one that cannot be loaded, the page shows. The field,
 * the View buttons and Back only ever change the URL; nothing else holds that state.
 */
interface ViewerDemoProps {
  /** Text above the field, for saying what the demo is. */
  intro?: React.ReactNode;
  children?: React.ReactNode;
  /** Draws a resource in the panel. Default: the 3.x Viewer. */
  renderViewer?: (resource: string) => React.ReactNode;
  /** Loads that Viewer ahead of a click. Default: the 3.x Viewer's. */
  preload?: () => void;
  /** The field for any IIIF resource, under `intro`. Default `true`. */
  field?: boolean;
  /** The featured items between the field and `children`. Default `true`. */
  featured?: boolean;
  /**
   * The recipes, after `children`. Default: the coverage table, with each recipe's 3.x
   * status. Given `onView` and `onPreload`, which open a resource and load ahead.
   */
  renderRecipes?: (
    onView: (resource: string) => void,
    onPreload: () => void,
  ) => React.ReactNode;
}

const ViewerDemo: React.FC<ViewerDemoProps> = ({
  intro,
  children,
  renderViewer,
  preload = preloadViewer,
  field = true,
  featured = true,
  renderRecipes,
}) => {
  const router = useRouter();
  const resource = validIiifContent(router.query[IIIF_CONTENT_PARAM]);
  const open = resource !== undefined;

  /*
   * Through a ref to the router, which is a new object whenever the address changes.
   * These go to a memoized table and would otherwise re-render all of its rows each time.
   */
  const current = useRef(router);
  current.current = router;
  const view = useCallback(
    (next: string) => pushIiifContent(current.current, next),
    [],
  );
  const back = useCallback(() => pushIiifContent(current.current), []);

  return (
    <>
      <div
        {...inertWhen(open)}
        aria-hidden={open || undefined}
        onFocus={preload}
      >
        {intro && <p className={styles.intro}>{intro}</p>}
        {field && (
          <CustomManifest
            placeholder="View a IIIF Manifest or valid IIIF resource"
            submitLabel="Enter"
            validate={iiifContentError}
          />
        )}
        {featured && <FeaturedGrid onView={view} onPreload={preload} />}
        {children}
        {renderRecipes ? (
          renderRecipes(view, preload)
        ) : (
          <CookbookCoverageTable onView={view} onPreload={preload} />
        )}
      </div>
      <CookbookViewerPanel
        resource={resource}
        onBack={back}
        renderViewer={renderViewer}
      />
    </>
  );
};

export default ViewerDemo;
