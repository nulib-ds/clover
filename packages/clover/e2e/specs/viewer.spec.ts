import { expect, test } from "@playwright/test";

import { book, encodeContentState, serveIIIF } from "./fixtures";

test.describe("Viewer", () => {
  test("opens a paged book, steps by spread, and keeps the pager and items in step", async ({
    page,
  }) => {
    await serveIIIF(page);
    await page.goto("/?content=https://fixtures.test/0009-book-1.json");
    await expect(
      page.getByRole("heading", { name: "Simple Manifest - Book" }),
    ).toBeVisible();
    const position = page.locator(".clover-pager-position");
    await expect(position).toHaveText(/Item 1 of 3/);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(position).toHaveText(/Item 2 of 3/);
    await expect(page.getByRole("option", { selected: true })).toContainText(
      /Frontispiece/,
    );
    await expect(page.locator(".clover-canvas")).toHaveAttribute(
      "data-status",
      /ready|loading/,
    );
  });

  test("the controls fade while the information panel is open", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "needs a pointer that can leave");
    await serveIIIF(page);
    await page.goto("/?content=https://fixtures.test/0009-book-1.json");
    // Open, the panel's toggle is on the spine, beside the Canvas, not in its cluster.
    const toggle = page.locator(
      '.clover-template-default-spine [data-button="panel"]',
    );
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    // Each control fades on its own; the panel's toggle never does.
    const zoom = page.locator(
      '.clover-canvas-controls > [data-button="zoom-in"]',
    );
    const opacity = () => zoom.evaluate((el) => getComputedStyle(el).opacity);

    const figure = await page.locator(".clover-canvas").boundingBox();
    await page.mouse.move(
      figure!.x + figure!.width / 2,
      figure!.y + figure!.height / 2,
    );
    await expect.poll(opacity).toBe("1");
    // Away from the Canvas: it lingers a second, then fades, panel open or not.
    await page.mouse.move(
      figure!.x + figure!.width / 2,
      figure!.y + figure!.height + 200,
    );
    await expect.poll(opacity, { timeout: 5000 }).toBe("0");
    expect(await toggle.evaluate((el) => getComputedStyle(el).opacity)).toBe(
      "1",
    );
  });

  test("a control under a resting pointer stays, Tip and all (WCAG 1.4.13)", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "needs a pointer that can rest");
    await serveIIIF(page);
    await page.goto("/?content=https://fixtures.test/0009-book-1.json");
    await expect(
      page.locator('.clover-template-default-spine [data-button="panel"]'),
    ).toHaveAttribute("aria-expanded", "true");
    const zoom = page.locator(
      '.clover-canvas-controls > [data-button="zoom-in"]',
    );
    const opacity = () => zoom.evaluate((el) => getComputedStyle(el).opacity);
    const figure = await page.locator(".clover-canvas").boundingBox();
    await page.mouse.move(
      figure!.x + figure!.width / 2,
      figure!.y + figure!.height / 2,
    );
    await expect.poll(opacity).toBe("1");

    // Resting on the control, well past the hide delay: it and its Tip stay.
    const box = await zoom.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.waitForTimeout(3000);
    expect(await opacity()).toBe("1");
    await expect(zoom.locator(".clover-tip")).toBeVisible();

    // Back on the picture, the controls fade as before.
    await page.mouse.move(
      figure!.x + figure!.width / 2,
      figure!.y + figure!.height / 2,
    );
    await expect.poll(opacity, { timeout: 5000 }).toBe("0");
  });

  test("reads right to left: the strip runs leftward, Previous on the right", async ({
    page,
  }) => {
    await serveIIIF(page);
    await page.goto(
      "/?content=https://fixtures.test/0010-book-2-viewing-direction-rtl.json",
    );
    const previous = page.getByRole("button", { name: "Previous" });
    const next = page.getByRole("button", { name: "Next" });
    await expect(next).toBeVisible();
    // Previous, at the strip's start, is on its right in a right-to-left book.
    const [p, n] = [await previous.boundingBox(), await next.boundingBox()];
    expect(p!.x).toBeGreaterThan(n!.x);
  });

  test("opens a content state link at its Canvas", async ({ page }) => {
    await serveIIIF(page);
    const state = encodeContentState({
      "@context": "http://iiif.io/api/presentation/3/context.json",
      type: "Annotation",
      motivation: ["contentState"],
      target: {
        id: book.items[2].id,
        type: "Canvas",
        partOf: [
          { id: "https://fixtures.test/0009-book-1.json", type: "Manifest" },
        ],
      },
    });
    await page.goto(`/?content=${state}`);
    await expect(page.locator(".clover-pager-position")).toHaveText(
      /Item 2 of 3/,
    );
  });
});
