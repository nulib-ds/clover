"use client";

import React, { useId } from "react";

import styles from "./RadioCards.module.css";

export interface RadioCard<T extends string> {
  value: T;
  title: string;
  /** What it gives, in a sentence: text, code or a link. */
  note: React.ReactNode;
  /** A name over the title, in the code's face: the component it starts from. */
  name?: React.ReactNode;
}

/**
 * A choice as radio cards, one over the other: each a native radio, so the group is one
 * tab stop and the arrow keys move through it, its mark at its start, an optional name in
 * the code's face, a title and a sentence of what it gives. The chosen one floats. Get
 * started's two choices are drawn with it, the setup and the way in (Mat, 2026-10-26:
 * "match styling of these to cards in step 3"). The group is named by `ask`, shown over
 * the cards, or by `label` alone.
 */
export function RadioCards<T extends string>({
  ask,
  label,
  options,
  value,
  onChange,
}: {
  ask?: React.ReactNode;
  label?: string;
  options: RadioCard<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className={styles.frame}>
      {ask && (
        <p id={`${id}-ask`} className={styles.ask}>
          {ask}
        </p>
      )}
      <div
        className={styles.cards}
        role="radiogroup"
        aria-labelledby={ask ? `${id}-ask` : undefined}
        aria-label={ask ? undefined : label}
      >
        {options.map((each) => (
          <div
            key={each.value}
            className={styles.card}
            data-option={each.value}
          >
            <input
              type="radio"
              name={`${id}-choice`}
              value={each.value}
              checked={each.value === value}
              onChange={() => onChange(each.value)}
              aria-labelledby={`${id}-${each.value}`}
              aria-describedby={`${id}-${each.value}-note`}
            />
            <span className={styles.dot} aria-hidden="true" />
            {each.name && (
              <p className={styles.name} aria-hidden="true">
                {each.name}
              </p>
            )}
            <span id={`${id}-${each.value}`} className={styles.title}>
              {each.title}
            </span>
            <p id={`${id}-${each.value}-note`} className={styles.note}>
              {each.note}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
