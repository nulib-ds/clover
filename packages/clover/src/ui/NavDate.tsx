import React from "react";

import { languageProps } from "../core/direction";
import { formatNavDate, navDateTime, readNavDate } from "../core/nav-date";
import { langWithin } from "../i18n/config";
import { useCloverTranslation } from "../i18n/useCloverTranslation";

/**
 * A resource's `navDate` as text: in the reader's language, to the precision it is likely
 * written to (a year, a month, a day, or a moment; `core/nav-date.ts`), as a `time` whose
 * `datetime` says the same, so a page or an agent reads what the reader sees. Marked with
 * its language where it is not the page's, or not that of what holds it (`within`: a
 * place's name around it), WCAG 3.1.2. Nothing for a value that is not a date.
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
  const date = readNavDate(value);
  if (!date) return null;
  const locale = i18n.language;
  return (
    <time
      className={className}
      dateTime={navDateTime(date, String(value))}
      {...languageProps(langWithin(locale, within ?? hostLanguage))}
    >
      {formatNavDate(date, locale)}
    </time>
  );
}
