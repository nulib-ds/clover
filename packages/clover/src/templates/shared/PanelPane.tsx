import React, { useEffect, useRef, useState } from "react";

import * as Clover from "../../parts";
import type { PanelProps, PanelSection, PanelToggleProps } from "../../parts";
import { preloadDrag } from "./useDragToClose";
import { useDrawer } from "./useDrawer";
import type { useFollowFocus } from "./useFollowFocus";
import { PANEL_MIN } from "./useSlide";
import { useSpineTop } from "./useSpine";

export type PanelPart = React.ComponentType<PanelProps>;

// The information panel, a chunk of its own (`PanelPart`), for a pane given no `panel`.
const loadPanel = () => import("./PanelPart");

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
  /**
   * The Body's side it sits on, and slides in from over the Body: `"end"` (the default,
   * every template's) or `"start"`. `PanelPane` goes after the main `SplitPane` for the
   * end, and before it for the start (Mat, 2026-11-04: the Helpers page's Map example).
   */
  side?: "start" | "end";
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
   * The Panel, `Clover.Panel`, drawn at once, on the server too: Default's. Without it,
   * the pane loads the Panel's code itself (Mat, 2026-11-04: "always lazy if started
   * closed. not lazy if open"): at once where it starts open, and otherwise as the
   * reader reaches for its toggle (pointed at or focused), or on a first press, which
   * waits for it, then opens the panel whole, so focus has its section to go to.
   * Document's and the lightbox's, which start shut or out of sight.
   */
  panel?: PanelPart;
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
  side = "end",
  followFocus,
  body,
  sections,
  panel,
}: PanelPaneOptions) {
  const drawer = useDrawer({
    id,
    beside,
    defaultOpen,
    side,
    followFocus,
  });
  const docked = !drawer.over && drawer.open;
  const spine = useRef<HTMLDivElement>(null);

  // The Panel given, or once its code has come, the one it loaded.
  const [loaded, setLoaded] = useState<PanelPart>();
  const Part = panel ?? loaded;
  const load = () =>
    loadPanel().then((module) => setLoaded(() => module.default));
  useEffect(() => {
    if (drawer.open && !Part) void load();
    // As it opens alone, or starts open: `load` is new each render, and `Part`, once
    // set, stays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer.open]);
  useSpineTop(spine, () => body?.(), docked && Boolean(body));

  // Reaching for its toggle, its code loads where it is still to come, and over the
  // Body, the drag's.
  const reach = (event: React.SyntheticEvent) => {
    if (!(event.target as Element).closest?.(`[aria-controls~="${id}"]`))
      return;
    if (!Part) void load();
    if (drawer.over) preloadDrag();
  };

  const toggle = (
    <PaneToggle
      sections={sections}
      open={drawer.open}
      onOpenChange={(next) =>
        next && !Part
          ? load().then(() => drawer.setOpen(true))
          : drawer.setOpen(next)
      }
      controls={id}
      side={side}
    />
  );

  return {
    ...drawer,
    id,
    side,
    /** Open beside the Body: its bar and spine drawn, its toggle on the spine. */
    docked,
    spine,
    /** The toggle: the template draws it among the Body's controls while `!docked`. */
    toggle,
    Part,
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
 * The panel's side of a template's `Split`, after its main pane (before it, for the
 * start side): while docked, the bar and the spine holding the toggle, between the two;
 * the pane itself (`clover-template-panel`), its Panel given `onClose` and Escape while
 * it floats over the Body; and, over the Body, the wash beside it. Nothing at all where the resource has none of the panel's sections: a
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
  const { id, over, docked, side, Part } = pane;
  const offered = Clover.usePanelSections(panel.sections);
  if (!offered.length) return null;
  // Between the panel and the main pane: after the panel on the start side.
  const bar = docked && (
    <>
      <Clover.SplitHandle
        className="clover-template-panel-handle"
        aria-controls={id}
      />
      <div ref={pane.spine} className="clover-template-spine">
        {pane.toggle}
      </div>
    </>
  );
  return (
    <>
      {side === "end" && bar}
      <Clover.SplitPane
        ref={pane.pane}
        id={id}
        data-spine={over || undefined}
        data-side={side}
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
      {side === "start" && bar}
      {pane.scrim && <div className="clover-template-scrim" {...pane.scrim} />}
    </>
  );
}
