import Link from "next/link";
import React from "react";
import Logo from "docs/components/Logo";
import { ThemeSwitch } from "docs/components/ThemeSwitch";
import { homeHeadline, homeTagline } from "docs/lib/site";

/* When Clover's development began, and the version these docs are for (Mat, 2026-10-21). */
const SINCE = 2021;
const VERSION = "version 4.x";

/**
 * The site's footer, inside Nextra's (`app/layout.tsx`): what Clover is, in the homepage
 * hero's words; whose project it is, since when, and how widely it is used and built on,
 * by institution and not by person, who are credited elsewhere, its maturity shown, not
 * claimed (Mat, 2026-10-21), its "more" linking to everyone the repository records; and
 * its license, with the site's links and its appearance (Mat, 2026-10-20 and
 * 2026-10-21). Every fact is the record's: the license and its holder from `LICENSE`.
 * Styled in `layout.css`.
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
          <span>{homeHeadline}</span> <span>{homeTagline}</span>
        </p>
        <p>
          Clover is a project of Academic Innovation at{" "}
          <a href="https://www.library.northwestern.edu/">
            Northwestern University Libraries
          </a>
          . Developed since {SINCE}, now at {VERSION}, it is used in a variety
          of implementations, with contributions from folks at Princeton
          University, Texas A&amp;M University, UNC Chapel Hill, University of
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
        <div className="site-footer-links">
          <ul>
            <li>
              <a href="https://github.com/nulib-ds/clover">Code</a>
            </li>
            {/* Clover's channel on IIIF's Slack (Mat, 2026-10-22). */}
            <li>
              <a href="https://iiif.slack.com/archives/C090ZBQCL77">Slack</a>
            </li>
            <li>
              <a href="https://github.com/nulib-ds/clover/blob/main/LICENSE">
                License
              </a>
            </li>
          </ul>
          {/* After the links, not among them: a control, not a page. */}
          <ThemeSwitch />
        </div>
      </div>
    </>
  );
}
