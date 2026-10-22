"use client";

import React, { useId } from "react";
import {
  CODE_FLAVORS,
  setCodeFlavor,
  useCodeFlavor,
} from "docs/lib/code-flavor";

/**
 * The header's switch for the docs' code, React or Web Components (Mat, 2026-10-21;
 * React by default; `docs/lib/code-flavor.ts`). A pair of radio buttons, named for what
 * they set: one stop in the tab order, the arrow keys moving between them, as in any
 * radio group. Drawn as the Viewer page's segmented control is (`layout.css`), the chosen
 * one shown from the page's root (`data-code`, set before the page paints), so a reader
 * who chose Web Components never sees React chosen first.
 */
export function CodeSwitch() {
  const name = useId();
  const flavor = useCodeFlavor();
  return (
    <div className="code-switch" role="radiogroup" aria-label="Code examples">
      {CODE_FLAVORS.map((option) => (
        <label
          key={option.value}
          className="code-switch-option"
          data-option={option.value}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={flavor === option.value}
            onChange={() => setCodeFlavor(option.value)}
          />
          {/*
           * Where the header is narrow, its short name shows, the rest still read
           * (`code-switch-more`), so its name holds what is seen (WCAG 2.5.3).
           */}
          <span>
            {option.short ? (
              <>
                {option.short}
                <span className="code-switch-more">
                  {option.label.slice(option.short.length)}
                </span>
              </>
            ) : (
              option.label
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
