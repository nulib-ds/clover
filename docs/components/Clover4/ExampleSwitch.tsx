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
