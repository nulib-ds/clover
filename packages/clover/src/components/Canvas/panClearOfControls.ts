import type { CanvasRenderer } from "../../lib/renderer";

/*
 * Keeping a hotspot reached by Tab clear of the Canvas's controls (WCAG 2.4.11). Its own
 * module, loaded once a hotspot takes focus (`Annotations.tsx`): only the keyboard needs
 * it, and it imports nothing, so its chunk shares nothing (1 kB).
 */

/** The Canvas's own controls over the Body, which a hotspot reached by Tab is kept clear of. */
const CONTROLS = [
  ".clover-canvas-controls",
  ".clover-canvas-navigator",
  ".clover-canvas-transport",
  '.clover-canvas-caption[data-open="true"]',
  ".clover-canvas-menu",
  ".clover-canvas-placeholder-toggle",
  ".clover-canvas-exit-full-screen",
].join(", ");

/** Whether `[a, b]` and `[c, d]` overlap. */
const overlap = (a: number, b: number, c: number, d: number) => a < d && c < b;

/**
 * Pan, no further than needed, so the focused hotspot sits in the part of the Body clear
 * of the controls (WCAG 2.4.11): the Body less each of the controls beside the hotspot,
 * cut away from the edge it hangs on (the cluster from the top, its column on a phone
 * from the side, the transport from the bottom). A piece cuts only once the hotspot is
 * beside it, where cutting by another has moved it: the cluster only above a hotspot
 * under it. So one clear of the controls stays where it is, and one larger than its part
 * is centered in it. An open caption may leave too little; Escape closes it without
 * moving focus (`CanvasView`).
 */
export function panClearOfControls(
  renderer: CanvasRenderer,
  hotspot: HTMLElement,
) {
  const layer = renderer.overlays.container;
  const figure = layer.closest(".clover-canvas");
  // A Canvas the reader cannot move (a lone video or sound, or one the host holds still)
  // has no way to pan back.
  if (figure?.getAttribute("data-navigable") === "false") return;
  const bodyRect = layer.getBoundingClientRect();
  if (!bodyRect.width || !bodyRect.height) return;
  const clear = {
    top: bodyRect.top,
    right: bodyRect.right,
    bottom: bodyRect.bottom,
    left: bodyRect.left,
  };
  // Each of the controls over the Body, and the edge it hangs on: the nearest.
  let pieces = Array.from(
    figure?.querySelectorAll<HTMLElement>(CONTROLS) ?? [],
  ).flatMap((piece) => {
    if (piece.closest(".clover-canvas") !== figure) return [];
    // Where it comes to rest: controls shown by the focus may still be sliding in.
    const [tx = 0, ty = 0] = (getComputedStyle(piece).translate || "")
      .split(" ")
      .map((length) => parseFloat(length) || 0);
    const moving = piece.getBoundingClientRect();
    const top = moving.top - ty;
    const right = moving.right - tx;
    const bottom = moving.bottom - ty;
    const left = moving.left - tx;
    if (
      !moving.width ||
      !moving.height ||
      !overlap(left, right, bodyRect.left, bodyRect.right) ||
      !overlap(top, bottom, bodyRect.top, bodyRect.bottom)
    )
      return [];
    const sides = [
      ["top", bottom - bodyRect.top],
      ["bottom", bodyRect.bottom - top],
      ["left", right - bodyRect.left],
      ["right", bodyRect.right - left],
    ] as const;
    const [side] = sides.reduce((least, cut) =>
      cut[1] < least[1] ? cut : least,
    );
    return [{ side, top, right, bottom, left }];
  });
  // A point's marker is a fixed size, and may be larger than the box it is pinned to.
  const boxes = [
    hotspot,
    hotspot.querySelector(".clover-canvas-annotation-point"),
  ]
    .filter((node): node is Element => Boolean(node))
    .map((node) => node.getBoundingClientRect());
  const own = {
    top: Math.min(...boxes.map((box) => box.top)),
    right: Math.max(...boxes.map((box) => box.right)),
    bottom: Math.max(...boxes.map((box) => box.bottom)),
    left: Math.min(...boxes.map((box) => box.left)),
  };
  let dx = 0;
  let dy = 0;
  // Until no piece is newly beside it; each cuts once, so this ends.
  for (let cut = true; cut; ) {
    const beside = pieces.filter((piece) =>
      piece.side === "top" || piece.side === "bottom"
        ? overlap(piece.left, piece.right, own.left + dx, own.right + dx)
        : overlap(piece.top, piece.bottom, own.top + dy, own.bottom + dy),
    );
    pieces = pieces.filter((piece) => !beside.includes(piece));
    cut = beside.length > 0;
    for (const piece of beside) {
      if (piece.side === "top") clear.top = Math.max(clear.top, piece.bottom);
      if (piece.side === "bottom")
        clear.bottom = Math.min(clear.bottom, piece.top);
      if (piece.side === "left") clear.left = Math.max(clear.left, piece.right);
      if (piece.side === "right")
        clear.right = Math.min(clear.right, piece.left);
    }
    dx = shift(own.left, own.right, clear.left, clear.right);
    dy = shift(own.top, own.bottom, clear.top, clear.bottom);
  }
  if (!dx && !dy) return;
  // Where the view's center goes: the point now on screen `dx, dy` short of it.
  const center = renderer.worldToScreenPoint(renderer.getCamera());
  renderer.panTo(
    renderer.screenToWorldPoint({ x: center.x - dx, y: center.y - dy }),
  );
}

/** How far to move `[start, end]` to bring it within `[min, max]`, or to center it there. */
function shift(start: number, end: number, min: number, max: number) {
  if (end - start > max - min) return (min + max - start - end) / 2;
  if (start < min) return min - start;
  if (end > max) return max - end;
  return 0;
}
