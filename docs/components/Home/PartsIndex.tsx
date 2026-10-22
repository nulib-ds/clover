import Link from "next/link";
import React from "react";
import { docsIndex } from "docs/lib/agents";

/**
 * The parts, listed: each component and primitive by its page's title in the docs' menu,
 * with what the page says it does, linked to it (`docs/lib/agents.ts`). Drawn on the
 * server into the parts' section (`Parts.tsx`), out of sight, for a reader the live parts
 * have not reached: the page read without its scripts, or before they run (an agent, a
 * crawler, a screen reader early on; Mat, 2026-10-21). The live parts take its place once
 * they load. Its headings are one below the section's.
 */
export async function PartsIndex() {
  const { sections } = await docsIndex();
  return (
    <>
      {sections
        .filter(({ key }) => key === "components" || key === "primitives")
        .map((section) => (
          <React.Fragment key={section.key}>
            <h3>{section.title}</h3>
            <ul>
              {section.pages.map((page) => (
                <li key={page.route}>
                  <Link href={page.route}>{page.title}</Link>
                  {page.description && `: ${page.description}`}
                </li>
              ))}
            </ul>
          </React.Fragment>
        ))}
    </>
  );
}
