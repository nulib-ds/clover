import React from "react";

import * as Clover from "../../parts";

/**
 * The toolbar's search field, Clover's Search at its small size: a module of its own, so
 * it loads as its magnifier is pointed at, focused or pressed, never with the template
 * (`SectionControls.tsx`).
 */
export default function SearchField() {
  return <Clover.Search size="small" />;
}
