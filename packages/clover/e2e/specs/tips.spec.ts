import { expect, type Page, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

/*
 * WCAG 1.4.10 and 1.4.12: a control's popover (`ui/Tip.tsx`) is the only visible name
 * of an icon, so none is cut off by the stage, at any width, with a reader's own text
 * spacing. Text spacing widens each by about a quarter, which pushed the ends of a wrapped
 * cluster row past the stage at 600 and 768 CSS px.
 */

/** WCAG 1.4.12's spacing, as its Understanding document's bookmarklet sets it. */
const SPACING = `
  * {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  p { margin-bottom: 2em !important; }
`;

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/*
 * The popover of each control on the stage, measured as it shows on keyboard focus. (By
 * pointer, a wrapped row's popovers hang over the row under it; the unit tests cover the
 * pointer's way in, `ui/Tip.test.tsx`.)
 */
async function tipsOver(page: Page) {
  const controls = page.locator(".clover-canvas-controls > button");
  await expect(controls.first()).toBeVisible();
  const seen: { name: string; tip: Box; cut: boolean }[] = [];
  for (const control of await controls.all()) {
    if (!(await control.isVisible())) continue;
    await control.focus();
    const tip = control.locator("> .clover-tip");
    await expect(tip).toBeVisible();
    seen.push(
      await tip.evaluate((element) => {
        const { left, right, top, bottom } = element.getBoundingClientRect();
        // Its words fit inside its own box: wrapped, not overflowing it.
        const range = document.createRange();
        range.selectNodeContents(element);
        const words = range.getBoundingClientRect();
        return {
          name: element.textContent ?? "",
          tip: { left, right, top, bottom },
          cut: words.left < left - 0.5 || words.right > right + 0.5,
        };
      }),
    );
  }
  return seen;
}

async function stageOf(page: Page): Promise<Box> {
  return page
    .locator(".clover-canvas")
    .first()
    .evaluate((element) => {
      const { left, right, top, bottom } = element.getBoundingClientRect();
      return { left, right, top, bottom };
    });
}

for (const spaced of [false, true]) {
  for (const width of [1280, 768, 600, 375, 320]) {
    test(`popovers stay inside the stage at ${width} CSS px${spaced ? ", text spaced" : ""}`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, "a phone's own width");
      await page.setViewportSize({ width, height: 900 });
      await serveIIIF(page);
      await page.goto("/?content=https://fixtures.test/0009-book-1.json");
      if (spaced) await page.addStyleTag({ content: SPACING });
      await expect(page.locator(".clover-canvas").first()).toHaveAttribute(
        "data-status",
        "ready",
      );
      const stage = await stageOf(page);
      const tips = await tipsOver(page);
      expect(tips.length).toBeGreaterThan(3);
      for (const { name, tip, cut } of tips) {
        expect(tip.left, name).toBeGreaterThanOrEqual(stage.left);
        expect(tip.right, name).toBeLessThanOrEqual(stage.right);
        expect(cut, name).toBe(false);
      }
    });
  }
}

/*
 * A name too long for the room wraps, rather than running past the stage: here the
 * stage is narrowed until no name fits on one line beside the controls.
 */
test("a popover wider than its room wraps inside the stage", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "a phone's own width");
  await page.setViewportSize({ width: 320, height: 900 });
  await serveIIIF(page);
  await page.goto("/?content=https://fixtures.test/0009-book-1.json");
  await page.addStyleTag({
    content: `${SPACING} .clover-tip { font-size: 2rem !important; }`,
  });
  await expect(page.locator(".clover-canvas").first()).toHaveAttribute(
    "data-status",
    "ready",
  );
  const stage = await stageOf(page);
  const tips = await tipsOver(page);
  let wrapped = 0;
  for (const { name, tip, cut } of tips) {
    expect(tip.left, name).toBeGreaterThanOrEqual(stage.left);
    expect(tip.right, name).toBeLessThanOrEqual(stage.right);
    expect(cut, name).toBe(false);
    if (tip.bottom - tip.top > 60) wrapped++;
  }
  expect(wrapped).toBeGreaterThan(0);
});
