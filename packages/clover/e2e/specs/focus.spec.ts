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
 * nothing else: in the Gallery's Lightbox, a modal `dialog` within the Gallery, the
 * dialog stays open until the next Escape (WCAG 2.4.3).
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
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const control = dialog.locator('[data-button="choice"]');
    await control.focus();
    await page.keyboard.press("Enter");
    const natural = dialog.getByRole("radio", { name: "Natural Light" });
    await expect(natural).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog.getByRole("radio")).toHaveCount(0);
    await expect(control).toBeFocused();
    await expect(dialog).toBeVisible();

    // Back on its control, the keyboard shows its popover: the next Escape puts that
    // away alone (WCAG 1.4.13), and the one after is the dialog's, focus going back to
    // the option.
    await page.keyboard.press("Escape");
    await expect(control).toHaveAttribute("data-tip-hidden", "");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(option).toBeFocused();
  });
});

/*
 * The Gallery's Lightbox is modal within the Gallery (`aria-modal`): Tab from its last
 * stop comes round to its first, and Shift+Tab the other way, so the keyboard never
 * leaves it for the page, which a screen reader hides meanwhile (WCAG 2.4.3).
 */
test("Tab comes round inside the Gallery's Lightbox, either way", async ({
  page,
}) => {
  await serveIIIF(page);
  await page.goto(
    "/?scene=gallery&content=https://fixtures.test/0009-book-1.json",
  );
  await page.getByRole("option").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const inside = () =>
    dialog.evaluate((node) => node.contains(document.activeElement));
  for (let press = 0; press < 24; press++) {
    await page.keyboard.press("Tab");
    expect(await inside()).toBe(true);
  }
  for (let press = 0; press < 24; press++) {
    await page.keyboard.press("Shift+Tab");
    expect(await inside()).toBe(true);
  }
});

/*
 * On a window too short for its title, Body, strip and caption (320 × 256, a page at
 * 400%), the Lightbox scrolls them, and its Body keeps room for its controls (WCAG
 * 1.4.10): it collapsed to a few pixels when the panel only took the window's height.
 */
test("on a short window the Lightbox scrolls rather than crushing its Body", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 256 });
  await serveIIIF(page);
  await page.goto(
    "/?scene=gallery&content=https://fixtures.test/0009-book-1.json",
  );
  await page.getByRole("option").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const body = dialog.locator(".clover-template-lightbox-body").first();
  await expect(body).toBeVisible();
  // Read once its view, which loads apart, has laid out.
  await expect
    .poll(async () => (await body.boundingBox())!.height)
    .toBeGreaterThan(120);
  // The panel scrolls, and what it holds is reached by scrolling to it.
  await expect
    .poll(() =>
      dialog.evaluate((node) => node.scrollHeight > node.clientHeight),
    )
    .toBe(true);
  const close = dialog.getByRole("button", { name: "Close" });
  await close.scrollIntoViewIfNeeded();
  await expect(close).toBeInViewport();
});

/*
 * The first time a Canvas's row stops fitting (the window narrowed, the page zoomed),
 * its view's controls go behind More, whose code loads only then: focus on one of them is
 * handed on once they have moved, never dropped to the page (WCAG 2.4.3).
 */
test("focus on a view control survives its row's first overflow", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "a phone's own width");
  await page.setViewportSize({ width: 1280, height: 800 });
  await serveIIIF(page);
  await page.goto("/?content=https://fixtures.test/0009-book-1.json");
  const zoom = page.getByRole("button", { name: "Zoom in", exact: true });
  await expect(zoom).toBeVisible();
  await zoom.focus();
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(
    page.getByRole("button", { name: "Expand viewer controls" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const active = document.activeElement;
        return Boolean(
          active &&
            active !== document.body &&
            active.closest(".clover-canvas-controls") &&
            !active.closest("[hidden]"),
        );
      }),
    )
    .toBe(true);
});

/*
 * One Escape closes one thing: with a Canvas's Choice menu open and focus back in the
 * image controls' tray, Escape closes the tray, where focus is, and leaves the menu open
 * for the next (DESIGN.md §0). Both closed at once before.
 */
test("Escape in the tray closes the tray, not an open menu too", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "a phone's own width");
  await page.setViewportSize({ width: 320, height: 800 });
  await serveIIIF(page);
  await page.goto("/?content=https://fixtures.test/0033-choice.json");
  const more = page.getByRole("button", { name: "Expand viewer controls" });
  await expect(more).toBeVisible();
  await more.focus();
  await page.keyboard.press("Enter");
  // Open, it is named for closing it: found by its state from here.
  const toggle = page.locator(".clover-canvas-more button[aria-expanded]");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const choice = page.locator('[data-button="choice"]');
  await choice.focus();
  await page.keyboard.press("Enter");
  const radios = page.getByRole("radio");
  await expect(radios.first()).toBeFocused();
  // Back into the tray, its first control, whose popover the keyboard shows: the first
  // Escape puts that away alone (WCAG 1.4.13), the next closes the tray.
  const zoomIn = page.getByRole("button", { name: "Zoom in", exact: true });
  await zoomIn.focus();
  await page.keyboard.press("Escape");
  await expect(zoomIn).toHaveAttribute("data-tip-hidden", "");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(radios.first()).toBeVisible();
});
