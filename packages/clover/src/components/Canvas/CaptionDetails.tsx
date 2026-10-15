import React from "react";

import type { IIIFCanvas } from "./layout";
import { Metadata, Summary } from "../Primitives/Primitives";

/**
 * A Canvas's `summary` and `metadata`: IIIF's limited HTML is kept, everything else is
 * sanitised away. Lazy, through `Caption`, so the sanitiser loads only when it opens.
 */
const CaptionDetails: React.FC<Pick<IIIFCanvas, "summary" | "metadata">> = ({
  summary,
  metadata,
}) => (
  <>
    {/* The Summary part, cut short with "Read more" as every summary is. */}
    <Summary value={summary as any} className="clover-canvas-caption-summary" />
    <Metadata
      value={metadata as any}
      className="clover-canvas-caption-metadata"
    />
  </>
);

export default CaptionDetails;
