import { useLayoutEffect } from "react";

/**
 * How far a Canvas's control cluster reaches from its corner, across and down, written
 * to its Canvas as `--clover-canvas-controls-width` and `--clover-canvas-controls-height`
 * for the popups it opens to clear (`ControlMenu.css`). A short or narrow stage wraps
 * the cluster onto more than one column or row, and a popup placed beside one would sit
 * under the next, its own controls covered (WCAG 2.5.8).
 *
 * Measured from the controls, not the cluster's box: Chromium sizes a wrapping column
 * wider than its controls.
 */
export function useClusterReach(cluster: HTMLElement | null) {
  useLayoutEffect(() => {
    const canvas = cluster?.closest<HTMLElement>(".clover-canvas");
    if (!cluster || !canvas) return;
    const write = (gone = false) => {
      let start = cluster.offsetWidth;
      let bottom = 0;
      for (const control of gone ? [] : Array.from(cluster.children)) {
        // Offsets leave out the controls' tuck as the chrome fades: they measure at rest.
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
    };
    write();
    // The stage's size wraps it; a control coming or going changes it.
    const resize = new ResizeObserver(() => write());
    resize.observe(cluster);
    resize.observe(canvas);
    const mutation = new MutationObserver(() => write());
    mutation.observe(cluster, { childList: true });
    return () => {
      resize.disconnect();
      mutation.disconnect();
      write(true);
    };
  }, [cluster]);
}
