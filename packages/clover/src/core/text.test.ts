import { markdownToPlainText } from "./text";

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
