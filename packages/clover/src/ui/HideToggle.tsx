import React from "react";
import { useUniqueId } from "./useUniqueId";

import { Tip } from "./Tip";
import { useCloverTranslation } from "../i18n/useCloverTranslation";

/**
 * Hides a page of annotations from the picture, or shows it again: a checkbox, checked
 * while the page is hidden, drawn as an eye, struck through while hidden. Its popover
 * says "Hide", as a control's names it. Its name is that word and what it hides, the
 * page's label (`of`), so no two read alike beside several pages (WCAG 2.4.6, 2.5.3);
 * "Hide Annotations" for a page without one. As small as a transcript's language codes,
 * and as large a target (WCAG 2.5.8). Styles are `ui/HideToggle.css`.
 */
export function HideToggle({
  hidden,
  onChange,
  of,
}: {
  hidden: boolean;
  onChange: (hidden: boolean) => void;
  /** The id of what holds the label of the page it hides, where the page has one. */
  of?: string;
}) {
  const { t, langOf } = useCloverTranslation();
  const id = useUniqueId();
  const key = of ? "annotationsHideTip" : "annotationsHide";
  return (
    <label className="clover-hide">
      <input
        type="checkbox"
        checked={hidden}
        aria-labelledby={of ? `${id} ${of}` : id}
        onChange={(event) => onChange(event.target.checked)}
      />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        // Its own size, so it never fills the row without the stylesheet.
        width={14}
        height={14}
        viewBox="0 0 512 512"
        aria-hidden="true"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeWidth={40}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M32 256s80-144 224-144 224 144 224 144-80 144-224 144S32 256 32 256z" />
        <circle cx={256} cy={256} r={72} />
        {hidden && <path d="M80 80l352 352" />}
      </svg>
      <span id={id} hidden lang={langOf(key)}>
        {t(key)}
      </span>
      <Tip
        label={t("annotationsHideTip")}
        lang={langOf("annotationsHideTip")}
      />
    </label>
  );
}
