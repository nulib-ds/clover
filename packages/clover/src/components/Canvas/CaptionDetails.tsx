import React from "react";

import type { IIIFCanvas } from "./layout";
import { localize } from "../../core/value";
import { Markup, MetadataList } from "../../ui/Markup";
import { ReadMore } from "../../ui/ReadMore";

/**
 * A Canvas's `summary` and `metadata`: IIIF's limited HTML is kept, everything else is
 * sanitised away. Lazy, through `Caption`, so the sanitiser loads only when it opens.
 *
 * Rendered as the Summary and Metadata parts render them, but in the Canvas's `language`,
 * which those parts cannot know outside a Root.
 */
const CaptionDetails: React.FC<
  Pick<IIIFCanvas, "summary" | "metadata"> & { language?: string }
> = ({ summary, metadata, language }) => (
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
  </>
);

export default CaptionDetails;
