import React, { useEffect, useState } from "react";

import { useCloverTranslation } from "../i18n/useCloverTranslation";
import { languageProps } from "../i18n/direction";
import { PinchGlyph } from "./glyphs/Pinch";
import type { GestureHintKind } from "../lib/renderer/input/GestureController";

/** How long it takes to fade out (`GestureHint.css`), staying that long as it leaves. */
const LEAVE_MS = 400;

/**
 * What the two-finger hint says, and its hand (`GestureHint`, which loads it the first time
 * it speaks). Kept as it fades out (Mat, 2026-11-23: "have it fade in out a little more
 * gracefully"), then gone, so its region speaks again the next time; at once where less
 * motion is asked for.
 */
export default function GestureHintWords({
  kind,
}: {
  kind: GestureHintKind | null;
}) {
  const { t, langOf } = useCloverTranslation();
  const [said, setSaid] = useState(kind);
  const leaving = Boolean(said) && !kind;
  useEffect(() => {
    if (kind) return setSaid(kind);
    const still =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => setSaid(null), still ? 0 : LEAVE_MS);
    return () => clearTimeout(timer);
  }, [kind]);
  if (!said) return null;
  return (
    <p
      className="clover-gesture-hint-text"
      data-leaving={leaving || undefined}
      {...languageProps(langOf("gestureHintTouch"))}
    >
      <svg
        viewBox="0 0 512 512"
        width="16"
        height="16"
        aria-hidden="true"
        focusable="false"
      >
        <PinchGlyph />
      </svg>
      {t("gestureHintTouch")}
    </p>
  );
}
