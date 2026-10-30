import type { DatePrecision, PreciseDate } from "./dates";

/*
 * A date written: for a reader, in a language, and for a machine (`dates.ts` reads it).
 * Apart from the reading, so a page loads it only where there is a date to show.
 */

const FORMATS: Record<DatePrecision, Intl.DateTimeFormatOptions> = {
  year: { year: "numeric" },
  month: { year: "numeric", month: "long" },
  day: { dateStyle: "long" },
  time: { dateStyle: "long", timeStyle: "short" },
};

/** It as a language writes it, to its precision ("February 1925"); English failing that. */
export function formatDate({ at, precision }: PreciseDate, locale: string) {
  const options = { ...FORMATS[precision], timeZone: "UTC" };
  try {
    return new Intl.DateTimeFormat(locale, options).format(at);
  } catch {
    return new Intl.DateTimeFormat("en", options).format(at);
  }
}

/**
 * It for a machine, a `time` element's `datetime` or a sitemap's, to the precision shown
 * ("1776", "1925-02", "1925-02-16"), so a page or an agent reads what the reader sees; a
 * moment as `written` where it is given, else in UTC.
 */
export function dateTimeOf({ at, precision }: PreciseDate, written?: string) {
  const year = at.getUTCFullYear();
  if (precision === "time" || year < 0)
    return written?.trim() || at.toISOString();
  const two = (n: number) => String(n).padStart(2, "0");
  return [
    String(year).padStart(4, "0"),
    ...(precision === "year" ? [] : [two(at.getUTCMonth() + 1)]),
    ...(precision === "day" ? [two(at.getUTCDate())] : []),
  ].join("-");
}
