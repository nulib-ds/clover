import React from "react";

import { join } from "../lib/classnames";

/**
 * The chevron an information panel opens and closes things by, one for all of them: a
 * section's heading in an accordion, and an entry's in Contents. Down to open, up to
 * close (`open`), in the text's color, `--clover-chevron` square (`ui/Chevron.css`).
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
      viewBox="0 0 12 12"
      className={join("clover-chevron", className)}
      data-open={open || undefined}
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
  );
}
