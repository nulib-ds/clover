import { deflateSync } from "node:zlib";

import { expect, type Locator, type Page, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

test("Items: one tab stop; arrows select as they move, Home and End jump", async ({
  page,
}) => {
  await serveIIIF(page);
  await page.goto(
    "/?scene=items&content=https://fixtures.test/0011-book-3-behavior-individuals.json",
  );
  const options = page.getByRole("option");
  await expect(options.first()).toBeVisible();
  const total = await options.count();
  expect(total).toBeGreaterThan(2);

  await page.keyboard.press("Tab");
  await expect(options.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  // As in a radio group: the option in focus is the one selected, and shown.
  await expect(options.nth(1)).toBeFocused();
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  const label = page.getByTestId("canvas-label");
  const second = await label.textContent();
  await page.keyboard.press("End");
  await expect(options.nth(total - 1)).toBeFocused();
  await expect(options.nth(total - 1)).toHaveAttribute("aria-selected", "true");
  await expect(label).not.toHaveText(second ?? "");
  await page.keyboard.press("Home");
  await expect(options.nth(0)).toBeFocused();
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
  // One tab stop: Tab leaves the list for what follows it.
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "After the items" }),
  ).toBeFocused();
});

/** A 64 × 64 PNG of one color, as `[r, g, b]`. */
function solidPng([r, g, b]: number[]) {
  const crc = (bytes: Buffer) => {
    let c = ~0;
    for (const byte of bytes) {
      c ^= byte;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const size = 64;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 8 bits a channel
  header[9] = 2; // RGB
  const row = Buffer.from([
    0,
    ...Array.from({ length: size }, () => [r, g, b]).flat(),
  ]);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(Array(size).fill(row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Every picture (not an image service's `info.json`) as one color. */
async function paintPictures(page: Page, rgb: number[]) {
  const png = solidPng(rgb);
  await page.route(
    /^https?:\/\/(?!localhost|fixtures\.test)[^/]+\/.*/,
    (route) =>
      route.request().url().endsWith("/info.json")
        ? route.fallback()
        : route.fulfill({
            status: 200,
            contentType: "image/png",
            headers: { "Access-Control-Allow-Origin": "*" },
            body: png,
          }),
  );
}

/**
 * The most contrast any of the first 6px in from the pictures' start edge, a quarter of the
 * way down, has against the picture there: what a ring inside that edge shows by. Not
 * across the middle, where the strip's Previous arrow sits, shown disabled, over the first
 * item. Only whole pixels inside the pictures' box, so none is the page beside them.
 */
async function edgeContrast(page: Page, pictures: Locator) {
  const box = (await pictures.boundingBox())!;
  const [x, y] = [Math.ceil(box.x), Math.ceil(box.y)];
  const clip = {
    x,
    y,
    width: Math.floor(box.x + box.width) - x,
    height: Math.floor(box.y + box.height) - y,
  };
  // In CSS pixels, so the 6px are the page's on a phone's dense screen too.
  const shot = (await page.screenshot({ clip, scale: "css" })).toString(
    "base64",
  );
  return page.evaluate(async (data: string) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const at = (x: number, y: number) =>
      Array.from(context.getImageData(x, y, 1, 1).data.slice(0, 3));
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((value) => {
        const v = value / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: number[], b: number[]) => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (light + 0.05) / (dark + 0.05);
    };
    const row = Math.floor(image.height / 4);
    const picture = at(Math.floor(image.width / 2), row);
    let most = 1;
    for (let x = 0; x < 6; x++) {
      most = Math.max(most, contrast(at(x, row), picture));
    }
    return most;
  }, shot);
}

/*
 * WCAG 1.4.1: selection follows focus, so the item in focus is the one selected. Focus
 * still shows by more than its ring's color: a second ring inside the pictures' edge,
 * which a selected item without focus has not, and which stands out (3:1) from a light
 * page, as most scans are, and from a dark one alike.
 */
const SCENES = [
  ["Items", "/?scene=items&content=https://fixtures.test/0009-book-1.json"],
  ["Default's slider", "/?content=https://fixtures.test/0009-book-1.json"],
] as const;
const PICTURES = [
  ["paper", [246, 242, 233]],
  ["dark", [38, 32, 28]],
] as const;

for (const [scene, url] of SCENES) {
  for (const [tone, rgb] of PICTURES) {
    test(`${scene}: focus on the selected item shows inside a ${tone} picture, not by color alone`, async ({
      page,
    }) => {
      await serveIIIF(page);
      await paintPictures(page, [...rgb]);
      await page.goto(url);
      const first = page.locator(".clover-items").getByRole("option").first();
      const pictures = first.locator(".clover-items-pictures");
      await expect(first).toHaveAttribute("aria-selected", "true");
      await expect(first.locator("img").first()).toHaveCSS("opacity", "1");

      // By keyboard: Home keeps the first selected, and focus shows.
      await first.focus();
      await page.keyboard.press("Home");
      await expect(first).toBeFocused();
      await expect(first).toHaveAttribute("aria-selected", "true");
      expect(await edgeContrast(page, pictures)).toBeGreaterThanOrEqual(3);
      const ring = await pictures.evaluate(
        (element) => getComputedStyle(element).outlineWidth,
      );

      await first.evaluate((element) => (element as HTMLElement).blur());
      await expect(first).not.toBeFocused();
      await expect(first).toHaveAttribute("aria-selected", "true");
      expect(await edgeContrast(page, pictures)).toBeLessThan(1.5);
      // The ring outside is the same thickness either way: it never grows.
      expect(
        await pictures.evaluate(
          (element) => getComputedStyle(element).outlineWidth,
        ),
      ).toBe(ring);
    });
  }
}
