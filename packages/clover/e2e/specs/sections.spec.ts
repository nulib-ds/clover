import { expect, type Locator, type Page, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

/*
 * The accordion's stuck headings, in a narrow scrolling pane (`?scene=panel`): a site's
 * own sections, long named, each a list of links. JSDOM lays nothing out, so this is
 * where the stacks are measured and focus is walked.
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

async function open(page: Page, spaced: boolean) {
  await serveIIIF(page);
  await page.goto("/?scene=panel");
  if (spaced) await page.addStyleTag({ content: SPACING });
  await expect(
    page.getByRole("button", { name: "Notes on this work" }),
  ).toBeVisible();
}

/** How far, in px, any heading covers the element: 0 when none does. */
function covered(element: Locator) {
  return element.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const overlaps = [
      ...document.querySelectorAll(".clover-sections-heading"),
    ].map((heading) => {
      const { top, bottom } = heading.getBoundingClientRect();
      return Math.min(box.bottom, bottom) - Math.max(box.top, top);
    });
    return Math.max(0, ...overlaps);
  });
}

async function inSight(element: Locator) {
  await expect(element).toBeFocused();
  await expect(element).toBeInViewport({ ratio: 1 });
  expect(await covered(element)).toBeLessThanOrEqual(0.5);
}

for (const spaced of [false, true]) {
  test(`focus in the open section never lands under a stuck heading${spaced ? ", text spaced" : ""} (WCAG 2.4.11)`, async ({
    page,
    browserName,
  }) => {
    // Safari's Tab skips links unless the reader turns that on; Option+Tab reaches them.
    const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
    await open(page, spaced);
    const section = page.getByRole("region", { name: "Notes on this work" });
    const links = section.getByRole("link");
    const count = await links.count();
    expect(count).toBe(24);

    await page.getByRole("button", { name: "Notes on this work" }).focus();
    for (let index = 0; index < count; index++) {
      await page.keyboard.press(tab);
      await inSight(links.nth(index));
    }
    // On to the next heading, stuck at the bottom, and back up through the links.
    await page.keyboard.press(tab);
    await expect(
      page.getByRole("button", { name: "Provenance notes" }),
    ).toBeFocused();
    for (let index = count - 1; index >= 0; index--) {
      await page.keyboard.press(`Shift+${tab}`);
      await inSight(links.nth(index));
    }
  });
}

test("a pane too short for the stacks lets the headings scroll with the open section (WCAG 2.4.11, 1.4.12)", async ({
  page,
  browserName,
}) => {
  const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
  await open(page, true);
  const list = page.locator(".clover-sections");
  const pane = page.getByTestId("pane");
  // At 24rem the wrapped labels' stacks leave two lines and more: they stick.
  await expect(list).not.toHaveAttribute("data-stacks");
  // At 20rem they would not, and WebKit would squeeze them over the open section.
  await pane.evaluate((node) => (node.style.height = "20rem"));
  await expect(list).toHaveAttribute("data-stacks", "off");

  // No heading over another, wherever the pane is scrolled.
  const headings = page.locator(".clover-sections-heading");
  for (const at of [0, 0.25, 0.5, 0.75, 1]) {
    await pane.evaluate(
      (node, at) =>
        node.scrollTo({ top: at * (node.scrollHeight - node.clientHeight) }),
      at,
    );
    const edges = await headings.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect()),
    );
    edges.slice(1).forEach((edge, index) => {
      expect(edge.top).toBeGreaterThanOrEqual(edges[index].bottom - 0.5);
    });
  }

  /*
   * Focus never under a heading. Nothing sticks, so each browser scrolls focus in as it
   * would anywhere: Firefox leaves a link that mostly shows where it is.
   */
  const shown = async (element: Locator) => {
    await expect(element).toBeFocused();
    await expect(element).toBeInViewport({ ratio: 0.5 });
    expect(await covered(element)).toBeLessThanOrEqual(0.5);
  };
  const links = page
    .getByRole("region", { name: "Notes on this work" })
    .getByRole("link");
  await pane.evaluate((node) => node.scrollTo({ top: 0 }));
  await page.getByRole("button", { name: "Notes on this work" }).focus();
  for (let index = 0; index < 24; index++) {
    await page.keyboard.press(tab);
    await shown(links.nth(index));
  }
  for (let index = 22; index >= 0; index--) {
    await page.keyboard.press(`Shift+${tab}`);
    await shown(links.nth(index));
  }

  // Room again, and they stick again.
  await pane.evaluate((node) => (node.style.height = "24rem"));
  await expect(list).not.toHaveAttribute("data-stacks");
});

test("a press on something partly under a stuck heading leaves the pane where it is", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName === "webkit",
    "Safari does not focus a link that is pressed",
  );
  await open(page, false);
  const pane = page.getByTestId("pane");
  const links = page
    .getByRole("region", { name: "Notes on this work" })
    .getByRole("link");
  const next = page.locator(".clover-sections-heading").nth(1);
  // The first link the stack below covers, scrolled to show only its top 6 px.
  const stack = (await next.boundingBox())!.y;
  let index = 0;
  while ((await links.nth(index).boundingBox())!.y + 6 <= stack) index++;
  const link = links.nth(index);
  const box = (await link.boundingBox())!;
  await pane.evaluate(
    (node, by) => node.scrollBy({ top: by, behavior: "instant" }),
    box.y - (stack - 6),
  );
  const shown = (await link.boundingBox())!;
  expect(stack - shown.y).toBeCloseTo(6, 0);
  const before = await pane.evaluate((node) => node.scrollTop);

  // Pressed where it shows: focus, but the pane stays under the pointer.
  await page.mouse.move(shown.x + shown.width / 2, shown.y + 3);
  await page.mouse.down();
  await expect(link).toBeFocused();
  expect(await pane.evaluate((node) => node.scrollTop)).toBe(before);
  await page.mouse.up();

  // From the keyboard, the same link is brought clear of the stack.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await inSight(link);
});

test("what is scrolled to in the open section clears the stuck headings too", async ({
  page,
}) => {
  await open(page, false);
  const links = page
    .getByRole("region", { name: "Notes on this work" })
    .getByRole("link");
  const pane = page.getByTestId("pane");
  // A Transcript's current cue is brought into view so, without focus.
  for (const [scroll, index] of [
    [0, 23],
    [1e6, 0],
  ] as const) {
    await pane.evaluate((node, top) => node.scrollTo({ top }), scroll);
    await links
      .nth(index)
      .evaluate((node) => node.scrollIntoView({ block: "nearest" }));
    await expect(links.nth(index)).toBeInViewport({ ratio: 1 });
    expect(await covered(links.nth(index))).toBeLessThanOrEqual(0.5);
  }
});

test("a label wraps, and each stack is as tall as the headings in it (WCAG 1.4.12)", async ({
  page,
}) => {
  await open(page, true);
  const headings = page.locator(".clover-sections-heading");
  const labels = page.locator(".clover-sections-label");

  // Every label whole: none runs past its box or is cut, and the longest wrap.
  const shown = await labels.evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      return {
        text: node.textContent,
        cut: node.scrollWidth > node.clientWidth + 0.5,
        ellipsis: style.textOverflow === "ellipsis",
        lines: Math.round(
          node.getBoundingClientRect().height / parseFloat(style.lineHeight),
        ),
      };
    }),
  );
  expect(shown.map(({ cut, ellipsis }) => cut || ellipsis)).toEqual([
    false,
    false,
    false,
    false,
  ]);
  const lines = Object.fromEntries(
    shown.map((label) => [label.text, label.lines]),
  );
  expect(lines["Notes on this work"]).toBeGreaterThan(1);
  expect(lines["Map"]).toBe(1);

  // Open the second, so two headings stack at the top and two at the bottom.
  await page.getByRole("button", { name: "Provenance notes" }).click();
  const pane = page.getByTestId("pane");
  const edges = () =>
    headings.evaluateAll((nodes) =>
      nodes.map((node) => {
        const { top, bottom } = node.getBoundingClientRect();
        return { top, bottom };
      }),
    );
  // Where each rests: the first two at the top, the last two at the end.
  await pane.evaluate((node) => node.scrollTo({ top: 0 }));
  const top = await edges();
  await pane.evaluate((node) => node.scrollTo({ top: node.scrollHeight }));
  const end = await edges();

  await pane.evaluate((node) =>
    node.scrollTo({ top: (node.scrollHeight - node.clientHeight) / 2 }),
  );
  const stuck = await edges();
  const near = (a: number, b: number) =>
    expect(Math.abs(a - b)).toBeLessThan(1);
  // Stuck where they rest, each touching the next: no overlap, no gap.
  near(stuck[0].top, top[0].top);
  near(stuck[1].top, stuck[0].bottom);
  near(stuck[2].bottom, stuck[3].top);
  near(stuck[3].bottom, end[3].bottom);
  near(stuck[2].top, end[2].top);
  // The wrapped heading is the taller, and the one under it stacks below all of it.
  expect(stuck[0].bottom - stuck[0].top).toBeGreaterThan(
    stuck[2].bottom - stuck[2].top,
  );
});
