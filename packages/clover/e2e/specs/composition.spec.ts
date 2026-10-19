import { expect, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

/*
 * A Canvas painted from several images (Cookbook 0036): the folio whole, and a finer
 * photograph of its miniature over the region it targets. Both are drawn: each image's
 * service is read and its tiles fetched, and the Canvas settles.
 */
test("a Canvas painted from several images draws each of them (Cookbook 0036)", async ({
  page,
}) => {
  const requests = await serveIIIF(page);
  await page.goto(
    "/?content=https://fixtures.test/0036-composition-from-multiple-images.json",
  );
  await expect(page.locator("figure.clover-canvas")).toHaveAttribute(
    "data-status",
    "ready",
  );
  const asked = (image: string) =>
    requests
      .map((request) => request.url())
      .filter((url) => url.includes(`${image}/`) && !url.endsWith("info.json"))
      .length;
  await expect.poll(() => asked("bnf_chateauroux")).toBeGreaterThan(0);
  await expect
    .poll(() => asked("bnf_chateauroux_miniature"))
    .toBeGreaterThan(0);
});
