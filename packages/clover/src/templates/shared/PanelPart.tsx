import React from "react";

import * as Clover from "../../parts";
import type { PanelProps } from "../../parts";

/**
 * The information panel, a chunk of its own, for a template whose panel starts shut or
 * out of sight (Document's, the Gallery's lightbox's): its code (the sections, About and
 * what they draw) loads as the reader first reaches for it (`usePanelPane`'s `load`).
 */
export default function PanelPart(props: PanelProps) {
  return <Clover.Panel {...props} />;
}
