import { useLayoutEffect, useRef } from "react";

/*
 * Whether a Canvas's controls fit their one row (`Fits`), measured as it draws them
 * (`Controls.tsx`): what says when the view's controls wait behind the image controls'
 * button, whose tray (`ImageControls.tsx`) loads only then (Mat, 2026-11-01: "rename More
 * as ImageControls. load it dynamically. don't include it in size"; one module, `More`,
 * loaded with every Canvas's controls, until then).
 */

/** Whether controls this wide fit a row `room` wide, every two `gap` apart. */
export function fitsRow(widths: number[], room: number, gap: number) {
  return widths.reduce((sum, width) => sum + width + gap, -gap) <= room;
}

/** Focus `id`, else the image controls' button, else the first control in sight. */
function refocus(cluster: HTMLElement, id: string, more: string) {
  const page = cluster.ownerDocument;
  const shown = (node: Element | null): node is HTMLElement =>
    node instanceof HTMLElement &&
    cluster.contains(node) &&
    !node.closest("[hidden]");
  const target = [
    page.getElementById(id),
    page.getElementById(more),
    ...Array.from(cluster.querySelectorAll("button")),
  ].find(shown);
  target?.focus();
}

/**
 * Measures whether the controls `ids` all fit on the row of `cluster`, beside the page's
 * own (the panel's toggle, placed in its corner, takes no room in it), as the Body's
 * width changes and as controls come and go, and says so (`onFits`): drawn by
 * `Controls.tsx`, which keeps `fits`, and draws nothing. Each control's width is read
 * while it is laid out and remembered while it is away; one never yet seen is taken to be
 * as wide as the widest that has been.
 *
 * A control the change takes away (behind the image controls' button, or that button itself) hands focus on: to itself
 * where it is drawn again, else to that button (WCAG 2.4.3).
 */
export function Fits({
  cluster,
  ids,
  more,
  fits,
  onFits,
}: {
  cluster: HTMLElement;
  ids: string[];
  /** The image controls' button's id. */
  more: string;
  fits: boolean;
  onFits: (fits: boolean) => void;
}) {
  const shown = useRef(fits);
  shown.current = fits;
  const report = useRef(onFits);
  report.current = onFits;
  const widths = useRef(new Map<string, number>());
  const latest = useRef(ids);
  latest.current = ids;
  const moved = useRef<string | null>(null);
  const key = ids.join(" ");

  useLayoutEffect(() => {
    const page = cluster.ownerDocument;
    const measure = () => {
      const ids = latest.current;
      const style = getComputedStyle(cluster);
      const gap = parseFloat(style.columnGap) || 0;
      let room =
        cluster.clientWidth -
        (parseFloat(style.paddingLeft) || 0) -
        (parseFloat(style.paddingRight) || 0);
      let unit = 0;
      for (const id of ids) {
        const width = page.getElementById(id)?.offsetWidth;
        if (width) widths.current.set(id, width);
        unit = Math.max(unit, widths.current.get(id) ?? 0);
      }
      // The page's own controls keep their places in the row, after the Canvas's.
      for (const child of Array.from(cluster.children)) {
        if (
          !(child instanceof HTMLElement) ||
          ids.includes(child.id) ||
          child.id === more ||
          child.classList.contains("clover-canvas-more") ||
          !child.offsetWidth ||
          getComputedStyle(child).position === "absolute"
        )
          continue;
        room -= child.offsetWidth + gap;
      }
      const next = fitsRow(
        ids.map((id) => widths.current.get(id) ?? unit),
        room,
        gap,
      );
      if (next === shown.current) return;
      const active = page.activeElement;
      moved.current =
        active instanceof HTMLElement && cluster.contains(active)
          ? active.id
          : null;
      shown.current = next;
      report.current(next);
    };
    measure();
    // Its width follows the Body's; a control coming or going changes the room.
    const resize = new ResizeObserver(() => measure());
    resize.observe(cluster);
    const mutation = new MutationObserver(() => measure());
    mutation.observe(cluster, { childList: true });
    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, [cluster, key, more]);

  useLayoutEffect(() => {
    const id = moved.current;
    moved.current = null;
    if (id === null) return;
    const active = cluster.ownerDocument.activeElement;
    if (!active || !cluster.contains(active) || active.closest("[hidden]"))
      refocus(cluster, id, more);
  }, [fits, cluster, more]);

  return null;
}
