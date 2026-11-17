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

/**
 * A control, link or overlay within `bodyBox` that handles its own presses. A label is
 * its control's: a press on a menu's option lands on it, not on its radio.
 */
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
      node instanceof HTMLLabelElement ||
      node instanceof HTMLSelectElement ||
      node.dataset?.cloverCanvasInteractive !== undefined
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

/** The most time between two wheel events of one scroll. */
const WHEEL_GAP_MS = 250;

type Wheel = { at: number; target: EventTarget | null };
let previousWheel: Wheel | null = null;
let currentWheel: Wheel | null = null;
let watching = false;

const recordWheel = (event: WheelEvent) => {
  previousWheel = currentWheel;
  currentWheel = { at: event.timeStamp, target: event.target };
};

/** Records the page's wheel events, for `pageWheeling`. Once a page, however often called. */
export function watchWheels(): void {
  if (watching || typeof window === "undefined") return;
  watching = true;
  window.addEventListener("wheel", recordWheel, {
    capture: true,
    passive: true,
  });
}

/**
 * Whether a wheel belongs to a scroll that began outside `box`: the page scrolling it under
 * a resting pointer. Read while handling the wheel, after `watchWheels` has recorded it.
 */
export function pageWheeling(event: WheelEvent, box: HTMLElement): boolean {
  const previous = previousWheel;
  return Boolean(
    previous &&
      event.timeStamp - previous.at < WHEEL_GAP_MS &&
      !(previous.target instanceof Node && box.contains(previous.target)),
  );
}
