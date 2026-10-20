import React, { useEffect, useRef } from "react";

import { join } from "../../lib/classnames";
import { useOneOpen } from "../../ui/useOneOpen";

interface ControlMenuProps {
  id: string;
  /** The control that opens the menu, which toggles it itself. */
  triggerId: string;
  /** Close, returning focus to the control that opened it when `restoreFocus`. */
  onClose: (restoreFocus: boolean) => void;
  "data-testid"?: string;
  /** Classes beside its own, for a menu that takes another part's look. */
  className?: string;
  children: React.ReactNode;
}

/**
 * The menu a control opens — Choice, annotations — hanging below the cluster; an
 * animation's frames open the same menu up from their bar.
 *
 * Its items are native radios in fieldsets, so a reader moves between them with the
 * arrow keys and hears the group's name and the current item. Opening focuses the checked
 * item (else the first that can be picked), scrolled into the menu's view. It closes on Escape (returning
 * focus to the control when focus was in the menu or on the control, and then closing
 * nothing else), on a press outside, and when another popup opens (`useOneOpen`).
 */
const ControlMenu: React.FC<ControlMenuProps> = ({
  id,
  triggerId,
  onClose,
  "data-testid": testId,
  className,
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  // Rendered only while open: another popup opening closes it.
  useOneOpen(true, () => onClose(false));

  useEffect(() => {
    const menu = ref.current;
    // An item, never a page's hide toggle (`HideToggle`), which is checked while hidden.
    const item =
      menu?.querySelector<HTMLInputElement>('input[type="radio"]:checked') ??
      menu?.querySelector<HTMLInputElement>(
        'input[type="radio"]:not(:disabled)',
      ) ??
      menu?.querySelector<HTMLInputElement>("input");
    // Its whole row in sight within the menu (a long one scrolls), never the page.
    const row = item?.closest("label");
    if (menu && row) {
      const bottom = row.offsetTop + row.offsetHeight;
      if (bottom > menu.scrollTop + menu.clientHeight) {
        menu.scrollTop = bottom - menu.clientHeight;
      }
      if (row.offsetTop < menu.scrollTop) menu.scrollTop = row.offsetTop;
    }
    item?.focus({ preventScroll: true });

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (ref.current?.contains(target)) return;
      // The control that opens the menu toggles it itself.
      if (document.getElementById(triggerId)?.contains(target)) return;
      onClose(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Escape in the menu, or on its control, hands focus back to the control. From
      // anywhere else it only closes the menu, leaving focus where the reader is.
      const active = document.activeElement;
      const inside = Boolean(
        ref.current?.contains(active) ||
          document.getElementById(triggerId)?.contains(active),
      );
      // Handled here, so nothing around it closes as well: a modal `<dialog>` (the
      // Gallery's Lightbox), a floating InformationPanel. Heard in the capture phase,
      // before the page's own handlers, the panel's among them.
      if (inside) event.preventDefault();
      onClose(inside);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [triggerId, onClose]);

  return (
    <div
      className={join("clover-canvas-menu", className)}
      data-testid={testId}
      id={id}
      ref={ref}
    >
      {children}
    </div>
  );
};

export default ControlMenu;
