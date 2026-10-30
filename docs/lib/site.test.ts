import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import {
  DESCRIPTION_MOST,
  earlierDescription,
  earlierTitle,
  homeDescription,
  isEarlierVersion,
  siteDescription,
  siteUrl,
  structuredData,
} from "docs/lib/site";

/*
 * Every page's description is what a search result shows under its title, and what
 * `llms.txt` says of it. These keep each one the page's own and short enough to show
 * whole, 3.x's with what they document after it (`earlierDescription`).
 */
const CONTENT = join(dirname(fileURLToPath(import.meta.url)), "../../content");

const pages = readdirSync(CONTENT, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".mdx"))
  .map((file) => {
    const source = readFileSync(join(CONTENT, file), "utf8");
    const matter = (parse(source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "") ??
      {}) as { description?: string; searchable?: boolean };
    const route =
      `/${file}`.replace(/\.mdx$/, "").replace(/\/index$/, "") || "/";
    return { file, route, matter };
  })
  // Search engines read the listed pages only: not the unlisted, nor the test mocks.
  .filter(
    ({ route, matter }) =>
      matter.searchable !== false && !route.startsWith("/test"),
  );

describe("page descriptions", () => {
  it("are read from every listed page", () => {
    expect(pages.length).toBeGreaterThan(50);
  });

  it.each(pages.filter(({ route }) => route !== "/"))(
    "$file has a description of its own",
    ({ matter }) => {
      expect(typeof matter.description).toBe("string");
    },
  );

  it.each(pages.filter(({ route }) => route !== "/"))(
    `$file's fits a search result (${DESCRIPTION_MOST} characters)`,
    ({ route, matter }) => {
      const text = isEarlierVersion(route)
        ? earlierDescription(matter.description)
        : (matter.description ?? "");
      expect(text.length).toBeLessThanOrEqual(DESCRIPTION_MOST);
    },
  );

  it("are each a page's own", () => {
    const seen = new Map<string, string>();
    for (const { file, matter } of pages) {
      if (!matter.description) continue;
      expect(seen.get(matter.description), file).toBeUndefined();
      seen.set(matter.description, file);
    }
  });

  it("fit for the homepage and the site's own", () => {
    expect(homeDescription.length).toBeLessThanOrEqual(DESCRIPTION_MOST);
    expect(siteDescription.length).toBeLessThanOrEqual(DESCRIPTION_MOST);
  });
});

describe("3.x pages", () => {
  it("say their version in their titles, once", () => {
    expect(earlierTitle("Slider")).toBe("Slider (3.x)");
    expect(earlierTitle("Slider (3.x)")).toBe("Slider (3.x)");
    expect(earlierTitle("Clover 3.x")).toBe("Clover 3.x");
  });

  it("open their descriptions with their own words", () => {
    expect(earlierDescription("Slider, a carousel.")).toMatch(
      /^Slider, a carousel\. Clover 3\.x/,
    );
    expect(earlierDescription()).toMatch(/^Clover 3\.x/);
  });
});

describe("structured data", () => {
  const data = structuredData({
    title: "Label",
    description: "A IIIF resource's label.",
    route: "/docs/primitives/label",
    trail: [{ name: "Primitives", route: "/docs/primitives" }],
  });
  const [article, breadcrumbs] = data["@graph"] as [
    { publisher: unknown },
    unknown,
  ];

  it("names the site's publisher on each page", () => {
    expect(article.publisher).toMatchObject({
      "@type": "Organization",
      name: "Northwestern University Libraries",
    });
  });

  it("gives breadcrumbs from the site, through the menu, to the page", () => {
    expect(breadcrumbs).toEqual({
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Clover IIIF",
          item: siteUrl,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Primitives",
          item: `${siteUrl}/docs/primitives`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Label",
          item: `${siteUrl}/docs/primitives/label`,
        },
      ],
    });
  });
});
