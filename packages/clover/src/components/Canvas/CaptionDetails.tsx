import React from "react";

import type { IIIFCanvas } from "./layout";
import { readBodies } from "../../core/annotation-bodies";
import { localize } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { Markup, MetadataList } from "../../ui/Markup";
import { ReadMore } from "../../ui/ReadMore";
import { EntryBodies } from "../Annotations/EntryBodies";

/**
 * A Canvas's `summary` and `metadata`: IIIF's limited HTML is kept, everything else is
 * sanitized away. Lazy, through `Caption`, so the sanitizer loads only when it opens.
 *
 * Rendered as the Summary and Metadata parts render them, but in the Canvas's `language`,
 * which those parts cannot know outside a Root. Then the comments on the whole Canvas
 * (Cookbook 0266, 0019), as the Annotations list shows them, under its "Annotations".
 */
const CaptionDetails: React.FC<
  Pick<IIIFCanvas, "summary" | "metadata"> & {
    comments?: Record<string, any>[];
    language?: string;
  }
> = ({ summary, metadata, comments, language }) => {
  const { t, langOf } = useCloverTranslation();
  return (
    <>
      {/* Cut short with "Read more", as every summary is. */}
      {localize(summary as any, language).text && (
        <ReadMore>
          <Markup
            as="p"
            markup={summary as any}
            language={language}
            className="clover-summary clover-canvas-caption-summary"
          />
        </ReadMore>
      )}
      <MetadataList
        metadata={metadata as any}
        language={language}
        className="clover-metadata clover-canvas-caption-metadata"
      />
      {comments?.length ? (
        <div className="clover-canvas-caption-annotations">
          <p
            className="clover-canvas-caption-annotations-label"
            lang={langOf("informationPanelTabsAnnotations")}
          >
            {t("informationPanelTabsAnnotations")}
          </p>
          <ul>
            {comments.map((annotation, index) => (
              <li key={annotation.id ?? index}>
                <EntryBodies
                  bodies={readBodies(annotation)}
                  language={language}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
};

export default CaptionDetails;
