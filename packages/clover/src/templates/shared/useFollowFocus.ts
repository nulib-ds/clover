import { useEffect, useRef } from "react";

/** How many frames a control's new place is waited for: half a second at 60 a second. */
const FRAMES = 30;

/**
 * Focus that follows a control as it moves. A toggle drawn in one place while its pane is
 * open and in another while it is shut is a new element after every press, and the one
 * pressed goes with focus on it; focus is never left on what is gone or hidden (WCAG
 * 2.4.3). Call the returned function, with a way to find the control, as the change that
 * moves it is made. From the next frame, once the control is in its new place and focus
 * has gone (with the element it was on, or the pane it was in), the control takes it.
 * Frame by frame, not after a render: React may commit the move a render or more later
 * (a Canvas draws its controls later still). If the reader puts focus somewhere of their
 * own meanwhile, it is left there. A layout whose panes' toggles all move gives them one,
 * so a later follow takes over from any before it: focus has one place to go.
 */
export function useFollowFocus() {
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return (find: () => HTMLElement | null | undefined) => {
    cancelAnimationFrame(frame.current);
    let frames = 0;
    const land = () => {
      const element = find();
      if (element && lost()) element.focus();
      else if (++frames < FRAMES) frame.current = requestAnimationFrame(land);
    };
    frame.current = requestAnimationFrame(land);
  };
}

/** Focus is nowhere of the reader's own: on the page itself, or on what is gone or hidden. */
function lost() {
  const active = document.activeElement;
  return (
    !active ||
    active === document.body ||
    !active.isConnected ||
    active.closest("[hidden], [inert]") !== null
  );
}
