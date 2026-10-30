import type { AnnotationBodyEntry } from "./annotation-bodies";
import { markdownToPlainText, readAs, toPlainText } from "./text";
import { localize } from "./value";

/*
 * Apart from `annotation-bodies.ts`, which every Body loads with the annotation sets: only
 * the hotspots and the Annotations list name an annotation, and both load on demand.
 */
const tagOf = (body: AnnotationBodyEntry) =>
  body.language && body.language !== "none" ? body.language : "none";

/**
 * Of these bodies, the first in the language to read, chosen between as any IIIF text is
 * (`localize`, the reader's languages by default): an annotation's name, and which item of
 * a `Choice` shows (Cookbook 0346).
 */
export function bodyInLanguage<T extends AnnotationBodyEntry>(
  bodies: T[],
  language?: string,
): T | undefined {
  const first: Record<string, string[]> = {};
  bodies.forEach((body, index) => {
    first[tagOf(body)] ??= [String(index)];
  });
  return bodies[Number(localize(first, language).text) || 0];
}

/**
 * An annotation's name, as plain text, and the language it is in: what its hotspot, the
 * Canvas's menu and the Annotations list all call it, so the one annotation is named
 * alike wherever it shows (WCAG 3.2.4). Of its text bodies, the first in each language,
 * chosen between as any IIIF text is (`localize`, the reader's languages by default), and
 * read by its format (`readAs`): HTML for its text, never as markup; Markdown without its
 * syntax; any other format as written, a "<" included. With no text, an image's label
 * names it (Cookbook 0377), or a place's (Cookbook 0139), else nothing does.
 */
export function annotationName(
  bodies: AnnotationBodyEntry[],
  language?: string,
): { text?: string; lang?: string } {
  const named = (text: string, lang?: string) =>
    text ? { text, ...(lang ? { lang } : {}) } : {};
  const texts = bodies.filter((body) => body.value?.trim());
  if (!texts.length) {
    const image = bodies.find(
      (body) => (body.image || body.place) && body.label,
    );
    if (!image) return {};
    const { text, lang } = localize(image.label, language);
    return named(toPlainText(text).trim(), lang);
  }
  const body = bodyInLanguage(texts, language)!;
  const value = body.value!;
  const kind = readAs(body.format, value);
  const text =
    kind === "markdown"
      ? markdownToPlainText(value)
      : kind === "html"
        ? toPlainText(value)
        : value;
  const tag = tagOf(body);
  return named(text.trim(), tag === "none" ? undefined : tag);
}
