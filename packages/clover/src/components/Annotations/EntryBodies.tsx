import React from "react";

import type { AnnotationBodyEntry } from "../../core/annotation-bodies";
import { shownBodies } from "../../core/shown-bodies";
import { useBodyAlt } from "../../ui/bodyAlt";
import { Markup } from "../../ui/Markup";
import { languageProps } from "../../i18n/direction";

/**
 * What an annotation says, as the Annotations list shows it and the Canvas's caption: each
 * text body by its format (IIIF's limited HTML sanitized, Markdown, plain text) and each
 * image (Cookbook 0377). The Canvas's annotations menu says it as plain words
 * (`ui/AnnotationEntry`'s `EntryWords`), from the same bodies.
 */
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
  const shown = shownBodies(bodies, language);
  const altOf = useBodyAlt(shown, language);
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
