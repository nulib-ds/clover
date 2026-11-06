"use client";

import React from "react";
import styles from "docs/components/Clover4/ViewerDocs.module.css";

/**
 * A switch over an example, outside its card (Mat, 2026-11-01: "move this above the
 * example, out of the dropshadow container … keep styling the same for all segmented
 * controls"): a fieldset named by its legend, its choices worked and drawn as the
 * header's code switch is (`CodeSwitch`; Mat, 2026-11-01: "work more like the react/wc
 * toggle"): radio buttons, one stop in the tab order, the arrow keys moving between them,
 * small pills, the chosen one in the controls' dark fill and the accent only under the
 * pointer or focused (`.code-switch`, `layout.css`). One look for every example's
 * (`switchAbove`, `ViewerDocs.module.css`).
 */
export function ExampleSwitch({
  id,
  label,
  options,
  chosen,
  onChoose,
}: {
  /** The id of its legend, which names the group, and of its radios' `name`. */
  id: string;
  label: string;
  /** Each choice, and the language of its name where that is not the page's. */
  options: { key: string; label: string; lang?: string }[];
  chosen: number;
  onChoose: (index: number) => void;
}) {
  return (
    <fieldset className={styles.switchAbove}>
      <legend className={styles.switchLabel} id={id}>
        {label}
      </legend>
      <div className="code-switch">
        {options.map((option, index) => (
          <label
            key={option.key}
            className="code-switch-option"
            data-option={option.key}
            data-checked={index === chosen || undefined}
            lang={option.lang}
          >
            <input
              type="radio"
              name={`${id}-choice`}
              value={option.key}
              checked={index === chosen}
              onChange={() => onChoose(index)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Checks over an example (Mat, 2026-11-05: "this should be have like checkboxes. design it
 * as a grid. with buttons like we have but it should be obvious that each can be
 * checked"): the switch's fieldset and legend, its choices in a grid, each a native
 * checkbox in a label drawn as the switch's buttons are, with a box before its name that
 * fills, checked, as the button takes the controls' dark fill. Each is a stop in the tab
 * order and Space toggles it; the label takes the press (WCAG 2.5.8). None is checked
 * until the reader checks it, but those `locked`: checked and disabled, drawn in the light
 * fill, a note under the name saying why, in the page's English, which describes the
 * box (Mat, 2026-11-05: "add a special mark … if it is detected as the users lang").
 */
export function ExampleChecks({
  id,
  label,
  options,
  checked,
  onChange,
  locked = {},
}: {
  /** The id of its legend, which names the group. */
  id: string;
  label: string;
  /** Each choice, and the language of its name where that is not the page's. */
  options: { key: string; label: string; lang?: string }[];
  /** The keys checked. */
  checked: string[];
  onChange: (checked: string[]) => void;
  /** Keys checked for the reader, each with why ("Detected from your browser"). */
  locked?: Record<string, string>;
}) {
  return (
    <fieldset className={`${styles.switchAbove} ${styles.checksAbove}`}>
      <legend className={styles.switchLabel} id={id}>
        {label}
      </legend>
      <div className={styles.checks}>
        {options.map((option) => {
          const note = locked[option.key];
          const on = !note && checked.includes(option.key);
          const noteId = `${id}-${option.key}-why`;
          return (
            <label
              key={option.key}
              className={`code-switch-option ${styles.check}`}
              data-option={option.key}
              data-checked={on || undefined}
              data-locked={note ? "" : undefined}
              lang={option.lang}
            >
              <span className={styles.checkBox}>
                <input
                  type="checkbox"
                  value={option.key}
                  checked={on || !!note}
                  disabled={!!note}
                  aria-describedby={note ? noteId : undefined}
                  onChange={() =>
                    onChange(
                      options
                        .map((each) => each.key)
                        .filter((key) =>
                          key === option.key ? !on : checked.includes(key),
                        ),
                    )
                  }
                />
                <svg
                  className={styles.checkMark}
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
              </span>
              <span>{option.label}</span>
              {note && (
                <span className={styles.checkNote} id={noteId} lang="en">
                  {note}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
