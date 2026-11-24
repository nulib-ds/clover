import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { GestureHintKind } from "../lib/renderer/input/GestureController";

export type { GestureHintKind };

/** How long a hint stays after the last gesture it answers. */
const SHOWN_MS = 1500;

/** Its words and hand (`GestureHintWords`), loaded apart from the view that shows them. */
const loadWords = () => import("./GestureHintWords");
const Words = lazy(loadWords);

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
 * How to move a view whose page keeps a finger's drag (`cooperative`): two fingers, in a
 * pill in the middle of the view with a hand pinching (`GestureHint.css`), as the gesture
 * is left to the page, on a touch screen alone (Mat, 2026-11-23: "scroll to zoom overlay
 * should only show on mobile"). Its live region is always there, so the words are
 * announced as they come (WCAG 4.1.3); the hand is for the eye alone. The words and hand
 * load apart: on a touch screen, where it may speak, two seconds after it is drawn (Safari
 * has no `requestIdleCallback`), so they are there for the first finger; anywhere else, the first time it speaks. A page shown
 * without touch never carries them.
 */
export function GestureHint({ kind }: { kind: GestureHintKind | null }) {
  const asked = useRef(false);
  if (kind) asked.current = true;
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.maxTouchPoints) return;
    const timer = setTimeout(() => void loadWords().catch(() => {}), 2000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="clover-gesture-hint" role="status">
      {asked.current && (
        <Suspense fallback={null}>
          <Words kind={kind} />
        </Suspense>
      )}
    </div>
  );
}
