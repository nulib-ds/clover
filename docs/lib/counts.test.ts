import { readdirSync } from "node:fs";
import { join } from "node:path";
import docsMenu from "content/docs/_meta";
import primitivesMenu from "content/docs/primitives/_meta";
import {
  componentNames,
  partCount,
  primitiveNames,
} from "docs/components/Home/counts";

/*
 * The homepage counts the parts from the docs' menus (`counts.ts`): "See all … components"
 * and the figures agents read (`figures.ts`). Nextra still shows a page its folder's
 * `_meta.ts` leaves out, so a part's page added without its menu entry would be on the
 * site and not in the count. These keep every page in its menu, so the count follows the
 * pages as parts are added and removed (Mat, 2026-10-25).
 */
const pagesIn = (folder: string) =>
  readdirSync(join(process.cwd(), folder), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.name.endsWith(".mdx"))
    .map((entry) => entry.name.replace(/\.mdx$/, ""));

describe("the parts' count", () => {
  it("lists every docs page in the docs menu", () => {
    const listed = Object.keys(docsMenu);
    expect(
      pagesIn("content/docs").filter((page) => !listed.includes(page)),
    ).toEqual([]);
  });

  it("lists every primitive's page in the primitives menu, and no more", () => {
    const pages = pagesIn("content/docs/primitives").filter(
      (page) => page !== "index",
    );
    expect(Object.keys(primitivesMenu).sort()).toEqual(pages.sort());
  });

  it("counts the Components menu's parts and every primitive", () => {
    expect(componentNames).toContain("Body");
    expect(componentNames).not.toContain("Primitives");
    expect(primitiveNames).toContain("Label");
    expect(partCount).toBe(componentNames.length + primitiveNames.length);
  });
});
