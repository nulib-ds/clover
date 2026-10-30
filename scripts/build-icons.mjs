import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SVG = readFileSync(join(ROOT, "app/icon.svg"), "utf8");
const SRC = `data:image/svg+xml;base64,${Buffer.from(SVG).toString("base64")}`;

/*
 * The site's icon is `app/icon.svg`; this draws the rest from it, for what reads no SVG.
 * `favicon.ico`, for a browser or crawler that asks for one: 16, 32 and 48px, as PNGs.
 * `apple-icon.png`, a home screen's: 180px, square, as iOS rounds its corners itself and
 * fills what is clear with black, so the icon's accent runs to its edges.
 */
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function draw(size, ground = "transparent") {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;background:${ground}"><img src="${SRC}" width="${size}" height="${size}" style="display:block"></body>`,
  );
  await page.locator("img").evaluate((img) => img.decode());
  return page.screenshot({ omitBackground: ground === "transparent" });
}

/** An ICO of PNGs: its header, an entry for each, then the images. */
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, png }, i) => {
    const at = 6 + 16 * i;
    head.writeUInt8(size, at);
    head.writeUInt8(size, at + 1);
    head.writeUInt16LE(1, at + 4);
    head.writeUInt16LE(32, at + 6);
    head.writeUInt32LE(png.length, at + 8);
    head.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...images.map(({ png }) => png)]);
}

const sizes = [16, 32, 48];
const favicon = [];
for (const size of sizes) favicon.push({ size, png: await draw(size) });
writeFileSync(join(ROOT, "app/favicon.ico"), ico(favicon));

const accent = SVG.match(/<circle[^>]*fill="([^"]+)"/)[1];
writeFileSync(join(ROOT, "app/apple-icon.png"), await draw(180, accent));

await browser.close();
console.log(
  `Drew app/favicon.ico (${sizes.join(", ")}px) and app/apple-icon.png (180px)`,
);
