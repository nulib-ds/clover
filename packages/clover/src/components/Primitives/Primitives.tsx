import type { MetadataItem } from "@iiif/presentation-3";
import React, { useEffect, useState } from "react";

import type { CloverState } from "../../core/clover";
import { selectSequence } from "../../core/selectors";
import { resolveThumbnail, thumbnailSource } from "../../core/thumbnail";
import { toPlainText } from "../../core/text";
import { type LanguageMapLike, localize } from "../../core/value";
import { join } from "../../lib/classnames";
import {
  useOptionalClover,
  useOptionalCloverSelector,
} from "../../react/context";
import { MetadataList, Markup } from "../../ui/Markup";
import { ReadMore } from "../../ui/ReadMore";

/**
 * The IIIF descriptive properties, one part each. Inside a `Root` each reads the
 * Manifest, or the current Canvas with `of="canvas"`; anywhere, a value passed as a prop
 * wins. Text is in the Root's language and marked with the language it is in; HTML is
 * sanitised. A part with nothing to show renders nothing.
 */

export type Of = "manifest" | "canvas";

type Json = Record<string, any>;

const resourceOf = (state: CloverState, of: Of): Json | null =>
  of === "canvas"
    ? ((selectSequence(state.manifest).canvases.find(
        (canvas) => canvas.id === state.canvasId,
      ) as Json | undefined) ?? null)
    : (state.manifest as Json | null);

/** A property of the Root's Manifest or current Canvas, unless one is given. */
function useProperty<T>(
  of: Of,
  key: string,
  given: T | undefined,
): T | undefined {
  const fromRoot = useOptionalCloverSelector(
    (state) => resourceOf(state, of)?.[key] as T | undefined,
    undefined,
  );
  return given !== undefined ? given : fromRoot;
}

const useLanguage = () => useOptionalClover()?.language;

const asArray = <T,>(value: T | T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

interface PartProps<Value>
  extends Omit<React.HTMLAttributes<HTMLElement>, "lang"> {
  /** Whose property: the Manifest's (default) or the current Canvas's. */
  of?: Of;
  /** The element to render. */
  as?: React.ElementType;
  /** Show this value instead of the Root's. */
  value?: Value;
}

/**
 * `summary`, as sanitised HTML, cut to five lines, with "Read more" under it when it runs
 * longer (`ReadMore`). Every summary Clover shows is this part: About's, a Collection's, a
 * Canvas's in its information box.
 *
 * The number of lines is a CSS custom property, `--clover-summary-lines` (default `5`),
 * set on `.clover-summary` or on any element around it; `none` shows it whole.
 *
 * ```css
 * .my-layout .clover-summary {
 *   --clover-summary-lines: 3;
 * }
 * ```
 */
export function Summary({
  of = "manifest",
  as = "p",
  value,
  className,
  ...rest
}: PartProps<LanguageMapLike>) {
  const summary = useProperty<LanguageMapLike>(of, "summary", value);
  const language = useLanguage();
  // Nothing at all without a summary: no button, and no empty box round it.
  if (!localize(summary, language).text) return null;
  return (
    <ReadMore>
      <Markup
        as={as}
        markup={summary}
        language={language}
        className={join("clover-summary", className)}
        {...rest}
      />
    </ReadMore>
  );
}

/**
 * Any IIIF language map — an annotation's text, a label you hold — in the reader's
 * language, read strictly by `format` (`readAs`): `text/html` as sanitised HTML,
 * `text/plain` as written, and none by IIIF's rule (HTML only from `<` to `>`).
 * `format="text/markdown"` reads Markdown, its lists as lists and its headings as
 * headings, the first at `headingLevel` (default 3).
 */
export function Value({
  value,
  format,
  headingLevel,
  as = "span",
  className,
  ...rest
}: Omit<PartProps<LanguageMapLike>, "of"> & {
  format?: string;
  /** With Markdown, the level of its first heading; the rest follow under it. Default 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
}) {
  const language = useLanguage();
  return (
    <Markup
      as={as}
      markup={value}
      format={format}
      headingLevel={headingLevel}
      language={language}
      className={join("clover-value", className)}
      {...rest}
    />
  );
}

/** `metadata`, as a description list of label and value pairs. */
export function Metadata({
  of = "manifest",
  value,
  className,
  renderValue,
  ...rest
}: Omit<PartProps<MetadataItem[]>, "as"> & {
  /** Your own rendering of a value; Clover's when it returns undefined. */
  renderValue?: (item: MetadataItem) => React.ReactNode;
}) {
  const metadata = useProperty<MetadataItem[]>(of, "metadata", value);
  const language = useLanguage();
  return (
    <MetadataList
      metadata={metadata}
      language={language}
      renderValue={renderValue}
      className={join("clover-metadata", className)}
      {...(rest as React.HTMLAttributes<HTMLDListElement>)}
    />
  );
}

/** `requiredStatement`: the attribution that must be shown, as a label and value. */
export function RequiredStatement({
  of = "manifest",
  value,
  className,
  ...rest
}: Omit<PartProps<MetadataItem>, "as">) {
  const statement = useProperty<MetadataItem>(of, "requiredStatement", value);
  const language = useLanguage();
  return (
    <MetadataList
      metadata={statement ? [statement] : null}
      language={language}
      className={join("clover-required-statement", className)}
      {...(rest as React.HTMLAttributes<HTMLDListElement>)}
    />
  );
}

/** `rights`: a link to the licence or rights statement. */
export function Rights({
  of = "manifest",
  value,
  className,
  ...rest
}: Omit<PartProps<string>, "as">) {
  const rights = useProperty<string>(of, "rights", value);
  if (!rights) return null;
  return (
    <a
      href={rights}
      className={join("clover-rights", className)}
      {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
    >
      {rights}
    </a>
  );
}

/** The resource's `id`: a link to its IIIF JSON. */
export function Id({
  of = "manifest",
  value,
  className,
  ...rest
}: Omit<PartProps<string>, "as">) {
  const id = useProperty<string>(of, "id", value);
  if (!id) return null;
  return (
    <a
      href={id}
      className={join("clover-id", className)}
      {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
    >
      {id}
    </a>
  );
}

interface LinkedResource {
  id?: string;
  label?: LanguageMapLike;
  format?: string;
  type?: string;
}

/** A list of linked resources: each by its label (else its id), with its format. */
function Links({
  property,
  className,
  of = "manifest",
  value,
  ...rest
}: Omit<PartProps<LinkedResource[]>, "as"> & { property: string }) {
  const resources = asArray(useProperty<LinkedResource[]>(of, property, value));
  const language = useLanguage();
  const links = resources.filter((resource) => resource?.id);
  if (!links.length) return null;
  return (
    <ul
      className={className}
      {...(rest as React.HTMLAttributes<HTMLUListElement>)}
    >
      {links.map((resource) => {
        const label = localize(resource.label, language);
        return (
          <li key={resource.id}>
            <a href={resource.id} lang={label.text ? label.lang : undefined}>
              {label.text ? toPlainText(label.text) : resource.id}
            </a>
            {resource.format && (
              <span className="clover-link-format"> ({resource.format})</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

type LinksProps = Omit<PartProps<LinkedResource[]>, "as">;

/** `homepage`: the resource's own web page. */
export const Homepage = ({ className, ...props }: LinksProps) => (
  <Links
    property="homepage"
    className={join("clover-homepage", className)}
    {...props}
  />
);

/** `rendering`: alternate formats, such as a PDF of the whole object. */
export const Rendering = ({ className, ...props }: LinksProps) => (
  <Links
    property="rendering"
    className={join("clover-rendering", className)}
    {...props}
  />
);

/** `seeAlso`: machine-readable descriptions elsewhere. */
export const SeeAlso = ({ className, ...props }: LinksProps) => (
  <Links
    property="seeAlso"
    className={join("clover-see-also", className)}
    {...props}
  />
);

/** `partOf`: the Collections the resource belongs to. */
export const PartOf = ({ className, ...props }: LinksProps) => (
  <Links
    property="partOf"
    className={join("clover-part-of", className)}
    {...props}
  />
);

/**
 * The resource's `thumbnail` (or, for a Canvas, its first image), at `size` pixels on
 * the longer side. Its `alt` is the resource's label.
 */
export function Thumbnail({
  of = "manifest",
  value,
  size = 400,
  className,
  ...rest
}: Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  of?: Of;
  /** A resource to picture instead of the Root's: a Manifest, Canvas or Collection. */
  value?: unknown;
  size?: number;
}) {
  const fromRoot = useOptionalCloverSelector(
    (state) => resourceOf(state, of),
    null,
  );
  const resource = (value as Json | undefined) ?? fromRoot;
  const language = useLanguage();
  const source = resource ? thumbnailSource(resource, size) : null;
  const key = source?.src ?? source?.service ?? source?.fallback;
  const [src, setSrc] = useState(source?.src);
  const request = useOptionalClover()?.clover.request;
  useEffect(() => {
    if (!source) return setSrc(undefined);
    if (source.src) return setSrc(source.src);
    let live = true;
    resolveThumbnail(source, size, request).then((url) => live && setSrc(url));
    return () => {
      live = false;
    };
    // `key` stands in for `source`, a new object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size]);
  if (!src) return null;
  const label = localize(resource?.label, language);
  return (
    <img
      src={src}
      alt={toPlainText(label.text)}
      // The label's language, while the alt is the label.
      lang={
        (rest as { alt?: string }).alt === undefined && label.text
          ? label.lang
          : undefined
      }
      width={size}
      loading="lazy"
      decoding="async"
      className={join("clover-thumbnail", className)}
      {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)}
    />
  );
}
