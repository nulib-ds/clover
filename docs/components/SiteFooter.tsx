import Link from "next/link";
import React from "react";
import Logo from "docs/components/Logo";

/**
 * The site's footer, inside Nextra's (`app/layout.tsx`): what Clover is, in the homepage
 * hero's words; whose project it is, who developed it and who contributed, in Mat's
 * words, its "more" linking to everyone the repository records; and its license (Mat,
 * 2026-10-20 and 2026-10-21). Every fact is the record's: the license and its holder
 * from `LICENSE`. Styled in `layout.css`.
 */
export function SiteFooter() {
  return (
    <>
      <div className="site-footer-about">
        <Link href="/" className="site-footer-logo">
          <Logo />
        </Link>
        {/* The homepage hero's words, at their size there, a sentence a line. */}
        <p className="site-footer-lede">
          <span>A viewer as distinctive as your collections.</span>{" "}
          <span>
            Design the user experience that you imagine for your IIIF resources.
          </span>
        </p>
        <p>
          A project of{" "}
          <a href="https://www.library.northwestern.edu/">
            Northwestern University Libraries
          </a>
          . Clover was developed by Mat Jordan, Adam Arling, and others at
          Northwestern University Libraries. With community contributions from
          others at Princeton University, UNC Chapel Hill, University of
          Pennsylvania, Cogapp, and{" "}
          <a href="https://github.com/nulib-ds/clover/graphs/contributors">
            more
          </a>
          .
        </p>
      </div>
      <div className="site-footer-legal">
        <p>
          MIT licensed, and fully open source. © 2026 Northwestern University
          Libraries.
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
