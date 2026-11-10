import React from "react";

import * as Clover from "../../parts";

/**
 * The downloads' links under the toolbar's Download button, Clover's Download: a module
 * of its own, so it loads as the toolbar first draws, beside the page's first view,
 * never with the template (`SectionControls.tsx`).
 */
export default function DownloadLinks({
  headingLevel,
}: {
  headingLevel: number;
}) {
  return <Clover.Download headingLevel={headingLevel} />;
}
