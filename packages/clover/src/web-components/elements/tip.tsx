import React from "react";
import { createPortal } from "react-dom";

import { type Shortcut, Tip } from "../../ui/Tip";
import type { HostedProps } from "../host";

/**
 * `<clover-tip>` (`specs/tip.ts`): the popover Clover's controls show, for a control of the
 * page's, as `<Clover.Tip>` is in React. Written inside the page's button, it draws the
 * popover there, last, its words the `label` the button's `aria-label` says, with the key
 * its `aria-keyshortcuts` names (`DESIGN.md` §7). The element itself shows nothing.
 *
 *   <button aria-label="Share" aria-keyshortcuts="S">
 *     <svg aria-hidden="true">…</svg>
 *     <clover-tip label="Share" keys="S"></clover-tip>
 *   </button>
 */
export function TipElement({ hosted, props }: HostedProps) {
  const control = hosted.element.parentElement;
  const label = typeof props.label === "string" ? props.label.trim() : "";
  if (!control || !label) return null;
  const keys = typeof props.keys === "string" ? props.keys : undefined;
  const glyph = typeof props.glyph === "string" ? props.glyph : keys;
  const shortcut =
    (props.shortcut as Shortcut | undefined) ??
    (keys ? { keys, glyph: glyph ?? keys } : undefined);
  return createPortal(
    <Tip
      label={label}
      lang={typeof props.lang === "string" ? props.lang : undefined}
      shortcut={shortcut}
    />,
    control,
  );
}
