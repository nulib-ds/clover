import { type Locator, type Page, expect, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

/*
 * The bar between two panes (`Clover.SplitHandle`), in the templates that use it: its
 * grip seen at rest (WCAG 1.4.11), a click or a tap for a drag (2.5.7), with three panes
 * as well as two, and right to left; a double click that clicks nothing beside it; a
 * popover that is no part of the bar to press; and its focus in forced colors and
 * without the stylesheet (2.4.7).
 */
const BOOK = "https://fixtures.test/0009-book-1.json";

async function open(page: Page, query = "") {
  await serveIIIF(page);
  await page.goto(`/?${query}content=${BOOK}`);
  await expect(page.locator(".clover-canvas")).toHaveAttribute(
    "data-status",
    /ready|loading/,
  );
}

const width = (pane: Locator) =>
  pane.evaluate((element) => element.getBoundingClientRect().width);

const middle = async (handle: Locator) => {
  const box = (await handle.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** The ratio between the grip and the ground of each pane beside the bar. */
const gripContrast = (handle: Locator) =>
  handle.evaluate((bar) => {
    const rgb = (color: string) =>
      (color.match(/[\d.]+/g) ?? []).map(Number) as number[];
    const luminance = ([r, g, b]: number[]) =>
      [r, g, b]
        .map((c) => c / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    // The first fill behind an element, or the page's white.
    const ground = (element: Element | null): number[] => {
      for (let at = element; at; at = at.parentElement) {
        const fill = rgb(getComputedStyle(at).backgroundColor);
        if (fill.length === 3 || fill[3] > 0) return fill;
      }
      return [255, 255, 255];
    };
    const grip = rgb(getComputedStyle(bar, "::after").backgroundColor);
    const ratio = (a: number[], b: number[]) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    return [bar.previousElementSibling, bar.nextElementSibling].map((pane) =>
      ratio(grip, ground(pane)),
    );
  });

test("Default: a click on the bar steps the panel to its widest, its narrowest and its own size, and a drag still resizes it (WCAG 2.5.7)", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "on a phone the panel slides over the stage: no bar");
  await open(page);
  const handle = page.getByRole("separator", { name: "Resize panels" });
  const panel = page.locator(".clover-template-default-panel");
  await expect(handle).toBeVisible();
  const own = await width(panel);
  expect(own).toBeCloseTo(384, 0);

  await handle.click();
  await expect.poll(() => width(panel)).toBeGreaterThan(own + 100);
  const widest = await width(panel);
  await expect(handle).toHaveAttribute(
    "aria-valuenow",
    String(
      Math.round(
        (widest /
          (await page
            .locator(".clover-template-default-body")
            .evaluate((element) => element.clientWidth))) *
          100,
      ),
    ),
  );
  await handle.click();
  await expect.poll(() => width(panel)).toBeCloseTo(224, 0);
  await handle.click();
  await expect.poll(() => width(panel)).toBeCloseTo(own, 0);

  // A drag follows the pointer from where it took the bar, and does not step as well.
  const at = await middle(handle);
  await page.mouse.move(at.x + 4, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x - 20, at.y, { steps: 4 });
  await page.mouse.move(at.x - 36, at.y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => width(panel)).toBeCloseTo(own + 40, 0);
});

test("Document: a click on the thumbnails' bar steps them too", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "on a phone the thumbnails slide over the page: no bar");
  await open(page, "scene=document&");
  const sidebar = page.locator(".clover-template-document-sidebar");
  const handle = page.locator(
    ".clover-template-document-sidebar + .clover-split-handle",
  );
  await expect(handle).toBeVisible();
  expect(await width(sidebar)).toBeCloseTo(208, 0);
  await handle.click();
  await expect.poll(() => width(sidebar)).toBeCloseTo(384, 0);
  await handle.click();
  await expect.poll(() => width(sidebar)).toBeCloseTo(128, 0);
  await handle.click();
  await expect.poll(() => width(sidebar)).toBeCloseTo(208, 0);
});

test.describe("under a finger", () => {
  test.use({ hasTouch: true });

  test("a tap on the bar steps the panel, as a click does", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "on a phone the panel slides over the stage: no bar");
    await open(page);
    const handle = page.getByRole("separator", { name: "Resize panels" });
    const panel = page.locator(".clover-template-default-panel");
    const own = await width(panel);
    const at = await middle(handle);
    await page.touchscreen.tap(at.x, at.y);
    await expect.poll(() => width(panel)).toBeGreaterThan(own + 100);
  });
});

test("at rest, the bar's grip keeps 3:1 beside each pane (WCAG 1.4.11)", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "on a phone there is no bar");
  await open(page);
  const handle = page.getByRole("separator", { name: "Resize panels" });
  await expect(handle).toBeVisible();
  const grip = await handle.evaluate((bar) => {
    const after = getComputedStyle(bar, "::after");
    return { height: parseFloat(after.height), width: parseFloat(after.width) };
  });
  expect(grip.height).toBeGreaterThan(40);
  // The bar's 3px, and 1px past it on each side, so it reads as a grip.
  expect(grip.width).toBe(5);
  for (const ratio of await gripContrast(handle))
    expect(ratio).toBeGreaterThanOrEqual(3);

  // Document's page sits on a gray ground, beside the white thumbnails.
  await open(page, "scene=document&");
  const thumbnails = page.locator(
    ".clover-template-document-sidebar + .clover-split-handle",
  );
  await expect(thumbnails).toBeVisible();
  for (const ratio of await gripContrast(thumbnails))
    expect(ratio).toBeGreaterThanOrEqual(3);
});

test("names itself beside its grip on keyboard focus, clear of the bar", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "on a phone there is no bar");
  await open(page);
  const handle = page.getByRole("separator", { name: "Resize panels" });
  await handle.focus();
  const tip = handle.locator(".clover-tip");
  await expect(tip).toBeVisible();
  await expect(tip).toHaveText("Resize panels");
  const bar = (await handle.boundingBox())!;
  const box = (await tip.boundingBox())!;
  expect(box.x).toBeGreaterThan(bar.x + bar.width);
  expect(
    Math.abs(box.y + box.height / 2 - (bar.y + bar.height / 2)),
  ).toBeLessThan(2);
});

test("in forced colors the bar shows in the text's color, and its focus in the highlight with an outline (WCAG 2.4.7)", async ({
  page,
  browserName,
  isMobile,
}) => {
  test.skip(
    browserName !== "chromium",
    "forced colors are emulated in Chromium",
  );
  test.skip(isMobile, "on a phone there is no bar");
  // Emulated before the page loads: switched on after, Chromium keeps the rules it had.
  await page.emulateMedia({ forcedColors: "active" });
  await open(page);
  const handle = page.getByRole("separator", { name: "Resize panels" });
  const look = () =>
    handle.evaluate((bar) => {
      const system = (color: string) => {
        const probe = document.createElement("div");
        probe.style.backgroundColor = color;
        document.body.append(probe);
        const value = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return value;
      };
      const style = getComputedStyle(bar);
      return {
        text: system("CanvasText"),
        highlight: system("Highlight"),
        bar: style.backgroundColor,
        grip: getComputedStyle(bar, "::after").backgroundColor,
        outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
        focused: bar.matches(":focus-visible"),
      };
    });
  const rest = await look();
  expect(rest.bar).toBe(rest.text);
  expect(rest.grip).toBe(rest.text);
  expect(rest.outline).toMatch(/^none 0px/);

  await page.keyboard.press("Tab");
  await handle.focus();
  const focused = await look();
  expect(focused.focused).toBe(true);
  expect(focused.bar).toBe(focused.highlight);
  expect(focused.outline).toBe(`solid 2px ${focused.text}`);
});

test("without the stylesheet, the bar is a focus stop that can be seen: its name, in a box of its own (WCAG 2.4.7)", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "on a phone the panel slides over the stage: no bar");
  await open(page, "css=0&");
  const handle = page.getByRole("separator", { name: "Resize panels" });
  await handle.focus();
  await expect(handle).toBeFocused();
  const box = (await handle.boundingBox())!;
  expect(box.width).toBeGreaterThan(8);
  expect(box.height).toBeGreaterThan(8);
  await expect(handle).toContainText("Resize panels");
});

/*
 * Document with the panel open beside the thumbnails: three panes and two bars. Each bar
 * steps its pane within the room it shares with the page, so neither squeezes the other
 * pane and each comes all the way round to its own size.
 */
for (const across of [1280, 1000])
  test(`Document at ${across}px, the panel open beside the thumbnails: each bar steps its pane all the way round (WCAG 2.5.7)`, async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "on a phone the panes slide over the page: no bars");
    await page.setViewportSize({ width: across, height: 800 });
    await open(page, "scene=document&");
    await page.getByRole("button", { name: "More information" }).click();
    const sidebar = page.locator(".clover-template-document-sidebar");
    const main = page.locator(".clover-template-document-main");
    const panel = page.locator(".clover-template-document-panel");
    const thumbnailsBar = page.locator(
      ".clover-template-document-sidebar + .clover-split-handle",
    );
    // The panel's bar, which its toggle's spine follows while the panel is open.
    const panelBar = page.locator(
      ".clover-template-document-body > .clover-split-handle[aria-controls$='-panel']",
    );
    await expect(panelBar).toBeVisible();
    await expect.poll(() => width(panel)).toBeCloseTo(384, 0);
    const pageMin = 256;

    // The panel's bar: own, widest (the page down to its minimum), narrowest, own.
    const room = (await width(panel)) + (await width(main)) - pageMin;
    await panelBar.click();
    await expect.poll(() => width(panel)).toBeCloseTo(room, 0);
    expect(await width(sidebar)).toBeCloseTo(208, 0);
    expect(await width(main)).toBeGreaterThanOrEqual(pageMin - 1);
    await expect(panelBar).toHaveAttribute(
      "aria-valuenow",
      (await panelBar.getAttribute("aria-valuemax"))!,
    );
    await panelBar.click();
    await expect.poll(() => width(panel)).toBeCloseTo(224, 0);
    await panelBar.click();
    await expect.poll(() => width(panel)).toBeCloseTo(384, 0);
    expect(await width(sidebar)).toBeCloseTo(208, 0);

    // The thumbnails' bar: own, widest (24rem, or what the page can spare), narrowest, own.
    const widest = Math.min(
      384,
      (await width(sidebar)) + (await width(main)) - pageMin,
    );
    await thumbnailsBar.click();
    await expect.poll(() => width(sidebar)).toBeCloseTo(widest, 0);
    expect(await width(panel)).toBeCloseTo(384, 0);
    await thumbnailsBar.click();
    await expect.poll(() => width(sidebar)).toBeCloseTo(128, 0);
    await thumbnailsBar.click();
    await expect.poll(() => width(sidebar)).toBeCloseTo(208, 0);
    expect(await width(panel)).toBeCloseTo(384, 0);
  });

test("a double click on Document's thumbnails' bar steps them once, and the second click, where the bar was, turns no page", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "on a phone the thumbnails slide over the page: no bar");
  await open(page, "scene=document&");
  const sidebar = page.locator(".clover-template-document-sidebar");
  const handle = page.locator(
    ".clover-template-document-sidebar + .clover-split-handle",
  );
  // The current view, as its thumbnail is selected.
  const position = page.locator(
    ".clover-template-document-sidebar [role='option'][aria-selected='true']",
  );
  await expect(handle).toBeVisible();
  await expect(position).toHaveCount(1);
  const before = await position.textContent();
  const box = (await handle.boundingBox())!;
  // Low on the bar, beside a thumbnail once the bar has moved off.
  const at = { x: box.x + box.width / 2, y: box.y + box.height * 0.7 };
  await page.mouse.dblclick(at.x, at.y);
  await expect.poll(() => width(sidebar)).toBeCloseTo(384, 0);
  expect(
    await page.evaluate(
      ({ x, y }) =>
        Boolean(
          document
            .elementFromPoint(x, y)
            ?.closest(".clover-template-document-sidebar"),
        ),
      at,
    ),
  ).toBe(true);
  await expect(position).toHaveText(before!);
  await expect(sidebar.locator(":focus")).toHaveCount(0);

  // Past a double click's time, a click there is the thumbnail's.
  await page.waitForTimeout(600);
  await page.mouse.click(at.x, at.y);
  await expect(position).not.toHaveText(before!);
});

test("a press on the bar's popover, over the panel, neither steps nor drags the bar", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "on a phone there is no bar");
  await open(page);
  const handle = page.getByRole("separator", { name: "Resize panels" });
  const panel = page.locator(".clover-template-default-panel");
  const own = await width(panel);
  const at = await middle(handle);
  await page.mouse.move(at.x, at.y);
  const tip = handle.locator(".clover-tip");
  await expect(tip).toBeVisible();
  const box = (await tip.boundingBox())!;
  const far = { x: box.x + box.width - 4, y: box.y + box.height / 2 };
  await page.mouse.move(far.x, far.y, { steps: 4 });
  expect(
    await tip.evaluate((element) => getComputedStyle(element).cursor),
  ).toBe("default");
  await page.mouse.click(far.x, far.y);
  await page.mouse.down();
  await page.mouse.move(far.x - 60, far.y, { steps: 4 });
  await page.mouse.up();
  expect(await width(panel)).toBeCloseTo(own, 0);
});

test("right to left, the popover hangs over the panel's side, and a click still steps the panel", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "on a phone there is no bar");
  await open(page);
  await page.evaluate(() => {
    document.documentElement.dir = "rtl";
  });
  const handle = page.getByRole("separator", { name: "Resize panels" });
  const panel = page.locator(".clover-template-default-panel");
  await expect(handle).toBeVisible();
  const bar = (await handle.boundingBox())!;
  const side = (await panel.boundingBox())!;
  expect(side.x + side.width).toBeLessThanOrEqual(bar.x + 1);
  await handle.focus();
  const tip = (await handle.locator(".clover-tip").boundingBox())!;
  expect(tip.x + tip.width).toBeLessThan(bar.x);
  const own = await width(panel);
  await handle.click();
  await expect.poll(() => width(panel)).toBeGreaterThan(own + 100);
});
