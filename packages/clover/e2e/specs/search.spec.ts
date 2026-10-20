import { expect, type Page, test } from "@playwright/test";

import { manifest, SEARCH_V2, v2Pages } from "../../src/fixtures/search";
import { openPanel, serveIIIF } from "./fixtures";

/*
 * Content Search in the Viewer's information panel, over the search fixture's book: its
 * Manifest served as `https://search.test/book.json`, its service answering from the
 * fixture, and `?q=fail` failing at once, as an offline or rejected search does.
 */
async function open(page: Page, isMobile = false) {
  await serveIIIF(page);
  await page.route("https://search.test/book.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(
        manifest([{ id: SEARCH_V2, type: "SearchService2" }]),
      ),
    }),
  );
  await page.route(`${SEARCH_V2}**`, (route) => {
    const answer = (v2Pages as Record<string, unknown>)[route.request().url()];
    return route.fulfill({
      status: answer ? 200 : 500,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: answer ? JSON.stringify(answer) : "{}",
    });
  });
  await page.goto("/?content=https://search.test/book.json&panel=tabs");
  await openPanel(page, isMobile);
  await page.getByRole("tab", { name: "Search" }).click();
  const search = page.locator(".clover-content-search");
  await expect(search.getByRole("searchbox")).toBeVisible();
  return search;
}

async function find(page: Page, query: string) {
  const field = page.locator(".clover-content-search").getByRole("searchbox");
  await field.fill(query);
  await field.press("Enter");
}

test.describe("Search", () => {
  /*
   * WCAG 4.1.3: the status region is there, for assistive technology, before its first
   * message, so the message is read as a change to it. Hidden by `display: none` while
   * empty, it arrived with a fast failure's message, which is often not read.
   */
  test("keeps its status in the accessibility tree before the first search", async ({
    page,
    isMobile,
  }) => {
    const search = await open(page, isMobile);
    const status = search.getByRole("status");
    await expect(status).toHaveCount(1);
    await expect(status).toBeEmpty();
    // Out of sight, and out of the column's gap.
    const box = (await status.boundingBox())!;
    expect(box.width * box.height).toBeLessThanOrEqual(1);

    await find(page, "fail");
    await expect(status).toHaveText("The search could not be completed.");
    // Emptied again, it stays.
    await find(page, "");
    await expect(status).toHaveCount(1);
    await expect(status).toBeEmpty();
  });

  /* WCAG 1.4.1: the words a hit matched are bold, not only tinted. */
  test("marks the words matched in bold, and in the system's colors when forced", async ({
    page,
    isMobile,
  }) => {
    await open(page, isMobile);
    await find(page, "bird");
    const mark = page.locator(".clover-content-search-hit mark").first();
    await expect(mark).toHaveText("birds");
    const weight = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((element) => Number(getComputedStyle(element).fontWeight));
    expect(await weight(".clover-content-search-hit mark")).toBeGreaterThan(
      await weight("button.clover-content-search-hit"),
    );

    await page.emulateMedia({ forcedColors: "active" });
    const ground = await mark.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    // An opaque system color, not the tint that forced colors drop.
    expect(ground).toMatch(/^rgb\(/);
  });
});
