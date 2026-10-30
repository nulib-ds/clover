/*
 * Dates, read and written one way across the project (Mat, 2026-10-29: "make sure these
 * helpers are global for the whole project"): a date as it is written, to the precision
 * it is written to (here), shown in the reader's language and given to a machine as the
 * same (`dates-format.ts`, apart, so a page reads whether there is a date and loads the
 * writing only where there is one; Mat, 2026-10-30). No framework and no DOM, so the docs
 * read and write their dates through them too (`docs/lib/figures.ts`,
 * `docs/lib/last-changed.ts`, `scripts/build-cookbook.mjs`).
 * `ui/NavDate.tsx` draws one as a `time`. A time on a recording is `formatTime`
 * (`lib/time.ts`), apart: every Canvas loads that up front, and only a place, an item or
 * About shows a date (2026-10-29: the two in one module took every player's first view
 * 116 B up, the date's rules riding with the clock).
 */

const DATE_TIME =
  /^(-?\d{4,})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?/;

export type DatePrecision = "year" | "month" | "day" | "time";

export interface PreciseDate {
  /** Its date and time as written, held at UTC so no time zone moves them. */
  at: Date;
  precision: DatePrecision;
}

/**
 * What a date names, and how precisely, or null: an `xsd:date` or `xsd:dateTime` as
 * written, every part kept, never moved to the reader's time zone, so
 * "1849-01-01T00:00:00Z" is 1849 on either side of Greenwich. To the precision given,
 * else to the one it is likely written to, as a resource's `navDate` is (Presentation 3
 * §3.3.1; Cookbook 0230, 0318; Mat, 2026-10-29): an `xsd:dateTime` must give a time, so a
 * year or a month is written as its first moment. Exactly midnight on January 1 is a year
 * ("1776"), midnight on the 1st a month ("February 1925"), any other midnight a day
 * ("February 16, 1925"), and any other moment a day and its time.
 */
export function readDate(
  value: unknown,
  precision?: DatePrecision,
): PreciseDate | null {
  if (typeof value !== "string") return null;
  const parts = DATE_TIME.exec(value.trim());
  if (!parts) return null;
  const [year, month, day, hours = 0, minutes = 0, seconds = 0] = parts
    .slice(1, 7)
    .map((part) => (part === undefined ? undefined : Number(part)));
  const at = new Date(Date.UTC(2000, month! - 1, day, hours, minutes, seconds));
  // `Date.UTC` reads 0 to 99 as 1900 to 1999: the year is set on its own.
  at.setUTCFullYear(year!);
  if (at.getUTCMonth() !== month! - 1 || at.getUTCDate() !== day) return null;
  const midnight = !hours && !minutes && !seconds && !Number(parts[7] ?? 0);
  return {
    at,
    precision:
      precision ??
      (!midnight ? "time" : day !== 1 ? "day" : month !== 1 ? "month" : "year"),
  };
}
