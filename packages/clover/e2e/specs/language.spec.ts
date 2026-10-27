import { type Locator, expect, test } from "@playwright/test";

import { manifestOf, serveIIIF } from "./fixtures";

/*
 * Clover in French on an English page (WCAG 3.1.2), as a host sets it with
 * `initCloverI18n({ lng: "fr" })` (the harness's `&lng=fr`). Each of its strings says so
 * with its own `lang`. No Clover root carries one, so the host's content
 * inside a Root, and the Manifest's text in no language, keep the page's English. A label
 * in German names the viewport through a hidden element that carries `de`. Names are read
 * from Chromium's own accessibility tree, as a screen reader gets them.
 */
test.use({ locale: "fr-FR" });

const manifest = (() => {
  const languages = manifestOf(3) as ReturnType<typeof manifestOf> & {
    label: Record<string, string[]>;
  };
  languages.id = "https://fixtures.test/languages.json";
  languages.label = { none: ["Atlas"] };
  (languages.items[0] as { label: unknown }).label = { de: ["Karte"] };
  (languages.items[1] as { label: unknown }).label = { none: ["Plate 2"] };
  return languages;
})();

/** The language an element is in: its own `lang`, or the nearest one around it. */
const languageOf = (locator: Locator) =>
  locator.evaluate((element) =>
    element.closest("[lang]")?.getAttribute("lang"),
  );

test.beforeEach(async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Reads Chromium's accessibility tree");
  await serveIIIF(page);
  await page.route(manifest.id, async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin":
          (await route.request().headerValue("origin")) ?? "*",
      },
      body: JSON.stringify(manifest),
    }),
  );
});

test("marks Clover's French apart from the page's English and the label's German", async ({
  page,
}) => {
  await page.goto(`/?scene=viewer&lng=fr&content=${manifest.id}`);

  const next = page.getByRole("button", { name: "Suivant" });
  await expect(next).toBeVisible();
  await expect(next).toHaveAttribute("lang", "fr");
  await expect(page.locator(".clover-root")).not.toHaveAttribute("lang");
  // Text in none is the page's.
  // The Viewer's title, not About's heading of the same name.
  const title = page.getByRole("heading", { name: "Atlas", level: 2 });
  await expect(title).not.toHaveAttribute("lang");
  expect(await languageOf(title)).toBe("en");
  expect(
    await languageOf(
      page.getByRole("listbox").getByText("Plate 2", { exact: true }),
    ),
  ).toBe("en");

  const viewport = page.locator(".clover-canvas-viewport");
  const nameId = await viewport.getAttribute("aria-labelledby");
  expect(nameId).toBeTruthy();
  await expect(page.locator(`[id="${nameId}"]`)).toHaveAttribute("lang", "de");

  // Chromium names the viewport from that hidden element.
  const cdp = await page.context().newCDPSession(page);
  await expect
    .poll(async () => {
      const { nodes } = await cdp.send("Accessibility.getFullAXTree");
      return nodes
        .filter((node) => node.role?.value === "image")
        .map((node) => node.name?.value);
    })
    .toContain("Karte");
});

test("leaves the host's own content in a Root in the page's language", async ({
  page,
}) => {
  await page.goto(`/?scene=items&lng=fr&content=${manifest.id}`);

  // The list's French name is a hidden element's, which says so.
  const list = page.getByRole("listbox", { name: "Éléments" });
  await expect(list).toBeVisible();
  const nameId = await list.getAttribute("aria-labelledby");
  expect(nameId).toBeTruthy();
  await expect(page.locator(`[id="${nameId}"]`)).toHaveAttribute("lang", "fr");
  await expect(page.locator(".clover-root")).not.toHaveAttribute("lang");
  await expect(page.locator(".clover-items")).not.toHaveAttribute("lang");
  // The host's button, beside Clover's parts in the Root, is English, as its page is.
  expect(
    await languageOf(page.getByRole("button", { name: "After the items" })),
  ).toBe("en");
  expect(await languageOf(page.getByRole("heading", { name: "Atlas" }))).toBe(
    "en",
  );
});

test("speaks the page's English to a French browser, marking nothing", async ({
  page,
}) => {
  // The browser is French (`locale` above); the page declares English and sets nothing.
  await page.goto(`/?scene=viewer&content=${manifest.id}`);

  const next = page.getByRole("button", { name: "Next" });
  await expect(next).toBeVisible();
  await expect(next).not.toHaveAttribute("lang");
  expect(await languageOf(next)).toBe("en");
});
