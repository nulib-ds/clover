import { type Page, expect, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

/*
 * Document's pages down one column (`templates/document/Sheets.tsx`), as a PDF reader's
 * continuous view, and the one place a sheet is active, the top of the column:
 *
 * - a sheet for each view, the next one's top in sight under the one at rest, those not
 *   active muted;
 * - a scroll that rests short of the threshold settling back, either way, and one past
 *   it bringing the next (or previous) sheet to the top; a fling resting on one sheet;
 * - a press on a sheet, a thumbnail, PageDown and PageUp bringing theirs, and a reader's
 *   scroll taking over from one on its way;
 * - the Canvas, and its controls, shown only once its sheet is in place and drawn;
 * - zoomed into or out of, the active sheet filling the column and the others dissolving,
 *   until home again or another sheet comes in;
 * - the active sheet kept at the top as the column resizes;
 * - a finger that scrolls the column until the reader zooms in.
 *
 * After every move, `settled` checks the whole of it: the active sheet at its place, the
 * live Canvas exactly over it and shown, nothing on its way.
 */
const BOOK = "https://fixtures.test/0009-book-1.json";
/** Twelve single pages, portrait: room to scroll, every sheet as tall as the column allows. */
const PAGES = "https://fixtures.test/generated/12.json";

async function open(page: Page, content = PAGES) {
  await serveIIIF(page);
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.goto(`/?scene=document&content=${content}`);
  await expect(page.locator(".clover-canvas")).toHaveAttribute(
    "data-status",
    /ready|loading/,
  );
  await settled(page, 0);
}

const column = (page: Page) => page.locator(".clover-template-document-column");
const sheets = (page: Page) => page.locator(".clover-template-document-sheet");
/** Which thumbnail is selected: the current view, as the sidebar shows it. */
const selected = (page: Page) =>
  page
    .locator(".clover-template-document-sidebar [role='option']")
    .evaluateAll((options) =>
      options.findIndex(
        (option) => option.getAttribute("aria-selected") === "true",
      ),
    );
/** The panel's toggle, the one control that never fades with the others at rest. */
const toggle = (page: Page) =>
  page.locator(".clover-template-document-live [data-button='panel']");

/** The column now: where it is, each sheet, the live Canvas, and what is on its way. */
const read = (page: Page) =>
  column(page).evaluate((element) => {
    const all = [
      ...element.querySelectorAll<HTMLElement>(
        ".clover-template-document-sheet",
      ),
    ];
    const end = element.scrollHeight - element.clientHeight;
    const live = element.querySelector<HTMLElement>(
      ".clover-template-document-live",
    )!;
    return {
      scrollTop: element.scrollTop,
      clientHeight: element.clientHeight,
      places: all.map((sheet) => Math.min(sheet.offsetTop, end)),
      sheets: all.map((sheet) => ({
        top: sheet.offsetTop,
        height: sheet.offsetHeight,
      })),
      active: all.findIndex((sheet) => sheet.hasAttribute("data-active")),
      live: { top: live.offsetTop, height: live.offsetHeight },
      moving:
        element.hasAttribute("data-scrolling") ||
        live.hasAttribute("data-moved"),
      zoomed: element.hasAttribute("data-zoomed"),
    };
  });

/** At rest on sheet `index`: in place, the Canvas exactly over it and shown. */
async function settled(page: Page, index: number) {
  await expect
    .poll(
      async () => {
        const now = await read(page);
        return {
          active: now.active,
          moving: now.moving,
          inPlace: Math.abs(now.scrollTop - now.places[index]) < 2,
          over:
            now.live.top === now.sheets[index].top &&
            now.live.height === now.sheets[index].height,
        };
      },
      { timeout: 8000 },
    )
    .toEqual({ active: index, moving: false, inPlace: true, over: true });
  expect(await selected(page)).toBe(index);
}

/** A scroll as the wheel, a finger or the scrollbar makes it, by a share of a sheet. */
const scrollBy = async (page: Page, share: number) => {
  const { sheets: all } = await read(page);
  await column(page).evaluate(
    (element, by) => element.scrollBy(0, by),
    Math.round(all[0].height * share),
  );
};

test("the thumbnails' toggle sits on their spine while they show, its far end over the page, and over the page's top left once put away", async ({
  page,
}) => {
  await open(page);
  const toggle = page.getByRole("button", { name: /^Show items/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const where = () =>
    page.evaluate(() => {
      const box = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect();
      const button = box(".clover-template-document-sidebar-toggle")!;
      const bar = box(
        ".clover-template-document-sidebar + .clover-split-handle",
      );
      const sidebar = box(".clover-template-document-sidebar")!;
      const main = box(".clover-template-document-main")!;
      const controls = box(
        ".clover-template-document-live .clover-canvas-controls",
      )!;
      const first = box(
        ".clover-template-document-sidebar [role='option'] .clover-items-pictures",
      );
      return {
        // How far it hangs past the bar, or the drawer's edge, over the page.
        over:
          button.right -
          (bar && bar.width ? (bar.left + bar.right) / 2 : sidebar.right),
        // Its far rounded end's radius: all that is over the page.
        rest: button.height / 2,
        top: button.top - main.top,
        start: button.left - main.left,
        controls: controls.top - main.top,
        // The thumbnails start at the pane's own top, nothing in the pane above them.
        first: first ? first.top - sidebar.top : null,
        pad: parseFloat(
          getComputedStyle(
            document.querySelector(".clover-template-document-sidebar")!,
          ).paddingTop,
        ),
      };
    });
  let now = await where();
  // Over the thumbnails, but for its far rounded end, over the page.
  expect(Math.abs(now.over - now.rest)).toBeLessThan(1);
  expect(Math.abs(now.top - now.controls)).toBeLessThan(1);
  expect(Math.abs(now.first! - now.pad)).toBeLessThan(1);

  // Put away: over the page's top left, as far in as the controls are down, focus with it.
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  now = await where();
  expect(Math.abs(now.top - now.controls)).toBeLessThan(1);
  expect(Math.abs(now.start - now.controls)).toBeLessThan(1);

  // On a phone the thumbnails float over the page: the toggle sits so on their inner edge.
  // Opened there, they take focus at the page the reader is on; Escape gives it back.
  await page.setViewportSize({ width: 375, height: 700 });
  // Once the template has measured itself narrow: opened before, they would close with it.
  await expect(page.locator(".clover-template-document-panes")).toHaveAttribute(
    "data-narrow",
  );
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.locator(
      ".clover-template-document-sidebar [role='option'][aria-selected='true']",
    ),
  ).toBeFocused();
  await expect
    .poll(async () => {
      const { over, rest } = await where();
      return Math.abs(over - rest) < 1;
    })
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
});

test("narrowing under the thumbnails puts them away, focus on their toggle going with it, and widening brings them back", async ({
  page,
}) => {
  await open(page);
  const toggle = page.getByRole("button", { name: /^Show items/ });
  const sidebar = page.locator(".clover-template-document-sidebar");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  // On their spine, as they show beside the page.
  await toggle.focus();
  await page.setViewportSize({ width: 375, height: 700 });
  await expect(page.locator(".clover-template-document-panes")).toHaveAttribute(
    "data-narrow",
  );
  await expect(sidebar).toBeHidden();
  // The toggle is over the page's top left now, a new element, and focus is on it.
  await expect(
    page.locator(
      ".clover-template-document-sidebar-closed .clover-template-document-sidebar-toggle",
    ),
  ).toBeFocused();
  await page.setViewportSize({ width: 1100, height: 760 });
  await expect(sidebar).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});

test("a sheet for each view, the next one in sight under the first, the rest muted", async ({
  page,
}) => {
  await open(page, BOOK);
  const { sheets: all, clientHeight } = await read(page);
  // The cover, and the two spreads.
  expect(all).toHaveLength(3);
  expect(all[1].top).toBeLessThan(clientHeight);
  await expect(sheets(page).nth(0)).toHaveCSS("opacity", "1");
  await expect(sheets(page).nth(1)).toHaveCSS("opacity", "0.618");
});

test("a scroll short of the threshold settles back, either way; past it, the next or the previous comes in", async ({
  page,
}) => {
  await open(page);
  await scrollBy(page, 0.15);
  await settled(page, 0);

  await scrollBy(page, 0.4);
  await settled(page, 1);

  await scrollBy(page, 0.4);
  await settled(page, 2);

  // Back up a little: the sheet it rested on stays.
  await scrollBy(page, -0.15);
  await settled(page, 2);

  // Back up past a quarter of the one before: it comes in.
  await scrollBy(page, -0.4);
  await settled(page, 1);
});

test("a fling rests on one sheet, the Canvas never shown on the way", async ({
  page,
}) => {
  await open(page);
  // Record every time the Canvas shows while the column moves.
  await page.evaluate(() => {
    const live = document.querySelector(".clover-template-document-live")!;
    const column = document.querySelector(".clover-template-document-column")!;
    (window as any).__shownMoving = 0;
    new MutationObserver(() => {
      if (
        !live.hasAttribute("data-moved") &&
        column.hasAttribute("data-scrolling")
      )
        (window as any).__shownMoving++;
    }).observe(live, { attributes: true, attributeFilter: ["data-moved"] });
  });
  await scrollBy(page, 5.5);
  await settled(page, 6);
  expect(await page.evaluate(() => (window as any).__shownMoving)).toBe(0);
});

test("a trackpad's run of small wheel steps rests on one sheet, and PageDown pressed quickly goes a sheet each", async ({
  page,
  browserName,
  isMobile,
}) => {
  await open(page);
  // Mobile WebKit has no wheel to send, as an iPhone has no trackpad.
  if (!(browserName === "webkit" && isMobile)) {
    const box = (await column(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // Forty small steps, 12px each, a frame or two apart: one gesture, past a quarter.
    for (let step = 0; step < 40; step++) {
      await page.mouse.wheel(0, 12);
      await page.waitForTimeout(16);
    }
    await settled(page, 1);
  } else {
    await sheets(page).nth(1).click();
    await settled(page, 1);
  }

  await page
    .locator(".clover-template-document-live .clover-canvas-viewport")
    .focus();
  for (let press = 0; press < 4; press++) await page.keyboard.press("PageDown");
  await settled(page, 5);
});

test("a press on a muted sheet brings it to the top; the controls wait until it is drawn", async ({
  page,
}) => {
  await open(page);
  await expect(toggle(page)).toHaveCSS("opacity", "1");
  await sheets(page).nth(1).click();
  // On its way, the controls are going or gone (they fade, as when put away).
  await expect
    .poll(async () =>
      Number(await toggle(page).evaluate((e) => getComputedStyle(e).opacity)),
    )
    .toBeLessThan(1);
  await settled(page, 1);
  await expect(toggle(page)).toHaveCSS("opacity", "1");
  await expect(sheets(page).nth(1)).toHaveCSS("opacity", "1");
  await expect(sheets(page).nth(0)).toHaveCSS("opacity", "0.618");
});

test("a thumbnail, PageDown and PageUp bring their sheets; a reader's scroll takes over from one on its way", async ({
  page,
}) => {
  await open(page);
  // Where the thumbnails start hidden (a narrow page), their toggle shows them.
  const showItems = async () => {
    const show = page.getByRole("button", { name: "Show items" });
    if ((await show.getAttribute("aria-expanded")) !== "true")
      await show.click();
  };
  await showItems();
  const thumbnails = page.locator(
    ".clover-template-document-sidebar [role='option']",
  );
  await thumbnails.nth(8).click();
  await settled(page, 8);

  await page
    .locator(".clover-template-document-live .clover-canvas-viewport")
    .focus();
  await page.keyboard.press("PageDown");
  await settled(page, 9);
  await page.keyboard.press("PageUp");
  await page.keyboard.press("PageUp");
  await settled(page, 7);

  // On its way to another, the reader scrolls on: the reader's scroll decides.
  await showItems();
  await thumbnails.nth(0).click();
  await page.waitForTimeout(60);
  await column(page).dispatchEvent("wheel", { deltaY: 1 });
  await scrollBy(page, 1);
  await expect
    .poll(async () => (await read(page)).moving, { timeout: 8000 })
    .toBe(false);
  await settled(page, (await read(page)).active);
});

test("zoomed in or out, the active sheet fills the column and the others dissolve; home, or another sheet, puts it back", async ({
  page,
}) => {
  await open(page);
  const viewport = page.locator(
    ".clover-template-document-live .clover-canvas-viewport",
  );
  await expect(viewport).toHaveCSS("touch-action", "pan-y");
  await viewport.focus();
  await page.keyboard.press("+");
  await expect(column(page)).toHaveAttribute("data-zoomed", "");
  await expect
    .poll(async () => {
      const now = await read(page);
      return now.sheets[0].height === now.clientHeight;
    })
    .toBe(true);
  await expect(sheets(page).nth(1)).toHaveCSS("opacity", "0");
  await expect(sheets(page).nth(1)).toHaveCSS("pointer-events", "none");
  await expect(viewport).toHaveCSS("touch-action", "none");
  await settled(page, 0);

  // Home again: a sheet among the rest.
  await page.keyboard.press("0");
  await expect(column(page)).not.toHaveAttribute("data-zoomed");
  await expect(sheets(page).nth(1)).toHaveCSS("opacity", "0.618");
  await settled(page, 0);

  // Out past home counts too.
  await page.keyboard.press("-");
  await expect(column(page)).toHaveAttribute("data-zoomed", "");
  await page.keyboard.press("0");
  await expect(column(page)).not.toHaveAttribute("data-zoomed");

  // Zoomed, a scroll past the threshold brings the next sheet in, at home.
  await page.keyboard.press("+");
  await expect(column(page)).toHaveAttribute("data-zoomed", "");
  await scrollBy(page, 0.5);
  await settled(page, 1);
  await expect(column(page)).not.toHaveAttribute("data-zoomed");
  await expect(sheets(page).nth(0)).toHaveCSS("opacity", "0.618");
});

test("the active sheet stays at the top as the column resizes", async ({
  page,
}) => {
  await open(page);
  await sheets(page).nth(3).click();
  await settled(page, 3);
  await page.setViewportSize({ width: 900, height: 640 });
  await settled(page, 3);
  await page.setViewportSize({ width: 1280, height: 860 });
  await settled(page, 3);
});

test("for less motion, a sheet chosen comes to the top at once", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await sheets(page).nth(1).click();
  await settled(page, 1);
  await page
    .locator(".clover-template-document-live .clover-canvas-viewport")
    .focus();
  await page.keyboard.press("PageDown");
  const { scrollTop, places } = await read(page);
  expect(Math.abs(scrollTop - places[2])).toBeLessThan(2);
  await settled(page, 2);
});
