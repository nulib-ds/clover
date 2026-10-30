import { formatNavDate, navDateTime, readNavDate } from "./nav-date";

const shown = (value: string, locale = "en") =>
  formatNavDate(readNavDate(value)!, locale);

describe("navDate", () => {
  it("reads a year, a month or a day from the moment that opens it", () => {
    expect(readNavDate("1776-01-01T00:00:00Z")?.precision).toBe("year");
    expect(shown("1776-01-01T00:00:00Z")).toBe("1776");
    expect(shown("1925-02-01T00:00:00Z")).toBe("February 1925");
    expect(shown("1925-02-16T00:00:00Z")).toBe("February 16, 1925");
    // A date with no time is its first moment, as one at midnight is.
    expect(shown("1849-01-01")).toBe("1849");
  });

  it("gives a day and its time for any other moment, as written", () => {
    expect(readNavDate("1925-02-16T15:30:00Z")?.precision).toBe("time");
    expect(shown("1925-02-16T15:30:00Z")).toBe("February 16, 1925 at 3:30 PM");
    // A second, or less, past midnight is a moment too.
    expect(readNavDate("1925-01-01T00:00:00.5Z")?.precision).toBe("time");
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
    const machine = (value: string) => navDateTime(readNavDate(value)!, value);
    expect(machine("1776-01-01T00:00:00Z")).toBe("1776");
    expect(machine("1925-02-01T00:00:00Z")).toBe("1925-02");
    expect(machine("1925-02-16T00:00:00Z")).toBe("1925-02-16");
    expect(machine("1925-02-16T15:30:00Z")).toBe("1925-02-16T15:30:00Z");
    expect(machine("0079-08-24T00:00:00Z")).toBe("0079-08-24");
  });

  it("keeps an early year as written", () => {
    expect(readNavDate("0079-08-24T00:00:00Z")?.at.getUTCFullYear()).toBe(79);
  });

  it("reads nothing from a value that is not a date", () => {
    expect(readNavDate(undefined)).toBeNull();
    expect(readNavDate("ca. 1725")).toBeNull();
    expect(readNavDate("1849-02-30T00:00:00Z")).toBeNull();
  });
});
