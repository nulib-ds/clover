import { markdownToPlainText, readAs } from "./text";

describe("markdownToPlainText", () => {
  it("takes Markdown's syntax off, so a name never reads it out", () => {
    expect(
      markdownToPlainText(
        [
          "## Sources ##",
          "",
          "- A letter of 1849",
          "* The *Gazette*, **bold** and __strong__ and _slanted_",
          "",
          "### Readings",
          "",
          "3. Third[^1]",
          "4) See [the page](https://example.org/a_b_c)",
          "",
          "[^1]: A note.",
        ].join("\n"),
      ),
    ).toBe(
      [
        "Sources",
        "A letter of 1849",
        "The Gazette, bold and strong and slanted",
        "Readings",
        "Third",
        "See the page",
        "A note.",
      ].join("\n"),
    );
  });

  it("leaves what is not Markdown's syntax as written", () => {
    expect(markdownToPlainText("#tag, 3 < 4 * 2, and &amp;")).toBe(
      "#tag, 3 < 4 * 2, and &amp;",
    );
    expect(markdownToPlainText("One\\\nTwo")).toBe("One\nTwo");
  });
});

/*
 * Strictly by the declared media type; with none, by IIIF's rule for property values:
 * HTML only from a first `<` to a last `>`.
 */
describe("readAs", () => {
  it("reads a declared format by its media type, and nothing else", () => {
    expect(readAs("text/html", "plain words")).toBe("html");
    expect(readAs("text/html; charset=utf-8")).toBe("html");
    expect(readAs("TEXT/HTML")).toBe("html");
    expect(readAs("text/markdown", "<p>x</p>")).toBe("markdown");
    // Markup in a body declared plain is plain text, shown as written.
    expect(readAs("text/plain", "<em>Note</em>")).toBe("plain");
    // A type that only looks like HTML is not it.
    expect(readAs("application/xhtml+xml", "<p>x</p>")).toBe("plain");
    expect(readAs("text/csv", "<p>x</p>")).toBe("plain");
  });

  it("reads a value with no format as HTML only from a first < to a last >", () => {
    expect(readAs(undefined, "<p>Written in <b>1849</b>.</p>")).toBe("html");
    expect(readAs(undefined, "  <span>x</span>\n")).toBe("html");
    expect(readAs(undefined, "Written in <b>1849</b>.")).toBe("plain");
    expect(readAs(undefined, "Fish &amp; chips")).toBe("plain");
    expect(readAs(undefined, "")).toBe("plain");
  });
});
