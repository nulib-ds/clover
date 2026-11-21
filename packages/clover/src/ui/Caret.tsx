import React from "react";

import { CaretGlyph } from "./glyphs/Caret";

/**
 * Clover's caret (`ui/glyphs/Caret.tsx`) in an svg of its own, with its own size, so
 * it never fills its button without the stylesheet: every chevron a part shows, turned by
 * `rotate` (0 right, 90 down, 180 left, 270 up).
 */
export function Caret({
  rotate = 0,
  size = 16,
  className,
}: {
  rotate?: number;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
    >
      <CaretGlyph rotate={rotate} />
    </svg>
  );
}
