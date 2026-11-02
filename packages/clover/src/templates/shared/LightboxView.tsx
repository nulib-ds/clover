import React, { useEffect, useRef } from "react";

import * as Clover from "../../parts";
import type { LightboxProps } from "./Lightbox";
import { PanelPane } from "./PanelPane";
import { useLazyPanelPane } from "./useLazyPanelPane";
import { useFollowFocus } from "./useFollowFocus";
import { BESIDE_REM, PAGE_MIN, useWideEnough } from "./useSlide";

/**
 * What the lightbox shows under its title, drawn as it opens (so its panes measure their
 * own width): the Body, the view's label and the thumbnails or pager in the main pane,
 * and beside them the
 * information panel, every template's (`PanelPane`): beside the view where there is
 * room, over it where there is not, its toggle on the bar between or among the Body's
 * controls.
 */
export default function LightboxView({
  id,
  annotations,
  items,
  headingLevel,
  panel = true,
  defaultPanelOpen = true,
  panelLayout = "accordion",
  download = true,
  languages = true,
  storageKey,
  collapseControls,
}: Omit<LightboxProps, "open" | "onClose" | "className"> & {
  id: string;
  /**
   * Whether the grid is annotations given as the content, so the strip steps through
   * them: the lightbox reads it (`useGivenAnnotations`), which keeps this chunk from
   * importing the Gallery's.
   */
  annotations: boolean;
}) {
  const panes = useRef<HTMLElement>(null);
  /*
   * Arriving after the lightbox opened (its code still loading as the reader pressed),
   * focus waits on Close: it goes on to the view shown in the strip, as at once it would,
   * and, where the strip's own code comes later still (the annotations'), as it arrives,
   * so long as focus is still waiting there.
   */
  useEffect(() => {
    const dialog = panes.current?.closest('[role="dialog"]');
    if (!dialog || items === "pager") return;
    const waiting = () =>
      dialog.ownerDocument.activeElement?.matches(
        ".clover-template-lightbox-close",
      );
    const moved = () => {
      const chosen = dialog.querySelector<HTMLElement>(
        '[role="listbox"] [role="option"][aria-selected="true"]',
      );
      if (chosen && waiting()) chosen.focus({ preventScroll: true });
      return Boolean(chosen);
    };
    if (moved() || !waiting()) return;
    const observer = new MutationObserver(() => {
      if (moved() || !waiting()) observer.disconnect();
    });
    observer.observe(dialog, { childList: true, subtree: true });
    return () => observer.disconnect();
    // Once, as it opens; the observer follows the strip from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Its code loads as the lightbox opens, the chunk Document's is (`PanelPart`).
  const pane = useLazyPanelPane({
    id: `${id}-panel`,
    beside: useWideEnough(panes, BESIDE_REM),
    defaultOpen: defaultPanelOpen,
    followFocus: useFollowFocus(),
    body: () =>
      panes.current?.querySelector<HTMLElement>(
        ".clover-template-lightbox-body",
      ),
  });
  return (
    <Clover.Split
      ref={panes}
      className="clover-template-lightbox-panes clover-template-panes"
      storageKey={storageKey || undefined}
      {...(panel ? pane.splitProps : { "data-panel": "beside" })}
    >
      <Clover.SplitPane
        className="clover-template-lightbox-main"
        // A minimum only while the panel is docked beside it: over it, none.
        min={panel && pane.over ? undefined : PAGE_MIN}
      >
        <Clover.Body
          className="clover-template-lightbox-body"
          collapseControls={collapseControls}
        >
          {panel && !pane.docked && pane.toggle}
        </Clover.Body>
        {/* The view's label under it, the Manifest's over it as the lightbox's title. */}
        <Clover.Label
          of="canvas"
          as="p"
          className="clover-template-lightbox-caption"
        />
        {/* The grid's own: the views, or the annotations it opened on. */}
        <Clover.Items
          layout={items === "pager" ? "pager" : "slider"}
          {...(annotations && { of: "annotations" as const })}
        />
      </Clover.SplitPane>
      {panel && (
        <PanelPane
          pane={pane}
          layout={panelLayout}
          download={download}
          languages={languages}
          // A level under the lightbox's title.
          headingLevel={(headingLevel ?? 3) + 1}
        />
      )}
    </Clover.Split>
  );
}
