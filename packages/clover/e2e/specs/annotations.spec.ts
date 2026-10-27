import { type Page, expect, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

/*
 * The information panel's Annotations, every Canvas's (`scope="all"`), in the Default
 * template, on the docs' `paged` mock: the catalog's "Then" and "Now" tags, a page of
 * them on each of eight plates, unlabeled, so one layer, by Canvas.
 */
const CATALOG = "https://nulib-ds.github.io/clover/mocks/paged/manifest.json";

async function open(page: Page) {
  await serveIIIF(page);
  // Short, so the panel scrolls.
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.goto(`/?content=${CATALOG}`);
  await page.getByRole("button", { name: "Annotations" }).click();
  await expect(page.locator(".clover-annotations-canvas")).toHaveCount(8);
}

/** Where a page's annotations sit in the panel: under the stuck headings, or as high as the list goes. */
const placeOf = (page: Page, label: string) =>
  page.evaluate((name) => {
    const panel = document.querySelector<HTMLElement>(
      ".clover-template-default-panel",
    )!;
    const group = [
      ...document.querySelectorAll<HTMLElement>(".clover-annotations-canvas"),
    ].find(
      (each) =>
        each.querySelector(".clover-annotations-canvas-label")?.textContent ===
        name,
    )!;
    const headings = [
      ...panel.querySelectorAll<HTMLElement>(".clover-sections-heading"),
    ];
    const stack = headings[headings.length - 1].getBoundingClientRect().bottom;
    return {
      current: group.getAttribute("aria-current"),
      under: Math.abs(group.getBoundingClientRect().top - stack) < 2,
      atEnd:
        Math.abs(panel.scrollTop - (panel.scrollHeight - panel.clientHeight)) <
        2,
      scrollTop: panel.scrollTop,
    };
  }, label);

test("all of the Manifest's annotations, by Canvas, the one in view marked and brought under the headings", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "on a phone the panel floats over the strip");
  await open(page);
  const labels = page.locator(".clover-annotations-canvas-label");
  await expect(labels).toHaveText([
    "Page 4",
    "Page 6",
    "Page 18",
    "Page 20",
    "Page 22",
    "Page 24",
    "Page 26",
    "Back Cover",
  ]);
  // Page 6 in view: its annotations current, brought up to the headings.
  await page.getByRole("option", { name: /Page 6/ }).click();
  await expect
    .poll(async () => {
      const place = await placeOf(page, "Page 6");
      return place.current === "true" && (place.under || place.atEnd);
    })
    .toBe(true);
});

test("a press in the list moves the Canvas, never the list under the pointer", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "on a phone the panel floats over the strip");
  await open(page);
  const entry = page
    .locator(".clover-annotations-canvas")
    .filter({ hasText: "Page 22" })
    .locator(".clover-annotations-entry")
    .first();
  /*
   * Under the pointer before it is pressed, as a reader's would be, so only Clover could
   * move it. Brought into view alone, it can sit under the stuck headings, where the click
   * would scroll it clear itself before pressing.
   */
  await entry.hover();
  const before = (await placeOf(page, "Page 22")).scrollTop;
  await entry.click();
  await expect
    .poll(async () => (await placeOf(page, "Page 22")).current)
    .toBe("true");
  expect((await placeOf(page, "Page 22")).scrollTop).toBe(before);
  await expect(entry).toHaveAttribute("data-selected", "true");
});

test("a press in the list opens the Canvas past its placeholder, there to show the annotation", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "on a phone the panel floats over the Canvas");
  await open(page);
  const canvas = page.locator("figure.clover-canvas");
  await expect(canvas).toHaveAttribute("data-placeholder", "true");
  await page
    .locator(".clover-annotations-canvas")
    .filter({ hasText: "Page 4" })
    .locator(".clover-annotations-entry")
    .first()
    .click();
  await expect(canvas).toHaveAttribute("data-placeholder", "false");
  // Named by its tag and the cataloger's words after it ("Then – Postman on foot…").
  const then = page.getByRole("button", { name: /^Then – / });
  await expect(then).toHaveAttribute("aria-current", "true");
  // Named on the Canvas without the pointer on it.
  await page.mouse.move(0, 0);
  await expect(then.locator("> .clover-tip")).toBeVisible();
});

test("the Canvas's own annotations menu works over its placeholder, opening it there", async ({
  page,
}) => {
  await serveIIIF(page);
  await page.goto(`/?content=${CATALOG}`);
  // Pages 3 and 4, still behind their placeholder.
  await page.getByRole("option", { name: /Page 4/ }).click();
  const canvas = page.locator("figure.clover-canvas");
  await expect(canvas).toHaveAttribute("data-placeholder", "true");
  // The Canvas's control, not the panel's section of that name.
  const control = canvas.getByRole("button", { name: "Annotations" });
  await control.focus();
  await page.keyboard.press("Enter");
  // Focus lands on the first, Then; the arrow moves to Now and picks it.
  await expect(page.getByRole("radio", { name: /^Then – / })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(canvas).toHaveAttribute("data-placeholder", "false");
  await expect(page.getByRole("button", { name: /^Now – / })).toHaveAttribute(
    "aria-current",
    "true",
  );
});

/*
 * Annotations as the content (an AnnotationPage made apart from any Manifest, as 3.x
 * took one), across two of the fixtures' Manifests: the first's opens, that annotation
 * picked; the other's is named in the list once fetched, and a press opens it there.
 */
test("annotations as the content open their first Manifest, and a press another's", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "on a phone the panel floats over the Canvas");
  await serveIIIF(page);
  const BOOK = "https://fixtures.test/0009-book-1.json";
  const FOLIO =
    "https://fixtures.test/0036-composition-from-multiple-images.json";
  const PAGE = "https://fixtures.test/tags/page.json";
  const tag = (
    id: string,
    value: string,
    canvas: string,
    manifest: string,
  ) => ({
    id: `${PAGE}#${id}`,
    type: "Annotation",
    motivation: "tagging",
    body: { type: "TextualBody", value, format: "text/plain" },
    target: {
      type: "SpecificResource",
      source: {
        id: canvas,
        type: "Canvas",
        partOf: [{ id: manifest, type: "Manifest" }],
      },
      selector: { type: "FragmentSelector", value: "xywh=100,100,400,400" },
    },
  });
  await page.route(PAGE, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        "@context": "http://iiif.io/api/presentation/3/context.json",
        id: PAGE,
        type: "AnnotationPage",
        label: { en: ["Tags"] },
        items: [
          tag(
            "book",
            "A page",
            "https://iiif.io/api/cookbook/recipe/0009-book-1/canvas/p2",
            BOOK,
          ),
          tag(
            "folio",
            "A miniature",
            "https://iiif.io/api/cookbook/recipe/0036-composition-from-multiple-images/canvas/p1",
            FOLIO,
          ),
        ],
      }),
    }),
  );
  await page.goto(`/?content=${PAGE}`);
  const title = page.locator(".clover-template-default-title");
  await expect(title).toHaveText("Simple Manifest - Book");
  await expect(
    page.getByRole("button", { name: "A page", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Annotations" }).last().click();
  // The other Manifest's, named by its label once fetched.
  const elsewhere = page
    .locator(".clover-annotations-canvas")
    .filter({ hasText: "Folio from Grandes Chroniques de France" });
  await expect(elsewhere).toHaveCount(1);
  await elsewhere.locator(".clover-annotations-entry").click();
  await expect(title).toHaveText(
    "Folio from Grandes Chroniques de France, ca. 1460",
  );
  await expect(
    page.getByRole("button", { name: "A miniature", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  // Both still listed, in the order given.
  await expect(page.locator(".clover-annotations-entry")).toHaveText([
    "A page",
    "A miniature",
  ]);
});

/*
 * Cookbook 0022: the fountain's hotspot links to the Manifest's other Canvas, its
 * close-up. Pressing it goes there, focus moving to the Canvas; so does the entry's
 * "Open the link" in the list.
 */
test("a linking hotspot, and its entry's link, go to the Canvas it links to", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "on a phone the panel floats over the Canvas");
  await serveIIIF(page);
  await page.goto(
    "/?content=https://fixtures.test/0022-linking-with-a-hotspot.json",
  );
  const second = page.getByRole("option", { name: /Item 2 of 2/ });
  const hotspot = page.getByRole("button", {
    name: "A link to a close up of Gänseliesel-Brunnen fountain.",
    exact: true,
  });
  await hotspot.click();
  await expect(second).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("clover-canvas-viewport")).toBeFocused();

  await page.getByRole("option", { name: /Item 1 of 2/ }).click();
  await page.getByRole("button", { name: "Annotations" }).last().click();
  await page.getByRole("button", { name: "Open the link" }).click();
  await expect(second).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("clover-canvas-viewport")).toBeFocused();
});
