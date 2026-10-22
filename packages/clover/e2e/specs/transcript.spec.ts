import { type Page, expect, test } from "@playwright/test";

import { serveIIIF } from "./fixtures";

/*
 * A Transcript of several caption files (Cookbook 0074: English and Italian), in the
 * Default template's accordion: its languages, as codes, beside the Transcript's heading
 * (`useSectionActions`), and following the Canvas's own Captions menu.
 */
const LANGUAGES =
  "/?content=https://fixtures.test/0074-multiple-language-captions.json";
/** WCAG 1.4.12's text spacing, as a reader's own stylesheet sets it. */
const SPACING = `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }`;

async function open(page: Page) {
  await serveIIIF(page);
  await page.goto(LANGUAGES);
  // On a phone the panel is over the stage, and opened by its toggle.
  const panel = page.getByRole("button", { name: "More information" });
  if ((await panel.getAttribute("aria-expanded")) !== "true")
    await panel.click();
  await page.getByRole("button", { name: "Transcript" }).click();
  await expect(page.getByRole("group", { name: "Captions" })).toBeVisible();
}

for (const spaced of [false, true]) {
  test(`its languages sit beside its heading, clear of its label, and nothing in the panel runs past its edge${spaced ? ", text spaced" : ""} (WCAG 1.4.12)`, async ({
    page,
  }) => {
    await open(page);
    if (spaced) await page.addStyleTag({ content: SPACING });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const heading = [
            ...document.querySelectorAll<HTMLElement>(
              ".clover-sections-heading",
            ),
          ].find((each) => each.textContent?.trim() === "Transcript")!;
          const label = heading.querySelector(".clover-sections-label")!;
          const words = document.createRange();
          words.selectNodeContents(label);
          const text = words.getBoundingClientRect();
          const languages = document
            .querySelector(".clover-transcript-languages")!
            .getBoundingClientRect();
          const row = heading.getBoundingClientRect();
          const panel = document.querySelector<HTMLElement>(
            ".clover-template-default-panel",
          )!;
          return {
            // The label ends before the codes begin, however it wraps.
            clear: text.right <= languages.left + 0.5,
            // The codes are on the heading's row, inside its box.
            onRow: languages.top >= row.top && languages.bottom <= row.bottom,
            // Nothing makes the panel scroll across, a label's popover included.
            across: panel.scrollWidth <= panel.clientWidth,
          };
        }),
      )
      .toEqual({ clear: true, onRow: true, across: true });
  });
}

test("a caption file chosen in the Canvas's menu is the one the Transcript reads; Off leaves it", async ({
  page,
}) => {
  await open(page);
  const english = page.getByRole("radio", {
    name: "EN Captions in WebVTT format",
  });
  await expect(english).toBeChecked();
  // The menu's radios are its rows' for the keyboard: picked as a reader would.
  const captions = page.getByRole("button", { name: "Captions" });
  await captions.focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("radio", { name: "IT Sottotitoli in formato WebVTT" })
    .first()
    .focus();
  await page.keyboard.press("Enter");
  const italian = page
    .getByRole("group", { name: "Captions" })
    .last()
    .getByRole("radio", { name: /^IT / });
  await expect(italian).toBeChecked();
  await expect(page.locator(".clover-transcript-cues")).toHaveAttribute(
    "lang",
    "it",
  );

  await captions.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("radio", { name: "Off" }).focus();
  await page.keyboard.press("Enter");
  await expect(captions).not.toHaveAttribute("data-active", "");
  await expect(italian).toBeChecked();
});

test("a language chosen in the Transcript is the one the Canvas's captions show, while they show", async ({
  page,
}) => {
  await open(page);
  const captions = page.getByRole("button", { name: "Captions" });
  await expect(captions).toHaveAttribute("data-active", "");
  const transcript = page.getByRole("group", { name: "Captions" }).last();
  await transcript.getByRole("radio", { name: /^IT / }).focus();
  await page.keyboard.press("Space");
  // The button describes the file it shows (no cue shows yet, at 0:00).
  await expect(captions).toHaveAccessibleDescription(
    "Sottotitoli in formato WebVTT",
  );

  // Off stays off: the Transcript changes its language, not whether captions show.
  await captions.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("radio", { name: "Off" }).focus();
  await page.keyboard.press("Enter");
  await transcript.getByRole("radio", { name: /^EN / }).focus();
  await page.keyboard.press("Space");
  await expect(captions).toHaveAccessibleDescription("Off");
  await expect(captions).not.toHaveAttribute("data-active", "");
});

test("a transcript as plain text shows in its paragraphs, read as the file is encoded (Cookbook 0017)", async ({
  page,
}) => {
  await serveIIIF(page);
  await page.goto("/?content=https://fixtures.test/0017-transcription-av.json");
  const panel = page.getByRole("button", { name: "More information" });
  if ((await panel.getAttribute("aria-expanded")) !== "true")
    await panel.click();
  await page.getByRole("button", { name: "Transcript" }).click();
  const paragraphs = page.locator(".clover-transcript-body > p");
  await expect(paragraphs).toHaveCount(2);
  await expect(paragraphs.first()).toHaveText(
    "[DISCLAIMER: machine-generated transcript]",
  );
  // Windows-1252's apostrophe, served without a charset, reads as one.
  await expect(paragraphs.last()).toContainText("the opponent’s court");
});

test("a film's captions and its transcript share the row, the transcript as TXT after the languages", async ({
  page,
}) => {
  await serveIIIF(page);
  // The docs' `transcripts` mock: English captions, and the film's plain-text transcript.
  await page.goto(
    "/?content=https://nulib-ds.github.io/clover/mocks/transcripts/manifest.json",
  );
  const panel = page.getByRole("button", { name: "More information" });
  if ((await panel.getAttribute("aria-expanded")) !== "true")
    await panel.click();
  await page.getByRole("button", { name: "Transcript" }).click();
  const row = page.getByRole("group", { name: "Transcript" });
  await expect(row.locator(".clover-transcript-code")).toHaveText([
    "EN",
    "TXT",
  ]);
  await row.getByRole("radio", { name: /^TXT / }).focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".clover-transcript-body")).toBeVisible();
  // The captions stay as they were.
  await expect(
    page.getByRole("button", { name: "Captions" }),
  ).toHaveAccessibleDescription("Captions in WebVTT format");
});

test("an image's transcript shows for the page in view, in its language, and follows the page", async ({
  page,
  isMobile,
}) => {
  await serveIIIF(page);
  // The docs' `page-transcript` mock: a newspaper's two pages, each with its OCR as text.
  await page.goto(
    "/?content=https://nulib-ds.github.io/clover/mocks/page-transcript/manifest.json",
  );
  const panel = page.getByRole("button", { name: "More information" });
  if ((await panel.getAttribute("aria-expanded")) !== "true")
    await panel.click();
  await page.getByRole("button", { name: "Transcript" }).click();
  const body = page.locator(".clover-transcript-body");
  await expect(body).toHaveAttribute("lang", "de");
  await expect(body.locator("p").first()).toHaveText("I. 54. Jahrgang");
  // On a phone the panel floats over the strip: put away, then opened again on page 2.
  if (isMobile)
    await page.getByRole("button", { name: "Close information panel" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  if (isMobile) await panel.click();
  await expect(body.locator("p").first()).toContainText(
    "Die beiden Weltreiſenden",
  );
});
