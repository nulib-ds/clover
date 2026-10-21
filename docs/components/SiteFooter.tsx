import Link from "next/link";
import React from "react";
import Logo from "docs/components/Logo";

/**
 * The site's footer, inside Nextra's (`app/layout.tsx`): what Clover is, where it came
 * from, who it thanks, and its license (Mat, 2026-10-20). Every fact is the record's:
 * the history from the repository's first commit (September 16, 2021) and npm's release
 * dates for `@samvera/clover-iiif` (1.x from February 2022, 2.0 in August 2023, 3.0 in
 * August 2025); the license and its holders from `LICENSE`. Styled in `layout.css`.
 */
export function SiteFooter() {
  return (
    <>
      <div className="site-footer-grid">
        <div className="site-footer-about">
          <Link href="/" className="site-footer-logo">
            <Logo />
          </Link>
          <p>
            An accessible, composable viewer for IIIF Manifests, Collections,
            and the material they describe. A project of{" "}
            <a href="https://www.library.northwestern.edu/">
              Northwestern University Libraries
            </a>
            .
          </p>
        </div>
        <section aria-labelledby="site-footer-history">
          <h2 id="site-footer-history">History</h2>
          <p>
            Clover began at Northwestern University Libraries in September 2021.
            Since February 2022 it has shipped as{" "}
            <code>@samvera/clover-iiif</code>, through versions 1, 2, and 3,
            with the Samvera community. Clover 4, <code>@nulib/clover</code>, is
            built anew: composable parts, and a renderer of its own.
          </p>
        </section>
        <section aria-labelledby="site-footer-thanks">
          <h2 id="site-footer-thanks">Acknowledgments</h2>
          <p>
            Thanks to everyone who has contributed to Clover, and to the IIIF
            and Samvera communities. Its examples draw on the IIIF Cookbook,
            Northwestern University Libraries&rsquo; Digital Collections,
            Wikimedia Commons, and other open collections.
          </p>
          <p>
            <a href="https://github.com/samvera-labs/clover-iiif/graphs/contributors">
              Contributors to Clover 3.x
            </a>
            {" · "}
            <a href="https://github.com/nulib-ds/clover/graphs/contributors">
              to Clover 4
            </a>
          </p>
        </section>
      </div>
      <div className="site-footer-legal">
        <p>
          MIT licensed, and fully open source. © 2025 Mat Jordan and Adam
          Arling.
        </p>
        <ul>
          <li>
            <a href="https://github.com/nulib-ds/clover">Source on GitHub</a>
          </li>
          <li>
            <a href="https://github.com/nulib-ds/clover/blob/main/LICENSE">
              License
            </a>
          </li>
          <li>
            <Link href="/docs/3.x">Clover 3.x</Link>
          </li>
        </ul>
      </div>
    </>
  );
}
