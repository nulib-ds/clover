/**
 * IIIF HTML as plain text: tags dropped and the common entities decoded. What a value
 * shows before the sanitizer has loaded, and wherever markup cannot go (an `alt`, an
 * `aria-label`). Never used as HTML. A numeric reference outside Unicode (`&#0;`,
 * `&#x110000;`) stays as written, as `cueText`'s does: decoding it would throw, and parts
 * render this.
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
        return code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
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
