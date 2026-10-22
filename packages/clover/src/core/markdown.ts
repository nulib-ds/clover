/**
 * The Markdown IIIF bodies use (`format: "text/markdown"`), as HTML: paragraphs, line
 * breaks, `*emphasis*`, `**strong**`, `[links](https://…)`, bullet and numbered lists
 * (`ul`, `ol`, nested by indent), headings, and footnotes (`[^1]` and `[^1]: …`). Not a
 * full CommonMark parser — enough for annotation text, and small.
 *
 * As in CommonMark, a heading needs no blank line round it, a list may follow a line of
 * text directly (a numbered one only from 1, so a line that opens with a year stays
 * text), and a line of text after a list item carries the item on.
 *
 * A heading is a bold paragraph with `role="heading"` and an `aria-level`, not an `h1`
 * to `h6`, so the page's own heading styles never reach annotation text. Its level is
 * set by the part around it (`headingLevel`): the first heading takes that level, and
 * each later one sits a level under the nearest shallower heading before it, so none is
 * skipped, whatever the source skips. Past 6, where screen readers misread an
 * `aria-level` (`ui/heading.ts`), a heading is a bold paragraph that names the group of
 * what follows it, up to the next heading as shallow (`role="group"`,
 * `aria-labelledby`), by an id of its own.
 *
 * The output is always passed through `sanitizeHTML(html, { markdown: true })` before
 * it is shown; nothing here is trusted. Text is escaped first, so only the markup this
 * module writes survives.
 */

export interface MarkdownOptions {
  /** The level of the text's first heading; the rest follow under it. Default 3. */
  headingLevel?: number;
}

const BULLET = /^\s*[-*+]\s+/;
const NUMBER = /^\s*(\d+)[.)]\s+/;
const HEADING = /^(#{1,6})\s+(\S.*?)(?:\s+#+)?\s*$/;

/**
 * The groups past h6, numbered on the page so each heading's id is its own: counted on
 * the page's global, so every copy of Clover on the page (React's, the elements' entries)
 * counts together, and no two ids meet (WCAG 4.1.2).
 */
const GROUPS = Symbol.for("clover.markdown.groups");
const nextGroup = () => {
  const page = globalThis as unknown as Record<symbol, number | undefined>;
  return (page[GROUPS] = (page[GROUPS] ?? 0) + 1);
};

// A quote too, so no text (a link's address) can end the attribute it is written into.
const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Inline markup within one block. */
function inline(text: string, notes: Map<string, number>): string {
  // Links are set aside first, so emphasis never reaches into a URL (`a_b_c`).
  const links: string[] = [];
  const marked = escape(text)
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
      (_, label: string, url: string) => {
        links.push(url);
        return `\u0000${links.length - 1}\u0001${label}\u0002`;
      },
    )
    // Footnote references, numbered in order of first definition.
    .replace(/\[\^([^\]]+)\]/g, (match, key: string) => {
      const number = notes.get(key);
      return number ? `<sup>${number}</sup>` : match;
    })
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => `<b>${a ?? b}</b>`)
    .replace(
      /\*([^*\s][^*]*)\*|_([^_\s][^_]*)_/g,
      (_, a, b) => `<i>${a ?? b}</i>`,
    )
    // A hard line break: two trailing spaces or a backslash, then a newline.
    .replace(/( {2,}|\\)\n/g, "<br>")
    .replace(/\n/g, " ");
  return marked.replace(
    /\u0000(\d+)\u0001([^\u0002]*)\u0002/g,
    (_, index: string, label: string) =>
      `<a href="${links[Number(index)]}">${label}</a>`,
  );
}

type Block =
  | { kind: "heading"; depth: number; text: string }
  | { kind: "list" | "paragraph"; lines: string[] };

/** The blocks of the text, split at blank lines, headings, and lists' first lines. */
function blocksOf(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.split(/\n(?:[ \t]*\n)+/)) {
    let last: Block | undefined;
    for (const line of chunk.split("\n")) {
      if (!line.trim()) continue;
      const heading = HEADING.exec(line);
      const number = NUMBER.exec(line);
      // A numbered list breaks into a paragraph only from 1.
      const item =
        BULLET.test(line) ||
        (number && (last?.kind !== "paragraph" || Number(number[1]) === 1));
      if (heading) {
        last = { kind: "heading", depth: heading[1].length, text: heading[2] };
        blocks.push(last);
      } else if (item && last?.kind !== "list") {
        last = { kind: "list", lines: [line] };
        blocks.push(last);
      } else if (last && last.kind !== "heading") {
        // A list's next item, a paragraph's next line, or an item's lazy continuation.
        last.lines.push(line);
      } else {
        last = { kind: "paragraph", lines: [line] };
        blocks.push(last);
      }
    }
  }
  return blocks;
}

/** A list's lines as `ul` and `ol`, an item indented under another nested in it. */
function list(lines: string[], notes: Map<string, number>): string {
  const items: Array<{
    indent: number;
    tag: "ul" | "ol";
    start: number;
    text: string;
  }> = [];
  for (const line of lines) {
    const bullet = BULLET.exec(line);
    const number = bullet ? null : NUMBER.exec(line);
    const marker = bullet ?? number;
    if (marker) {
      items.push({
        indent: line.replace(/\t/g, "    ").search(/\S/),
        tag: bullet ? "ul" : "ol",
        start: number ? Number(number[1]) : 1,
        text: line.slice(marker[0].length),
      });
    } else items[items.length - 1].text += `\n${line.trimStart()}`;
  }

  let html = "";
  // The lists open round the item, outermost first, each at its first item's indent.
  const open: Array<{ indent: number; tag: "ul" | "ol" }> = [];
  const close = () => (html += `</li></${open.pop()!.tag}>`);
  for (const item of items) {
    // Back out to the list it belongs to: the deepest inside one shallower than it.
    while (open.length > 1 && item.indent <= open[open.length - 2].indent)
      close();
    const top = open[open.length - 1];
    const sibling = top && item.indent <= top.indent;
    if (sibling && item.tag === top.tag) html += "</li><li>";
    else {
      // A sibling of the other kind ends its list, and starts its own in its place.
      if (sibling) close();
      const start =
        item.tag === "ol" && item.start !== 1 ? ` start="${item.start}"` : "";
      html += `<${item.tag}${start}><li>`;
      open.push({ indent: sibling ? top.indent : item.indent, tag: item.tag });
    }
    html += inline(item.text.trim(), notes);
  }
  while (open.length) close();
  return html;
}

export function markdownToHtml(
  markdown: string,
  { headingLevel = 3 }: MarkdownOptions = {},
): string {
  const notes = new Map<string, number>();
  const definitions: Array<[string, string]> = [];
  const body = markdown
    .replace(/\r\n?/g, "\n")
    .replace(/^\[\^([^\]]+)\]:\s*(.*)$/gm, (_, key: string, text: string) => {
      notes.set(key, notes.size + 1);
      definitions.push([key, text]);
      return "";
    });

  const base = Math.max(headingLevel, 1);
  // The `#` depths of the headings a later one may sit under, the outermost first.
  const above: number[] = [];
  // The `#` depths of the groups open round headings past 6, each closed by a heading as
  // shallow, or at the end.
  const open: number[] = [];

  const html: string[] = [];
  for (const block of blocksOf(body)) {
    if (block.kind === "heading") {
      while (above.length && above[above.length - 1] >= block.depth)
        above.pop();
      while (open.length && open[open.length - 1] >= block.depth) {
        open.pop();
        html.push("</div>");
      }
      const level = base + above.length;
      above.push(block.depth);
      const text = `<b>${inline(block.text, notes)}</b>`;
      if (level <= 6) {
        html.push(`<p role="heading" aria-level="${level}">${text}</p>`);
      } else {
        const id = `clover-md-${nextGroup()}`;
        open.push(block.depth);
        html.push(
          `<div role="group" aria-labelledby="${id}"><p id="${id}">${text}</p>`,
        );
      }
    } else if (block.kind === "list") html.push(list(block.lines, notes));
    else html.push(`<p>${inline(block.lines.join("\n").trim(), notes)}</p>`);
  }
  while (open.pop() !== undefined) html.push("</div>");

  if (definitions.length) {
    html.push(
      `<p><small>${definitions
        .map(
          ([key, text]) =>
            `<sup>${notes.get(key)}</sup> ${inline(text, notes)}`,
        )
        .join("<br>")}</small></p>`,
    );
  }
  return html.join("");
}
