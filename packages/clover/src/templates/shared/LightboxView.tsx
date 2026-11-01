import React, { useEffect, useRef } from "react";

import * as Clover from "../../parts";
import type { LightboxProps } from "./Lightbox";
import { PanelPane } from "./PanelPane";
import { useLazyPanelPane } from "./useLazyPanelPane";
import { useFollowFocus } from "./useFollowFocus";
import { BESIDE_REM, PAGE_MIN, useWideEnough } from "./useSlide";

/**
 * What the lightbox shows under its title, drawn as it opens (so its panes measure their
 * own width): the Body and the thumbnails or pager in the main pane, and beside them the
 * information panel, every template's (`PanelPane`): beside the view where there is
 * room, over it where there is not, its toggle on the bar between or among the Body's
 * controls.
 */
export default function LightboxView({
  id,
  items,
  headingLevel,
  panel = true,
  defaultPanelOpen = true,
  panelLayout = "accordion",
  download = true,
  languages = true,
  storageKey,
}: Omit<LightboxProps, "open" | "onClose" | "className"> & { id: string }) {
  const panes = useRef<HTMLElement>(null);
  /*
   * Arriving after the lightbox opened (its code still loading as the reader pressed),
   * focus waits on Close: it goes on to the view shown in the strip, as at once it would.
   */
  useEffect(() => {
    const dialog = panes.current?.closest('[role="dialog"]');
    const active = dialog?.ownerDocument.activeElement;
    if (!active?.matches(".clover-template-lightbox-close")) return;
    dialog
      ?.querySelector<HTMLElement>(
        '[role="listbox"] [role="option"][aria-selected="true"]',
      )
      ?.focus({ preventScroll: true });
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
        <Clover.Body className="clover-template-lightbox-body">
          {panel && !pane.docked && pane.toggle}
        </Clover.Body>
        <Clover.Items layout={items === "pager" ? "pager" : "slider"} />
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
