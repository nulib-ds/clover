import { expect, type Page, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

/*
 * A Collection of three books, served as `https://collection.test/shelf.json`: its
 * members' titles long, with the words that tell them apart (a volume, a year) last.
 */
const SHELF = "https://collection.test/shelf.json";
const MEMBERS = [
  ["0009-book-1", "Simple Manifest - Book"],
  [
    "0010-book-2-viewing-direction-rtl",
    "Book with Right-to-Left Viewing Direction",
  ],
  ["0011-book-3-behavior-individuals", /^\[Conoximent de las orines\]/],
] as const;
const titleOf = (index: number) =>
  `Letters and papers of the family, gathered from the attic at Evanston, volume ${index + 1}, 1896`;

async function open(page: Page, query = "") {
  await serveIIIF(page);
  await page.route(SHELF, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        "@context": "http://iiif.io/api/presentation/3/context.json",
        id: SHELF,
        type: "Collection",
        label: { en: ["The family papers"] },
        items: MEMBERS.map(([name], index) => ({
          id: `https://fixtures.test/${name}.json`,
          type: "Manifest",
          label: { en: [titleOf(index)] },
        })),
      }),
    }),
  );
  await page.goto(`/?content=${SHELF}${query}`);
}

/** WCAG 1.4.12's spacing, as its Understanding document's bookmarklet sets it. */
const SPACING = `
  * {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  p { margin-bottom: 2em !important; }
`;

test.describe("A Collection", () => {
  /*
   * WCAG 3.2.2: Windows and Linux browsers fire `change` for each arrow key on a closed
   * select, so stepping through the menu must not load each member it passes. Enter
   * makes the choice.
   */
  test("menu loads a member on Enter, not on each arrow key", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "webkit" || process.platform === "darwin",
      "an arrow key opens the menu's own list here, which the page does not see",
    );
    await open(page, "&scene=collection");
    const title = page.locator("h1.clover-label");
    await expect(title).toHaveText(MEMBERS[0][1]);
    const menu = page.getByRole("combobox", { name: "The family papers" });
    await menu.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(menu).toHaveValue(
      `https://fixtures.test/${MEMBERS[2][0]}.json`,
    );
    // The work shown stays the same while the reader steps through.
    await page.waitForTimeout(500);
    await expect(title).toHaveText(MEMBERS[0][1]);

    await page.keyboard.press("Enter");
    await expect(title).toHaveText(MEMBERS[2][1]);
    await expect(menu).toBeFocused();
  });

  /*
   * WCAG 2.4.3: Tab after a step takes the step back rather than loading it. Loaded once
   * focus had moved on, a Manifest could take away the control focus went to (Download,
   * after the menu, for a Manifest with no renderings), and leave focus on the page.
   */
  test("menu takes a step back on Tab, and loads nothing", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "webkit" || process.platform === "darwin",
      "an arrow key opens the menu's own list here, which the page does not see",
    );
    await open(page, "&scene=collection");
    const title = page.locator("h1.clover-label");
    await expect(title).toHaveText(MEMBERS[0][1]);
    const menu = page.getByRole("combobox", { name: "The family papers" });
    await menu.focus();
    await page.keyboard.press("ArrowDown");
    await expect(menu).toHaveValue(
      `https://fixtures.test/${MEMBERS[1][0]}.json`,
    );
    await page.keyboard.press("Tab");
    await expect(menu).not.toBeFocused();
    await expect(menu).toHaveValue(
      `https://fixtures.test/${MEMBERS[0][0]}.json`,
    );
    await page.waitForTimeout(500);
    await expect(title).toHaveText(MEMBERS[0][1]);
    expect(
      await page.evaluate(() => document.activeElement !== document.body),
    ).toBe(true);
  });

  /*
   * WCAG 4.1.3: the Status's region stays, empty, once ready, so the next load's words
   * arrive in a region already there, and are read as a change.
   */
  test("announces each load in the one status region", async ({ page }) => {
    await open(page, "&scene=collection");
    const title = page.locator("h1.clover-label");
    await expect(title).toHaveText(MEMBERS[0][1]);
    const status = page.locator(".clover-status[role='status']");
    await expect(status).toHaveCount(1);
    await expect(status).toBeEmpty();
    // Every message it is given, and whether it is still the same element.
    await status.evaluate((element) => {
      const heard: string[] = [];
      (window as any).__heard = heard;
      new MutationObserver(() => {
        if (element.textContent) heard.push(element.textContent);
      }).observe(element, { childList: true, subtree: true });
      element.setAttribute("data-probe", "");
    });
    await page
      .getByRole("combobox", { name: "The family papers" })
      .selectOption(`https://fixtures.test/${MEMBERS[1][0]}.json`);
    await expect(title).toHaveText(MEMBERS[1][1]);
    expect(await page.evaluate(() => (window as any).__heard)).toContain(
      "Loading…",
    );
    await expect(page.locator(".clover-status[data-probe]")).toBeEmpty();
    await expect(status).toHaveCount(1);
  });

  /*
   * WCAG 1.4.10 and 1.4.12: a member's title wraps, in full, never cut short, at
   * 320 CSS px and with a reader's own text spacing.
   */
  for (const spaced of [false, true]) {
    test(`members' titles wrap, in full${spaced ? ", text spaced" : ""}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await open(page, "&panel=tabs");
      if (spaced) await page.addStyleTag({ content: SPACING });
      // On a phone the panel is over the stage: opened by its toggle.
      const toggle = page.locator('.clover-canvas [data-button="panel"]');
      if ((await toggle.getAttribute("aria-expanded")) !== "true")
        await toggle.click();
      await page.getByRole("tab", { name: "Collection" }).click();
      const labels = page.locator(".clover-collection .clover-items-label");
      await expect(labels).toHaveCount(MEMBERS.length);
      for (const [index, label] of (await labels.all()).entries()) {
        await expect(label).toHaveText(titleOf(index));
        const shown = await label.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const words = range.getBoundingClientRect();
          const box = element.getBoundingClientRect();
          return {
            inside:
              words.right <= box.right + 0.5 &&
              words.bottom <= box.bottom + 0.5,
            tall: box.height,
            overflow: getComputedStyle(element).textOverflow,
          };
        });
        expect(shown.inside, titleOf(index)).toBe(true);
        expect(shown.overflow).not.toBe("ellipsis");
        // Too long for one line beside its thumbnail: it takes more.
        expect(shown.tall).toBeGreaterThan(40);
      }
    });
  }
});
