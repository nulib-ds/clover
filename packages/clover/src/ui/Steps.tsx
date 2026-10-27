import React from "react";

import { useCloverTranslation } from "../i18n/useCloverTranslation";
import { join } from "../lib/classnames";
import { Tip } from "./Tip";
import { visuallyHidden } from "./visuallyHidden";

/** Where the reader is among matches, and the way to step through them. */
export interface StepsModel {
  /** The current match's index, or -1 where none is current. */
  position: number;
  total: number;
  /** Go one back (-1) or on (1). */
  step: (by: -1 | 1) => void;
}

/**
 * Steps through matches: Search's hits, a Transcript's (Mat, 2026-10-26), small, as
 * Annotations' language codes are: the current one's place over the total ("3 / 11", a
 * dash until one is current), then Previous and Next together. The place is read as it
 * changes, by `sentence` ("Result 3 of 11"), from a live region there before its first
 * (WCAG 4.1.3). One reads "1 / 1", its steps both disabled; none, nothing.
 */
export function Steps({
  steps,
  sentence,
  className,
}: {
  steps: StepsModel;
  /** The string read for the place: `{{index}}` of `{{total}}`. */
  sentence: "contentSearchPosition";
  className?: string;
}) {
  const { t, langOf } = useCloverTranslation();
  const { position, total } = steps;
  if (total < 1) return null;
  const current = position + 1;
  return (
    <div className={join("clover-steps", className)}>
      <span aria-live="polite" className="clover-steps-position">
        <span aria-hidden="true">
          {current > 0 ? current : "–"} / {total}
        </span>
        {/*
         * The widest count, unseen in the same place: it keeps the room, so nothing beside
         * it moves as it grows. Without the stylesheet, `hidden`.
         */}
        <span className="clover-steps-room" aria-hidden="true" hidden>
          {total} / {total}
        </span>
        {current > 0 && (
          <span style={visuallyHidden} lang={langOf(sentence)}>
            {t(sentence, { index: current, total })}
          </span>
        )}
      </span>
      <Step steps={steps} step="previous" />
      <Step steps={steps} step="next" />
    </div>
  );
}

/**
 * A step: a pill around a chevron, muted, the accent under the pointer or focused, its
 * name a `Tip`. At the first match or the last it is `aria-disabled`, not `disabled`, so
 * the press that reaches the end leaves focus on it (WCAG 2.4.3).
 */
function Step({
  steps,
  step,
}: {
  steps: StepsModel;
  step: "previous" | "next";
}) {
  const { t, langOf } = useCloverTranslation();
  const isNext = step === "next";
  const available = isNext
    ? steps.position + 1 < steps.total
    : steps.position > 0;
  const key = isNext ? "commonNext" : "commonPrevious";
  return (
    <button
      type="button"
      className="clover-steps-step"
      data-step={step}
      lang={langOf(key)}
      aria-disabled={!available || undefined}
      tabIndex={available ? undefined : -1}
      onClick={() => {
        if (available) steps.step(isNext ? 1 : -1);
      }}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        width="12"
        height="12"
        viewBox="0 0 16 16"
      >
        <path
          d={isNext ? "M6 3l5 5-5 5" : "M10 3L5 8l5 5"}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span style={visuallyHidden}>{t(key)}</span>
      <Tip label={t(key)} />
    </button>
  );
}
