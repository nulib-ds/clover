import { expect, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

/*
 * A Manifest of 1,000 Canvases: what loads, how soon, and how quickly the reader can move.
 * Budgets are generous ceilings, to catch a regression (an eager thumbnail strip, a
 * selector that walks every Canvas per move), not to benchmark. Chromium only: timings
 * differ by engine, and one engine is enough to catch the shape of a regression.
 */
test("1,000 Canvases: opens quickly, fetches only what shows, moves without lag", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "timed in one engine");
  const requests = await serveIIIF(page);
  await page.addInitScript(() => {
    (window as any).__long = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        (window as any).__long.push(entry.duration);
    }).observe({ type: "longtask", buffered: true });
  });

  const started = Date.now();
  await page.goto("/?content=https://fixtures.test/generated/1000.json");
  // The Viewer's title; About repeats the label a level down.
  await expect(
    page.getByRole("heading", { name: "1000 Canvases", level: 2 }),
  ).toBeVisible();
  const opened = Date.now() - started;
  await expect(page.locator(".clover-pager-position")).toHaveText(
    /Item 1 of 1000/,
  );
  await page.waitForTimeout(1500);

  const images = requests.filter((r) =>
    r.url().startsWith("https://images.test/"),
  );
  const services = new Set(
    images.map((r) => r.url().split("/").slice(0, 6).join("/")),
  );

  const position = page.locator(".clover-pager-position");
  const next = page.getByRole("button", { name: "Next" });
  const moves: number[] = [];
  for (let i = 2; i <= 21; i++) {
    const t = Date.now();
    await next.click();
    await expect(position).toHaveText(new RegExp(`Item ${i} of 1000`));
    moves.push(Date.now() - t);
  }
  const longTasks: number[] = await page.evaluate(() => (window as any).__long);
  const average = moves.reduce((a, b) => a + b, 0) / moves.length;

  console.log(
    `1,000 Canvases: opened in ${opened} ms; ${images.length} image requests over ${services.size} images; Next ${Math.round(average)} ms on average (max ${Math.max(...moves)}); long tasks ${longTasks.length} (max ${Math.round(Math.max(0, ...longTasks))} ms)`,
  );
  expect(opened).toBeLessThan(5000);
  // Thumbnails load lazily: a strip's worth, not a thousand.
  expect(services.size).toBeLessThan(60);
  expect(average).toBeLessThan(250);
  expect(Math.max(0, ...longTasks)).toBeLessThan(1000);
});
