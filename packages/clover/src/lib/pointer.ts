/**
 * Pointers, read the same way wherever Clover takes them: the 2D renderer's gestures
 * (`renderer/input/GestureController.ts`), a Body's controls (`components/Body/
 * useControlsVisibility.ts`), the 3D Scene's orbit (`components/Scene/gestures.ts`) and
 * the Map's wheel (`components/Map/MapView.tsx`), so a gesture does the same on each.
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

/**
 * Whether a wheel over a view zooms it, alike on a Canvas, a Map and a Scene, as on an
 * embedded Google map: with Ctrl or ⌘ held, as a trackpad's pinch comes; plain, only
 * where `scrollZoom` says, or, `cooperative`, in full screen, where there is no page to
 * scroll. Otherwise it is the page's, with no word over the view (Mat, 2026-11-23: "scroll
 * to zoom overlay should only show on mobile").
 */
export function wheelZooms(
  event: WheelEvent,
  options: {
    scrollZoom: boolean;
    cooperative: boolean;
    fullscreen: boolean;
  },
): boolean {
  const { scrollZoom, cooperative, fullscreen } = options;
  return (
    event.ctrlKey || event.metaKey || scrollZoom || (cooperative && fullscreen)
  );
}

/**
 * Where one finger's drag is the page's (`touch-action: pan-x pan-y`, `[data-cooperative]`
 * in `Canvas.css`), two fingers are the view's: their moves are kept from the page, so it
 * neither scrolls nor zooms under them. Returns the way to stop.
 */
export function holdTwoFingers(
  element: HTMLElement,
  cooperating: () => boolean,
): () => void {
  const move = (event: TouchEvent) => {
    if (!cooperating() || event.targetTouches.length < 2) return;
    if (isInteractive(event.target, element)) return;
    if (event.cancelable) event.preventDefault();
  };
  element.addEventListener("touchmove", move, { passive: false });
  return () => element.removeEventListener("touchmove", move);
}
