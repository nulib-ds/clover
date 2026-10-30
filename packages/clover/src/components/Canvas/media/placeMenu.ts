/**
 * Places an open menu from where its button is, whichever row of the bar it wrapped
 * onto: no taller than the Body leaves above the button, and moved along, if it must
 * be, to lie within the transport's inset from the Body's sides (WCAG 1.4.10). What
 * nothing scrolls to, off the Body, cannot be read. The captions', chapters' and an
 * animation's frames' menus share it.
 */
export function placeMenu(
  options: HTMLElement,
  wrapper: HTMLElement,
  transport: HTMLElement,
  bodyBox: HTMLElement,
) {
  const room = bodyBox.getBoundingClientRect();
  // At rest: the transport stands on the Body's foot, and tucks (`Canvas.css`) with
  // its button, so the distance between them holds while it moves.
  const above =
    room.height -
    (transport.getBoundingClientRect().bottom -
      wrapper.getBoundingClientRect().top);
  options.style.setProperty("--clover-transport-menu-above", `${above}px`);
  options.style.removeProperty("--clover-transport-menu-shift");
  const box = options.getBoundingClientRect();
  const inset = parseFloat(getComputedStyle(transport).paddingRight) || 0;
  const shift = Math.max(
    room.left + inset - box.left,
    Math.min(0, room.right - inset - box.right),
  );
  if (shift) {
    options.style.setProperty("--clover-transport-menu-shift", `${shift}px`);
  }
}
