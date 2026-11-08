import { type Page, expect, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

/*
 * The stylesheet in tiers (`build/tiers.mjs`): base.css alone draws the structure of the
 * Viewer and nothing of its look, in a layout that works, and base.css then spacing.css
 * space it as styles.css does.
 */
const BOOK = "content=https://fixtures.test/0009-book-1.json";

const open = async (page: Page, css: string) => {
  await serveIIIF(page);
  await page.goto(`/?${css}&${BOOK}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Simple Manifest - Book" }),
  ).toBeVisible();
  await expect(page.locator(".clover-canvas")).toHaveAttribute(
    "data-status",
    "ready",
  );
};

/** Pairs of the Canvas's controls whose boxes meet: one lies over the other. */
const overlapping = (page: Page) =>
  page.locator(".clover-canvas-controls button").evaluateAll((buttons) => {
    const boxes = buttons
      .map((button) => ({
        name: button.getAttribute("aria-label"),
        box: button.getBoundingClientRect(),
      }))
      .filter(({ box }) => box.width && box.height);
    return boxes.flatMap((a, at) =>
      boxes
        .slice(at + 1)
        .filter(
          (b) =>
            a.box.left < b.box.right - 1 &&
            b.box.left < a.box.right - 1 &&
            a.box.top < b.box.bottom - 1 &&
            b.box.top < a.box.bottom - 1,
        )
        .map((b) => `${a.name} / ${b.name}`),
    );
  });

for (const width of [1280, 390])
  test(`with base.css alone, the Viewer lays out its structure, and no control lies over another (${width}px, WCAG 2.4.11)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await open(page, "css=base");

    // The controls sit over the Body, at its top end, as styles.css places them.
    const body = (await page.locator(".clover-body").boundingBox())!;
    const cluster = (await page
      .locator(".clover-canvas-controls")
      .boundingBox())!;
    expect(cluster.y).toBeGreaterThanOrEqual(body.y);
    expect(cluster.x + cluster.width).toBeLessThanOrEqual(body.x + body.width);
    expect(cluster.x + cluster.width).toBeGreaterThan(body.x + body.width / 2);
    expect(await overlapping(page)).toEqual([]);

    // Nothing of the spacing: the header's region has no inset of its own.
    expect(
      await page
        .locator(".clover-template-default-header")
        .evaluate((header) => getComputedStyle(header).paddingTop),
    ).toBe("0px");
    // Nothing of the look: the round controls keep the browser's own fill.
    expect(
      await page
        .locator("button.clover-canvas-button")
        .first()
        .evaluate((button) => getComputedStyle(button).backgroundColor),
    ).not.toBe("rgb(26, 29, 30)");
  });

test("with base.css alone, a control's name shows on focus and hides at rest (WCAG 1.4.13)", async ({
  page,
}) => {
  await open(page, "css=base");
  const control = page.locator("button.clover-canvas-button").first();
  const tip = control.locator("> .clover-tip");
  await expect(tip).toHaveCSS("opacity", "0");
  // As the tips' own spec focuses one: keyboard focus, as Playwright gives it.
  await control.focus();
  await expect(tip).toHaveCSS("opacity", "1");
  // On a surface of the page's own colors, so the words never sit on the picture.
  expect(
    await tip.evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe("rgba(0, 0, 0, 0)");
});

test("base.css then spacing.css space the Viewer as styles.css does", async ({
  page,
}) => {
  const SPACES = [
    ".clover-template-default-header",
    ".clover-template-default-rail",
    ".clover-canvas-controls",
    ".clover-panel",
  ];
  const spacesOf = () =>
    page.evaluate(
      (selectors) =>
        selectors.map((selector) => {
          const style = getComputedStyle(document.querySelector(selector)!);
          return [
            selector,
            style.padding,
            style.rowGap,
            style.columnGap,
            style.marginTop,
            style.marginBottom,
          ].join(" ");
        }),
      SPACES,
    );
  await open(page, "css=spacing");
  const tiered = await spacesOf();
  await open(page, "css=1");
  expect(tiered).toEqual(await spacesOf());
});

test("with base.css alone, an item is as wide as its pictures, and keeps styles.css's cursor", async ({
  page,
}) => {
  // The browser gives a figure 40px each side: Items' own zero margins undo it.
  const read = () =>
    page
      .locator(".clover-items-item")
      .first()
      .evaluate((item) => ({
        figure: getComputedStyle(item.querySelector(".clover-items-figure")!)
          .margin,
        cursor: getComputedStyle(item).cursor,
      }));
  await open(page, "css=1");
  const styled = await read();
  expect(styled).toEqual({ figure: "0px", cursor: "pointer" });
  await open(page, "css=base");
  expect(await read()).toEqual(styled);
});

test("with base.css alone, a hotspot lets the picture show through", async ({
  page,
}) => {
  const MANIFEST = "https://fixtures.test/tier-hotspot.json";
  const CANVAS = "https://fixtures.test/tier-hotspot/canvas/1";
  const SERVICE = "https://images.test/iiif/hotspots/1";
  await serveIIIF(page);
  await page.route(MANIFEST, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        "@context": "http://iiif.io/api/presentation/3/context.json",
        id: MANIFEST,
        type: "Manifest",
        label: { en: ["A hotspot"] },
        items: [
          {
            id: CANVAS,
            type: "Canvas",
            width: 2000,
            height: 1000,
            items: [
              {
                id: `${CANVAS}/page`,
                type: "AnnotationPage",
                items: [
                  {
                    id: `${CANVAS}/page/image`,
                    type: "Annotation",
                    motivation: "painting",
                    body: {
                      id: `${SERVICE}/full/max/0/default.jpg`,
                      type: "Image",
                      format: "image/jpeg",
                      width: 2000,
                      height: 1000,
                      service: [
                        {
                          id: SERVICE,
                          type: "ImageService3",
                          profile: "level1",
                        },
                      ],
                    },
                    target: CANVAS,
                  },
                ],
              },
            ],
            annotations: [
              {
                id: `${CANVAS}/notes`,
                type: "AnnotationPage",
                items: [
                  {
                    id: `${CANVAS}/notes/1`,
                    type: "Annotation",
                    motivation: "commenting",
                    body: {
                      type: "TextualBody",
                      value: "A region",
                      language: "en",
                    },
                    target: `${CANVAS}#xywh=300,300,800,400`,
                  },
                ],
              },
            ],
          },
        ],
      }),
    }),
  );
  await page.goto(`/?scene=composed&css=base&content=${MANIFEST}`);
  const hotspot = page.locator("button.clover-canvas-annotation");
  await expect(hotspot).toHaveCount(1);
  // Never the browser's gray button over the picture.
  await expect(hotspot).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});
