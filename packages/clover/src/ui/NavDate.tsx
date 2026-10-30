import React from "react";

import { languageProps } from "../i18n/direction";
import { readDate } from "../core/dates";
import { dateTimeOf, formatDate } from "../core/dates-format";
import { langWithin } from "../i18n/config";
import { useCloverTranslation } from "../i18n/useCloverTranslation";

/**
 * A resource's `navDate` as text: in the reader's language, to the precision it is likely
 * written to (a year, a month, a day, or a moment; `core/dates.ts`), as a `time` whose
 * `datetime` says the same, so a page or an agent reads what the reader sees. Marked with
 * its language where it is not the page's, or not that of what holds it (`within`: a
 * place's name around it), WCAG 3.1.2. Nothing for a value that is not a date. A part
 * that may show one loads it as it does (`lazy`), the writing with it (`dates-format.ts`),
 * deciding first by `readDate` whether there is a date at all.
 */
export function NavDate({
  value,
  className,
  within,
}: {
  value: unknown;
  className?: string;
  /** The language of the element it sits in, where that is not the page's. */
  within?: string;
}) {
  const { i18n, hostLanguage } = useCloverTranslation();
  const date = readDate(value);
  if (!date) return null;
  const locale = i18n.language;
  return (
    <time
      className={className}
      dateTime={dateTimeOf(date, String(value))}
      {...languageProps(langWithin(locale, within ?? hostLanguage))}
    >
      {formatDate(date, locale)}
    </time>
  );
}
