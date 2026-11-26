import { createRequire } from "node:module";

import { expect, type Page, test } from "@playwright/test";

import { openPanel, serveIIIF } from "./fixtures";

const axePath = createRequire(__filename).resolve("axe-core/axe.min.js");

/** A basemap of one color: nothing to fetch, nothing to draw but the ground. */
const STYLE = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "ground",
      type: "background",
      paint: { "background-color": "#e6e8eb" },
    },
  ],
};

const PLACES = "https://fixtures.test/0240-navPlace-on-canvases.json";

async function open(page: Page, query: string) {
  await serveIIIF(page);
  // Registered last, so it answers before the fixtures' catch-all.
  await page.route("https://fixtures.test/map-style.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(STYLE),
    }),
  );
  await page.goto(query);
  await ready(page);
}

/** MapLibre loads when a map is first shown: on a cold dev server, a while. */
async function ready(page: Page) {
  await expect(page.locator(".clover-geomap").first()).toHaveAttribute(
    "data-status",
    "ready",
    { timeout: 30_000 },
  );
}

test("the map is one region, named, and described by a count of its places", async ({
  page,
}) => {
  await open(page, `/?scene=map&content=${PLACES}`);
  // MapLibre's canvas is the region; Clover's box around it is not another.
  const region = page.getByRole("region");
  await expect(region).toHaveCount(1);
  await expect(region).toHaveClass(/maplibregl-canvas/);
  await expect(region).toHaveAccessibleName("Map");
  await expect(region).toHaveAccessibleDescription(
    "Places listed after the map: 2",
  );
  // Its credits are named in Clover's words.
  await expect(page.locator(".maplibregl-ctrl-attrib-button")).toHaveAttribute(
    "aria-label",
    "Map credits",
  );
});

test("axe: no serious or critical violations on a map and its places", async ({
  page,
}) => {
  await open(page, `/?scene=map&content=${PLACES}`);
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const result = await (window as any).axe.run(document, {
      resultTypes: ["violations"],
    });
    return result.violations
      .filter((v: any) => v.impact === "serious" || v.impact === "critical")
      .map((v: any) => ({
        id: v.id,
        nodes: v.nodes.map((n: any) => n.target.join(" ")).slice(0, 5),
      }));
  });
  expect(violations).toEqual([]);
});

test("a place is chosen from the keyboard, and named in its language", async ({
  page,
}) => {
  await open(page, `/?scene=map&content=${PLACES}`);
  const label = page.getByTestId("canvas-label");
  await expect(label).toHaveText("Front of Bronze");
  // The places are Items' list: a listbox, one stop, its options moved through by arrow.
  const list = page.getByRole("listbox", { name: "On the map" });
  const bronze = list.getByRole("option", {
    name: "Current Location of the Laocoön Bronze",
  });
  const painting = list.getByRole("option", {
    name: "Current Location of Painting",
  });
  await expect(bronze).toHaveAttribute("aria-selected", "true");

  // From the map, through its controls, to the places: the current one first.
  await page.getByRole("region", { name: "Map" }).focus();
  for (let step = 0; step < 8; step++) {
    if (await bronze.evaluate((node) => node === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(bronze).toBeFocused();
  // An arrow moves focus alone: nothing is chosen until Enter or Space.
  await page.keyboard.press("ArrowDown");
  await expect(painting).toBeFocused();
  await expect(painting).toBeInViewport();
  await expect(bronze).toHaveAttribute("aria-selected", "true");
  await expect(label).toHaveText("Front of Bronze");

  await page.keyboard.press("Enter");
  const popup = page.locator(".clover-geomap-popup");
  await expect(popup).toHaveCount(1);
  await expect(popup).toHaveText("Current Location of Painting");
  await expect(popup.locator('span[lang="en"]')).toHaveCount(1);
  await expect(label).toHaveText("Painting");
  await expect(painting).toHaveAttribute("aria-selected", "true");
  await expect(bronze).not.toHaveAttribute("aria-selected", "true");
  // Focus stays on the list, and one popup shows at a time.
  await expect(painting).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(bronze).toBeFocused();
  await page.keyboard.press("Space");
  await expect(popup).toHaveCount(1);
  await expect(popup).toHaveText("Current Location of the Laocoön Bronze");
  await expect(label).toHaveText("Front of Bronze");
  await expect(bronze).toHaveAttribute("aria-selected", "true");
});

/** The Viewer on the places, its default basemap one color, its panel open. */
async function openViewer(page: Page, isMobile: boolean, panel = "") {
  await serveIIIF(page);
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(STYLE),
    }),
  );
  await page.goto(`/?${panel}content=${PLACES}`);
  await openPanel(page, isMobile);
}

test("in the Viewer's Map tab, the places sit under the map", async ({
  page,
  isMobile,
}) => {
  // The Map's own section, where the page names it.
  await openViewer(page, isMobile, "panel=tabs&sections=about,map&");
  await page.getByRole("tab", { name: "Map" }).click();
  const painting = page
    .getByRole("listbox", { name: "On the map" })
    .getByRole("option", { name: "Current Location of Painting" });
  await expect(painting).toBeVisible();
  // The map's box is the first child; its list, Items', is a `div` too.
  const box = await page
    .locator(".clover-geomap > div:first-child")
    .boundingBox();
  const list = await page.locator(".clover-geomap-items").boundingBox();
  expect(box!.height).toBeGreaterThan(100);
  expect(list!.y).toBeGreaterThanOrEqual(box!.y + box!.height);
  await painting.scrollIntoViewIfNeeded();
  await expect(painting).toBeInViewport();
});

test("in the accordion's Map section, the map is no second region", async ({
  page,
  isMobile,
}) => {
  await openViewer(page, isMobile, "panel=accordion&sections=about,map&");
  // The panel's section: the Canvas's place control is named "Map" too.
  await page
    .getByLabel("Information panel")
    .getByRole("button", { name: "Map", exact: true })
    .click();
  await ready(page);
  // The section is the landmark; the map in it is a group of the same name.
  const section = page.getByRole("region", { name: "Map" });
  await expect(section).toHaveCount(1);
  await expect(section).toHaveClass(/clover-sections-panel/);
  await expect(section.getByRole("region")).toHaveCount(0);
  const map = section.getByRole("group", { name: "Map" });
  await expect(map).toHaveClass(/maplibregl-canvas/);
  await expect(map).toHaveAccessibleDescription(
    "Places listed after the map: 2",
  );
});

// Mat, 2026-11-13: no Map section by default; a place, named in About as its date is,
// opens the map expanded over the Body.
test("in the Viewer, a place pressed in About fills the Body with the map, and gives it back", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "the panel lies over the Body on a phone");
  await openViewer(page, isMobile, "panel=tabs&");
  await expect(page.getByRole("tab", { name: "Map" })).toHaveCount(0);
  const find = page.getByRole("button", {
    name: "Find on the map: Current Location of the Laocoön Bronze",
  });
  await find.focus();
  await page.keyboard.press("Enter");
  await ready(page);
  // The map takes the Canvas's place, filling the Body; focus stays on the place.
  const figure = page.getByTestId("clover-canvas");
  await expect(figure).toHaveAttribute("data-place", "swapped");
  const box = page.locator('[id^="place-asked-"]');
  await expect(box).toHaveAttribute("data-swapped", "true");
  const body = (await figure.boundingBox())!;
  const map = (await box.locator(".clover-geomap").boundingBox())!;
  expect(map.width).toBeGreaterThan(body.width * 0.9);
  await expect(find).toBeFocused();
  await expect(find).toHaveAttribute("aria-current", "true");
  // Framed and marked, its name in About beside it: no popup over the place.
  await expect(box.locator(".clover-geomap-popup")).toHaveCount(0);
  // About's places and the map over the Body: no serious or critical violations.
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const result = await (window as any).axe.run(
      { include: [[".clover-about-places"], ['[id^="place-asked-"]']] },
      { resultTypes: ["violations"] },
    );
    return result.violations
      .filter((v: any) => v.impact === "serious" || v.impact === "critical")
      .map((v: any) => ({
        id: v.id,
        nodes: v.nodes.map((n: any) => n.target.join(" ")).slice(0, 5),
      }));
  });
  expect(violations).toEqual([]);

  // As Document's (Mat, 2026-11-15: "default should be treated the same as document"): no
  // Close of its own over the Body, its zoom row at its top end, and under it the page's
  // picture in an Inset, which trades them back, its one Close in that box (2026-11-16),
  // the Canvas's controls away meanwhile.
  await expect(box.getByRole("button", { name: "Close" })).toHaveCount(1);
  await expect(
    box
      .locator(".clover-canvas-place-page")
      .getByRole("button", { name: "Close" }),
  ).toHaveCount(1);
  const zoomRow = (await box
    .locator(".maplibregl-ctrl-top-right")
    .boundingBox())!;
  const pageInset = (await box
    .locator(".clover-geomap .clover-canvas-place-page")
    .boundingBox())!;
  expect(pageInset.y).toBeGreaterThan(zoomRow.y + zoomRow.height);
  expect(pageInset.y - (zoomRow.y + zoomRow.height)).toBeLessThan(20);
  await expect(
    page.locator(".clover-canvas > .clover-canvas-controls"),
  ).toBeHidden();

  // Traded: the map in its box under the Canvas's controls, which come back, their Tips
  // over it, focus on its Expand map.
  await box.getByRole("button", { name: "Collapse map" }).focus();
  await page.keyboard.press("Enter");
  await expect(box).toHaveClass(/clover-inset/);
  await expect(figure).not.toHaveAttribute("data-place", "swapped");
  await expect(box.getByRole("button", { name: "Expand map" })).toBeFocused();
  const row = (await page
    .locator(".clover-canvas > .clover-canvas-controls")
    .boundingBox())!;
  const small = (await box.boundingBox())!;
  expect(small.y).toBeGreaterThan(row.y + row.height);
  expect(small.y - (row.y + row.height)).toBeLessThan(20);
  expect(Math.abs(row.x + row.width - (small.x + small.width))).toBeLessThan(2);

  // Closed: the Canvas stays, focus back on the place pressed.
  await box.getByRole("button", { name: "Close" }).click();
  await expect(box).toHaveCount(0);
  await expect(find).toBeFocused();
  await expect(find).not.toHaveAttribute("aria-current");
});

// Mat, 2026-11-13: on a phone the panel lies over the Body, so it goes, and focus with it,
// whether the place in About is tapped (which leaves focus nowhere) or pressed from the
// keyboard.
for (const way of ["a tap", "the keyboard"] as const) {
  test(`on a phone, a place pressed in About by ${way} puts the panel away, focus going to the map`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "the panel lies beside the Body on a wide screen");
    await openViewer(page, isMobile, "panel=tabs&");
    const place = page.getByRole("button", {
      name: "Find on the map: Current Location of the Laocoön Bronze",
    });
    if (way === "a tap") await place.tap();
    else {
      await place.focus();
      await page.keyboard.press("Enter");
    }
    await ready(page);
    const box = page.locator('[id^="place-asked-"]');
    await expect(box).toHaveAttribute("data-swapped", "true");
    // The panel is put away, and focus goes on to the map that took the Canvas's place.
    await expect(page.locator(".clover-template-panel")).toBeHidden();
    await expect(
      box.getByRole("button", { name: "Collapse map" }),
    ).toBeFocused();

    // Escape puts away the Tip focus brought, then the map (one thing each, WCAG 1.4.13);
    // focus goes to the panel's toggle, as the place pressed went with the panel.
    await page.keyboard.press("Escape");
    await expect(box).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(box).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "More information" }),
    ).toBeFocused();
  });
}

/** Document on the places, its default basemap one color, its aside on About. */
async function openDocument(page: Page, content = PLACES) {
  await serveIIIF(page);
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(STYLE),
    }),
  );
  await page.goto(`/?scene=document&content=${content}`);
  await page.getByRole("button", { name: "About", exact: true }).click();
}

// Mat, 2026-11-13: Document, as a Panel, offers no Map section unasked; a place pressed in
// About shows the map over the pages, the aside beside it.
test("in Document, a place pressed in About shows the map over the pages, and gives it back", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "the aside lies over the pages on a phone");
  await openDocument(page);
  await expect(page.locator('button[data-section="map"]')).toHaveCount(0);
  const find = page.getByRole("button", {
    name: "Find on the map: Current Location of the Laocoön Bronze",
  });
  await find.focus();
  await page.keyboard.press("Enter");
  await ready(page);
  const over = page.locator(".clover-template-document-map");
  await expect(over).toHaveAttribute("data-asked", "");
  // Over the whole of the pages' column, the aside beside it, focus kept on the place.
  const column = (await page
    .locator(".clover-template-document-main")
    .boundingBox())!;
  const map = (await over.boundingBox())!;
  expect(map.width).toBeGreaterThan(column.width * 0.95);
  expect(map.height).toBeGreaterThan(column.height * 0.95);
  await expect(page.locator(".clover-template-document-aside")).toBeVisible();
  await expect(find).toBeFocused();
  await expect(find).toHaveAttribute("aria-current", "true");
  // Its zoom row at its top end, where the full viewer has the Canvas's controls (Mat,
  // 2026-11-14: "put map controls in top right. like we do for canvas controls."), and no
  // Close of its own: the page's picture in a box under it, which trades the two ("remove
  // this. in the top right corner, show the image inset into a box").
  const zoomRow = (await over
    .locator(".maplibregl-ctrl-top-right")
    .boundingBox())!;
  expect(map.x + map.width - (zoomRow.x + zoomRow.width)).toBeLessThan(40);
  expect(zoomRow.y - map.y).toBeLessThan(40);
  // An Inset (`Clover.Inset`): the page's picture, Collapse map in its corner, and the one
  // Close after it (2026-11-16: "include close button here as well").
  const swap = over.getByRole("button", { name: "Collapse map" });
  const pageInset = over.locator(".clover-template-document-map-page");
  await expect(over.getByRole("button", { name: "Close" })).toHaveCount(1);
  await expect(pageInset.getByRole("button", { name: "Close" })).toHaveCount(1);
  // Its picture the page's (the test serves no image, so only its element is checked).
  await expect(pageInset.locator("img")).toHaveCount(1);
  const box = (await pageInset.boundingBox())!;
  expect(map.x + map.width - (box.x + box.width)).toBeLessThan(40);
  // In the map's box (its `children`), `s` under the zoom row, whose Tips lie over it
  // (Mat, 2026-11-14: "This is a little too far off the controls above it.").
  await expect(
    over.locator(".clover-geomap .clover-template-document-map-page"),
  ).toHaveCount(1);
  expect(box.y).toBeGreaterThan(zoomRow.y + zoomRow.height);
  expect(box.y - (zoomRow.y + zoomRow.height)).toBeLessThan(20);
  // About's places and the map over the pages: no serious or critical violations.
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const result = await (window as any).axe.run(
      {
        include: [[".clover-about-places"], [".clover-template-document-map"]],
      },
      { resultTypes: ["violations"] },
    );
    return result.violations
      .filter((v: any) => v.impact === "serious" || v.impact === "critical")
      .map((v: any) => ({
        id: v.id,
        nodes: v.nodes.map((n: any) => n.target.join(" ")).slice(0, 5),
      }));
  });
  expect(violations).toEqual([]);

  // Traded: the pages back, the map in a box over them at their top end, focus on its
  // Expand map; and back.
  await swap.click();
  await expect(over).toHaveAttribute("data-inset", "true");
  await expect(page.locator(".clover-template-document-column")).toBeVisible();
  const expand = over.getByRole("button", { name: "Expand map" });
  await expect(expand).toBeFocused();
  const inset = (await over.boundingBox())!;
  expect(inset.width).toBeLessThan(column.width * 0.6);
  // At the column's top end, where nothing is over it.
  expect(inset.y - column.y).toBeLessThan(40);
  await expand.click();
  await expect(over).not.toHaveAttribute("data-inset");
  await expect(swap).toBeFocused();

  // Closed from its box: the pages come back, focus on the place pressed.
  await swap.click();
  await over.getByRole("button", { name: "Close" }).click();
  await expect(over).toHaveCount(0);
  await expect(find).toBeFocused();
  await expect(find).not.toHaveAttribute("aria-current");

  // Asked again, then another Canvas chosen: the map follows it to its place, which About
  // names, pressed (Mat, 2026-11-13: "toggling canvases in expanded map mode doesn't
  // toggle map").
  await find.click();
  await expect(over).toHaveCount(1);
  await page.getByRole("option", { name: "Painting", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Find on the map: Current Location of Painting",
    }),
  ).toHaveAttribute("aria-current", "true");
  await expect(over).toHaveCount(1);
});

// Mat, 2026-11-14: "add the map icon back if canvas has geo data (navplace/georeferencing
// annotation) this should toggle the inset on/off".
test("in Document's full viewer, the Map control shows the map in its box under the controls, and puts it away", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "the aside lies over the pages on a phone");
  await openDocument(page);
  // Among the pages, none (Mat, 2026-11-09: "remove this from over here").
  const control = page.locator(
    '.clover-template-document-live .clover-canvas-controls button[data-button="place"]',
  );
  await expect(control).toHaveCount(0);
  await page.locator(".clover-template-document-live").click();
  await expect(
    page.locator(".clover-template-document-column[data-expanded]"),
  ).toHaveCount(1);
  await expect(control).toHaveAttribute("aria-expanded", "false");
  // From the keyboard: Safari gives a button no focus on a press.
  await control.focus();
  await page.keyboard.press("Enter");
  await ready(page);
  const box = page.locator(".clover-template-document-map");
  await expect(box).toHaveAttribute("data-inset", "true");
  await expect(control).toHaveAttribute("aria-expanded", "true");
  await expect(control).toBeFocused();
  // In the Canvas, `s` under its row, its end the row's, the row's Tips over it (Mat,
  // 2026-11-14: "This is a little too far off the controls above it.").
  await expect(
    page.locator(
      ".clover-template-document-live .clover-canvas .clover-template-document-map",
    ),
  ).toHaveCount(1);
  const row = (await page
    .locator(".clover-template-document-live .clover-canvas-controls")
    .boundingBox())!;
  const inset = (await box.boundingBox())!;
  expect(Math.abs(row.x + row.width - (inset.x + inset.width))).toBeLessThan(2);
  expect(inset.y).toBeGreaterThan(row.y + row.height);
  expect(inset.y - (row.y + row.height)).toBeLessThan(20);
  // Pressed again: put away, focus kept on it.
  await page.keyboard.press("Enter");
  await expect(box).toHaveCount(0);
  await expect(control).toHaveAttribute("aria-expanded", "false");
  await expect(control).toBeFocused();
});

// Mat's preview, 2026-11-15: a place picked on the page opened its box over the Map
// control's, in the same place, that map's Close under it (WCAG 2.4.11). They take turns.
test("in Document's full viewer, a place picked on the page and the Map control's map take turns", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "the aside lies over the pages on a phone");
  await openDocument(
    page,
    "https://clover.iiif.library.northwestern.edu/mocks/sanborn/manifest.json",
  );
  const live = page.locator(".clover-template-document-live");
  await live.click({ position: { x: 40, y: 40 } });
  await expect(
    page.locator(".clover-template-document-column[data-expanded]"),
  ).toHaveCount(1);
  const control = live.locator(
    '.clover-canvas-controls button[data-button="place"]',
  );
  // From the keyboard: Safari gives a button no focus on a press.
  await control.focus();
  await page.keyboard.press("Enter");
  await ready(page);
  const map = page.locator(".clover-template-document-map");
  await expect(map).toHaveCount(1);

  // Sheet 17's library, a GeoJSON Feature (Cookbook 0139): its box, the map put away.
  const library = live.getByRole("button", { name: "Evanston Public Library" });
  await library.focus();
  await page.keyboard.press("Enter");
  const picked = live.locator(".clover-canvas-place");
  await expect(picked).toHaveCount(1);
  await expect(map).toHaveCount(0);
  await expect(control).toHaveAttribute("aria-expanded", "false");
  await expect(library).toBeFocused();

  // The control again: its map, the place's box put away, focus kept on it.
  await control.focus();
  await page.keyboard.press("Enter");
  await expect(map).toHaveCount(1);
  await expect(picked).toHaveCount(0);
  await expect(control).toHaveAttribute("aria-expanded", "true");
  await expect(control).toBeFocused();
});

// On a phone Document's aside lies over the pages, so it goes, and focus with it.
for (const way of ["a tap", "the keyboard"] as const) {
  test(`on a phone, a place pressed in Document's About by ${way} puts the aside away, focus going to the map`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "the aside lies beside the pages on a wide screen");
    await openDocument(page);
    const place = page.getByRole("button", {
      name: "Find on the map: Current Location of the Laocoön Bronze",
    });
    if (way === "a tap") await place.tap();
    else {
      await place.focus();
      await page.keyboard.press("Enter");
    }
    await ready(page);
    const over = page.locator(".clover-template-document-map");
    await expect(page.locator(".clover-template-document-aside")).toBeHidden();
    await expect(
      over.getByRole("button", { name: "Collapse map" }),
    ).toBeFocused();

    // Escape puts away any Tip focus brought, then the map; focus goes to About's button,
    // as the place pressed went with the aside.
    await page.keyboard.press("Escape");
    if (await over.count()) await page.keyboard.press("Escape");
    await expect(over).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "About", exact: true }),
    ).toBeFocused();
  });
}

test("in forced colors, only the current place's ring shows", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "forced colors emulate in Chromium");
  await page.emulateMedia({ forcedColors: "active" });
  await open(page, `/?scene=map&content=${PLACES}`);
  const list = page.getByRole("listbox", { name: "On the map" });
  const bronze = list.getByRole("option", {
    name: "Current Location of the Laocoön Bronze",
  });
  const painting = list.getByRole("option", {
    name: "Current Location of Painting",
  });
  await expect(bronze).toHaveAttribute("aria-selected", "true");
  // A system color, as the browser resolves it.
  const system = (name: string) =>
    page.evaluate((name) => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = name;
      document.body.append(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    }, name);
  // The ring around an item's picture, as Items draws it.
  const pictures = (option: typeof bronze) =>
    option.locator(".clover-items-pictures");
  const ring = (option: typeof bronze) =>
    pictures(option).evaluate((node) => getComputedStyle(node).outlineColor);
  const ground = await system("Canvas");
  const highlight = await system("Highlight");
  expect(highlight).not.toBe(ground);
  expect(await ring(painting)).toBe(ground);
  expect(await ring(bronze)).toBe(highlight);
  await expect(pictures(bronze)).toHaveCSS("outline-style", "solid");
  await expect(pictures(bronze)).toHaveCSS("outline-width", "3px");
});

// Audit of 2026-11-25: MapLibre disabled Zoom out at its least zoom, dropping focus.
test("Zoom out at the least zoom keeps focus, and says it is at an end", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, `/?scene=map&content=${PLACES}`);
  const out = page.getByRole("button", { name: "Zoom out" });
  await out.focus();
  for (let press = 0; press < 40; press++) {
    if ((await out.getAttribute("aria-disabled")) === "true") break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(50);
  }
  await expect(out).toHaveAttribute("aria-disabled", "true");
  // Never `disabled`, which would drop focus to the page (WCAG 2.4.3).
  expect(
    await out.evaluate((button) => (button as HTMLButtonElement).disabled),
  ).toBe(false);
  await expect(out).toBeFocused();
  // A press there does nothing, and keeps focus.
  await page.keyboard.press("Enter");
  await expect(out).toBeFocused();
  // Zoom in, from there, takes it off the end.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(out).toHaveAttribute("aria-disabled", "false");
});

// Audit of 2026-11-25: in the higher-contrast mode the fill at rest is the fill focused.
test("in the higher-contrast mode, a focused map control has a ring", async ({
  page,
}) => {
  await page.emulateMedia({ contrast: "more" });
  await open(page, `/?scene=map&content=${PLACES}`);
  const zoom = page.getByRole("button", { name: "Zoom in" });
  await zoom.focus();
  await expect(zoom).toBeFocused();
  expect(
    await zoom.evaluate((element) => getComputedStyle(element).boxShadow),
  ).not.toBe("none");
});

test("in forced colors, the credits' button shows focus", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "forced colors emulate in Chromium");
  await page.emulateMedia({ forcedColors: "active" });
  await serveIIIF(page);
  // A basemap with credits, so its ⓘ shows: the one-color basemap has none.
  await page.route("https://fixtures.test/map-style.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        ...STYLE,
        sources: {
          credited: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
            attribution: "Test basemap",
          },
        },
        // Credited only where a layer draws from it.
        layers: [
          ...STYLE.layers,
          { id: "credited", type: "circle", source: "credited" },
        ],
      }),
    }),
  );
  await page.goto(`/?scene=map&content=${PLACES}`);
  await ready(page);
  const credits = page.locator(".maplibregl-ctrl-attrib-button");
  // By the keyboard, from Zoom out before it.
  await page.getByRole("button", { name: "Zoom out" }).focus();
  await page.keyboard.press("Tab");
  await expect(credits).toBeFocused();
  expect(
    await credits.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).toBe("solid");
});

// Audit of 2026-11-25: the annotations menu stayed open over the map filling the Body,
// over its Collapse map and Close, as Tab went on into the map (WCAG 2.4.11).
test("the annotations menu over a map filling the Body closes as focus goes into the map", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "the panel lies over the Body on a phone");
  await serveIIIF(page);
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(STYLE),
    }),
  );
  await page.goto(
    "/?content=https://clover.iiif.library.northwestern.edu/mocks/sanborn/manifest.json",
  );
  const figure = page.getByTestId("clover-canvas");
  const place = figure.locator(
    '.clover-canvas-controls button[data-button="place"]',
  );
  await place.focus();
  await page.keyboard.press("Enter");
  await ready(page);
  await figure.getByRole("button", { name: "Expand map" }).click();
  await expect(figure).toHaveAttribute("data-place", "swapped");
  const annotations = figure.locator(
    '.clover-canvas-controls button[data-button="annotations"]',
  );
  await annotations.focus();
  await page.keyboard.press("Enter");
  const menu = figure.locator(".clover-canvas-annotation-menu");
  await expect(menu).toHaveCount(1);
  await figure
    .locator(".clover-canvas-place[data-swapped] .maplibregl-canvas")
    .focus();
  await expect(menu).toHaveCount(0);
});
