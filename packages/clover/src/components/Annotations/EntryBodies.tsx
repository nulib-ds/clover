import React from "react";

import type { AnnotationBodyEntry } from "../../core/annotation-bodies";
import { bodyInLanguage } from "../../core/annotation-name";
import { type LocalizedValue, localize } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { Markup } from "../../ui/Markup";
import { languageProps } from "../../core/direction";

/**
 * What an annotation says, as the Annotations list shows it and the Canvas's caption: each
 * text body by its format (IIIF's limited HTML sanitized, Markdown, plain text) and each
 * image (Cookbook 0377).
 */
/** Whether there is text, which describes any image beside it (Cookbook 0377). */
const hasText = (bodies: AnnotationBodyEntry[]) =>
  bodies.some((body) => body.value?.trim());

/** Of each `Choice`, the item in the language to read (Cookbook 0346); the rest as given. */
const shownOf = (bodies: AnnotationBodyEntry[], language?: string) => {
  const choices = new Map<number, AnnotationBodyEntry[]>();
  for (const body of bodies)
    if (body.choice !== undefined)
      choices.set(body.choice, [...(choices.get(body.choice) ?? []), body]);
  if (!choices.size) return bodies;
  const shown = new Set(
    [...choices.values()].map((items) => bodyInLanguage(items, language)),
  );
  return bodies.filter((body) => body.choice === undefined || shown.has(body));
};

export function EntryBodies({
  bodies,
  language,
  headingLevel,
}: {
  bodies: AnnotationBodyEntry[];
  language?: string;
  /** The level of a Markdown body's first heading. */
  headingLevel?: number;
}) {
  const { t, langOf } = useCloverTranslation();
  const shown = shownOf(bodies, language);
  /*
   * An image's text alternative (WCAG 1.1.1): none beside text that describes it, which
   * would say it twice; else its label, or its annotation's; else that it is an image.
   */
  const altOf = (body: AnnotationBodyEntry): LocalizedValue => {
    if (hasText(shown)) return { text: "" };
    const label = localize(body.label, language);
    return label.text
      ? label
      : { text: t("annotationsImage"), lang: langOf("annotationsImage") };
  };
  return (
    <>
      {shown.map((body, index) => {
        // A place, by its name (Cookbook 0139); the Map draws where it is.
        if (body.place)
          return (
            <Markup
              key={index}
              as="div"
              markup={body.label}
              language={language}
              className="clover-annotations-text"
            />
          );
        if (!body.image)
          return (
            <Markup
              key={index}
              as="div"
              markup={{ [body.language ?? "none"]: [body.value ?? ""] }}
              format={body.format}
              headingLevel={headingLevel}
              language={language}
              className="clover-annotations-text"
            />
          );
        const alt = altOf(body);
        return (
          <img
            key={index}
            src={body.image}
            alt={alt.text}
            {...languageProps(alt.text ? alt.lang : undefined)}
            width={200}
            loading="lazy"
            className="clover-annotations-image"
          />
        );
      })}
    </>
  );
}
