import React from "react";

import { CaretGlyph as Caret } from "./glyphs/Caret";
import { join } from "../lib/classnames";

/**
 * The chevron an information panel opens and closes things by, one for all of them: a
 * section's heading in an accordion, and an entry's in Contents. Clover's caret pointing
 * down to open, turned up to close (`open`), in the text's color, `--clover-chevron`
 * square (`ui/Chevron.css`).
 */
export function Chevron({
  open = false,
  className,
}: {
  open?: boolean;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="12"
      height="12"
      viewBox="0 0 512 512"
      className={join("clover-chevron", className)}
      data-open={open || undefined}
    >
      <Caret rotate={90} />
    </svg>
  );
}
