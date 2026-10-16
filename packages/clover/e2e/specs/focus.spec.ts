import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { type Locator, expect, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

const BOOK = "https://fixtures.test/0009-book-1.json";

const opacity = (locator: Locator) => () =>
  locator.evaluate((element) => getComputedStyle(element).opacity);

/*
 * The press that reaches the first view or the last leaves focus on the arrow that made
 * it (WCAG 2.4.3): it is `aria-disabled`, not `disabled`, which would drop focus to the
 * page. It is whole while focused, and shows disabled, faded, once focus leaves.
 */
test.describe("Arrows at the ends keep focus", () => {
  test("Pager: Next keeps focus at the last view, and a press there does nothing", async ({
    page,
  }) => {
    await serveIIIF(page);
    await page.goto(`/?scene=composed&content=${BOOK}`);
    const previous = page.locator("button.clover-pager-previous");
    const next = page.locator("button.clover-pager-next");
    const position = page.locator(".clover-pager-position");
    await expect(position).toHaveText(/Item 1 of 3/);
    await expect(previous).toHaveAttribute("aria-disabled", "true");

    await next.focus();
    await page.keyboard.press("Enter");
    await expect(position).toHaveText(/Item 2 of 3/);
    await page.keyboard.press("Enter");
    await expect(position).toHaveText(/Item 3 of 3/);
    await expect(next).toHaveAttribute("aria-disabled", "true");
    await expect(next).toBeFocused();
    await expect.poll(opacity(next)).toBe("1");

    await page.keyboard.press("Enter");
    await expect(position).toHaveText(/Item 3 of 3/);
    await expect(next).toBeFocused();

    // Focus leaves: it shows disabled, and Tab no longer stops on it.
    await page.keyboard.press("Shift+Tab");
    await expect(previous).toBeFocused();
    await expect.poll(opacity(next)).toBe("0.38");
    await page.keyboard.press("Tab");
    await expect(next).not.toBeFocused();
  });

  test("Pager: a pointer that reaches the first view shows Previous disabled", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "a mouse's press");
    await serveIIIF(page);
    await page.goto(`/?scene=composed&content=${BOOK}`);
    const previous = page.locator("button.clover-pager-previous");
    const next = page.locator("button.clover-pager-next");
    const position = page.locator(".clover-pager-position");
    await expect(position).toHaveText(/Item 1 of 3/);
    await next.click();
    await expect(position).toHaveText(/Item 2 of 3/);
    await previous.click();
    await expect(position).toHaveText(/Item 1 of 3/);
    await expect(previous).toHaveAttribute("aria-disabled", "true");
    await expect.poll(opacity(previous)).toBe("0.38");
    // It takes no pointer, so it never lights up under one.
    expect(
      await previous.evaluate(
        (element) => getComputedStyle(element).pointerEvents,
      ),
    ).toBe("none");
  });

  test("Items: the strip's Next keeps focus at the last item", async ({
    page,
  }) => {
    await serveIIIF(page);
    await page.goto(`/?content=${BOOK}`);
    const next = page.locator("button.clover-items-scroll-next");
    const selected = page.getByRole("option", { selected: true });
    await expect(selected).toBeVisible();
    const options = page.getByRole("option");

    await next.focus();
    await page.keyboard.press("Enter");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(options.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(next).toHaveAttribute("aria-disabled", "true");
    await expect(next).toBeFocused();
    await expect.poll(opacity(next)).toBe("1");

    await page.keyboard.press("Enter");
    await expect(options.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(next).toBeFocused();

    // Focus leaves: it shows disabled, as the pager's does, and takes no pointer.
    await page.keyboard.press("Shift+Tab");
    await expect(next).not.toBeFocused();
    await expect.poll(opacity(next)).toBe("0.38");
    expect(
      await next.evaluate((element) => getComputedStyle(element).pointerEvents),
    ).toBe("none");
  });
});

/*
 * Escape in a Canvas's menu closes the menu and hands focus to its control, and closes
 * nothing else: in the Gallery's Lightbox, a modal `<dialog>`, the dialog stays open
 * until the next Escape (WCAG 2.4.3).
 */
test.describe("Escape closes one thing at a time", () => {
  const TWO = "https://fixtures.test/two-choices.json";

  test("a Choice menu in the Lightbox closes, and the dialog stays open", async ({
    page,
  }) => {
    await serveIIIF(page);
    // 0033-choice twice over: Items lists one view as nothing to choose between.
    const choice = JSON.parse(
      readFileSync(
        resolve(__dirname, "../../src/fixtures/iiif-cookbook/0033-choice.json"),
        "utf8",
      ),
    );
    const second = JSON.parse(
      JSON.stringify(choice.items[0])
        .replaceAll("/p1", "/p2")
        .replaceAll("p0001", "p0002"),
    );
    await page.route(TWO, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          ...choice,
          id: TWO,
          items: [choice.items[0], second],
        }),
      }),
    );
    await page.goto(`/?scene=gallery&content=${TWO}`);

    const option = page.getByRole("option").first();
    await option.focus();
    await page.keyboard.press("Enter");
    const dialog = page.locator("dialog.clover-template-lightbox");
    await expect(dialog).toHaveJSProperty("open", true);

    const control = dialog.locator('[data-button="choice"]');
    await control.focus();
    await page.keyboard.press("Enter");
    const natural = dialog.getByRole("radio", { name: "Natural Light" });
    await expect(natural).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog.getByRole("radio")).toHaveCount(0);
    await expect(control).toBeFocused();
    await expect(dialog).toHaveJSProperty("open", true);

    // The next Escape is the dialog's, and focus goes back to the option.
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveJSProperty("open", false);
    await expect(option).toBeFocused();
  });
});
