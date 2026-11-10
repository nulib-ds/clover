import { type Page, expect, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

/*
 * Document's pages down one column (`templates/document/Sheets.tsx`), as a PDF reader's
 * continuous view, the scroll resting where it is left and the sheet most in view the
 * active one:
 *
 * - a sheet for each view, the next one's top in sight under the one at rest, none muted;
 * - a scroll, a fling or a trackpad's run resting where it stops, never nudged, the
 *   sheet most in view active;
 * - a thumbnail, PageDown and PageUp bringing theirs to the top, and a scroll taking over
 *   from one on its way;
 * - a press on a page, or a zoom, opening it as the full viewer over the whole column,
 *   Escape closing it and bringing its page to the top;
 * - the column held where it rests as it resizes;
 * - a finger that scrolls the column until the page is zoomed in;
 * - a recording's or a Scene's sheet taking the column, and a Scene keeping a finger's
 *   drag;
 * - a video waiting as its still until it is pressed into;
 * - a section's button in the toolbar opening it alone in the aside, its close handing
 *   focus back.
 *
 * After every move, `settled` (a sheet brought to the top) or `rested` (a scroll left
 * where it stopped) checks the whole of it: the active sheet, the live Canvas over it and
 * the gap around it, nothing on its way.
 */
const BOOK = "https://fixtures.test/0009-book-1.json";
/** Twelve single pages, portrait: room to scroll, every sheet as tall as the column allows. */
const PAGES = "https://fixtures.test/generated/12.json";
const VIDEO = "https://fixtures.test/0003-mvm-video.json";

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
const viewport = (page: Page) =>
  page.locator(".clover-template-document-live .clover-canvas-viewport");
const thumbnails = (page: Page) =>
  page.locator(".clover-template-document-sidebar [role='option']");
/** Which thumbnail is selected: the current view, as the sidebar shows it. */
const selected = (page: Page) =>
  thumbnails(page).evaluateAll((options) =>
    options.findIndex(
      (option) => option.getAttribute("aria-selected") === "true",
    ),
  );

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
    const box = element.querySelector(".clover-template-document-sheets")!;
    // The space between the sheets and over the first, which a sheet at the top keeps.
    const gap = parseFloat(getComputedStyle(box).rowGap) || 0;
    return {
      scrollTop: element.scrollTop,
      clientHeight: element.clientHeight,
      gap,
      places: all.map((sheet) =>
        Math.max(0, Math.min(sheet.offsetTop - gap, end)),
      ),
      sheets: all.map((sheet) => ({
        top: sheet.offsetTop,
        height: sheet.offsetHeight,
        // The space at its sides, the gap, which the live Canvas lies over too.
        inset: parseFloat(getComputedStyle(sheet).paddingInlineStart) || 0,
      })),
      active: all.findIndex((sheet) => sheet.hasAttribute("data-active")),
      /* The sheet most in view, as `Sheets` chooses it: the first of two as shown. */
      inView: (() => {
        const top = element.scrollTop;
        if (top <= 0.5) return 0;
        if (top >= end - 0.5) return all.length - 1;
        const bottom = top + element.clientHeight;
        let best = 0;
        let most = -1;
        all.forEach((sheet, index) => {
          const shown =
            Math.min(sheet.offsetTop + sheet.offsetHeight, bottom) -
            Math.max(sheet.offsetTop, top);
          if (shown > most + 0.5) {
            most = shown;
            best = index;
          }
        });
        return best;
      })(),
      live: {
        top: live.offsetTop,
        height: live.offsetHeight,
        // Its player: among the pages a page that plays keeps it out of sight.
        shown:
          getComputedStyle(live.querySelector(".clover-body") ?? live)
            .visibility !== "hidden",
      },
      moving:
        element.hasAttribute("data-scrolling") ||
        live.hasAttribute("data-moved"),
      zoomed: element.hasAttribute("data-zoomed"),
      expanded: element.hasAttribute("data-expanded"),
    };
  });

type Read = Awaited<ReturnType<typeof read>>;

/** The live Canvas over sheet `index`, the gap around it too. */
const over = (now: Read, index: number) => {
  const sheet = now.sheets[index];
  return (
    !!sheet &&
    Math.abs(now.live.top - (sheet.top - sheet.inset)) < 1 &&
    Math.abs(now.live.height - (sheet.height + 2 * sheet.inset)) < 1
  );
};

/** At rest on sheet `index`: in place, the Canvas over it. */
async function settled(page: Page, index: number) {
  await expect
    .poll(
      async () => {
        const now = await read(page);
        return {
          active: now.active,
          moving: now.moving,
          inPlace: Math.abs(now.scrollTop - now.places[index]) < 2,
          over: over(now, index),
        };
      },
      { timeout: 8000 },
    )
    .toEqual({ active: index, moving: false, inPlace: true, over: true });
  expect(await selected(page)).toBe(index);
}

/**
 * At rest where the scroll left it, at `top`: not nudged, the sheet most in view active,
 * the Canvas over it. The active sheet's index.
 */
async function rested(page: Page, top: number) {
  await expect
    .poll(
      async () => {
        const now = await read(page);
        return {
          moving: now.moving,
          left: Math.abs(now.scrollTop - top) < 2,
          inView: now.active === now.inView,
          over: over(now, now.active),
        };
      },
      { timeout: 8000 },
    )
    .toEqual({ moving: false, left: true, inView: true, over: true });
  // A moment on, still there: nothing brings a sheet in after the rest.
  await page.waitForTimeout(400);
  const now = await read(page);
  expect(Math.abs(now.scrollTop - top)).toBeLessThan(2);
  expect(await selected(page)).toBe(now.active);
  return now.active;
}

/** The full viewer: open, the live Canvas over the whole of the column's view. */
async function full(page: Page) {
  await expect
    .poll(async () => {
      const now = await read(page);
      return (
        now.expanded &&
        Math.abs(now.live.top - now.scrollTop) < 1 &&
        Math.abs(now.live.height - now.clientHeight) < 1
      );
    })
    .toBe(true);
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
      // The template's own controls over the page's top left.
      const lead = box(".clover-template-document-lead")!;
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
        leadTop: lead.top - main.top,
        leadStart: lead.left - main.left,
        // The first thumbnail as far from the pane's top as the list's room over it.
        first: first ? first.top - sidebar.top : null,
        room: parseFloat(
          getComputedStyle(
            document.querySelector(".clover-template-document-thumbnails")!,
          ).paddingTop,
        ),
      };
    });
  let now = await where();
  // Over the thumbnails, but for its far rounded end, over the page, level with the
  // template's controls there.
  expect(Math.abs(now.over - now.rest)).toBeLessThan(1);
  expect(Math.abs(now.top - now.leadTop)).toBeLessThan(1);
  expect(Math.abs(now.first! - now.room)).toBeLessThan(1);
  // No magnifier among the pages: a page opens from itself (Mat, 2026-11-10).
  await expect(page.locator(".clover-template-document-view")).toHaveCount(0);

  // Put away: first over the page's top left, focus with it.
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  now = await where();
  expect(Math.abs(now.top - now.leadTop)).toBeLessThan(1);
  expect(Math.abs(now.start - now.leadStart)).toBeLessThan(1);

  // On a phone the thumbnails float over the page: the toggle sits so on their inner edge.
  // Opened there, they take focus at the current page; Escape gives it back.
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

test("a sheet for each view, the next one in sight under the first, none muted", async ({
  page,
}) => {
  await open(page, BOOK);
  const { sheets: all, clientHeight } = await read(page);
  // The cover, and the two spreads.
  expect(all).toHaveLength(3);
  expect(all[1].top).toBeLessThan(clientHeight);
  await expect(sheets(page).nth(0)).toHaveCSS("opacity", "1");
  await expect(sheets(page).nth(1)).toHaveCSS("opacity", "1");
});

test("a scroll rests where it stops, either way, the sheet most in view active", async ({
  page,
}) => {
  await open(page);
  const height = (await read(page)).sheets[0].height;
  const at = (share: number) => Math.round(height * share);

  await scrollBy(page, 0.15);
  expect(await rested(page, at(0.15))).toBe(0);

  await scrollBy(page, 0.45);
  expect(await rested(page, at(0.15) + at(0.45))).toBe(1);

  // Half up the column, a sheet stays there.
  await scrollBy(page, 0.6);
  expect(await rested(page, at(0.15) + at(0.45) + at(0.6))).toBe(1);

  // Back up a little, and past the one before.
  await scrollBy(page, -0.15);
  await rested(page, at(0.15) + at(0.45) + at(0.6) - at(0.15));
  await scrollBy(page, -0.9);
  expect(await rested(page, at(0.15) + at(0.45) + at(0.6) - at(1.05))).toBe(0);
});

test("a fling rests where it stops, the Canvas never shown on the way", async ({
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
  const height = (await read(page)).sheets[0].height;
  await scrollBy(page, 5.5);
  expect(await rested(page, Math.round(height * 5.5))).toBeGreaterThan(4);
  expect(await page.evaluate(() => (window as any).__shownMoving)).toBe(0);
});

test("a trackpad's run of small wheel steps rests where it stops, and PageDown pressed quickly goes a sheet each", async ({
  page,
  browserName,
  isMobile,
}) => {
  await open(page);
  let from = 0;
  // Mobile WebKit has no wheel to send, as an iPhone has no trackpad.
  if (!(browserName === "webkit" && isMobile)) {
    const box = (await column(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // Forty small steps, 12px each, a frame or two apart: one gesture.
    for (let step = 0; step < 40; step++) {
      await page.mouse.wheel(0, 12);
      await page.waitForTimeout(16);
    }
    from = await rested(page, 480);
  }

  await viewport(page).focus();
  for (let press = 0; press < 4; press++) await page.keyboard.press("PageDown");
  await settled(page, from + 4);
});

test("a press on a page opens it as the full viewer over the column; Escape closes it, that page at the top", async ({
  page,
}) => {
  await open(page);
  await expect(viewport(page)).toHaveCSS("cursor", "zoom-in");
  // Pressed where it shows, its top at the column's foot, as nothing scrolls first.
  const shown = (await column(page).boundingBox())!;
  const next = (await sheets(page).nth(1).boundingBox())!;
  await page.mouse.click(
    next.x + next.width / 2,
    (next.y + shown.y + shown.height) / 2,
  );
  await full(page);
  expect(await selected(page)).toBe(1);
  // Its keys work at once: the press was into it.
  await expect(viewport(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(column(page)).not.toHaveAttribute("data-expanded");
  // Pressed where it partly showed, the page comes to the top as it closes.
  await settled(page, 1);

  // A zoom on the page's Canvas opens it too, the keyboard's way in: the view's controls
  // are the Canvas's own, at its top end, and over the top left the arrow back, the
  // pager's steps after it.
  await viewport(page).focus();
  await page.keyboard.press("+");
  await full(page);
  const view = page.locator(".clover-template-document-view");
  const magnifier = view.locator("> button").first();
  await expect(magnifier).toHaveAccessibleName(/^Back to /);
  const live = page.locator(".clover-template-document-live");
  await expect(live.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(
    live.getByRole("button", { name: "Rotate right" }),
  ).toBeVisible();
  const zoom = (await live
    .getByRole("button", { name: "Zoom in" })
    .boundingBox())!;
  const back = (await magnifier.boundingBox())!;
  expect(zoom.x).toBeGreaterThan(back.x);
  // Next and Previous step through the pages, the full viewer open.
  await view.getByRole("button", { name: "Next" }).click();
  await expect.poll(() => selected(page)).toBe(2);
  await expect(column(page)).toHaveAttribute("data-expanded");
  await view.getByRole("button", { name: "Previous" }).click();
  await expect.poll(() => selected(page)).toBe(1);
  // Wholly in view, at the top, it stays where it rests as it closes, focus back on its
  // Canvas.
  await magnifier.click();
  await expect(column(page)).not.toHaveAttribute("data-expanded");
  await settled(page, 1);
  await expect(viewport(page)).toBeFocused();
});

test("a thumbnail, PageDown and PageUp bring their sheets; a scroll takes over from one on its way", async ({
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
  await thumbnails(page).nth(8).click();
  await settled(page, 8);

  await viewport(page).focus();
  await page.keyboard.press("PageDown");
  await settled(page, 9);
  await page.keyboard.press("PageUp");
  await page.keyboard.press("PageUp");
  await settled(page, 7);

  // On its way to another, a scroll goes on: the scroll decides.
  await showItems();
  await thumbnails(page).nth(0).click();
  await page.waitForTimeout(60);
  await column(page).dispatchEvent("wheel", { deltaY: 1 });
  await scrollBy(page, 1);
  await expect
    .poll(async () => (await read(page)).moving, { timeout: 8000 })
    .toBe(false);
  // At rest where the scroll left it, nothing brought in after.
  await rested(page, (await read(page)).scrollTop);
});

test("zoomed in or out, the page opens as the full viewer; home leaves it open, Escape puts it back", async ({
  page,
}) => {
  await open(page);
  await expect(viewport(page)).toHaveCSS("touch-action", "pan-y");
  await viewport(page).focus();
  await page.keyboard.press("+");
  await expect(column(page)).toHaveAttribute("data-zoomed", "");
  await full(page);
  await expect(viewport(page)).toHaveCSS("touch-action", "none");

  // Home again: the full viewer stays, at home.
  await page.keyboard.press("0");
  await expect(column(page)).not.toHaveAttribute("data-zoomed");
  await full(page);

  // Out past home counts too.
  await page.keyboard.press("-");
  await expect(column(page)).toHaveAttribute("data-zoomed", "");
  await page.keyboard.press("Escape");
  await expect(column(page)).not.toHaveAttribute("data-expanded");
  await expect(column(page)).not.toHaveAttribute("data-zoomed");
  await settled(page, 0);
  await expect(viewport(page)).toHaveCSS("touch-action", "pan-y");
});

test("a recording's or a Scene's sheet takes the column, and a finger's drag is the Scene's", async ({
  page,
}) => {
  await serveIIIF(page);
  await page.setViewportSize({ width: 375, height: 812 });
  // No width and height to fit: a Timeline (a Canvas of sound alone), then a Scene.
  for (const name of ["0002-mvm-audio", "0608-mvm-3d-v4"]) {
    await page.goto(
      `/?scene=document&content=https://fixtures.test/${name}.json`,
    );
    await expect(sheets(page).first()).toHaveAttribute("data-fill", "true");
    // The sheet the column less the gap over and under it; the Canvas over the gap too,
    // as tall as the column is once its toolbar's controls are in.
    await expect
      .poll(async () => {
        const now = await read(page);
        return [
          Math.abs(now.sheets[0].height + 2 * now.gap - now.clientHeight) < 1,
          Math.abs(now.live.height - now.clientHeight) < 1,
        ];
      })
      .toEqual([true, true]);
  }
  // A Scene keeps every drag, as in Default; at home a page's Canvas lets a finger scroll.
  await expect(viewport(page)).toHaveCSS("touch-action", "none");
});

test("a video waits as its still until it is pressed into, then fills the column on black", async ({
  page,
}) => {
  await serveIIIF(page);
  // Never playing aloud: the player is kept muted.
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "muted", {
      get: () => true,
      set: () => undefined,
      configurable: true,
    });
  });
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.goto(`/?scene=document&content=${VIDEO}`);
  await expect(
    page.locator(".clover-template-document-live .clover-canvas"),
  ).toHaveAttribute("data-media", "video");
  // Its still and play button, nothing of the player.
  await expect(
    page.locator(".clover-template-document-live-play"),
  ).toBeVisible();
  await expect.poll(async () => (await read(page)).live.shown).toBe(false);
  // Its play button is a real one, the keyboard's way in, and nothing over the top left.
  await expect(
    page.locator(".clover-template-document-live-play"),
  ).toHaveAccessibleName("Play");
  await expect(page.locator(".clover-template-document-view")).toHaveCount(0);

  // Pressed off its play button (and the thumbnails' toggle on its edge), it opens
  // without playing.
  const sheet = (await sheets(page).first().boundingBox())!;
  await page.mouse.click(
    sheet.x + sheet.width * 0.25,
    sheet.y + sheet.height * 0.75,
  );
  await full(page);
  await expect.poll(async () => (await read(page)).live.shown).toBe(true);
  await expect(
    page.locator(".clover-template-document-live .clover-canvas"),
  ).toHaveCSS("background-color", "rgb(0, 0, 0)");
  // No picture's controls: its player has its own.
  await expect(
    page
      .locator(".clover-template-document-live")
      .getByRole("button", { name: "Zoom in" }),
  ).toHaveCount(0);
  // The arrow back closes it, and the video goes back to its still.
  await page.locator(".clover-template-document-view > button").first().click();
  await expect.poll(async () => (await read(page)).expanded).toBe(false);
  await expect.poll(async () => (await read(page)).live.shown).toBe(false);
});

test("a section's button opens it alone in the aside, beside the page; its close hands focus back", async ({
  page,
}) => {
  await open(page, BOOK);
  const toolbar = page.locator(".clover-template-document-toolbar");
  const about = toolbar.getByRole("button", { name: "About" });
  const aside = page.locator(".clover-template-document-aside");
  await expect(about).toHaveAttribute("aria-expanded", "false");
  await about.click();
  await expect(aside).toBeVisible();
  await expect(about).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("complementary", { name: "About" }),
  ).toBeVisible();
  await expect(page.locator(".clover-template-document-panes")).toHaveAttribute(
    "data-panel",
    "beside",
  );
  // Its close, on its inner edge, puts it away, focus back on the section's button.
  const close = aside.getByRole("button", { name: "Close information panel" });
  await close.focus();
  await page.keyboard.press("Enter");
  await expect(aside).toBeHidden();
  await expect(about).toBeFocused();
});

test("the column holds where it rests as it resizes", async ({ page }) => {
  await open(page);
  await thumbnails(page).nth(3).click();
  await settled(page, 3);
  await page.setViewportSize({ width: 900, height: 640 });
  await settled(page, 3);
  await page.setViewportSize({ width: 1280, height: 860 });
  await settled(page, 3);

  // Left a third of the way down the sheet, it stays a third of the way down it, from
  // where it rests at the top, the gap over it.
  const before = (await read(page)).sheets[3];
  const { gap } = await read(page);
  await scrollBy(page, 0.3);
  expect(await rested(page, (await read(page)).scrollTop)).toBe(3);
  const share =
    ((await read(page)).scrollTop - (before.top - gap)) / before.height;
  await page.setViewportSize({ width: 900, height: 640 });
  await expect
    .poll(async () => {
      const now = await read(page);
      const sheet = now.sheets[3];
      return (
        now.active === 3 &&
        Math.abs(now.scrollTop - (sheet.top - now.gap + share * sheet.height)) <
          3
      );
    })
    .toBe(true);
});

test("for less motion, a sheet chosen comes to the top at once", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await viewport(page).focus();
  await page.keyboard.press("PageDown");
  const { scrollTop, places } = await read(page);
  expect(Math.abs(scrollTop - places[1])).toBeLessThan(2);
  await settled(page, 1);
});

test("an annotation chosen in the aside opens the full viewer on it, a picture's or a recording's", async ({
  page,
}) => {
  // A picture's comment on a region, framed in the full viewer.
  await open(
    page,
    "https://fixtures.test/0261-non-rectangular-commenting.json",
  );
  const toolbar = page.locator(".clover-template-document-toolbar");
  await toolbar.getByRole("button", { name: "Annotations" }).click();
  const aside = page.locator(".clover-template-document-aside");
  await aside.locator(".clover-annotations-entry").first().click();
  await expect(column(page)).toHaveAttribute("data-expanded");

  // A recording's: the full viewer opens at its time.
  await page.addInitScript(() => {
    // Every playback in these tests stays muted.
    Object.defineProperty(HTMLMediaElement.prototype, "muted", {
      get: () => true,
      set: () => {},
      configurable: true,
    });
  });
  await open(
    page,
    "https://fixtures.test/0103-poetry-reading-annotations.json",
  );
  await toolbar.getByRole("button", { name: "Annotations" }).click();
  await aside.locator(".clover-annotations-entry").first().click();
  await expect(column(page)).toHaveAttribute("data-expanded");
});

test("an annotation on a page far down opens the full viewer there, its thumbnail chosen; closed, that page rests at the top", async ({
  page,
}) => {
  await open(page, "https://fixtures.test/generated/12-commented-3,9.json");
  await page
    .locator(".clover-template-document-toolbar")
    .getByRole("button", { name: "Annotations" })
    .click();
  const entries = page.locator(
    ".clover-template-document-aside .clover-annotations-entry",
  );
  await expect(entries).toHaveCount(2);
  await entries.filter({ hasText: "A comment on Page 9" }).click();
  // Its page under the viewer, its thumbnail chosen, the comment framed.
  await expect(column(page)).toHaveAttribute("data-expanded");
  await expect.poll(() => selected(page)).toBe(8);
  await expect.poll(async () => (await read(page)).active).toBe(8);
  // Back: page 9 at the top of the column, where the reader was taken.
  await page.locator(".clover-template-document-view > button").first().click();
  await expect(column(page)).not.toHaveAttribute("data-expanded");
  await settled(page, 8);
});

test("among the pages, Up and Down step from page to page, Home and End to the first and last, the page's place said", async ({
  page,
}) => {
  await open(page);
  await viewport(page).focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => selected(page)).toBe(2);
  await settled(page, 2);
  // Among the pages, never the full viewer, and focus on the page in view.
  await expect(column(page)).not.toHaveAttribute("data-expanded");
  await expect(viewport(page)).toBeFocused();
  const said = page.locator(
    ".clover-template-document-column > [role='status']",
  );
  await expect(said).toHaveText("Page 3, Item 3 of 12");
  await page.keyboard.press("End");
  await expect.poll(() => selected(page)).toBe(11);
  await expect(said).toHaveText("Page 12, Item 12 of 12");
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => selected(page)).toBe(10);
  await page.keyboard.press("Home");
  await expect.poll(() => selected(page)).toBe(0);
  await settled(page, 0);
  // Enter opens the page in view as the full viewer, focus kept on its Canvas.
  await page.keyboard.press("Enter");
  await expect(column(page)).toHaveAttribute("data-expanded");
  await expect(viewport(page)).toBeFocused();
});
