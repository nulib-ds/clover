import DOMPurify from "dompurify";

import { sanitizeHTML } from "./sanitize";

/**
 * Manifests are other people's data. Everything Clover renders as HTML goes through
 * `sanitizeHTML`, so these are the payloads it must defuse.
 */
describe("sanitizeHTML", () => {
  const cases: Array<[string, string, (out: string) => void]> = [
    [
      "a script",
      "<p>Hi<script>alert(1)</script></p>",
      (out) => expect(out).toBe("<p>Hi</p>"),
    ],
    [
      "an event handler",
      '<img src="https://example.org/a.jpg" onerror="alert(1)">',
      (out) => expect(out).toBe('<img src="https://example.org/a.jpg">'),
    ],
    [
      "a javascript: link",
      '<a href="javascript:alert(1)">x</a>',
      (out) => expect(out).toBe("<a>x</a>"),
    ],
    [
      "a javascript: link with whitespace and case",
      '<a href=" JaVaScRiPt:alert(1)">x</a>',
      (out) => expect(out).not.toMatch(/javascript/i),
    ],
    [
      "a data: link",
      '<a href="data:text/html,<script>alert(1)</script>">x</a>',
      (out) => expect(out).toBe("<a>x</a>"),
    ],
    [
      "a data: image",
      '<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=">',
      (out) => expect(out).toBe("<img>"),
    ],
    [
      "inline SVG with a script",
      '<svg onload="alert(1)"><script>alert(1)</script></svg>ok',
      (out) => expect(out).toBe("ok"),
    ],
    [
      "an iframe",
      '<iframe src="https://evil.example"></iframe>ok',
      (out) => expect(out).toBe("ok"),
    ],
    [
      "a style attribute",
      '<span style="background:url(javascript:alert(1))">x</span>',
      (out) => expect(out).toBe("<span>x</span>"),
    ],
  ];

  it.each(cases)("removes %s", (_, input, check) => check(sanitizeHTML(input)));

  it("keeps IIIF's allowed markup", () => {
    const html =
      '<p><b>Bold</b>, <i>italic</i>, <a href="https://example.org">a link</a>,<br><small>small</small> <sub>1</sub><sup>2</sup> <span>span</span> <a href="mailto:a@example.org">mail</a></p>';
    expect(sanitizeHTML(html)).toBe(html);
  });

  it("keeps lang and dir", () => {
    const out = sanitizeHTML(
      '<p><span lang="la" dir="ltr">Lorem</span> <i lang="ar" dir="rtl">x</i></p>',
    );
    const doc = new DOMParser().parseFromString(out, "text/html");
    expect(doc.querySelector("span")?.getAttribute("lang")).toBe("la");
    expect(doc.querySelector("span")?.getAttribute("dir")).toBe("ltr");
    expect(doc.querySelector("i")?.getAttribute("lang")).toBe("ar");
    expect(doc.querySelector("i")?.getAttribute("dir")).toBe("rtl");
  });

  it("keeps an image's height and width", () => {
    const out = sanitizeHTML(
      '<img src="https://example.org/a.jpg" height="10" width="20">',
    );
    const img = new DOMParser()
      .parseFromString(out, "text/html")
      .querySelector("img");
    expect(img?.getAttribute("height")).toBe("10");
    expect(img?.getAttribute("width")).toBe("20");
  });

  it("removes aria-* and data-* attributes, which IIIF's HTML does not allow", () => {
    expect(
      sanitizeHTML(
        '<p aria-hidden="true" data-open="true"><a href="https://example.org" aria-label="Elsewhere">x</a></p>',
      ),
    ).toBe('<p><a href="https://example.org">x</a></p>');
  });

  it("removes lists and headings from IIIF's HTML", () => {
    expect(
      sanitizeHTML(
        '<ul><li>a</li></ul><ol start="2"><li>b</li></ol><p role="heading" aria-level="2">c</p>',
      ),
    ).toBe("ab<p>c</p>");
    // And Markdown's groups past h6.
    expect(
      sanitizeHTML(
        '<div role="group" aria-labelledby="clover-md-1"><p id="clover-md-1">t</p></div>',
      ),
    ).toBe("<p>t</p>");
  });

  it("keeps Markdown's lists and headings, with only the values it writes", () => {
    const markdown = (html: string) => sanitizeHTML(html, { markdown: true });
    const kept = new DOMParser().parseFromString(
      markdown(
        '<ul><li>a</li></ul><ol start="2"><li>b</li></ol><p role="heading" aria-level="4"><b>c</b></p>',
      ),
      "text/html",
    );
    expect(kept.querySelectorAll("ul > li, ol > li")).toHaveLength(2);
    expect(kept.querySelector("ol")?.getAttribute("start")).toBe("2");
    expect(kept.querySelector("p")?.getAttribute("role")).toBe("heading");
    expect(kept.querySelector("p")?.getAttribute("aria-level")).toBe("4");
    expect(
      markdown(
        '<p role="button" aria-level="9" aria-hidden="true">x</p><ol start="x"><li>y</li></ol>',
      ),
    ).toBe("<p>x</p><ol><li>y</li></ol>");
    // Its groups past h6, named by their titles' ids, and nothing else of the kind.
    const group = new DOMParser().parseFromString(
      markdown(
        '<div role="group" aria-labelledby="clover-md-3"><p id="clover-md-3"><b>t</b></p></div>',
      ),
      "text/html",
    );
    expect(group.querySelector("div")?.getAttribute("role")).toBe("group");
    expect(group.querySelector("div")?.getAttribute("aria-labelledby")).toBe(
      "clover-md-3",
    );
    expect(group.querySelector("p")?.id).toBe("clover-md-3");
    expect(
      markdown(
        '<div role="note" aria-labelledby="page-title"><p id="page-title" role="group">x</p></div><span id="clover-md-1" aria-labelledby="clover-md-1">y</span>',
      ),
    ).toBe("<div><p>x</p></div><span>y</span>");
    // Only on the elements Markdown writes them on.
    expect(
      markdown(
        '<a href="https://example.org" role="heading" aria-level="1" start="2">x</a><ul start="2"><li role="heading">y</li></ul>',
      ),
    ).toBe('<a href="https://example.org">x</a><ul><li>y</li></ul>');
    // Still IIIF's limits otherwise.
    expect(
      markdown('<a href="javascript:alert(1)">x</a><script>1</script>'),
    ).toBe("<a>x</a>");
  });

  it("leaves the page's own DOMPurify as it was", () => {
    sanitizeHTML('<p role="heading" aria-level="2">x</p>', { markdown: true });
    sanitizeHTML('<a href="/relative">x</a>');
    // The page's copy, shared with Clover's through the package, has no hook of Clover's.
    const out = new DOMParser().parseFromString(
      DOMPurify.sanitize(
        '<div role="note" aria-level="10"><a href="/relative">x</a></div>',
      ),
      "text/html",
    );
    expect(out.querySelector("div")?.getAttribute("role")).toBe("note");
    expect(out.querySelector("div")?.getAttribute("aria-level")).toBe("10");
    expect(out.querySelector("a")?.getAttribute("href")).toBe("/relative");
  });

  it("still removes a javascript: link beside lang", () => {
    expect(sanitizeHTML('<a href="javascript:alert(1)" lang="en">x</a>')).toBe(
      '<a lang="en">x</a>',
    );
  });
});
