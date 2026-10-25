import React, { useEffect, useRef, useState } from "react";

import CustomManifest from "docs/components/CustomManifest/CustomManifest";
import Viewer from "docs/components/DynamicImports/Viewer";
import { demoTitleFor } from "docs/components/CookbookRecipes/cookbookCatalog";
import { iiifContentError } from "docs/lib/iiif-content";
import { inertWhen } from "docs/lib/inert";
import styles from "docs/components/CookbookRecipes/CookbookViewerPanel.module.css";
import type { ViewerConfigOptions } from "@samvera/clover-iiif/viewer";
import { EXAMPLE, example } from "docs/lib/example";

/** Matches the slide transition in the stylesheet. */
const slideDuration = 300;

/*
 * Declared once, outside the component. The Viewer loads its resource in an effect that
 * depends on `options` by identity, so an object literal in the JSX would reload the
 * manifest whenever anything re-rendered this panel.
 */
const viewerOptions: ViewerConfigOptions = {
  canvasHeight: "100%",
  map: { enabled: true },
  openSeadragon: { gestureSettingsMouse: { scrollToZoom: false } },
  showDownload: true,
  showIIIFBadge: false,
  showTitle: false,
};

interface CookbookViewerPanelProps {
  /** The resource to show. The panel is open while this is set. */
  resource?: string;
  onBack: () => void;
  /** Draws the resource. Default: the 3.x Viewer; Clover 4's demo passes its own. */
  renderViewer?: (resource: string) => React.ReactNode;
}

const render3x = (resource: string) => (
  <Viewer key={resource} iiifContent={resource} options={viewerOptions} />
);

/**
 * Slides in over the page to show a resource in Clover's Viewer.
 *
 * The page's table is still there underneath, so the header carries the same field as the
 * page does: the address stays visible, and a different one can be pasted without going back.
 */
const CookbookViewerPanel: React.FC<CookbookViewerPanelProps> = ({
  resource,
  onBack,
  renderViewer = render3x,
}) => {
  const open = resource !== undefined;
  const backButton = useRef<HTMLButtonElement>(null);

  /*
   * Keep the last resource mounted until the panel has slid out, so the Viewer does not
   * vanish mid-transition. Adjusting state while rendering means a new resource reaches
   * the Viewer in the same commit that opens the panel, not one render later.
   */
  const [shown, setShown] = useState(resource);
  if (resource && resource !== shown) setShown(resource);

  useEffect(() => {
    if (open) return;
    const timeout = setTimeout(() => setShown(undefined), slideDuration);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement as HTMLElement | null;
    backButton.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      /*
       * Escape belongs to a text field it is pressed in, and to the Viewer where it
       * handled it (`preventDefault`: a menu or caption closed, an annotation let go), and
       * should not also close the panel.
       */
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !(event.target instanceof HTMLInputElement)
      )
        onBack();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [open, onBack]);

  const title = demoTitleFor(shown);

  return (
    <aside
      className={styles.panel}
      data-open={open}
      aria-hidden={!open}
      aria-label={title ? `Viewer: ${title}` : "Viewer"}
      {...inertWhen(!open)}
    >
      <div className={styles.header}>
        <button
          type="button"
          ref={backButton}
          className={styles.back}
          onClick={onBack}
        >
          ← Back to recipes
        </button>
        {title && <strong className={styles.title}>{title}</strong>}
        <CustomManifest
          className={styles.field}
          placeholder="View a IIIF Manifest or valid IIIF resource"
          submitLabel="Enter"
          validate={iiifContentError}
        />
      </div>
      <div className={styles.body} {...example(EXAMPLE)}>
        {shown && renderViewer(shown)}
      </div>
    </aside>
  );
};

export default CookbookViewerPanel;
