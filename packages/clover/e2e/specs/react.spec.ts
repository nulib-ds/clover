import { expect, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

test("runs on the React it says: 19 in the react19 project, 18 elsewhere", async ({
  page,
}, info) => {
  await serveIIIF(page);
  await page.goto("/?content=https://fixtures.test/0009-book-1.json");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Simple Manifest - Book",
    }),
  ).toBeVisible();
  const version = await page.locator("html").getAttribute("data-react");
  expect(version?.split(".")[0]).toBe(
    info.project.name === "react19" ? "19" : "18",
  );
});
