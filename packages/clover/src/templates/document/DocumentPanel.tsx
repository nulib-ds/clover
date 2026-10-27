import React from "react";

import * as Clover from "../../parts";
import type { PanelProps } from "../../parts";

/**
 * Document's information panel, a chunk of its own: it starts shut, so its code (the
 * sections, About and what they draw) loads as the reader first reaches for it
 * (`Document`).
 */
export default function DocumentPanel(props: PanelProps) {
  return <Clover.Panel {...props} />;
}
