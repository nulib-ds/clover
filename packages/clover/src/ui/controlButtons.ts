import type React from "react";

/**
 * Everything a control needs in order to work, ready to spread onto a button: the id, the
 * accessible name, the click handler and the icon. Spreading `buttonProps` keeps the wiring
 * while the element, its shape and its styling stay the consumer's.
 */
export type ControlButtonProps = {
  buttonProps: {
    id: string;
    type: "button";
    "aria-label": string;
    /**
     * The language of the name, when it is not the page's: a Choice's own label, or one
     * of Clover's strings in another language. Spread it with the rest (WCAG 3.1.2).
     */
    lang?: string;
    /** The key the Canvas answers to for this control, when it has one. */
    "aria-keyshortcuts"?: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    /** On a control that opens a menu (the Choice control): its state and target. */
    "aria-expanded"?: boolean;
    "aria-controls"?: string;
  };
  icon: React.ReactNode;
  label: string;
  /**
   * The popover Clover's own controls show on hover and focus: the name, and the key when
   * there is one. Render it inside your button, last, to keep it.
   */
  tip: React.ReactNode;
};

/**
 * Replacements for the controls over a Canvas. Each key is optional, so a consumer can
 * override one control and leave the rest as they are. A replacement owns the whole
 * button, not just the glyph, so it can change shape as well as appearance.
 */
export type ControlButtons = {
  zoomIn?: React.ComponentType<ControlButtonProps>;
  zoomOut?: React.ComponentType<ControlButtonProps>;
  fullPage?: React.ComponentType<ControlButtonProps>;
  rotateRight?: React.ComponentType<ControlButtonProps>;
  rotateLeft?: React.ComponentType<ControlButtonProps>;
  /** A Scene's: its models turned up, or down, about the horizontal axis. */
  rotateUp?: React.ComponentType<ControlButtonProps>;
  rotateDown?: React.ComponentType<ControlButtonProps>;
  reset?: React.ComponentType<ControlButtonProps>;
  choice?: React.ComponentType<ControlButtonProps>;
};
