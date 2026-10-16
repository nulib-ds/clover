import type { MetadataItem } from "@iiif/presentation-3";
import React, { forwardRef, useEffect, useState } from "react";

import { hasMarkup, markdownToPlainText, toPlainText } from "../core/text";
import { type LanguageMapLike, localize } from "../core/value";

/**
 * A IIIF value, which may hold the HTML the Presentation API allows.
 *
 * Plain values render as text, at once. A value with markup renders as text first and
 * becomes sanitised HTML once the sanitiser (DOMPurify, loaded on demand) arrives, so a
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
   * `text/markdown` is converted to HTML (then sanitised), keeping its lists and
   * headings; anything else is IIIF's HTML.
   */
  format?: string;
  /**
   * The level of a Markdown value's first heading, a level under the part around it;
   * the rest follow under it, none skipped. Default 3.
   */
  headingLevel?: number;
  /** The language to read the value in; the reader's by default. */
  language?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, "dangerouslySetInnerHTML" | "lang">;

/** A IIIF language map, in the closest language, as sanitised HTML. Nothing when empty. */
export const Markup = forwardRef<HTMLElement, MarkupProps>(function Markup(
  { as: Tag = "span", markup, language, format, headingLevel, ...rest },
  ref,
) {
  const { text, lang } = localize(markup, language);
  const markdown = format === "text/markdown";
  const html = useSanitized(text, markdown, headingLevel);
  if (!text) return null;
  return html !== null ? (
    <Tag
      ref={ref}
      {...rest}
      lang={lang}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    // Until the sanitiser arrives, Markdown shows without its syntax.
    <Tag ref={ref} {...rest} lang={lang}>
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
