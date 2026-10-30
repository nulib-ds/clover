import { readDate } from "./dates";
import { dateTimeOf, formatDate } from "./dates-format";

const shown = (value: string, locale = "en") =>
  formatDate(readDate(value)!, locale);

describe("navDate", () => {
  it("reads a year, a month or a day from the moment that opens it", () => {
    expect(readDate("1776-01-01T00:00:00Z")?.precision).toBe("year");
    expect(shown("1776-01-01T00:00:00Z")).toBe("1776");
    expect(shown("1925-02-01T00:00:00Z")).toBe("February 1925");
    expect(shown("1925-02-16T00:00:00Z")).toBe("February 16, 1925");
    // A date with no time is its first moment, as one at midnight is.
    expect(shown("1849-01-01")).toBe("1849");
  });

  it("gives a day and its time for any other moment, as written", () => {
    expect(readDate("1925-02-16T15:30:00Z")?.precision).toBe("time");
    expect(shown("1925-02-16T15:30:00Z")).toBe("February 16, 1925 at 3:30 PM");
    // A second, or less, past midnight is a moment too.
    expect(readDate("1925-01-01T00:00:00.5Z")?.precision).toBe("time");
  });

  it("keeps every part as written, on either side of Greenwich", () => {
    expect(shown("1849-01-01T00:00:00+05:00")).toBe("1849");
    expect(shown("1925-02-16T00:00:00-05:00")).toBe("February 16, 1925");
  });

  it("writes it in the reader's language", () => {
    expect(shown("1925-02-01T00:00:00Z", "fr")).toBe("février 1925");
    expect(shown("1925-02-16T00:00:00Z", "fr")).toBe("16 février 1925");
    expect(shown("1925-02-16T00:00:00Z", "not a language")).toBe(
      "February 16, 1925",
    );
  });

  it("says to a machine what it shows: the year, month or day, or the moment", () => {
    const machine = (value: string) => dateTimeOf(readDate(value)!, value);
    expect(machine("1776-01-01T00:00:00Z")).toBe("1776");
    expect(machine("1925-02-01T00:00:00Z")).toBe("1925-02");
    expect(machine("1925-02-16T00:00:00Z")).toBe("1925-02-16");
    expect(machine("1925-02-16T15:30:00Z")).toBe("1925-02-16T15:30:00Z");
    expect(machine("0079-08-24T00:00:00Z")).toBe("0079-08-24");
  });

  it("keeps an early year as written", () => {
    expect(readDate("0079-08-24T00:00:00Z")?.at.getUTCFullYear()).toBe(79);
  });

  it("reads nothing from a value that is not a date", () => {
    expect(readDate(undefined)).toBeNull();
    expect(readDate("ca. 1725")).toBeNull();
    expect(readDate("1849-02-30T00:00:00Z")).toBeNull();
  });
});

describe("dates the docs give", () => {
  it("reads a date to the precision given, whatever its day", () => {
    const checked = readDate("2026-11-01", "day")!;
    expect(formatDate(checked, "en-US")).toBe("November 1, 2026");
    expect(dateTimeOf(checked)).toBe("2026-11-01");
  });

  it("writes a moment in UTC where it is not written out", () => {
    const at = new Date("2026-10-29T21:35:53-04:00");
    expect(dateTimeOf({ at, precision: "time" })).toBe(
      "2026-10-30T01:35:53.000Z",
    );
  });
});
