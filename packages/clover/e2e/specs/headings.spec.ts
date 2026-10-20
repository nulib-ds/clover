import { createRequire } from "node:module";

import { expect, type Page, test } from "@playwright/test";

import { manifestOf, openPanel, serveIIIF } from "./fixtures";

/*
 * A Markdown annotation in the Viewer's panel (WCAG 1.3.1): its lists are lists and its
 * headings headings, nested under the panel's own, as the browser itself reads them once
 * DOMPurify has run in it, and its names carry none of its syntax (2.4.6). JSDOM has
 * neither the browser's sanitizing nor its layout.
 */

const axePath = createRequire(__filename).resolve("axe-core/axe.min.js");

const NOTES = "https://fixtures.test/markdown-notes.json";

/** One Canvas, with a page of notes written in Markdown, skipping a heading level. */
function notes() {
  const manifest = manifestOf(1) as Record<string, any>;
  const canvas = manifest.items[0];
  canvas.annotations = [
    {
      id: `${canvas.id}/notes`,
      type: "AnnotationPage",
      label: { en: ["Notes"] },
      items: [
        {
          id: `${canvas.id}/notes/1`,
          type: "Annotation",
          motivation: "commenting",
          body: {
            type: "TextualBody",
            format: "text/markdown",
            value: [
              "## Sources",
              "",
              "- A letter of 1849",
              "- The *Gazette*",
              "",
              "#### Readings",
              "",
              "3. Third",
              "4. Fourth",
            ].join("\n"),
          },
          target: `${canvas.id}#xywh=0,0,100,100`,
        },
      ],
    },
  ];
  return { ...manifest, id: NOTES, label: { en: ["Annotated page"] } };
}

async function open(page: Page, isMobile = false) {
  await serveIIIF(page);
  // Registered last, so it answers before the fixtures' own route.
  await page.route(NOTES, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(notes()),
    }),
  );
  await page.goto(`/?scene=viewer&content=${encodeURIComponent(NOTES)}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Annotated page" }),
  ).toBeVisible();
  await openPanel(page, isMobile);
  await page
    .locator(".clover-panel")
    .getByRole("button", { name: "Annotations" })
    .click();
}

test("a Markdown note's headings nest under the panel's, its lists are lists", async ({
  page,
  isMobile,
}) => {
  await open(page, isMobile);
  // The title h2, the panel's sections h3, the set's title h4, the note's own under it.
  await expect(
    page.getByRole("heading", { level: 3, name: "Annotations" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 4, name: "Notes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 5, name: "Sources" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 6, name: "Readings" }),
  ).toBeVisible();

  const body = page.locator(".clover-annotations-text");
  await expect(body.locator("ul > li")).toHaveCount(2);
  await expect(body.locator("ol")).toHaveAttribute("start", "3");
  await expect(body.locator("ol > li")).toHaveCount(2);

  // Flush with the note's paragraphs; markers in the scale's `l`.
  const list = await body.locator("ul").evaluate((ul) => {
    const style = getComputedStyle(ul);
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return {
      margin: parseFloat(style.marginTop) + parseFloat(style.marginBottom),
      indent: parseFloat(style.paddingInlineStart) / rem,
    };
  });
  expect(list.margin).toBe(0);
  expect(list.indent).toBeCloseTo(1.618, 2);
  // Their markers are drawn, the bullets a list's own though each entry is an item.
  await expect(body.locator("ul")).toHaveCSS("list-style-type", "disc");
  await expect(body.locator("ol")).toHaveCSS("list-style-type", "decimal");

  // Named by its text, without Markdown's syntax: the entry's button and the hotspot.
  const text = "Sources A letter of 1849 The Gazette Readings Third Fourth";
  await expect(page.locator(".clover-annotations-show")).toHaveAccessibleName(
    `Find on the image: ${text}`,
  );
  await expect(page.locator(".clover-canvas-annotation")).toHaveAccessibleName(
    text,
  );

  // Axe's rules for headings and lists, at every impact.
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const result = await (window as any).axe.run(".clover-annotations", {
      runOnly: [
        "aria-allowed-role",
        "aria-valid-attr-value",
        "empty-heading",
        "heading-order",
        "list",
        "listitem",
      ],
      resultTypes: ["violations"],
    });
    return result.violations.map((v: any) => v.id);
  });
  expect(violations).toEqual([]);
});

test("Chromium's own accessibility tree reads the note's headings and lists", async ({
  page,
  isMobile,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "The tree is read over Chromium's CDP.",
  );
  await open(page, isMobile);
  await expect(
    page.getByRole("heading", { level: 5, name: "Sources" }),
  ).toBeVisible();
  const client = await page.context().newCDPSession(page);
  const { nodes } = (await client.send("Accessibility.getFullAXTree")) as {
    nodes: Array<{
      role?: { value: string };
      name?: { value: string };
      properties?: Array<{ name: string; value: { value: unknown } }>;
    }>;
  };
  const heading = (name: string) =>
    nodes.find(
      (node) => node.role?.value === "heading" && node.name?.value === name,
    );
  const level = (name: string) =>
    heading(name)?.properties?.find((property) => property.name === "level")
      ?.value.value;
  expect(level("Sources")).toBe(5);
  expect(level("Readings")).toBe(6);
  // The entry's button, named by the note's text and none of its syntax.
  const names = nodes
    .filter((node) => node.role?.value === "button")
    .map((node) => node.name?.value.replace(/\s+/g, " "));
  expect(names).toContain(
    "Find on the image: Sources A letter of 1849 The Gazette Readings Third Fourth",
  );
  // The note's two lists, beside the panel's own list of annotations.
  expect(
    nodes.filter((node) => node.role?.value === "list").length,
  ).toBeGreaterThanOrEqual(3);
});
