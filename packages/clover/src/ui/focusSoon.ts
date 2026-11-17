/**
 * Focus on what `find` gives, as soon as it can take it: from the next frame, frame by
 * frame for half a second, as what covered it goes (a map over the Body, whose Canvas's
 * controls come back into sight once it has). Never once focus is somewhere of the reader's
 * own meanwhile: only while it is on the page itself, or on what is gone or hidden (WCAG
 * 2.4.3).
 */
export function focusSoon(find: () => Element | null | undefined) {
  let frames = 30;
  const land = () => {
    const active = document.activeElement;
    const free =
      !active ||
      active === document.body ||
      !active.isConnected ||
      active.closest("[hidden], [inert]") !== null;
    if (!free) return;
    const target = find();
    if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    if (document.activeElement !== target && --frames)
      requestAnimationFrame(land);
  };
  requestAnimationFrame(land);
}
