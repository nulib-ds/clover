"use client";

import { usePathname } from "next/navigation";

/**
 * The line under the navbar: whose project Clover is, on the homepage only (Mat,
 * 2026-10-22: not on interior pages, whose footer says it). It scrolls away with the page
 * while the navbar stays held (the root layout's `navbar` renders it after Nextra's
 * navbar, outside the navbar's sticky box). Each page is drawn with its own path, so the
 * static export holds it in the homepage's HTML alone. Styled in `docs/styles/layout.css`.
 */
const Subheader = () => {
  if (usePathname() !== "/") return null;
  return (
    <div className="site-subheader">
      <p>
        Clover is a project of{" "}
        <a href="https://www.library.northwestern.edu/">
          Northwestern University Libraries
        </a>
        .
      </p>
    </div>
  );
};

export default Subheader;
