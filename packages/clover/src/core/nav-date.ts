/**
 * A resource's `navDate`, the date IIIF gives it for navigation (an `xsd:dateTime`,
 * Presentation 3 §3.3.1; Cookbook 0230, 0318), read and shown as Clover shows it, in the
 * reader's language, to the precision it is likely written to (Mat, 2026-10-29): an
 * `xsd:dateTime` must give a time, so a year or a month is written as its first moment.
 * Exactly midnight on January 1 is a year ("1776"), midnight on the 1st a month
 * ("February 1925"), any other midnight a day ("February 16, 1925"), and any other moment
 * a day and its time. Every part as written, never moved to the reader's time zone, so
 * "1849-01-01T00:00:00Z" is 1849 on either side of Greenwich. Nothing for a value that
 * is not a date.
 */
const DATE_TIME =
  /^(-?\d{4,})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?/;

export type NavDatePrecision = "year" | "month" | "day" | "time";

export interface NavDate {
  /** Its date and time as written, held at UTC so no time zone moves them. */
  at: Date;
  precision: NavDatePrecision;
}

/** What a `navDate` names, and how precisely, or null. */
export function readNavDate(value: unknown): NavDate | null {
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
  const precision: NavDatePrecision = !midnight
    ? "time"
    : day !== 1
      ? "day"
      : month !== 1
        ? "month"
        : "year";
  return { at, precision };
}

const FORMATS: Record<NavDatePrecision, Intl.DateTimeFormatOptions> = {
  year: { year: "numeric" },
  month: { year: "numeric", month: "long" },
  day: { dateStyle: "long" },
  time: { dateStyle: "long", timeStyle: "short" },
};

/** It as the reader's language writes it, to its precision ("February 1925"). */
export function formatNavDate({ at, precision }: NavDate, locale: string) {
  const options = { ...FORMATS[precision], timeZone: "UTC" };
  try {
    return new Intl.DateTimeFormat(locale, options).format(at);
  } catch {
    return new Intl.DateTimeFormat("en", options).format(at);
  }
}

/**
 * It for a `time` element's `datetime`, to the precision shown ("1776", "1925-02",
 * "1925-02-16"), so a page or an agent reads what the reader sees; a moment as written.
 */
export function navDateTime({ at, precision }: NavDate, written: string) {
  const year = at.getUTCFullYear();
  if (precision === "time" || year < 0) return written.trim();
  const two = (n: number) => String(n).padStart(2, "0");
  return [
    String(year).padStart(4, "0"),
    ...(precision === "year" ? [] : [two(at.getUTCMonth() + 1)]),
    ...(precision === "day" ? [two(at.getUTCDate())] : []),
  ].join("-");
}
