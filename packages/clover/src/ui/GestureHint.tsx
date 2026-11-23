import React, { useCallback, useEffect, useRef, useState } from "react";

import { useCloverTranslation } from "../i18n/useCloverTranslation";
import { languageProps } from "../i18n/direction";
import type { GestureHintKind } from "../lib/renderer/input/GestureController";

export type { GestureHintKind };

/** How long a hint stays after the last gesture it answers. */
const SHOWN_MS = 1500;

/** Each call to the setter restarts the hint's timer. */
export function useGestureHint(): [
  GestureHintKind | null,
  (kind: GestureHintKind) => void,
] {
  const [kind, setKind] = useState<GestureHintKind | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((next: GestureHintKind) => {
    setKind(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setKind(null), SHOWN_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [kind, show];
}

/**
 * How to move a view whose page keeps a finger's drag (`cooperative`): two fingers, over
 * the Body as the gesture is left to the page, on a touch screen alone (Mat, 2026-11-23:
 * "scroll to zoom overlay should only show on mobile"). Its live region is always there,
 * so the words are announced as they come (WCAG 4.1.3).
 */
export function GestureHint({ kind }: { kind: GestureHintKind | null }) {
  const { t, langOf } = useCloverTranslation();
  return (
    <div className="clover-gesture-hint" role="status">
      {kind && (
        <p
          className="clover-gesture-hint-text"
          {...languageProps(langOf("gestureHintTouch"))}
        >
          {t("gestureHintTouch")}
        </p>
      )}
    </div>
  );
}
