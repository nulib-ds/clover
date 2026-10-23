/**
 * Pointers, read the same way wherever Clover takes them: the 2D renderer's gestures
 * (`renderer/input/GestureController.ts`), a Body's controls (`components/Body/
 * useControlsVisibility.ts`) and the 3D Scene's orbit (`components/Scene/gestures.ts`).
 */

/** How far a press may move, in CSS pixels, and still be a tap. */
export const TAP_SLOP = 5;
/** How long a tap may take, and the most time between the two of a double tap. */
export const TAP_MS = 300;
/** How far apart the two taps of a double tap may land. */
export const DOUBLE_TAP_SLOP = TAP_SLOP * 4;

/**
 * A finger, or a pen: pointers pressed on the screen itself, with no hover to rely on. A
 * pen that has been seen to hover (`hovers`, from `isHovering`) is pointed as a mouse is.
 */
export function isDirect(
  pointerType: string | undefined,
  hovers = false,
): boolean {
  return pointerType === "touch" || (pointerType === "pen" && !hovers);
}

/** A pen moving over the screen without touching it, as a desktop tablet's does. */
export function isHovering(event: PointerEvent): boolean {
  return event.pointerType === "pen" && event.buttons === 0;
}

/** Whether a box between `target` and `bodyBox` can scroll further down (or up). */
export function scrollsWithin(
  target: EventTarget | null,
  bodyBox: HTMLElement,
  deltaY: number,
): boolean {
  for (
    let node = target as HTMLElement | null;
    node && node !== bodyBox;
    node = node.parentElement
  ) {
    // Room that way: below for a wheel down, above for one up.
    const room =
      deltaY > 0
        ? node.scrollHeight - node.clientHeight - node.scrollTop
        : node.scrollTop;
    if (room >= 1 && /auto|scroll/.test(getComputedStyle(node).overflowY))
      return true;
  }
  return false;
}

/** A control, link or overlay within `bodyBox` that handles its own presses. */
export function isInteractive(
  target: EventTarget | null,
  bodyBox: HTMLElement,
): boolean {
  let node = target as HTMLElement | null;
  while (node && node !== bodyBox) {
    if (
      node instanceof HTMLButtonElement ||
      node instanceof HTMLAnchorElement ||
      node instanceof HTMLInputElement ||
      node instanceof HTMLSelectElement ||
      node.dataset?.cloverCanvasInteractive !== undefined
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}
