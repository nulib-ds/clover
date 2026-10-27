import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { openPanel, serveIIIF } from "./fixtures";

/*
 * WCAG 2.5.8, Target Size (Minimum): links stacked in a list (About's Homepage and See
 * also) are each a 24px target, or 24px apart, at the page's own type and leading. The
 * harness leaves `line-height: normal`, about 1.2, where a bare list of links stood 19px
 * apart; a page's reset may set less, or smaller text, under the same 16px rem.
 */
const book = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../src/fixtures/iiif-cookbook/0009-book-1.json"),
    "utf8",
  ),
);
const LINKED = "https://links.test/book.json";
const links = (kind: string) =>
  [1, 2, 3].map((n) => ({
    id: `https://example.org/${kind}/${n}`,
    type: "Text",
    label: { en: [`${kind} ${n}`] },
    format: "text/html",
  }));

const HOSTS = [
  ["the harness's own type", ""],
  ["14px text", "body { font-size: 14px }"],
  ["line-height: 1", "body { line-height: 1 }"],
  [
    "14px text at line-height 1.15",
    "body { font-size: 14px; line-height: 1.15 }",
  ],
] as const;

/*
 * What a browser's sub-pixel layout takes off a length: Firefox lays out in sixtieths of a
 * pixel, so links set 24px apart can measure 23.99998px. Far under anything a reader's
 * pointer meets; a link set short of 24px still fails.
 */
const ROUNDING = 0.01;

for (const [host, css] of HOSTS) {
  test(`lists of links space each link to a 24px target, with ${host} (WCAG 2.5.8)`, async ({
    page,
    isMobile,
  }) => {
    await serveIIIF(page);
    await page.route(LINKED, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          ...book,
          id: LINKED,
          homepage: links("Homepage"),
          seeAlso: links("See also"),
        }),
      }),
    );
    await page.goto(`/?content=${LINKED}&panel=tabs`);
    await openPanel(page, isMobile);
    if (css) await page.addStyleTag({ content: css });
    for (const list of [".clover-homepage", ".clover-see-also"]) {
      const anchors = page.locator(`.clover-about ${list} a`);
      await expect(anchors).toHaveCount(3);
      const boxes = await anchors.evaluateAll((elements) =>
        elements.map((element) => {
          const { top, bottom, height } = element.getBoundingClientRect();
          return { center: (top + bottom) / 2, height };
        }),
      );
      for (let index = 1; index < boxes.length; index++) {
        const [above, below] = [boxes[index - 1], boxes[index]];
        // Too short to be 24px itself, so a 24px circle on each must clear the other.
        if (above.height >= 24 - ROUNDING && below.height >= 24 - ROUNDING)
          continue;
        expect(below.center - above.center, list).toBeGreaterThanOrEqual(
          24 - ROUNDING,
        );
        expect(
          below.center - below.height / 2 - above.center,
          list,
        ).toBeGreaterThanOrEqual(12 - ROUNDING);
      }
    }
  });
}
