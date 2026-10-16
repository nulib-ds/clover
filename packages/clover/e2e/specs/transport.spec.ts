import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { type Locator, type Page, expect, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

const COOKBOOK = resolve(__dirname, "../../src/fixtures/iiif-cookbook");

/**
 * Every control the bar has at once: Cookbook 0026's opera (chapters, a two-hour
 * duration, full screen) given 0074's two caption files.
 */
async function serveCaptionedOpera(page: Page) {
  const opera = JSON.parse(
    readFileSync(resolve(COOKBOOK, "0026-toc-opera.json"), "utf8"),
  );
  const captioned = JSON.parse(
    readFileSync(
      resolve(COOKBOOK, "0074-multiple-language-captions.json"),
      "utf8",
    ),
  );
  const [canvas] = opera.items;
  canvas.annotations = captioned.items[0].annotations.map((page: any) => ({
    ...page,
    items: page.items.map((annotation: any) => ({
      ...annotation,
      target: canvas.id,
    })),
  }));
  await page.route("https://fixtures.test/captioned-opera.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(opera),
    }),
  );
}

const MUYBRIDGE = resolve(
  __dirname,
  "../../src/fixtures/muybridge-626-annie-g-galloping.json",
);

/** Cookbook 0074 with a summary on its Canvas, so the Canvas has information to open. */
async function serveAboutCaptions(page: Page) {
  const manifest = JSON.parse(
    readFileSync(
      resolve(COOKBOOK, "0074-multiple-language-captions.json"),
      "utf8",
    ),
  );
  manifest.items[0].summary = {
    en: [
      "The Canvas's own summary, which its information box shows over the video.",
    ],
  };
  await page.route("https://fixtures.test/about-captions.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(manifest),
    }),
  );
}

/*
 * The media transport at reflow sizes (WCAG 1.4.10): on a narrow stage its bar wraps
 * onto two rows with every control on the stage, and on a short one its menus stay on
 * it. Its toggles' marks, and the caption tracks a real video lists (WCAG 1.2.2). Layout
 * and text tracks need a real engine; checked in Chromium.
 */

/** WCAG 1.4.12's text spacing, as a bookmarklet would apply it. */
const TEXT_SPACING = `* {
  line-height: 1.5 !important;
  letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important;
}
p { margin-bottom: 2em !important; }`;

/** The bar's parts and where they sit, against the Canvas. */
async function layout(page: Page) {
  const bar = page.locator(".clover-canvas-transport-bar");
  await expect(bar).toHaveCount(1);
  return bar.evaluate((element) => {
    const figure = element.closest(".clover-canvas")!.getBoundingClientRect();
    const box = (node: Element) => node.getBoundingClientRect();
    const controls = [
      ...element.querySelectorAll(
        "button, input, .clover-canvas-transport-time",
      ),
    ].filter((node) => getComputedStyle(node).display !== "none");
    // A row's parts are centred on one line.
    const rows = new Set(
      [...element.children].map((child) =>
        Math.round((box(child).top + box(child).bottom) / 2),
      ),
    );
    const status = element.querySelector(".clover-canvas-transport-status");
    const play = element.querySelector('[data-button="play"]');
    const end = [
      ...element.querySelectorAll(
        '[data-button="chapters"], [data-button="captions"], [data-button="fullscreen"]',
      ),
    ];
    return {
      // Every control and the time, wholly on the Canvas.
      inside: controls.every(
        (node) =>
          box(node).left >= figure.left - 0.5 &&
          box(node).right <= figure.right + 0.5,
      ),
      names: controls.map(
        (node) =>
          node.getAttribute("aria-label") ?? node.textContent?.trim() ?? "",
      ),
      rows: rows.size,
      // The time and chapter over the buttons.
      statusAbove: status && play ? box(status).bottom <= box(play).top : null,
      // Chapters, Captions and Full screen on one row, at its end.
      endTogether:
        new Set(end.map((node) => Math.round(box(node).top))).size === 1 &&
        Math.abs(box(end.at(-1)!).right - box(element).right) < 1,
      // What clears the bar knows how tall it is.
      measured: getComputedStyle(
        element.closest(".clover-canvas")!,
      ).getPropertyValue("--clover-transport-bar-height"),
      height: box(element).height,
    };
  });
}

/** Whether `locator`'s box lies wholly on its stage, which clips what leaves it. */
function onStage(locator: Locator) {
  return locator.evaluate((element) => {
    const stage = element.closest(".clover-canvas")!.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return (
      box.top >= stage.top - 0.5 &&
      box.bottom <= stage.bottom + 0.5 &&
      box.left >= stage.left - 0.5 &&
      box.right <= stage.right + 0.5
    );
  });
}

/**
 * Opens the transport's menu `name` from the keyboard, and tells whether it and its first
 * option lie wholly on the stage, then closes it.
 */
async function menuOnStage(page: Page, name: string) {
  const button = page.getByRole("button", { name });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  const menu = page.locator(
    `[id="${await button.getAttribute("aria-controls")}"]`,
  );
  await expect(menu).toBeVisible();
  const first = menu.locator(".clover-canvas-transport-option").first();
  // The bar springs into place as the chrome shows: read it at rest.
  await expect.poll(() => onStage(menu)).toBe(true);
  const placed = { menu: await onStage(menu), first: await onStage(first) };
  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  return placed;
}

/** What is drawn at the middle of `locator`'s box, or `[dx, dy]` from it, as a class. */
function topmost(locator: Locator, [dx, dy] = [0, 0]) {
  return locator.evaluate(
    (element, [dx, dy]) => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        box.left + box.width / 2 + dx,
        box.top + box.height / 2 + dy,
      );
      return hit === element ? "itself" : (hit?.className.toString() ?? "");
    },
    [dx, dy],
  );
}

/** Whether the Canvas's chrome shows, as the stylesheet decides it. */
function shown(page: Page) {
  return page
    .locator(".clover-canvas-media")
    .first()
    .evaluate((element) =>
      getComputedStyle(element)
        .getPropertyValue("--clover-chrome-shown")
        .trim(),
    );
}

test.describe("transport", () => {
  test.beforeEach(({ browserName, isMobile }) => {
    test.skip(browserName !== "chromium" || isMobile, "layout, in Chromium");
  });

  for (const spacing of [false, true]) {
    test(`wraps onto two rows at 320 px, every control on the stage${spacing ? ", with text spacing" : ""}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await serveIIIF(page);
      await serveCaptionedOpera(page);
      await page.goto("/?content=https://fixtures.test/captioned-opera.json");
      if (spacing) await page.addStyleTag({ content: TEXT_SPACING });
      await expect(
        page.getByRole("button", { name: "Captions" }),
      ).toBeAttached();
      const bar = await layout(page);
      expect(bar.names).toEqual(
        expect.arrayContaining([
          "Play",
          "Mute",
          "Volume",
          "Chapters",
          "Captions",
          "Full screen",
        ]),
      );
      expect(bar.inside).toBe(true);
      expect(bar.rows).toBe(2);
      expect(bar.statusAbove).toBe(true);
      // In whole pixels, as the layout has it.
      expect(Math.abs(parseFloat(bar.measured) - bar.height)).toBeLessThan(1);
    });
  }

  test("stays one row where it fits", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serveIIIF(page);
    await page.goto(
      "/?content=https://fixtures.test/0074-multiple-language-captions.json",
    );
    await expect(page.getByRole("button", { name: "Captions" })).toBeAttached();
    const bar = await layout(page);
    expect(bar.inside).toBe(true);
    expect(bar.rows).toBe(1);
  });

  /*
   * Where the bar needs a third row: the Default template at 1280 × 720 and 200% (a
   * stage beside the panel), and the Document template at 320 px, short and tall. The
   * controls at the end keep together at the end of the bar's last row, and their
   * menus open above them, on the stage.
   */
  for (const { scene, width, height } of [
    { scene: "", width: 640, height: 360 },
    { scene: "scene=document&", width: 320, height: 256 },
    { scene: "scene=document&", width: 320, height: 640 },
  ]) {
    test(`keeps the Chapters and Captions menus on the stage, ${scene ? "Document" : "Default"} at ${width} × ${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await serveIIIF(page);
      await serveCaptionedOpera(page);
      await page.goto(
        `/?${scene}content=https://fixtures.test/captioned-opera.json`,
      );
      await expect(
        page.getByRole("button", { name: "Captions" }),
      ).toBeAttached();
      const bar = await layout(page);
      expect(bar.inside).toBe(true);
      expect(bar.endTogether).toBe(true);
      for (const name of ["Chapters", "Captions"]) {
        expect(await menuOnStage(page, name)).toEqual({
          menu: true,
          first: true,
        });
      }

      // Keyboard focus moving on past an open menu closes it, so it never covers the
      // control focus lands on (WCAG 2.4.11).
      const chapters = page.getByRole("button", { name: "Chapters" });
      await chapters.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(chapters).toBeFocused();
      await expect(chapters).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Shift+Tab");
      await expect(chapters).toHaveAttribute("aria-expanded", "false");
      const volume = page.getByRole("slider", { name: "Volume" });
      await expect(volume).toBeFocused();
      expect(await topmost(volume)).toBe("itself");
    });
  }

  // 1280 × 1024 at 400% and 1280 × 720 at 400%: a stage about 166 and 117 px tall.
  for (const height of [256, 180]) {
    test(`keeps the Captions menu on a short stage, 320 × ${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height });
      await serveIIIF(page);
      await page.goto(
        "/?content=https://fixtures.test/0074-multiple-language-captions.json",
      );
      const button = page.getByRole("button", { name: "Captions" });
      await button.focus();
      await page.keyboard.press("Enter");
      const menu = page.locator(".clover-canvas-transport-options");
      await expect(menu).toBeVisible();
      expect(await onStage(menu)).toBe(true);
      // Its first option ("Off") is on the stage too, not cut off above it.
      const off = page.locator(".clover-canvas-transport-option").first();
      await expect(off).toHaveText("Off");
      expect(await onStage(off)).toBe(true);
      // An open menu is over the Canvas's controls, so none covers an option.
      const point = await off.boundingBox();
      const hit = await page.evaluate(
        ({ x, y }) =>
          document
            .elementFromPoint(x, y)
            ?.closest(".clover-canvas-transport-options") !== null,
        { x: point!.x + point!.width / 2, y: point!.y + point!.height / 2 },
      );
      expect(hit).toBe(true);
    });
  }

  for (const height of [180, 256]) {
    test(`keeps the information box and the captions on a 320 × ${height} stage`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height });
      await serveIIIF(page);
      await serveAboutCaptions(page);
      await page.goto("/?content=https://fixtures.test/about-captions.json");
      const captions = page.getByRole("button", { name: "Captions" });
      await expect(captions).toHaveAttribute("data-active", "");

      // A two-line cue on the chosen track, as the browser would make it active. Keyboard
      // focus on the transport holds the chrome, so the cue is lifted over the bar.
      await captions.focus();
      await page.evaluate(() => {
        const [track] = Array.from(document.querySelector("video")!.textTracks);
        Object.defineProperty(track, "activeCues", {
          configurable: true,
          get: () => [{ text: "Per voi, signore,\nmodelli francesi" }],
        });
        track.dispatchEvent(new Event("cuechange"));
      });
      const cue = page.locator(".clover-canvas-captions-cue");
      await expect(cue).toBeVisible();
      await expect.poll(() => shown(page)).toBe("1");
      // Lifted by the transport's whole room it would leave the stage; it stays on it.
      await expect.poll(() => onStage(cue)).toBe(true);

      // Halfway through, with Seek focused: the cue runs down over the bar, but never
      // over the focused control, its thumb or its ring (WCAG 2.4.7, 2.4.11).
      const seek = page.getByRole("slider", { name: "Seek" });
      await seek.focus();
      await page.evaluate(() => {
        const video = document.querySelector("video")!;
        // No media loads here: the time asked for is the time it reads.
        video.currentTime = 32.5;
        video.dispatchEvent(new Event("timeupdate"));
      });
      await expect(seek).toHaveValue("32.5");
      // Cues take no pointer, so a point passes through them: here they take one, so
      // the point finds whatever is drawn on top.
      await cue.evaluate((element) => {
        element.style.pointerEvents = "auto";
      });
      for (const offset of [
        [0, 0],
        [0, -9],
        [0, 9],
        [-9, 0],
        [9, 0],
      ]) {
        // Its thumb, in the middle of its rail, ringed 6 px round.
        expect(await topmost(seek, offset)).toBe("itself");
      }

      // The Canvas's information, over the transport if it must, but on the stage.
      const about = page.getByRole("button", { name: "About" });
      await about.focus();
      await page.keyboard.press("Enter");
      const box = page.locator(".clover-canvas-caption");
      await expect(box).toBeVisible();
      expect(await onStage(box)).toBe(true);
      // Tall enough to show more than its own padding: something to read and scroll.
      const room = await box.evaluate((element) => {
        const style = getComputedStyle(element);
        return (
          element.clientHeight -
          parseFloat(style.paddingTop) -
          parseFloat(style.paddingBottom)
        );
      });
      expect(room).toBeGreaterThan(16);

      // Its close button is clear of the Canvas's controls, however the stage wraps
      // them (WCAG 2.5.8): a press there closes it.
      const close = box.getByRole("button", { name: "Close" });
      const point = (await close.boundingBox())!;
      await page.mouse.click(
        point.x + point.width / 2,
        point.y + point.height / 2,
      );
      await expect(box).toHaveAttribute("data-open", "false");
      await expect(
        page.getByRole("button", { name: "More Information" }),
      ).toHaveAttribute("aria-expanded", "false");
    });
  }

  test("keeps an animation's frames menu on a 320 × 180 stage", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 180 });
    await serveIIIF(page);
    await page.route("https://fixtures.test/muybridge.json", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: readFileSync(MUYBRIDGE, "utf8"),
      }),
    );
    await page.goto("/?content=https://fixtures.test/muybridge.json");
    // The plate opens on its placeholder still.
    const open = page.getByRole("button", { name: "Open image viewer" });
    await open.focus();
    await page.keyboard.press("Enter");
    const trigger = page.locator(".clover-canvas-transport-frames > button");
    await expect(trigger).toBeAttached();
    await trigger.focus();
    await page.keyboard.press("Enter");
    const menu = page.locator(
      ".clover-canvas-transport-frames > .clover-canvas-menu",
    );
    await expect(menu).toBeVisible();
    expect(await onStage(menu)).toBe(true);
    // Opening focuses the frame showing, the first: it is on the stage, not hidden
    // above it (WCAG 2.4.11).
    const first = menu.locator(".clover-canvas-menu-item").first();
    await expect(first.locator("input")).toBeFocused();
    expect(await onStage(first)).toBe(true);
  });

  test("marks a toggle that is on with more than its fill (WCAG 1.4.1)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serveIIIF(page);
    await page.goto(
      "/?content=https://fixtures.test/0074-multiple-language-captions.json",
    );
    const captions = page.getByRole("button", { name: "Captions" });
    await expect(captions).toHaveAttribute("data-active", "");
    const mark = () =>
      captions.evaluate((element) => {
        const after = getComputedStyle(element, "::after");
        return (
          after.content !== "none" && parseFloat(after.borderBottomWidth) > 0
        );
      });
    expect(await mark()).toBe(true);

    // In forced colours the fill is the system's Highlight, and the mark is drawn in
    // the button's own text colour over it.
    await page.emulateMedia({ forcedColors: "active" });
    const forced = await captions.evaluate((element) => {
      const button = getComputedStyle(element);
      const after = getComputedStyle(element, "::after");
      return {
        mark: after.borderBottomColor,
        text: button.color,
        fill: button.backgroundColor,
      };
    });
    expect(forced.mark).toBe(forced.text);
    expect(forced.mark).not.toBe(forced.fill);
    await page.emulateMedia({ forcedColors: "none" });

    // Off: the fill may still show under the pointer or focus, the mark does not.
    await captions.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("radio", { name: "Off" }).focus();
    await page.keyboard.press("Enter");
    await expect(captions).not.toHaveAttribute("data-active", "");
    await expect(captions).toBeFocused();
    expect(await mark()).toBe(false);
  });

  test("draws the sliders and the buttons' edges in forced colours (WCAG 1.4.11)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serveIIIF(page);
    await page.goto(
      "/?content=https://fixtures.test/0074-multiple-language-captions.json",
    );
    await expect(page.getByRole("button", { name: "Captions" })).toBeAttached();
    await page.emulateMedia({ forcedColors: "active" });
    // Each round button keeps an edge where its fill is dropped (once the change of
    // colours, which the buttons ease into, is over).
    const play = page.getByRole("button", { name: "Play" });
    await expect
      .poll(() =>
        play.evaluate((element) => getComputedStyle(element).borderTopWidth),
      )
      .toBe("1px");
    // A slider draws something: its rail and thumb, beside none at all. Focus on
    // Play holds the chrome in sight.
    await play.focus();
    await expect.poll(() => shown(page)).toBe("1");
    for (const name of ["Seek", "Volume"]) {
      const slider = page.getByRole("slider", { name });
      const drawn = await slider.screenshot({ animations: "disabled" });
      await slider.evaluate((element) => {
        element.style.opacity = "0";
      });
      const bare = await slider.screenshot({ animations: "disabled" });
      await slider.evaluate((element) => {
        element.style.opacity = "";
      });
      expect(drawn.equals(bare)).toBe(false);
    }
    await page.emulateMedia({ forcedColors: "none" });
  });

  test("offers captions the media adds, and shows the chosen track in picture in picture", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await serveIIIF(page);
    await page.goto(
      "/?content=https://fixtures.test/0074-multiple-language-captions.json",
    );
    const captions = page.getByRole("button", { name: "Captions" });
    await expect(captions).toBeAttached();
    const modes = () =>
      page.evaluate(() =>
        Array.from(document.querySelector("video")!.textTracks).map(
          (track) => track.mode,
        ),
      );
    // The Manifest's two, the first chosen: Clover draws it, the browser none.
    await expect.poll(modes).toEqual(["hidden", "hidden"]);

    // Picture in picture is the system's player: it draws only a track that shows.
    await page.evaluate(() =>
      document
        .querySelector("video")!
        .dispatchEvent(new Event("enterpictureinpicture")),
    );
    await expect.poll(modes).toEqual(["showing", "hidden"]);
    await page.evaluate(() =>
      document
        .querySelector("video")!
        .dispatchEvent(new Event("leavepictureinpicture")),
    );
    await expect.poll(modes).toEqual(["hidden", "hidden"]);

    // A track the media adds (as hls.js adds a stream's), offered after them.
    await page.evaluate(() =>
      document
        .querySelector("video")!
        .addTextTrack("captions", "Français", "fr"),
    );
    // `addTextTrack` makes it `hidden`, which hls.js reads as chosen: it is turned off.
    await expect.poll(modes).toEqual(["hidden", "hidden", "disabled"]);
    await captions.focus();
    await page.keyboard.press("Enter");
    const french = page.getByRole("radio", { name: "Français" });
    await expect(french).toBeAttached();
    await expect(page.getByText("Français", { exact: true })).toHaveAttribute(
      "lang",
      "fr",
    );
    await french.focus();
    await page.keyboard.press("Enter");
    await expect.poll(modes).toEqual(["hidden", "hidden", "hidden"]);
    await expect(captions).toHaveAccessibleDescription("Français");
  });
});
