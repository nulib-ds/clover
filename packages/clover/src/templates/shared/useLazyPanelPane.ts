import { useEffect, useState } from "react";

import {
  type PanelPart,
  type PanelPaneOptions,
  usePanelPane,
} from "./PanelPane";

// The information panel, a chunk of its own (`PanelPart`).
const loadPanel = () => import("./PanelPart");

/**
 * The information panel for a template where it starts shut or out of sight, Document's
 * and the Gallery's lightbox's: `usePanelPane` with the Panel's code loaded only as the
 * reader reaches for its toggle or it opens (the host's, or beside the Body again), so a
 * page draws without it. A module of its own, so Default, whose panel starts open, never
 * carries it.
 */
export function useLazyPanelPane(
  options: Omit<PanelPaneOptions, "panel" | "load">,
) {
  const [Part, setPart] = useState<PanelPart>();
  const load = () =>
    loadPanel().then((module) => setPart(() => module.default));
  const pane = usePanelPane({ ...options, panel: Part, load });
  useEffect(() => {
    if (pane.open && !Part) void load();
    // As it opens alone: `load` is new each render, and `Part`, once set, stays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pane.open]);
  return pane;
}
