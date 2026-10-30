import React, { Suspense, lazy, useCallback, useRef, useState } from "react";

import { useUniqueId } from "../../ui/useUniqueId";

/* The popup's code, loaded as one first opens: a pager that is never opened carries none. */
const ControlMenu = lazy(() => import("../Canvas/ControlMenu"));

/**
 * Where the reader is among a pager's items, as its figure ("1 / 2", a dash where none is
 * shown): a button opening them all, listed as the Panel lists them (Mat, 2026-10-29:
 * "render just like the collection component list"), each its picture and its name, the
 * one shown selected and given focus. It opens over the pager, from its corner, the count
 * and steps staying on top of it, the list under them ("make it so this popover actually
 * opens up with the indicator/pager within it"): stepping keeps it open, and it follows.
 * Choosing one goes there and closes it, focus back on the figure; so do Escape, a press
 * outside and another popup opening (WCAG 2.4.3).
 * A Collection's members (Cookbook 0032) and a content state's targets (0540), in the
 * Default template's header.
 */
export function CountMenu({
  position,
  total,
  list,
}: {
  position: number;
  total: number;
  /** The list to open: Items' (`layout="list"`), told to close once one is chosen. */
  list: (chosen: () => void) => React.ReactNode;
}) {
  const triggerId = `${useUniqueId().replace(/:/g, "")}-count`;
  const menuId = `${triggerId}-menu`;
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);
  // The pager it opens over: a press on its steps keeps it open.
  const holds = useCallback(() => holder.current?.closest(".clover-pager"), []);
  const close = useCallback(
    (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) document.getElementById(triggerId)?.focus();
    },
    [triggerId],
  );
  return (
    <span className="clover-pager-count" ref={holder}>
      <button
        type="button"
        id={triggerId}
        className="clover-pager-count-button"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="clover-pager-position" aria-live="polite">
          <span>
            {position >= 0 ? position + 1 : "–"} / {total}
          </span>
          {/*
           * The widest count, unseen in the same place: it keeps the room, so nothing
           * beside it moves as the count grows (Pager.css). Without the stylesheet, `hidden`.
           */}
          <span className="clover-pager-room" aria-hidden="true" hidden>
            {total} / {total}
          </span>
        </span>
        <svg
          aria-hidden="true"
          focusable="false"
          width="12"
          height="12"
          viewBox="0 0 12 12"
        >
          <path
            d="M3 4.5l3 3 3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <Suspense fallback={null}>
          <ControlMenu
            id={menuId}
            triggerId={triggerId}
            onClose={close}
            holds={holds}
            className="clover-pager-menu"
          >
            {/* Drawn as the Collection's list is (`Collection.css`). */}
            <div className="clover-collection clover-pager-list">
              {list(() => close(true))}
            </div>
          </ControlMenu>
        </Suspense>
      )}
    </span>
  );
}
