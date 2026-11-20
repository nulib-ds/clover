/**
 * Markdown (`text/markdown`) as plain text, its syntax taken off: headings' `#`s, list
 * markers, emphasis, footnote marks, and links down to their text. What names an
 * annotation written in it (an `aria-label`, a hotspot's tip), where markup cannot go,
 * and what a Markdown value shows until the sanitizer arrives (`Markup`'s `markdownText`).
 * Small and synchronous, so the Markdown module itself still loads only to show it. Apart
 * from `text.ts`: only what reads a `format` meets Markdown, never a first view's values.
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
