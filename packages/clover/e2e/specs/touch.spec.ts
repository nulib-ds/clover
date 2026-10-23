import { type Page, expect, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

/*
 * The Canvas's controls under a finger, in a browser that turns touches into pointer
 * events itself. With no hover to hold them, no timer hides them (WCAG 2.2.1): a tap on
 * the picture shows them, and the next hides them.
 */
test.use({ hasTouch: true });

const BOOK = "https://fixtures.test/0009-book-1.json";

/** How much of the Canvas shows, from the composed scene's viewport channel. */
const area = async (page: Page) => {
  const region = await page.evaluate(
    () => (window as any).__viewport?.region ?? null,
  );
  return region ? region.w * region.h : null;
};

async function open(page: Page) {
  await serveIIIF(page);
  await page.goto(`/?scene=composed&content=${BOOK}`);
  await expect(page.locator(".clover-canvas")).toHaveAttribute(
    "data-status",
    "ready",
  );
  await expect.poll(() => area(page)).not.toBeNull();
  const box = (await page.locator(".clover-canvas-viewport").boundingBox())!;
  // The middle of the picture, clear of the controls in its top corner.
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("a tap on the picture shows the controls until the next tap, however long the reader takes", async ({
  page,
}) => {
  const picture = await open(page);
  const canvas = page.locator(".clover-canvas");
  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  await expect(canvas).toHaveAttribute("data-controls", "hidden");

  await page.touchscreen.tap(picture.x, picture.y);
  await expect(canvas).toHaveAttribute("data-controls", "visible");

  // Well past a mouse's two seconds, the controls are still there to tap.
  await page.waitForTimeout(3000);
  await expect(canvas).toHaveAttribute("data-controls", "visible");
  await expect(zoomIn).toHaveCSS("opacity", "1");
  const before = (await area(page))!;
  await zoomIn.tap();
  // Less of the Canvas shows (clipped to the Canvas, so not a quarter as much).
  await expect.poll(() => area(page)).toBeLessThan(before * 0.9);
  await expect(canvas).toHaveAttribute("data-controls", "visible");

  await page.touchscreen.tap(picture.x, picture.y);
  await expect(canvas).toHaveAttribute("data-controls", "hidden");
});

test("a tap where a faded control sits shows the controls, and zooms nothing", async ({
  page,
}) => {
  await open(page);
  const canvas = page.locator(".clover-canvas");
  const before = (await area(page))!;
  const box = (await page
    .getByRole("button", { name: "Zoom in" })
    .boundingBox())!;

  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(canvas).toHaveAttribute("data-controls", "visible");
  await page.waitForTimeout(500);
  expect((await area(page))! / before).toBeCloseTo(1, 3);
});

/**
 * A Canvas of the Body's shape, so at home it fills the Body, and one note on its top
 * left quarter, under the navigator.
 */
const NOTED = "https://fixtures.test/noted.json";
const NOTED_CANVAS = "https://fixtures.test/noted/canvas/1";
const NOTED_SERVICE = "https://images.test/iiif/noted/1";
const notedOf = (width: number, height: number) => ({
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: NOTED,
  type: "Manifest",
  label: { en: ["Noted"] },
  items: [
    {
      id: NOTED_CANVAS,
      type: "Canvas",
      label: { en: ["A page"] },
      width,
      height,
      items: [
        {
          id: `${NOTED_CANVAS}/page`,
          type: "AnnotationPage",
          items: [
            {
              id: `${NOTED_CANVAS}/page/image`,
              type: "Annotation",
              motivation: "painting",
              body: {
                id: `${NOTED_SERVICE}/full/max/0/default.jpg`,
                type: "Image",
                format: "image/jpeg",
                width,
                height,
                service: [
                  {
                    id: NOTED_SERVICE,
                    type: "ImageService3",
                    profile: "level1",
                  },
                ],
              },
              target: NOTED_CANVAS,
            },
          ],
        },
      ],
      annotations: [
        {
          id: `${NOTED_CANVAS}/notes`,
          type: "AnnotationPage",
          items: [
            {
              id: `${NOTED_CANVAS}/notes/1`,
              type: "Annotation",
              motivation: "commenting",
              body: { type: "TextualBody", value: "A corner", language: "en" },
              target: `${NOTED_CANVAS}#xywh=0,0,${width / 2},${height / 2}`,
            },
          ],
        },
      ],
    },
  ],
});

test("a tap where the faded navigator sits over a hotspot shows the controls, and leaves the hotspot alone", async ({
  page,
}) => {
  await serveIIIF(page);
  // The Body is 60vh tall and (nearly) the page's width.
  const screen = page.viewportSize()!;
  const noted = notedOf(
    3000,
    Math.round((3000 * 0.6 * screen.height) / screen.width),
  );
  await page.route(NOTED, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(noted),
    }),
  );
  await page.goto(`/?scene=composed&navigator=1&content=${NOTED}`);
  const canvas = page.locator(".clover-canvas");
  await expect(canvas).toHaveAttribute("data-status", "ready");
  await expect.poll(() => area(page)).not.toBeNull();
  const hotspot = page.getByRole("button", { name: "A corner", exact: true });
  await expect(hotspot).toBeAttached();
  await expect(canvas).toHaveAttribute("data-controls", "hidden");

  const box = (await page.locator(".clover-canvas-navigator").boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  // Faded, the navigator takes no pointer: the hotspot is what lies there.
  expect(
    await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest("button")?.textContent,
      at,
    ),
  ).toBe("A corner");
  const before = (await area(page))!;

  await page.touchscreen.tap(at.x, at.y);
  await expect(canvas).toHaveAttribute("data-controls", "visible");
  await page.waitForTimeout(500);
  await expect(hotspot).not.toHaveAttribute("aria-current", "true");
  expect((await area(page))! / before).toBeCloseTo(1, 3);

  // Clear of the controls, the hotspot takes its own tap.
  const spot = (await hotspot.boundingBox())!;
  await page.touchscreen.tap(
    spot.x + spot.width * 0.75,
    spot.y + spot.height * 0.75,
  );
  await expect(hotspot).toHaveAttribute("aria-current", "true");
});
