/**
 * IIIF HTML as plain text: tags dropped and the common entities decoded. What a value
 * shows before the sanitizer has loaded, and wherever markup cannot go (an `alt`, an
 * `aria-label`). Never used as HTML.
 */
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity[0] === "#") {
        const code =
          entity[1] === "x" || entity[1] === "X"
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return ENTITIES[entity.toLowerCase()] ?? match;
    });
}

/** Whether a value carries markup or entities, and so needs the sanitizer to show. */
export const hasMarkup = (value: string) =>
  /<[a-z!/]|&(#x?[0-9a-f]+|[a-z]+);/i.test(value);

/**
 * How a text is read, strictly by its `format`'s media type: `text/html` as IIIF's HTML,
 * sanitized to what the Presentation API allows; `text/markdown` as Markdown; `text/plain`
 * (and any other type) as written, a `<` included. With no format, as IIIF's property
 * values come, by IIIF's rule: HTML only from a first `<` to a last `>`, whitespace
 * aside; anything else is plain text.
 */
export function readAs(
  format: string | undefined,
  value = "",
): "markdown" | "html" | "plain" {
  const type = format?.split(";")[0].trim().toLowerCase();
  if (type) {
    return type === "text/html"
      ? "html"
      : type === "text/markdown"
        ? "markdown"
        : "plain";
  }
  const text = value.trim();
  return text.startsWith("<") && text.endsWith(">") ? "html" : "plain";
}

/**
 * Markdown (`text/markdown`) as plain text, its syntax taken off: headings' `#`s, list
 * markers, emphasis, footnote marks, and links down to their text. What names an
 * annotation written in it (an `aria-label`, a hotspot's tip), where markup cannot go.
 * Small and synchronous, so the Markdown module itself still loads only to show it.
 */
export function markdownToPlainText(markdown: string): string {
  return (
    markdown
      .replace(/\r\n?/g, "\n")
      .replace(/^\[\^[^\]]+\]:[ \t]*/gm, "")
      .replace(/\[\^[^\]]+\]/g, "")
      .replace(/^#{1,6}[ \t]+(\S.*?)(?:[ \t]+#+)?[ \t]*$/gm, "$1")
      .replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, "")
      // Links before emphasis, so an address's `_` is never read as emphasis.
      .replace(/\[([^\]]+)\]\((?:https?:\/\/|mailto:)[^\s)]+\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => a ?? b)
      .replace(/\*([^*\s][^*]*)\*|_([^_\s][^_]*)_/g, (_, a, b) => a ?? b)
      // A backslash's line break, and blank lines, are one line break.
      .replace(/\\\n/g, "\n")
      .replace(/\n\s*\n/g, "\n")
      .trim()
  );
}
