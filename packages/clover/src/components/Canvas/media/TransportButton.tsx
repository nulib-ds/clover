import React from "react";

import { useCloverTranslation } from "../../../i18n/useCloverTranslation";
import { type Shortcut, Tip } from "../../../ui/Tip";
import { languageProps } from "../../../i18n/direction";

/**
 * One of a transport's buttons (a recording's, an animation's): named by Clover's words,
 * with their language, its key in `aria-keyshortcuts` and its Tip, its glyph inside.
 */
export function TransportButton({
  words,
  button,
  shortcut,
  disabled,
  pressed,
  onClick,
  buttonRef,
  children,
}: {
  /** Its name, as one of Clover's strings. */
  words: string;
  /** `data-button`, which the stylesheet and a host read. */
  button?: string;
  shortcut?: Shortcut;
  /** Nothing to do now (the first or last frame): still focusable, and said so. */
  disabled?: boolean;
  /** A toggle's state. */
  pressed?: boolean;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  buttonRef?: React.Ref<HTMLButtonElement>;
  children: React.ReactNode;
}) {
  const { t, langOf } = useCloverTranslation();
  const label = t(words);
  return (
    <button
      aria-label={label}
      {...languageProps(langOf(words))}
      aria-keyshortcuts={shortcut?.keys}
      aria-disabled={disabled || undefined}
      aria-pressed={pressed}
      className="clover-canvas-transport-button"
      data-button={button}
      onClick={onClick}
      ref={buttonRef}
      type="button"
    >
      {children}
      <Tip label={label} shortcut={shortcut} />
    </button>
  );
}
