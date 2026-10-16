import { type Page, expect, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

/*
 * A phone: WebKit at iPhone size, with touch (the `iphone` project). Playwright's WebKit
 * is the desktop engine, so iPhone-only behavior (full screen for a video alone, HLS
 * through the system player) is covered by unit tests; this covers layout and touch.
 */
test.beforeEach(({ isMobile }) => {
  test.skip(!isMobile, "phone only");
});

const region = (page: Page) =>
  page.evaluate(() => (window as any).__viewport?.region ?? null);

/** How much of the Canvas shows: zooming in shows less. */
const area = async (page: Page) => {
  const { w, h } = await region(page);
  return w * h;
};

/** Two touch pointers, moved apart (or together) across the middle of `element`. */
async function pinch(page: Page, selector: string, from: number, to: number) {
  await page.locator(selector).evaluate(
    (element, { from, to }) => {
      // Synthetic pointers are not active ones, so the browser refuses to capture them.
      Element.prototype.setPointerCapture = () => {};
      Element.prototype.releasePointerCapture = () => {};
      const box = element.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const fire = (type: string, id: number, x: number) =>
        element.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: id,
            pointerType: "touch",
            isPrimary: id === 1,
            clientX: x,
            clientY: cy,
            button: 0,
            buttons: type === "pointerup" ? 0 : 1,
          }),
        );
      fire("pointerdown", 1, cx - from);
      fire("pointerdown", 2, cx + from);
      for (let step = 1; step <= 10; step++) {
        const half = from + ((to - from) * step) / 10;
        fire("pointermove", 1, cx - half);
        fire("pointermove", 2, cx + half);
      }
      fire("pointerup", 1, cx - to);
      fire("pointerup", 2, cx + to);
    },
    { from, to },
  );
}

test("the Viewer fits a phone: no sideways scroll, and the pager taps", async ({
  page,
}) => {
  await serveIIIF(page);
  await page.goto("/?content=https://fixtures.test/0009-book-1.json");
  await expect(
    page.getByRole("heading", { name: "Simple Manifest - Book" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Next" }).tap();
  await expect(page.locator(".clover-pager-position")).toHaveText(
    /Item 2 of 3/,
  );
});

test("a pinch zooms the Canvas in, and back out", async ({ page }) => {
  await serveIIIF(page);
  await page.goto(
    "/?scene=composed&content=https://fixtures.test/0009-book-1.json",
  );
  await expect(page.locator(".clover-canvas")).toHaveAttribute(
    "data-status",
    "ready",
  );
  await expect.poll(() => region(page)).not.toBeNull();
  const before = await area(page);

  await pinch(page, ".clover-canvas-viewport", 30, 120);
  await expect.poll(() => area(page)).toBeLessThan(before * 0.5);

  await pinch(page, ".clover-canvas-viewport", 120, 30);
  await expect.poll(() => area(page)).toBeGreaterThan(before * 0.8);
});

test("the transport's bar wraps onto two rows, every control on the stage", async ({
  page,
}) => {
  await serveIIIF(page);
  await page.goto("/?content=https://fixtures.test/0026-toc-opera.json");
  const bar = page.locator(".clover-canvas-transport-bar");
  await expect(bar).toHaveCount(1);
  const layout = await bar.evaluate((el) => {
    const figure = el.closest(".clover-canvas")!.getBoundingClientRect();
    const shown = [...el.children].filter(
      (child) => getComputedStyle(child).display !== "none",
    );
    // A row's parts are centred on one line.
    const rows = new Set(
      shown.map((child) => {
        const b = child.getBoundingClientRect();
        return Math.round((b.top + b.bottom) / 2);
      }),
    );
    return {
      rows: rows.size,
      // The time and chapter over the buttons, and nothing off the stage.
      inside: shown.every((child) => {
        const b = child.getBoundingClientRect();
        return b.left >= figure.left - 0.5 && b.right <= figure.right + 0.5;
      }),
    };
  });
  expect(layout.rows).toBe(2);
  expect(layout.inside).toBe(true);
});
