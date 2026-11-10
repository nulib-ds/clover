import { createRequire } from "node:module";

import { expect, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

const axePath = createRequire(__filename).resolve("axe-core/axe.min.js");

for (const scene of ["viewer", "document", "items"]) {
  test(`axe: no serious or critical violations in the ${scene}`, async ({
    page,
  }) => {
    await serveIIIF(page);
    await page.goto(
      `/?scene=${scene}&content=https://fixtures.test/0009-book-1.json`,
    );
    // The page's title: the Viewer's an h2, the items scene's an h1 (About's is lower).
    await expect(
      page.getByRole("heading", {
        level: scene === "items" ? 1 : 2,
        name: "Simple Manifest - Book",
      }),
    ).toBeVisible();
    await page.waitForTimeout(500);
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => {
      const result = await (window as any).axe.run(document, {
        resultTypes: ["violations"],
      });
      return result.violations
        .filter((v: any) => v.impact === "serious" || v.impact === "critical")
        .map((v: any) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n: any) => n.target.join(" ")).slice(0, 5),
        }));
    });
    expect(violations).toEqual([]);
  });
}

/*
 * Document's other states: a section open in its aside, the full viewer, a video's page,
 * and a phone with the thumbnails over the page.
 */
for (const [state, content, width, act] of [
  ["Document's aside", "0024-book-4-toc.json", 1280, "Contents"],
  ["Document's full viewer", "0024-book-4-toc.json", 1280, "+"],
  ["Document's video page", "0003-mvm-video.json", 1280, ""],
  [
    "Document's thumbnails on a phone",
    "0024-book-4-toc.json",
    375,
    "Show items",
  ],
] as const) {
  test(`axe: no serious or critical violations in ${state}`, async ({
    page,
  }) => {
    await serveIIIF(page);
    await page.setViewportSize({ width, height: 800 });
    await page.goto(
      `/?scene=document&content=https://fixtures.test/${content}`,
    );
    await page
      .locator(".clover-template-document-sheet[data-active]")
      .waitFor();
    if (act === "+") {
      await page
        .locator(".clover-template-document-live .clover-canvas-viewport")
        .focus();
      await page.keyboard.press("+");
    } else if (act === "Show items") {
      await page.getByRole("button", { name: /^Show items/ }).click();
    } else if (act) {
      await page
        .locator(".clover-template-document-toolbar")
        .getByRole("button", { name: act })
        .click();
    }
    await page.waitForTimeout(800);
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => {
      const result = await (window as any).axe.run(document, {
        resultTypes: ["violations"],
      });
      return result.violations
        .filter((v: any) => v.impact === "serious" || v.impact === "critical")
        .map((v: any) => ({
          id: v.id,
          nodes: v.nodes.map((n: any) => n.target.join(" ")).slice(0, 5),
        }));
    });
    expect(violations).toEqual([]);
  });
}
