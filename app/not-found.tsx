import type { Metadata } from "next";

import { Moved } from "docs/components/Moved";
import { pageMetadata } from "docs/lib/site";

/*
 * The static export writes this as `404.html`, which GitHub Pages serves for any missing
 * path: a page that moved is sent on from here (`docs/components/Moved.tsx`).
 */
export const metadata: Metadata = pageMetadata({
  title: "Page not found",
  route: "/404",
});

export default function NotFound() {
  return (
    // The skip link's target, as a page's article is.
    <main
      id="nextra-skip-nav"
      style={{
        width: "100%",
        maxWidth: "var(--nextra-content-width)",
        margin: "0 auto",
        paddingInline: "1.5rem",
      }}
    >
      <Moved />
    </main>
  );
}
