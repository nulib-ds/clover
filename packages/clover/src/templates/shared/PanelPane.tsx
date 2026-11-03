import React, { useRef } from "react";

import * as Clover from "../../parts";
import type { PanelProps, PanelSection, PanelToggleProps } from "../../parts";
import { preloadDrag } from "./useDragToClose";
import { useDrawer } from "./useDrawer";
import type { useFollowFocus } from "./useFollowFocus";
import { PANEL_MIN } from "./useSlide";
import { useSpineTop } from "./useSpine";

export type PanelPart = React.ComponentType<PanelProps>;

export interface PanelPaneOptions {
  /** The pane's `id`, which its toggle's `aria-controls` names. */
  id: string;
  /**
   * Whether there is room for it beside the Body (`useWideEnough`): `undefined` until
   * measured, and beside until then, as on the server.
   */
  beside: boolean | undefined;
  /** Whether it starts open beside the Body. Over the Body it always starts closed. */
  defaultOpen: boolean;
  /** The layout's `useFollowFocus`, one for all its drawers. */
  followFocus: ReturnType<typeof useFollowFocus>;
  /**
   * The Body its toggle sits level with on the spine, its top measured as it moves
   * (`useSpineTop`): a title over it wrapping, the bar dragged. Without one, the toggle
   * sits the inset down from the spine's top, as the Body starts there.
   */
  body?: () => HTMLElement | null | undefined;
  /**
   * The sections the panel may have (`Clover.Panel`'s `sections`). Where the resource has
   * none of them the pane and its toggle are left out altogether, so a layout never keeps
   * room for a panel with nothing in it.
   */
  sections?: readonly PanelSection[];
  /**
   * The Panel: `Clover.Panel`, drawn at once where the panel starts open; or, while its
   * code is still to come, nothing (`useLazyPanelPane`).
   */
  panel?: PanelPart;
  /**
   * Where its code is still to come, what loads it: as the reader reaches for its toggle
   * (pointed at or focused), and on a first press, which waits for it, then opens the
   * panel whole, so focus has its section to go to (`useLazyPanelPane`).
   */
  load?: () => Promise<unknown>;
}

/**
 * The information panel beside the Body, one for every template (Mat, 2026-11-01: "an
 * abstracted pane and not recreating the wheel for every template"): Default's, Document's
 * and the Gallery's lightbox's. Its rule is `useDrawer`'s: beside the Body, a pane of its
 * own past a bar that shares the width, where there is room for both; over the Body where
 * there is not, sliding in, taking focus, and put away by Escape, its close button, a
 * press on the Body beside it or a drag back off the end. Its toggle (`PanelToggle`) sits
 * on the spine, the bar between them, while the panel is open beside the Body, and among
 * the Body's controls otherwise, which the template places (`toggle`, while `!docked`): a
 * press moves it, and focus follows it there. `PanelPane` draws the rest.
 *
 * The template's `Split` takes `splitProps`: where the panel is, Escape over the Body, and
 * the reach that loads its code and the drag's.
 */
export function usePanelPane({
  id,
  beside,
  defaultOpen,
  followFocus,
  body,
  sections,
  panel,
  load,
}: PanelPaneOptions) {
  const drawer = useDrawer({
    id,
    beside,
    defaultOpen,
    side: "end",
    followFocus,
  });
  const docked = !drawer.over && drawer.open;
  const spine = useRef<HTMLDivElement>(null);
  useSpineTop(spine, () => body?.(), docked && Boolean(body));

  // Reaching for its toggle, its code loads where it is still to come, and over the
  // Body, the drag's.
  const reach = (event: React.SyntheticEvent) => {
    if (!(event.target as Element).closest?.(`[aria-controls~="${id}"]`))
      return;
    if (!panel) void load?.();
    if (drawer.over) preloadDrag();
  };

  const toggle = (
    <PaneToggle
      sections={sections}
      open={drawer.open}
      onOpenChange={(next) =>
        next && !panel && load
          ? load().then(() => drawer.setOpen(true))
          : drawer.setOpen(next)
      }
      controls={id}
    />
  );

  return {
    ...drawer,
    id,
    /** Open beside the Body: its bar and spine drawn, its toggle on the spine. */
    docked,
    spine,
    /** The toggle: the template draws it among the Body's controls while `!docked`. */
    toggle,
    Part: panel,
    splitProps: {
      "data-panel": drawer.over ? "over" : "beside",
      onKeyDown: drawer.onKeyDown,
      onPointerOver: reach,
      onFocus: reach,
    },
  };
}

export type PanelPaneState = ReturnType<typeof usePanelPane>;

/**
 * The toggle, drawn only where the panel it opens has a section to show
 * (`usePanelSections`): a template places it among the Body's controls and on the spine,
 * both inside the Root, so it can ask there what the pane itself asks.
 */
function PaneToggle({
  sections,
  ...props
}: { sections?: readonly PanelSection[] } & PanelToggleProps) {
  return Clover.usePanelSections(sections).length ? (
    <Clover.PanelToggle {...props} />
  ) : null;
}

/**
 * The panel's side of a template's `Split`, after its main pane: while docked, the bar
 * and the spine holding the toggle; the pane itself (`clover-template-panel`), its Panel
 * given `onClose` and Escape while it floats over the Body; and, over the Body, the wash
 * beside it. Nothing at all where the resource has none of the panel's sections: a
 * template keeps no room, and no toggle, for a panel that would draw nothing. Its look is
 * written once, in `Default.css`, which `styles.css` carries.
 */
export function PanelPane({
  pane,
  className,
  ...panel
}: { pane: PanelPaneState; className?: string } & Omit<
  PanelProps,
  "onClose" | "closeOnEscape"
>) {
  const { id, over, docked, Part } = pane;
  const offered = Clover.usePanelSections(panel.sections);
  if (!offered.length) return null;
  return (
    <>
      {docked && (
        <Clover.SplitHandle
          className="clover-template-panel-handle"
          aria-controls={id}
        />
      )}
      {docked && (
        <div ref={pane.spine} className="clover-template-spine">
          {pane.toggle}
        </div>
      )}
      <Clover.SplitPane
        ref={pane.pane}
        id={id}
        data-spine={over || undefined}
        name="panel"
        /*
         * Whether its panel has About, which Default's header reads to decide whether it
         * may tuck the provider's logo away in a narrow column: About shows the provider,
         * and a panel without it shows the provider nowhere.
         */
        data-about={offered.includes("about") || undefined}
        className={["clover-template-panel clover-template-drawer", className]
          .filter(Boolean)
          .join(" ")}
        size="24rem"
        min={over ? undefined : PANEL_MIN}
        data-open={pane.opened}
        hidden={!pane.shown}
      >
        {Part && (
          <Part
            {...panel}
            onClose={over ? pane.close : undefined}
            closeOnEscape={over}
          />
        )}
      </Clover.SplitPane>
      {pane.scrim && <div className="clover-template-scrim" {...pane.scrim} />}
    </>
  );
}
