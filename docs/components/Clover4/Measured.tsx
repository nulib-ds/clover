import React from "react";

import { kB, sizes } from "docs/lib/sizes";

/**
 * A size the package's build measured (`sizes.json`, by its key), in kB gzipped, for a
 * page's prose: the code's own figure, never one written into the copy (AGENTS.md).
 *
 * ```mdx
 * three.js loads with the first Scene: <Measured size="sceneOnDemandGzip" />.
 * ```
 */
export function Measured({ size }: { size: keyof typeof sizes }) {
  const bytes = sizes[size];
  return <>{typeof bytes === "number" ? `${kB(bytes)} kB` : "—"}</>;
}
