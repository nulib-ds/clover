import React from "react";

import * as Clover from "../../parts";

/**
 * The lightbox's Body, a chunk of its own: a Gallery's page draws only thumbnails until the
 * reader opens one, so the Body's code (the Canvas, its renderer) loads then (`Lightbox`).
 */
export default function LightboxBody() {
  return <Clover.Body className="clover-template-lightbox-body" />;
}
