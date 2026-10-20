"use client";

import { Homepage } from "@samvera/clover-iiif/primitives";

/*
 * The 3.x Homepage primitive with a click handler of its own, as the page's example
 * writes it: drawn in the browser, since a page drawn on the server cannot hand it a
 * function.
 */
export default function HomepageButton() {
  return (
    <Homepage
      homepage={[
        {
          id: "https://dc.library.northwestern.edu/items/71153379-4283-43be-8b0f-4e7e3bfda275",
          type: "Text",
          format: "text/html",
          label: {
            none: [
              "Homepage at Northwestern University Libraries Digital Collections",
            ],
          },
        },
      ]}
      role="button"
      data-homepage-id="https://dc.library.northwestern.edu/items/71153379-4283-43be-8b0f-4e7e3bfda275"
      onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        alert((e.target as HTMLElement).dataset.homepageId);
      }}
    />
  );
}
