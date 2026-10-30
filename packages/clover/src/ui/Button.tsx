import React from "react";

import { join } from "../lib/classnames";
import { type Shortcut, Tip } from "./Tip";
import { languageProps } from "../core/direction";

interface ButtonProps {
  className?: string;
  id: string;
  label: string;
  children: React.ReactElement | string | number;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** For a control that opens something (Canvas's Choice menu): its state and target. */
  expanded?: boolean;
  controls?: string;
  /** The key the Canvas answers to for this control, shown in its popover. */
  shortcut?: Shortcut;
  /** The language of `label`, where it is not the page's: Clover's, or a Choice's. */
  lang?: string;
}

const Button: React.FC<ButtonProps> = ({
  className,
  id,
  label,
  children,
  onClick,
  expanded,
  controls,
  shortcut,
  lang,
}) => {
  // Extract button type from id (e.g., "rotateLeft-abc123" → "rotate-left")
  // This ensures data-button is language-independent for CSS selectors
  const buttonType = id.split("-")[0];
  const dataButton = buttonType
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "");
  return (
    <button
      id={id}
      className={join("clover-canvas-button", className)}
      data-testid="clover-canvas-button"
      data-button={dataButton}
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={controls}
      /*
       * The name on the button, not as the icon's SVG <title>, which browsers also show
       * as a tooltip of their own beside the popover.
       */
      aria-label={label}
      aria-keyshortcuts={shortcut?.keys}
      // On the button, so its name and its popover share it.
      {...languageProps(lang)}
      type="button"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        data-testid="clover-canvas-button-svg"
        focusable="false"
        // Its own size, so it never fills the button without the stylesheet.
        width="16"
        height="16"
        viewBox="0 0 512 512"
      >
        {children}
      </svg>
      <Tip label={label} shortcut={shortcut} />
    </button>
  );
};

export default Button;
