"use client";

/*
 * No "Last updated" line under a page (Mat, 2026-10-21): the date is kept for crawlers
 * and agents instead, in the page's structured data (`dateModified`) and Open Graph
 * (`article:modified_time`), from the same last commit (`app/[[...mdxPath]]/page.tsx`).
 * Nextra takes a component here and clones it on the client, so this one is a client
 * component that draws nothing (a server one would reach the client as nothing at all).
 */
export function NoLastUpdated() {
  return null;
}
