import React, { forwardRef } from "react";

import { useCloverTranslation } from "../i18n/useCloverTranslation";
import { join } from "../lib/classnames";
import { Steps, type StepsModel } from "./Steps";
import { Tip } from "./Tip";
import { visuallyHidden } from "./visuallyHidden";
import { languageProps } from "../core/direction";

export interface FieldPillProps {
  /** The field's id, for its label. */
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Enter, or the submit's press. */
  onSubmit: () => void;
  /** Clear's press: the field is emptied, and focus goes back to it. */
  onClear: () => void;
  /**
   * What the query found, shown inside the pill before Clear: the steps through it ("3 /
   * 11", "1 / 1" for one), or "No results" where it found none. Nothing before a search.
   */
  results?: StepsModel | null;
  /** `large` (the default), its submit a round control's; `small`, a tad smaller. */
  size?: "large" | "small";
  /** Classes of the part's own, beside the pill's: the form's, the query's, the buttons'. */
  classes?: { form?: string; query?: string; clear?: string; submit?: string };
}

/**
 * The search field, one component wherever Clover searches (Mat, 2026-10-26: "this is a
 * generic search component"): Search's over a Content Search service, and the
 * Transcript's over its cues, the same in every way but what they search. One pill: the
 * query, what it found (the steps through it, or "No results"; Mat: "place the results
 * and next/prev controls inside search"), Clear while there is something to clear, and a
 * round submit in the accent. In Search's own words ("Search", "Clear search", "Result 2
 * of 7", "No results"), so it brings no strings of its own. A `search` landmark named by
 * its field. The browser's own clear is hidden: the keyboard cannot reach it, nor a
 * stylesheet style it.
 */
export const FieldPill = forwardRef<HTMLInputElement, FieldPillProps>(
  function FieldPill(
    {
      id,
      value,
      onChange,
      onSubmit,
      onClear,
      results,
      size = "large",
      classes = {},
    },
    ref,
  ) {
    const { t, langOf } = useCloverTranslation();
    const search = t("commonSearch");
    const clear = t("contentSearchClear");
    return (
      <form
        role="search"
        className={join("clover-field-pill", classes.form)}
        data-size={size}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label
          htmlFor={id}
          style={visuallyHidden}
          {...languageProps(langOf("informationPanelTabsSearch"))}
        >
          {t("informationPanelTabsSearch")}
        </label>
        <input
          ref={ref}
          id={id}
          type="search"
          className={join("clover-field-pill-query", classes.query)}
          value={value}
          placeholder={t("contentSearchPlaceholder")}
          lang={langOf("contentSearchPlaceholder")}
          onChange={(event) => onChange(event.target.value)}
        />
        {results &&
          (results.total ? (
            <Steps steps={results} sentence="contentSearchPosition" />
          ) : (
            // Shown; the part's status says it to assistive technology.
            <span
              className="clover-field-pill-note"
              aria-hidden="true"
              {...languageProps(langOf("contentSearchResultsNone"))}
            >
              {t("contentSearchResultsNone")}
            </span>
          ))}
        {value && (
          <button
            type="button"
            className={join("clover-field-pill-clear", classes.clear)}
            {...languageProps(langOf("contentSearchClear"))}
            onClick={onClear}
          >
            <svg
              aria-hidden="true"
              focusable="false"
              width="12"
              height="12"
              viewBox="0 0 16 16"
            >
              <path
                d="M4 4l8 8M12 4l-8 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span style={visuallyHidden}>{clear}</span>
            <Tip label={clear} />
          </button>
        )}
        <button
          type="submit"
          className={join("clover-field-pill-submit", classes.submit)}
          {...languageProps(langOf("commonSearch"))}
        >
          <svg
            aria-hidden="true"
            focusable="false"
            width="16"
            height="16"
            viewBox="0 0 16 16"
          >
            <circle
              cx="7"
              cy="7"
              r="4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M10.5 10.5L14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span style={visuallyHidden}>{search}</span>
          <Tip label={search} />
        </button>
      </form>
    );
  },
);
