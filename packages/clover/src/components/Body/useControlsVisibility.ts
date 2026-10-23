import { type RefObject, useEffect, useState } from "react";

import {
  DOUBLE_TAP_SLOP,
  TAP_MS,
  TAP_SLOP,
  isDirect,
  isHovering,
  isInteractive,
} from "../../lib/pointer";

/** The Player's default (`options.player.hideDelay`). */
export const DEFAULT_HIDE_DELAY = 2000;

/** How long the controls linger once the pointer, or keyboard focus, leaves the viewer. */
export const LEAVE_DELAY = 1000;

/** Focus this soon after a press or a lift, anywhere on the page, is the pointer's. */
const PRESS_FOCUS_MS = 1000;

/**
 * The controls that fade and, faded, take no pointer, so a press where one sits would
 * fall through to the picture beneath. (The control cluster takes its own.)
 */
const FADING_CONTROLS = [
  ":scope > .clover-canvas-controls > *",
  ":scope > .clover-canvas-navigator",
  ":scope > .clover-scene-navigation :is(button, .clover-scene-rotate-disc)",
  ":scope > .clover-canvas-media > .clover-canvas-transport > *",
].join(", ");

/**
 * Whether a viewer's controls — its control cluster, navigator and the scrim behind
 * them — are showing, as the Player's control bar decides it.
 *
 * A mouse, or a pen that hovers, shows them on any activity over `element` (a move, a
 * press); they hide again after `hideDelay` milliseconds without any, or a second after
 * the pointer (or focus) leaves. CSS holds them while the pointer rests on one of them,
 * and while keyboard focus is inside (`:has(:focus-visible)`).
 *
 * A finger, or a pen that does not hover, has no hover to hold the controls, so no timer
 * hides them (WCAG 2.2.1): a tap on the `picture` shows them, and the next hides them. A
 * tap waits out the double tap's window first, so a double tap, which zooms, leaves the
 * controls as they were. A tap elsewhere that is not on a control (where a faded control
 * sits, say) only shows them, and the control it reveals does not take that tap. A drag
 * or a pinch leaves the controls alone.
 *
 * A press on the picture where a faded control sits (the navigator, the transport) only
 * shows the controls, from any pointer: nothing beneath, a hotspot included, sees the
 * press or its click. Focus that comes inside other than from a press (the keyboard's, or
 * a screen reader's, which may not match `:focus-visible`) shows the controls and holds
 * them until focus leaves or a pointer takes over, so no control fades under focus.
 * Leaving, focus lets them linger for the same second.
 *
 * Shared by the image controls and the media transport: the same reveal, the same delay.
 */
export function useControlsVisibility(
  element: HTMLElement | null,
  hideDelay = DEFAULT_HIDE_DELAY,
  picture?: RefObject<HTMLElement | null>,
): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!element) return;
    const page = element.ownerDocument;
    let timer: ReturnType<typeof setTimeout> | undefined;
    /** Showing now: by pointer or by focus (here), or by keyboard focus (CSS). */
    let shown = false;
    let keyboard = false;
    /** Focus came inside other than from a press, and is still inside. */
    let focusHeld = false;
    /** A pen has hovered here, so pens are pointed as a mouse is. */
    let penHovers = false;
    /** When a pointer last pressed or lifted anywhere on the page. */
    let pressedAt = -Infinity;
    /**
     * A press kept from the picture beneath a faded control, and the click it would make.
     */
    let held: number | null = null;
    let swallowClick = false;
    let clickTimer: ReturnType<typeof setTimeout> | undefined;
    /** A finger or pen on the screen that may yet lift as a tap. */
    let press: {
      id: number;
      x: number;
      y: number;
      target: EventTarget | null;
    } | null = null;
    /** A tap, waiting to show the controls (or toggle them, on the picture). */
    let tap: {
      x: number;
      y: number;
      onPicture: boolean;
      timer: ReturnType<typeof setTimeout>;
    } | null = null;

    const set = (value: boolean) => {
      shown = value;
      setVisible(value);
    };
    // Focus held inside keeps the controls, whatever a timer says.
    const hide = () => {
      if (!focusHeld) set(false);
    };
    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };
    const forgetTap = () => {
      if (tap) clearTimeout(tap.timer);
      tap = null;
    };
    // A missing pointer type is a mouse's: only synthetic events omit it.
    const direct = (event: PointerEvent) =>
      isDirect(event.pointerType, penHovers);
    const show = (event: Event) => {
      keyboard = event.type === "keydown";
      if (keyboard) return;
      set(true);
      stop();
      if (Number.isFinite(hideDelay)) timer = setTimeout(hide, hideDelay);
    };
    const linger = () => {
      set(true);
      stop();
      timer = setTimeout(hide, LEAVE_DELAY);
    };
    /*
     * Shows it a moment later, once the click a browser makes of the tap has landed:
     * shown at once, the control under the finger would take it, unseen.
     */
    const later = (at: { x: number; y: number; onPicture: boolean }) => {
      forgetTap();
      tap = {
        ...at,
        timer: setTimeout(() => {
          tap = null;
          set(at.onPicture ? !shown : true);
        }, TAP_MS),
      };
    };
    const move = (event: PointerEvent) => {
      if (isHovering(event)) penHovers = true;
      if (!direct(event)) return show(event);
      if (
        press?.id === event.pointerId &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_SLOP
      ) {
        press = null; // A drag, not a tap.
      }
    };
    const down = (event: PointerEvent) => {
      if (!direct(event)) return show(event);
      keyboard = false;
      // A finger or pen takes over from a mouse: no timer runs under it.
      stop();
      // A second finger makes a pinch, not a tap.
      press =
        event.isPrimary === false
          ? null
          : {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              target: event.target,
            };
    };
    const up = (event: PointerEvent) => {
      if (!direct(event) || press?.id !== event.pointerId) return;
      const { target } = press;
      press = null;
      if (event.type !== "pointerup") return;
      // A control (a button, a hotspot) takes its own press.
      if (isInteractive(target, element)) return;
      const pictureElement = picture?.current;
      const onPicture = Boolean(
        pictureElement &&
          target instanceof Node &&
          pictureElement.contains(target),
      );
      // The second tap of a double tap zooms, and the controls stay as they were.
      if (
        onPicture &&
        tap?.onPicture &&
        Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <
          DOUBLE_TAP_SLOP
      ) {
        forgetTap();
        return;
      }
      // Elsewhere, it only shows.
      later({ x: event.clientX, y: event.clientY, onPicture });
    };
    /** The press lands on the picture where a faded control sits over it. */
    const underFadedControls = (event: PointerEvent) => {
      const pictureElement = picture?.current;
      const target = event.target as Node | null;
      // The picture lies beneath all the controls: a control that showed would take it.
      if (!pictureElement || !target || !pictureElement.contains(target))
        return false;
      return Array.from(element.querySelectorAll(FADING_CONTROLS)).some(
        (piece) => {
          const box = piece.getBoundingClientRect();
          return (
            box.width > 0 &&
            box.height > 0 &&
            event.clientX >= box.left &&
            event.clientX <= box.right &&
            event.clientY >= box.top &&
            event.clientY <= box.bottom
          );
        },
      );
    };
    /*
     * A press on the picture where a faded control sits belongs to the controls, as a
     * press on a faded control belongs to the cluster: it shows the controls, and the
     * picture and any hotspot beneath never see it, nor the click it makes.
     */
    const hold = (event: PointerEvent) => {
      if (event.type === "pointerdown") {
        if (held !== null) return;
        clearTimeout(clickTimer);
        swallowClick = false;
        if (!underFadedControls(event)) return;
        held = event.pointerId;
        swallowClick = true;
        if (direct(event)) {
          keyboard = false;
          stop();
        } else show(event);
      } else if (event.pointerId !== held) return;
      event.stopPropagation();
      event.preventDefault();
      if (event.type === "pointercancel") {
        held = null;
        swallowClick = false;
      } else if (event.type === "pointerup") {
        held = null;
        if (direct(event)) {
          later({ x: event.clientX, y: event.clientY, onPicture: false });
        }
        // Its click comes at once, if at all (not after a drag): none later is its.
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => (swallowClick = false), TAP_MS);
      }
    };
    const swallow = (event: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.stopPropagation();
      event.preventDefault();
    };
    // Timed by the clock: some engines count a focus event's `timeStamp` from elsewhere.
    const pressed = (event: PointerEvent) => {
      pressedAt = Date.now();
      // A press hands the controls back to the pointer.
      if (event.type === "pointerdown") focusHeld = false;
    };
    const focus = () => {
      if (Date.now() - pressedAt < PRESS_FOCUS_MS) return;
      focusHeld = true;
      stop();
      set(true);
    };
    const leave = (event: PointerEvent) => {
      // A finger lifting off is not leaving.
      if (direct(event)) return;
      if (shown) linger();
    };
    const blur = (event: FocusEvent) => {
      // Only focus leaving the viewer altogether, not moving between its controls.
      if (element.contains(event.relatedTarget as Node | null)) return;
      focusHeld = false;
      // Only controls that are showing linger; a mouse-focused, faded viewer stays faded.
      if (shown || keyboard) linger();
    };

    page.addEventListener("pointerdown", pressed, true);
    page.addEventListener("pointerup", pressed, true);
    for (const type of ["pointerdown", "pointermove", "pointerup"] as const)
      element.addEventListener(type, hold, true);
    element.addEventListener("pointercancel", hold, true);
    element.addEventListener("click", swallow, true);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    element.addEventListener("pointerleave", leave);
    element.addEventListener("focusin", focus);
    element.addEventListener("focusout", blur);
    element.addEventListener("keydown", show);
    return () => {
      stop();
      forgetTap();
      clearTimeout(clickTimer);
      page.removeEventListener("pointerdown", pressed, true);
      page.removeEventListener("pointerup", pressed, true);
      for (const type of ["pointerdown", "pointermove", "pointerup"] as const)
        element.removeEventListener(type, hold, true);
      element.removeEventListener("pointercancel", hold, true);
      element.removeEventListener("click", swallow, true);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      element.removeEventListener("pointerleave", leave);
      element.removeEventListener("focusin", focus);
      element.removeEventListener("focusout", blur);
      element.removeEventListener("keydown", show);
    };
  }, [element, hideDelay, picture]);

  return visible;
}
