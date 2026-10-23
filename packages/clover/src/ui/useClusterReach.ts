import { useLayoutEffect } from "react";

/** Below the cluster, the least height a popup is put in: a few lines to read. */
const BELOW_MIN = 112;
/** Beside it, the least width. */
const BESIDE_MIN = 128;

/**
 * How far a Canvas's control cluster reaches from its corner, across and down, written
 * to its Canvas as `--clover-canvas-controls-width` and `--clover-canvas-controls-height`
 * for the popups it opens to clear (`ControlMenu.css`). A short or narrow Body wraps
 * the cluster onto more than one column or row, and a popup placed beside one would sit
 * under the next, its own controls covered (WCAG 2.5.8).
 *
 * Measured from the controls, not the cluster's box, which a placed control (the panel's
 * toggle) and the room kept for it are part of.
 *
 * It also says where those popups go: below the cluster, unless a short Body leaves
 * them too little there (the playback controls' room taken too), and there is room
 * beside it, from the top (`data-popups="beside"` on the Canvas).
 */
export function useClusterReach(cluster: HTMLElement | null) {
  useLayoutEffect(() => {
    const canvas = cluster?.closest<HTMLElement>(".clover-canvas");
    if (!cluster || !canvas) return;
    const write = (gone = false) => {
      let start = cluster.offsetWidth;
      let bottom = 0;
      for (const control of gone ? [] : Array.from(cluster.children)) {
        // Offsets leave out the controls' tuck as they fade: they measure at rest.
        if (!(control instanceof HTMLElement) || !control.offsetParent)
          continue;
        start = Math.min(start, control.offsetLeft);
        bottom = Math.max(bottom, control.offsetTop + control.offsetHeight);
      }
      const reach = { width: cluster.offsetWidth - start, height: bottom };
      for (const [name, value] of Object.entries(reach)) {
        const property = `--clover-canvas-controls-${name}`;
        // None laid out (or the cluster gone): the popups keep one control's room.
        if (bottom) canvas.style.setProperty(property, `${value}px`);
        else canvas.style.removeProperty(property);
      }
      const inset = cluster.offsetTop;
      const transport = canvas.querySelector<HTMLElement>(
        ":scope > .clover-canvas-media > .clover-canvas-transport",
      );
      const below =
        canvas.clientHeight -
        2 * inset -
        reach.height -
        (transport?.offsetHeight ?? 0);
      const beside = cluster.offsetLeft + start - inset;
      if (bottom && below < BELOW_MIN && beside >= BESIDE_MIN)
        canvas.dataset.popups = "beside";
      else delete canvas.dataset.popups;
    };
    write();
    // The Body's size wraps it; a control coming or going changes it.
    const resize = new ResizeObserver(() => write());
    resize.observe(cluster);
    resize.observe(canvas);
    const mutation = new MutationObserver(() => write());
    mutation.observe(cluster, { childList: true });
    // The playback controls arriving take room below.
    mutation.observe(canvas, { childList: true });
    return () => {
      resize.disconnect();
      mutation.disconnect();
      write(true);
    };
  }, [cluster]);
}
