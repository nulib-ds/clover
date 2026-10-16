import { createRequire } from "node:module";

import { expect, type Page, test } from "@playwright/test";

import { openPanel, serveIIIF } from "./fixtures";

const axePath = createRequire(__filename).resolve("axe-core/axe.min.js");

/** A basemap of one colour: nothing to fetch, nothing to draw but the ground. */
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
  const bronze = page.getByRole("button", {
    name: "Current Location of the Laocoön Bronze",
  });
  const painting = page.getByRole("button", {
    name: "Current Location of Painting",
  });
  await expect(bronze).toHaveAttribute("aria-current", "true");

  // From the map, through its controls, to the places.
  await page.getByRole("region", { name: "Map" }).focus();
  for (let step = 0; step < 8; step++) {
    if (await painting.evaluate((node) => node === document.activeElement))
      break;
    await page.keyboard.press("Tab");
  }
  await expect(painting).toBeFocused();
  await expect(painting).toBeInViewport();

  await page.keyboard.press("Enter");
  const popup = page.locator(".clover-geomap-popup");
  await expect(popup).toHaveCount(1);
  await expect(popup).toHaveText("Current Location of Painting");
  await expect(popup.locator('span[lang="en"]')).toHaveCount(1);
  await expect(label).toHaveText("Painting");
  await expect(painting).toHaveAttribute("aria-current", "true");
  await expect(bronze).not.toHaveAttribute("aria-current", "true");
  // Focus stays on the list, and one popup shows at a time.
  await expect(painting).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(bronze).toBeFocused();
  await page.keyboard.press("Space");
  await expect(popup).toHaveCount(1);
  await expect(popup).toHaveText("Current Location of the Laocoön Bronze");
  await expect(label).toHaveText("Front of Bronze");
});

/** The Viewer on the places, its default basemap one colour, its panel open. */
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
  await openViewer(page, isMobile, "panel=tabs&");
  await page.getByRole("tab", { name: "Map" }).click();
  const painting = page.getByRole("button", {
    name: "Current Location of Painting",
  });
  await expect(painting).toBeVisible();
  const box = await page.locator(".clover-geomap > div").boundingBox();
  const list = await page.locator(".clover-geomap-places").boundingBox();
  expect(box!.height).toBeGreaterThan(100);
  expect(list!.y).toBeGreaterThanOrEqual(box!.y + box!.height);
  await painting.scrollIntoViewIfNeeded();
  await expect(painting).toBeInViewport();
});

test("in the accordion's Map section, the map is no second region", async ({
  page,
  isMobile,
}) => {
  await openViewer(page, isMobile, "panel=accordion&");
  await page.getByRole("button", { name: "Map", exact: true }).click();
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

test("in forced colours, only the current place's edge shows", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "forced colours emulate in Chromium");
  await page.emulateMedia({ forcedColors: "active" });
  await open(page, `/?scene=map&content=${PLACES}`);
  const bronze = page.getByRole("button", {
    name: "Current Location of the Laocoön Bronze",
  });
  const painting = page.getByRole("button", {
    name: "Current Location of Painting",
  });
  await expect(bronze).toHaveAttribute("aria-current", "true");
  // A system colour, as the browser resolves it.
  const system = (name: string) =>
    page.evaluate((name) => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = name;
      document.body.append(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    }, name);
  const edge = (button: typeof bronze) =>
    button.evaluate((node) => getComputedStyle(node).borderInlineStartColor);
  const ground = await system("Canvas");
  const highlight = await system("Highlight");
  expect(highlight).not.toBe(ground);
  expect(await edge(painting)).toBe(ground);
  expect(await edge(bronze)).toBe(highlight);
  await expect(bronze).toHaveCSS("border-inline-start-width", "3px");
});
