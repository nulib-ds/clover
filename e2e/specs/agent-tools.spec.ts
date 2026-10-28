import { createRequire } from "node:module";

import { expect, test } from "@playwright/test";

import { call, described, open, standIn } from "./stand-in";

/*
 * The docs' tools for agents (AGENTS.md, "Agent tools (WebMCP)"): registered on every
 * page, each answering as its definition says, and the preview drawn in the page's
 * first example, by keyboard and against the accessibility tree (WCAG 2.2 AA). The
 * resources are the docs' own mocks, served by the dev server; what the checks read
 * of them is their own JSON.
 */

const axePath = createRequire(__filename).resolve("axe-core/axe.min.js");

test.beforeEach(async ({ page }) => {
  await standIn(page);
});

test("registers each tool as the draft has it, read-only but the preview", async ({
  page,
}) => {
  await open(page, "/docs/composing");
  const tools = await described(page);
  expect(
    tools.map((tool) => [tool.name, tool.title, tool.annotations]),
  ).toEqual([
    [
      "clover_suggest_layout",
      "Suggest a Clover layout",
      { readOnlyHint: true, untrustedContentHint: true },
    ],
    [
      "clover_compose_layout",
      "Write a Clover layout's code",
      { readOnlyHint: true },
    ],
    [
      "clover_preview_layout",
      "Preview a Clover layout",
      { readOnlyHint: false },
    ],
  ]);
  for (const tool of tools)
    expect(tool.name).toMatch(/^[A-Za-z0-9_.-]{1,128}$/);
});

test("loads what the tools do only when an agent first calls one", async ({
  page,
}) => {
  /*
   * Each by a string of its own, so the check holds in development and in a build
   * alike, whatever the bundler names its chunks: the engine (`suggest.ts`) and the
   * preview's renderer (`AgentPreview.tsx`).
   */
  const MARKS = {
    engine: "Clover has nothing by that name",
    renderer: "Preview from your agent",
  };
  const loaded = new Set<string>();
  page.on("response", async (response) => {
    if (response.request().resourceType() !== "script") return;
    const text = await response.text().catch(() => "");
    for (const [name, mark] of Object.entries(MARKS))
      if (text.includes(mark)) loaded.add(name);
  });
  await open(page, "/docs/primitives/rights");
  await page.waitForLoadState("networkidle");
  expect([...loaded]).toEqual([]);
  await call(page, "clover_compose_layout", { parts: [{ part: "Label" }] });
  await expect.poll(() => [...loaded]).toEqual(["engine"]);
  await call(page, "clover_preview_layout");
  await expect(
    page.getByRole("group", { name: "Preview from your agent" }),
  ).toBeVisible();
  await expect.poll(() => [...loaded].sort()).toEqual(["engine", "renderer"]);
});

test("keeps the tools as the reader moves through the docs", async ({
  page,
}) => {
  await open(page, "/docs/composing");
  // The sidebar's link, a move within the app, not a new page.
  await page
    .locator('a[href$="/docs/items"]')
    .filter({ visible: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/docs\/items$/);
  const registered = await page.evaluate(() => ({
    now: (window as unknown as { __tools: Map<string, unknown> }).__tools.size,
    ever: (window as unknown as { __registered: string[] }).__registered.length,
  }));
  expect(registered).toEqual({ now: 3, ever: 3 });
});

test("writes a layout's code, or says what is wrong and how to put it right", async ({
  page,
}) => {
  await open(page, "/docs/composing");
  const written = await call(page, "clover_compose_layout", {
    flavor: "html",
    parts: [{ part: "Body" }, { part: "Items", props: { layout: "grid" } }],
  });
  expect(written).toMatchObject({
    ok: true,
    flavor: "html",
    install: "npm install @nulib/clover",
  });
  expect(written.code).toContain('<clover-items layout="grid"></clover-items>');
  expect(
    await call(page, "clover_compose_layout", { parts: [{ part: "Itms" }] }),
  ).toEqual({
    ok: false,
    issues: [
      {
        level: "error",
        at: "parts[0].part",
        says: "Clover has no part `Itms`. Did you mean `Items`?",
      },
    ],
  });
});

test("suggests from a resource's structure, never its words, marked untrusted", async ({
  page,
  baseURL,
}) => {
  await open(page, "/docs/composing");
  const address = `${baseURL}/mocks/rudolf-hess-nuremberg/manifest.json`;
  const answer = await call(page, "clover_suggest_layout", {
    resource: address,
  });
  expect(answer).toMatchObject({
    ok: true,
    resource: { address, untrusted: true },
    layout: {
      resource: address,
      parts: [{ part: "Label" }, { part: "Body" }, { part: "Panel" }],
    },
  });
  expect(
    (answer.has as { capability: string }[]).map((each) => each.capability),
  ).toEqual(
    expect.arrayContaining(["video", "annotations", "transcripts", "contents"]),
  );
  // Its label and summary are about Rudolf Hess at Nuremberg: none of it comes back.
  const said = JSON.stringify(answer).split(address).join("");
  expect(said).not.toMatch(/Hess|Nuremberg|Sentencing|Defendants/i);
  expect(
    await call(page, "clover_suggest_layout", {
      resource: "javascript:alert(1)",
    }),
  ).toMatchObject({ ok: false, says: expect.stringMatching(/on the web/) });
});

test("previews a part's page's own part, and gives the page's example back by keyboard", async ({
  page,
}) => {
  await open(page, "/docs/primitives/rights");
  expect(await call(page, "clover_preview_layout")).toMatchObject({
    ok: true,
    shows: "Rights",
    page: "Rights",
    sample: "paged",
  });
  const preview = page.getByRole("group", { name: "Preview from your agent" });
  await expect(preview).toBeVisible();
  await expect(
    preview
      .getByRole("group", { name: "Example" })
      .getByRole("link", { name: /rightsstatements\.org/ }),
  ).toBeVisible();
  await expect(preview.locator("code").first()).toContainText(
    "<Clover.Rights />",
  );
  await expect(page.locator('[role="status"]').last()).toHaveText(
    "Your agent's preview, Rights, is in the page's first example.",
  );

  // By keyboard: to the way back, and back.
  const back = preview.getByRole("button", {
    name: "Show this page's example",
  });
  const box = await back.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(24);
  await page.locator("body").focus();
  for (let tab = 0; tab < 80; tab++) {
    if (await back.evaluate((element) => element === document.activeElement))
      break;
    await page.keyboard.press("Tab");
  }
  await expect(back).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(preview).toHaveCount(0);
  // Focus to the frame, where the example came back.
  await expect
    .poll(() =>
      page.evaluate(() => document.activeElement?.tagName.toLowerCase()),
    )
    .toBe("figure");
  await expect(page.locator('[role="status"]').last()).toHaveText(
    "The page's own example is back.",
  );
});

test("previews an agent's layout, brought into view without moving focus", async ({
  page,
}) => {
  await open(page, "/docs/composing");
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  expect(
    await call(page, "clover_preview_layout", {
      reveal: true,
      layout: {
        parts: [
          { part: "Label", props: { as: "h2" } },
          { part: "Body" },
          {
            element: "aside",
            children: [{ part: "Items", props: { layout: "grid" } }],
          },
        ],
      },
    }),
  ).toMatchObject({ ok: true, shows: "Label, Body and Items" });
  const preview = page.getByRole("group", { name: "Preview from your agent" });
  await expect(preview).toBeInViewport();
  const example = preview.getByRole("group", { name: "Example" });
  await expect(
    example.getByRole("heading", { level: 2, name: /White bicycles/ }),
  ).toBeVisible();
  await expect(example.getByRole("listbox", { name: "Items" })).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(
    "BODY",
  );

  // axe, on the preview: no serious or critical violations.
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const frame = document.querySelector("article figure");
    const result = await (
      window as unknown as {
        axe: {
          run: (
            context: Element | null,
            options: object,
          ) => Promise<{ violations: { id: string; impact: string }[] }>;
        };
      }
    ).axe.run(frame, { resultTypes: ["violations"] });
    return result.violations
      .filter((each) => each.impact === "serious" || each.impact === "critical")
      .map((each) => each.id);
  });
  expect(violations).toEqual([]);
});

test("previews on Build with an agent, in the page's own example", async ({
  page,
}) => {
  await open(page, "/docs/agents");
  expect(
    await call(page, "clover_preview_layout", { capability: "metadata" }),
  ).toMatchObject({ ok: true, shows: "Metadata" });
  const preview = page.getByRole("group", { name: "Preview from your agent" });
  await expect(preview.locator("dl").first()).toBeVisible();
  await preview
    .getByRole("button", { name: "Show this page's example" })
    .click();
  await expect(preview).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Example" }).getByRole("listbox"),
  ).toBeVisible();
});

test("previews the Viewer on its page, and refuses a page with no example", async ({
  page,
}) => {
  await open(page, "/docs/viewer");
  expect(await call(page, "clover_preview_layout")).toMatchObject({
    ok: true,
    shows: "the Viewer",
    page: "Viewer",
  });
  // The Viewer's title, a level under the page's; About repeats the label further down.
  await expect(
    page
      .getByRole("group", { name: "Preview from your agent" })
      .getByRole("heading", { name: /White bicycles/, level: 2 }),
  ).toBeVisible();

  await open(page, "/docs/styling");
  expect(
    await call(page, "clover_preview_layout", { capability: "3d" }),
  ).toMatchObject({
    ok: false,
    says: expect.stringMatching(/no example to draw in/),
  });
});

test("previews in the example the page shows, its titles under the heading before it", async ({
  page,
}) => {
  // Composing's first example sits under "A layout of your own", an h2: its titles are h3s.
  await open(page, "/docs/composing");
  expect(
    await call(page, "clover_preview_layout", {
      layout: {
        parts: [{ part: "Label" }, { part: "Body" }, { part: "Panel" }],
      },
    }),
  ).toMatchObject({
    ok: true,
    notes: expect.arrayContaining([
      "Gave Panel headingLevel 3: the preview sits under the level 2 heading before its frame.",
    ]),
  });
  const preview = page.getByRole("group", { name: "Preview from your agent" });
  await expect(
    preview.getByRole("heading", { level: 3 }).first(),
  ).toBeVisible();
  await expect(preview.getByRole("heading", { level: 2 })).toHaveCount(0);

  // Get started keeps every setup's example, showing the one chosen: the preview goes there.
  await open(page, "/docs");
  await page.getByRole("radio", { name: /Web components \(npm\)/ }).check();
  expect(
    await call(page, "clover_preview_layout", {
      layout: { parts: [{ part: "Label" }, { part: "Body" }] },
    }),
  ).toMatchObject({ ok: true });
  await expect(
    page.getByRole("group", { name: "Preview from your agent" }),
  ).toBeVisible();
});
