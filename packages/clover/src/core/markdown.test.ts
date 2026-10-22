import { markdownToHtml } from "./markdown";
import { sanitizeHTML } from "./sanitize";

describe("markdownToHtml", () => {
  it("writes paragraphs, emphasis, links and breaks", () => {
    expect(
      markdownToHtml(
        "*Translated* by **A. B.**  \nsee [the page](https://example.org/a_b_c).\n\nNext.",
      ),
    ).toBe(
      '<p><i>Translated</i> by <b>A. B.</b><br>see <a href="https://example.org/a_b_c">the page</a>.</p><p>Next.</p>',
    );
  });

  it("numbers footnotes and lists them at the end", () => {
    expect(markdownToHtml("Text[^1].\n\n[^1]: The note.")).toBe(
      "<p>Text<sup>1</sup>.</p><p><small><sup>1</sup> The note.</small></p>",
    );
  });

  it("writes bullet and numbered lists as lists, a numbered one from its first number", () => {
    expect(markdownToHtml("- one\n* **two**\n+ three")).toBe(
      "<ul><li>one</li><li><b>two</b></li><li>three</li></ul>",
    );
    expect(markdownToHtml("1. one\n2. two")).toBe(
      "<ol><li>one</li><li>two</li></ol>",
    );
    expect(markdownToHtml("3) three\n4) four")).toBe(
      '<ol start="3"><li>three</li><li>four</li></ol>',
    );
  });

  it("starts a list after a line of text, a numbered one only from 1", () => {
    expect(markdownToHtml("Intro:\n- a\n- b")).toBe(
      "<p>Intro:</p><ul><li>a</li><li>b</li></ul>",
    );
    expect(markdownToHtml("Intro:\n1. one\n2. two")).toBe(
      "<p>Intro:</p><ol><li>one</li><li>two</li></ol>",
    );
    // A line that opens with a number is still text, as in CommonMark.
    expect(markdownToHtml("Printed in\n1849. Then sold.")).toBe(
      "<p>Printed in 1849. Then sold.</p>",
    );
  });

  it("nests an indented item under the one before, and carries an item on to the next line", () => {
    expect(markdownToHtml("- a\n  - b\n  - c\n- d")).toBe(
      "<ul><li>a<ul><li>b</li><li>c</li></ul></li><li>d</li></ul>",
    );
    expect(markdownToHtml("1. a\n   - b\n2. c")).toBe(
      "<ol><li>a<ul><li>b</li></ul></li><li>c</li></ol>",
    );
    expect(markdownToHtml("- a\ncontinued\n- b")).toBe(
      "<ul><li>a continued</li><li>b</li></ul>",
    );
    // A list of the other kind at the same depth is a list of its own.
    expect(markdownToHtml("1. a\n- b")).toBe(
      "<ol><li>a</li></ol><ul><li>b</li></ul>",
    );
  });

  it("writes headings from the level it is given, each under the nearest shallower one, none skipped", () => {
    // The source skips a level; the output does not.
    expect(markdownToHtml("## Notes\n\n#### Sources\n\nText.")).toBe(
      '<p role="heading" aria-level="3"><b>Notes</b></p>' +
        '<p role="heading" aria-level="4"><b>Sources</b></p>' +
        "<p>Text.</p>",
    );
    const levels = (markdown: string, headingLevel?: number) =>
      [
        ...markdownToHtml(markdown, { headingLevel }).matchAll(
          /aria-level="(\d)"/g,
        ),
      ].map(([, level]) => Number(level));
    expect(levels("# Title\n### Deep")).toEqual([3, 4]);
    // The first heading takes the level, deeper or not; a shallower one later backs out.
    expect(levels("### A\n# B\n## C\n#### D\n## E")).toEqual([3, 3, 4, 5, 4]);
    expect(levels("# Notes", 5)).toEqual([5]);
    // Never deeper than 6: past it, no heading (below).
    expect(levels("# One\n## Two\n### Three", 5)).toEqual([5, 6]);
  });

  it("past 6, writes a heading as a paragraph naming the group of what follows it", () => {
    const html = markdownToHtml(
      "# Notes\n\n## Sources\n\nOne.\n\n### Letters\n\nTwo.\n\n## Places\n\nThree.",
      { headingLevel: 6 },
    );
    const parsed = new DOMParser().parseFromString(html, "text/html").body;
    expect(
      parsed.querySelector('[role="heading"]')?.getAttribute("aria-level"),
    ).toBe("6");
    const groups = [...parsed.querySelectorAll('div[role="group"]')];
    // "Sources" holds its text and "Letters" inside it; "Places" is its own.
    expect(groups).toHaveLength(3);
    const name = (group: Element) =>
      parsed.querySelector(`#${group.getAttribute("aria-labelledby")}`)
        ?.textContent;
    expect(groups.map(name)).toEqual(["Sources", "Letters", "Places"]);
    expect(groups[0].textContent).toBe("SourcesOne.LettersTwo.");
    expect(groups[1].parentElement).toBe(groups[0]);
    expect(groups[2].parentElement).toBe(parsed);
    // None is a heading.
    expect(parsed.querySelectorAll('[role="heading"]')).toHaveLength(1);
    // Each id is its own.
    const again = markdownToHtml("# A\n## B", { headingLevel: 7 });
    expect(again.match(/id="(clover-md-\d+)"/g)).toHaveLength(2);
    expect(html).not.toContain(again.match(/id="(clover-md-\d+)"/)![1] + '"');
  });

  it("numbers its groups with every other copy of Clover on the page (WCAG 4.1.2)", async () => {
    // Two copies, each new, as a page with React's Clover and the elements' has.
    vi.resetModules();
    const one = await import("./markdown");
    vi.resetModules();
    const two = await import("./markdown");
    expect(two.markdownToHtml).not.toBe(one.markdownToHtml);
    const ids = [one, two].map(
      ({ markdownToHtml: write }) =>
        write("# A", { headingLevel: 7 }).match(/id="(clover-md-\d+)"/)![1],
    );
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("keeps its groups past 6 through the Markdown sanitizer", () => {
    const html = markdownToHtml("# Notes\n\nText.", { headingLevel: 7 });
    const parse = (markup: string) => {
      const template = document.createElement("template");
      template.innerHTML = markup;
      return template.content;
    };
    expect(
      parse(sanitizeHTML(html, { markdown: true })).isEqualNode(parse(html)),
    ).toBe(true);
  });

  it("takes a heading from the lines round it, and its closing hashes off", () => {
    expect(markdownToHtml("# Title #\nText under it.\n- a\n- b")).toBe(
      '<p role="heading" aria-level="3"><b>Title</b></p>' +
        "<p>Text under it.</p><ul><li>a</li><li>b</li></ul>",
    );
    expect(markdownToHtml("Text\n## Part\n- a\n- b")).toBe(
      "<p>Text</p>" +
        '<p role="heading" aria-level="3"><b>Part</b></p>' +
        "<ul><li>a</li><li>b</li></ul>",
    );
  });

  it("writes no heading without text, nor for a hash with no space", () => {
    expect(markdownToHtml("#\n\n#tag")).toBe("<p>#</p><p>#tag</p>");
  });

  it("keeps its lists and headings through the Markdown sanitizer", () => {
    const html = markdownToHtml("# Notes\n\n- one\n\n2. two", {
      headingLevel: 4,
    });
    // The same markup, whatever order the sanitizer leaves its attributes in.
    const parse = (markup: string) => {
      const template = document.createElement("template");
      template.innerHTML = markup;
      return template.content;
    };
    expect(
      parse(sanitizeHTML(html, { markdown: true })).isEqualNode(parse(html)),
    ).toBe(true);
  });

  it("escapes HTML in the source, and leaves unsafe links as text", () => {
    const html = sanitizeHTML(
      markdownToHtml(
        "<script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror=1>",
      ),
      { markdown: true },
    );
    expect(html).not.toMatch(/<script|<img|href=/);
    expect(html).toContain("&lt;script&gt;");
  });

  it("never lets a quote in a link's address write attributes of its own", () => {
    const html = sanitizeHTML(
      markdownToHtml('[x](https://a"role="heading"aria-level="1)'),
      { markdown: true },
    );
    const link = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector("a")!;
    expect(link.getAttributeNames()).toEqual(["href"]);
    expect(link.getAttribute("href")).toBe(
      'https://a"role="heading"aria-level="1',
    );
    expect(markdownToHtml('Say "hi"')).toBe("<p>Say &quot;hi&quot;</p>");
  });
});
