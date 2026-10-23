import React from "react";

import { Flavored, PartName } from "docs/components/Flavored";
import { aloneParts, elementLoads, partLoads } from "docs/lib/sizes";

/**
 * A size set as the homepage's figures are (`Home.module.css`'s `.figure`): the number,
 * its unit smaller. What was measured is in words for assistive technology, not shown
 * (Mat, 2026-10-22).
 */
function Figure({ value, caption }: { value: string; caption: string }) {
  return (
    <>
      <span className="docs-part-head-value">
        {value}
        <span className="docs-part-head-unit"> kB</span>
      </span>
      <span className="docs-part-head-caption"> {caption}</span>
    </>
  );
}

/**
 * A component page's head, a bar between its first example's demo and its code (`Example`'s
 * `head`; Mat, 2026-10-22): the part's name as the reader's code writes it, as the
 * homepage's tiles name it, and at the bar's end what the part adds to a page, as that
 * technology measures it (`sizes.json`): React's with a `Root`, the element's with a
 * `<clover-root>`, its styles with it; or, for a part its page shows alone, what a page
 * with it alone loads.
 */
export function PartHead({ part }: { part: keyof typeof partLoads }) {
  // A part its page shows with no `Root` round it, measured on a page by itself.
  const alone = aloneParts.has(part);
  return (
    <div className="docs-part-head">
      <p className="docs-part-head-name">
        <PartName name={part} />
      </p>
      <p className="docs-part-head-figure">
        <Flavored
          react={
            <Figure
              value={partLoads[part]}
              caption={
                alone
                  ? "loaded by a page with it alone, gzipped"
                  : "added to a page with a Root, gzipped"
              }
            />
          }
          webComponents={
            <Figure
              value={elementLoads[part]}
              caption={
                alone
                  ? "loaded by a page with it alone, styles included, gzipped"
                  : "added to a page with a <clover-root>, styles included, gzipped"
              }
            />
          }
        />
      </p>
    </div>
  );
}
