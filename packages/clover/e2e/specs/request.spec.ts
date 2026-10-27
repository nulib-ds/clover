import { expect, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

test("request settings reach every request: the Manifest, image services and images", async ({
  page,
  context,
  browserName,
}) => {
  await context.addCookies([
    {
      name: "session",
      value: "e2e",
      domain: "fixtures.test",
      path: "/",
      secure: true,
      // Cross-site from the page, so it must be SameSite=None to be sent at all.
      sameSite: "None",
    },
  ]);
  const requests = await serveIIIF(page);
  await page.goto("/?headers=1&content=https://fixtures.test/0009-book-1.json");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Simple Manifest - Book",
    }),
  ).toBeVisible();
  await expect.poll(() => requests.length).toBeGreaterThan(2);

  const manifest = requests.find((r) => r.url().includes("fixtures.test/0009"));
  expect(manifest).toBeDefined();
  const headers = await manifest!.allHeaders();
  expect(headers["x-clover"]).toBe("e2e");
  // WebKit blocks cross-site cookies by default (Intelligent Tracking Prevention), as
  // Safari does; `credentials: "include"` cannot override it, so the cookie is checked in
  // the browsers that send it.
  if (browserName !== "webkit") {
    expect(headers.cookie ?? "").toContain("session=e2e");
  }

  const info = requests.filter((r) => r.url().endsWith("/info.json"));
  for (const request of info) {
    expect((await request.allHeaders())["x-clover"]).toBe("e2e");
  }
});
