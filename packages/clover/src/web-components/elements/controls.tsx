import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type {
  ControlButtonProps,
  ControlButtons,
} from "../../ui/controlButtons";

/** What the page's function for one of the Body's controls is told. */
export interface PageControl {
  /** Which control: `zoomIn`, `zoomOut`, `fullPage`, `rotateRight`, `rotateLeft`, `reset`, `choice`. */
  name: keyof ControlButtons;
  /** Its name, as its `aria-label` says it. */
  label: string;
  /**
   * Clover's icon for it, to put in your button: kept current (full screen's arrows turn
   * inward while full screen).
   */
  icon: HTMLElement;
}

/**
 * The Body's controls, each replaced by a button of the page's, without React: a
 * function that makes the button, which Clover keeps named, keyed and in its state, wires
 * to the control's action, and gives the popover its own have (`DESIGN.md` §7).
 *
 *   content.controlButtons = {
 *     zoomIn: ({ icon }) => {
 *       const button = document.createElement("button");
 *       button.className = "my-zoom";
 *       button.append(icon);
 *       return button;
 *     },
 *   };
 */
export type PageControlButtons = Partial<
  Record<keyof ControlButtons, (control: PageControl) => Element>
>;

/** Each function as the one component, by control, so the cluster keeps what it drew. */
const ADAPTED = new Map<
  string,
  WeakMap<object, React.FC<ControlButtonProps>>
>();

/** The page's control buttons as `controlButtons` takes them; undefined for none. */
export function toControlButtons(value: unknown): ControlButtons | undefined {
  if (!value || typeof value !== "object") return undefined;
  const buttons: Record<string, React.FC<ControlButtonProps>> = {};
  for (const [name, make] of Object.entries(value)) {
    if (typeof make !== "function") continue;
    const known = ADAPTED.get(name) ?? new WeakMap();
    ADAPTED.set(name, known);
    let component = known.get(make);
    if (!component) {
      component = (props) => (
        <PageButton
          {...props}
          name={name as keyof ControlButtons}
          make={make as (control: PageControl) => Element}
        />
      );
      known.set(make, component);
    }
    buttons[name] = component;
  }
  return buttons as ControlButtons;
}

/** What Clover keeps on the page's button: its wiring, as `buttonProps` spreads it. */
const WIRED = [
  "id",
  "type",
  "aria-label",
  "lang",
  "aria-keyshortcuts",
  "aria-expanded",
  "aria-controls",
] as const;

/**
 * The page's button, in the cluster where Clover's would be: right after a hidden mark
 * Clover draws there, so it is one of the cluster's own children and fades and comes back
 * with the others. Made once; its name, keys and state follow the control.
 */
function PageButton({
  name,
  make,
  buttonProps,
  icon,
  label,
  tip,
}: ControlButtonProps & {
  name: keyof ControlButtons;
  make: (control: PageControl) => Element;
}) {
  const mark = useRef<HTMLSpanElement>(null);
  const [iconBox] = useState(() => {
    const box = document.createElement("span");
    box.style.display = "contents";
    return box;
  });
  const [button, setButton] = useState<HTMLElement | null>(null);
  const press = useRef(buttonProps.onClick);
  press.current = buttonProps.onClick;

  useLayoutEffect(() => {
    const at = mark.current;
    if (!at) return;
    const made = make({ name, label, icon: iconBox });
    if (!(made instanceof HTMLElement)) {
      console.warn(
        `controlButtons.${name} returned no element; Clover's own is not drawn either.`,
      );
      return;
    }
    const control = made.matches("button")
      ? made
      : (made.querySelector("button") ?? made);
    const click = (event: Event) => press.current?.(event as never);
    control.addEventListener("click", click);
    at.after(made);
    setButton(control);
    return () => {
      control.removeEventListener("click", click);
      made.remove();
      setButton(null);
    };
    // Made once for its function; what changes later is written on it below.
  }, [make]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!button) return;
    const given = buttonProps as Record<string, unknown>;
    for (const attribute of WIRED) {
      const value = given[attribute];
      if (value === undefined) button.removeAttribute(attribute);
      else button.setAttribute(attribute, String(value));
    }
  });

  return (
    <>
      <span ref={mark} hidden />
      {createPortal(icon, iconBox)}
      {button && createPortal(tip, button)}
    </>
  );
}
