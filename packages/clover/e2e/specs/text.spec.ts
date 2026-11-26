import { expect, type Page, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

/*
 * A Canvas's text, read from its picture (`Canvas/text/TextLayer.tsx`), under a mouse:
 * a drag selects it, as in a PDF, and a click zooms, as anywhere on the picture, so a
 * pointer alone can move about a column of text (WCAG 2.5.1; ACCESSIBILITY.md N42).
 */
const CANVAS = "https://fixtures.test/ocr/canvas/1";
const MANIFEST = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://ocr.test/manifest.json",
  type: "Manifest",
  label: { en: ["Twelve lines of text"] },
  items: [
    {
      id: CANVAS,
      type: "Canvas",
      width: 1000,
      height: 1400,
      items: [
        {
          id: `${CANVAS}/page`,
          type: "AnnotationPage",
          items: [
            {
              id: `${CANVAS}/image`,
              type: "Annotation",
              motivation: "painting",
              body: {
                id: "https://images.test/iiif/ocr/full/max/0/default.jpg",
                type: "Image",
                format: "image/jpeg",
                width: 1000,
                height: 1400,
                service: [
                  {
                    id: "https://images.test/iiif/ocr",
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
          id: `${CANVAS}/text`,
          type: "AnnotationPage",
          items: Array.from({ length: 12 }, (_, line) => ({
            id: `${CANVAS}/line-${line + 1}`,
            type: "Annotation",
            motivation: "supplementing",
            textGranularity: "line",
            body: {
              type: "TextualBody",
              value: `Line ${line + 1} of the test page`,
              language: "en",
              format: "text/plain",
            },
            target: `${CANVAS}#xywh=100,${100 + line * 100},800,60`,
          })),
        },
      ],
    },
  ],
};

const region = (page: Page) =>
  page.evaluate(() => (window as any).__viewport?.region ?? null);
const selected = (page: Page) =>
  page.evaluate(() => document.getSelection()?.toString() ?? "");

test("on a Canvas's text, a click zooms, a drag selects, and a double click takes no word", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "a mouse's");
  await serveIIIF(page);
  await page.route("https://ocr.test/manifest.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(MANIFEST),
    }),
  );
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto("/?scene=composed&content=https://ocr.test/manifest.json");
  const lines = page.locator(".clover-canvas-text span");
  await expect(lines.first()).toBeAttached({ timeout: 15_000 });
  await page.waitForTimeout(800);
  const center = async (line: number) => {
    const box = (await lines.nth(line).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  // A click on a line zooms in, as on the picture.
  const home = await region(page);
  const at = await center(5);
  await page.mouse.click(at.x, at.y);
  await expect.poll(async () => (await region(page)).h).toBeLessThan(home.h);

  // A drag across lines selects them, and moves nothing: once the zoom has eased in.
  await page.waitForTimeout(1200);
  const zoomed = await region(page);
  const from = (await lines.nth(4).boundingBox())!;
  const to = await center(6);
  await page.mouse.move(from.x + 5, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  expect(await selected(page)).toContain("Line 6 of the test page");
  expect(await region(page)).toEqual(zoomed);

  // The first click over the selection lets it go, and zooms nothing.
  const again = await center(5);
  await page.mouse.click(again.x, again.y);
  await page.waitForTimeout(500);
  expect(await selected(page)).toBe("");
  expect(await region(page)).toEqual(zoomed);

  // A double click takes no word.
  const twice = await center(5);
  await page.mouse.dblclick(twice.x, twice.y);
  await page.waitForTimeout(300);
  expect(await selected(page)).toBe("");
});
