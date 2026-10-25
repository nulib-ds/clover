import type { MetadataItem } from "@iiif/presentation-3";
import React, { forwardRef, useEffect, useState } from "react";

import {
  hasMarkup,
  markdownToPlainText,
  readAs,
  toPlainText,
} from "../core/text";
import { type LanguageMapLike, localize } from "../core/value";
import { directionOf } from "../core/direction";

/**
 * A IIIF value, which may hold the HTML the Presentation API allows.
 *
 * Plain values render as text, at once. A value with markup renders as text first and
 * becomes sanitized HTML once the sanitizer (DOMPurify, loaded on demand) arrives, so a
 * page whose values carry no markup never loads it.
 */
function useSanitized(
  text: string,
  markdown = false,
  headingLevel = 3,
): string | null {
  const markup = markdown || hasMarkup(text);
  const key = markdown ? `${headingLevel}\n${text}` : text;
  const [html, setHtml] = useState<{ for: string; html: string } | null>(null);
  useEffect(() => {
    if (!markup) return;
    let live = true;
    Promise.all([
      import("../core/sanitize"),
      markdown ? import("../core/markdown") : null,
    ]).then(([{ sanitizeHTML }, md]) => {
      const source = md ? md.markdownToHtml(text, { headingLevel }) : text;
      if (live)
        setHtml({ for: key, html: sanitizeHTML(source, { markdown: !!md }) });
    });
    return () => {
      live = false;
    };
  }, [text, key, markup, markdown, headingLevel]);
  return markup && html?.for === key ? html.html : null;
}

type MarkupProps = {
  as?: React.ElementType;
  markup?: LanguageMapLike;
  /**
   * Read strictly by it (`readAs`): `text/markdown` is converted to HTML (then
   * sanitized), keeping its lists and headings; `text/html` is IIIF's HTML; `text/plain`
   * (or any other type) is shown as written, its line breaks kept. With none, IIIF's
   * rule: HTML only from a first `<` to a last `>`.
   */
  format?: string;
  /**
   * The level of a Markdown value's first heading, a level under the part around it;
   * the rest follow under it, none skipped. Default 3.
   */
  headingLevel?: number;
  /** The language to read the value in; the reader's by default. */
  language?: string;
} & Omit<
  React.HTMLAttributes<HTMLElement>,
  "dangerouslySetInnerHTML" | "lang" | "dir"
>;

/** A IIIF language map, in the closest language, as sanitized HTML. Nothing when empty. */
export const Markup = forwardRef<HTMLElement, MarkupProps>(function Markup(
  { as: Tag = "span", markup, language, format, headingLevel, ...rest },
  ref,
) {
  const { text, lang } = localize(markup, language);
  // Written right to left where its language is (Arabic, Hebrew…), else as the page is.
  const dir = directionOf(lang);
  const kind = readAs(format, text);
  const markdown = kind === "markdown";
  // Plain text is never markup: nothing is sanitized, so nothing loads for it.
  const html = useSanitized(
    kind === "plain" ? "" : text,
    markdown,
    headingLevel,
  );
  if (!text) return null;
  if (kind === "plain")
    return (
      <Tag ref={ref} {...rest} lang={lang} dir={dir}>
        {text.split(/\r?\n/).map((line, index) => (
          <React.Fragment key={index}>
            {index > 0 && <br />}
            {line}
          </React.Fragment>
        ))}
      </Tag>
    );
  return html !== null ? (
    <Tag
      ref={ref}
      {...rest}
      lang={lang}
      dir={dir}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    // Until the sanitizer arrives, Markdown shows without its syntax.
    <Tag ref={ref} {...rest} lang={lang} dir={dir}>
      {markdown ? markdownToPlainText(text) : toPlainText(text)}
    </Tag>
  );
});

type MetadataListProps = {
  metadata?: MetadataItem[] | null;
  language?: string;
  /** Your own rendering of a value; Clover's for the rest when it returns undefined. */
  renderValue?: (item: MetadataItem) => React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDListElement>, "lang">;

/** IIIF `metadata` (or a `requiredStatement`) as a description list. */
export const MetadataList: React.FC<MetadataListProps> = ({
  metadata,
  language,
  renderValue,
  ...rest
}) => {
  if (!metadata?.length) return null;
  return (
    <dl {...rest}>
      {metadata.map((item, index) => {
        const label = localize(item.label as LanguageMapLike, language);
        const custom = renderValue?.(item);
        return (
          // `dl` accepts a plain `div` around each pair, keeping dt and dd associated.
          <div
            key={index}
            data-label={localize(item.label as LanguageMapLike, "none")
              .text.replace(/\s+/g, "-")
              .toLowerCase()}
          >
            <dt lang={label.lang}>{label.text}</dt>
            {custom !== undefined ? (
              <dd>{custom}</dd>
            ) : (
              <Markup
                as="dd"
                markup={item.value as LanguageMapLike}
                language={language}
              />
            )}
          </div>
        );
      })}
    </dl>
  );
};
