/*
 * Clover's elements, each alone, styled as the whole stylesheet styles them: each page
 * holds one element (or one natural group), defined from source by the elements' dev
 * server, so it brings only the sheets its code owns (`build/clover-sheets.mjs`). Every
 * node's computed style, and its ::before's and ::after's, is read with those sheets, then
 * with the package's whole stylesheet added (`dist/styles.css`, `dist/templates.css`); at
 * rest, then with every disclosure and tab opened. A node that changes shows a sheet some
 * module draws without owning it: name the module in `OWNERS`.
 *
 *   npx vite --config e2e/vite.elements.config.mjs     (the server, port 4323)
 *   npm run build -w @nulib/clover                     (the whole stylesheet to compare)
 *   node e2e/check-sheets.mjs [page] [--dark]
 *
 * It opens the IIIF Cookbook's resources, so it needs the network. Keep A/V muted.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const only = args.find((arg) => !arg.startsWith("--"));
const scheme = args.includes("--dark") ? "dark" : "light";
const require = createRequire(join(pkg, "../../package.json"));
const { chromium } = require("playwright");
const whole = ["styles.css", "templates.css"]
  .map((file) => readFileSync(join(pkg, "dist", file), "utf8"))
  .join("\n");

const R = (n) => `https://iiif.io/api/cookbook/recipe/${n}`;
const BOOK = R("0009-book-1/manifest.json");
const TOC = R("0024-book-4-toc/manifest.json");
const TAGGING = R("0021-tagging/manifest.json");
const COLLECTION = R("0032-collection/collection.json");
const NAVPLACE = R("0240-navPlace-on-canvases/manifest.json");
const IMAGE = R("0005-image-service/manifest.json");
const VIDEO = R("0003-mvm-video/manifest.json");
const METADATA = R("0029-metadata-anywhere/manifest.json");
const RENDERING = R("0046-rendering/manifest.json");
const CAPTIONS = R("0219-using-caption-file/manifest.json");
const inRoot = (url, inner) =>
  `<clover-root iiif-content="${url}">${inner}</clover-root>`;
const box = 'style="height: 320px"';

const PAGES = {
  label: inRoot(BOOK, `<clover-label as="h2"></clover-label>`),
  properties: inRoot(
    METADATA,
    [
      "summary",
      "metadata",
      "required-statement",
      "rights",
      "homepage",
      "see-also",
      "rendering",
      "part-of",
      "id",
      "thumbnail",
    ]
      .map((tag) => `<clover-${tag}></clover-${tag}>`)
      .join("") + `<clover-value of="label"></clover-value>`,
  ),
  status: inRoot(BOOK, `<clover-status></clover-status>`),
  pager: inRoot(
    BOOK,
    `<clover-previous></clover-previous><clover-position></clover-position><clover-next></clover-next>`,
  ),
  items: inRoot(BOOK, `<clover-items></clover-items>`),
  "items grid": inRoot(BOOK, `<clover-items layout="grid"></clover-items>`),
  "items list": inRoot(BOOK, `<clover-items layout="list"></clover-items>`),
  "items pager": inRoot(BOOK, `<clover-items layout="pager"></clover-items>`),
  "items alone": `<clover-items iiif-content="${BOOK}"></clover-items>`,
  content: inRoot(IMAGE, `<clover-content ${box}></clover-content>`),
  "content, annotations": inRoot(
    TAGGING,
    `<clover-content ${box}></clover-content>`,
  ),
  "content, video": inRoot(VIDEO, `<clover-content ${box}></clover-content>`),
  canvas: `<clover-canvas iiif-content="${IMAGE}" ${box}></clover-canvas>`,
  about: inRoot(BOOK, `<clover-about></clover-about>`),
  annotations: inRoot(TAGGING, `<clover-annotations></clover-annotations>`),
  collection: inRoot(COLLECTION, `<clover-collection></clover-collection>`),
  "collection select": inRoot(
    COLLECTION,
    `<clover-collection-select></clover-collection-select>`,
  ),
  contents: inRoot(TOC, `<clover-contents></clover-contents>`),
  transcript: inRoot(
    CAPTIONS,
    `<clover-content ${box}></clover-content><clover-transcript></clover-transcript>`,
  ),
  download: inRoot(RENDERING, `<clover-download></clover-download>`),
  map: `<clover-map iiif-content="${NAVPLACE}" ${box}></clover-map>`,
  panel: inRoot(
    TOC,
    `<clover-panel><clover-tab value="about" label="About"><clover-about></clover-about></clover-tab><clover-tab value="contents" label="Contents"><clover-contents></clover-contents></clover-tab></clover-panel>`,
  ),
  "panel, tabs": inRoot(
    TOC,
    `<clover-panel layout="tabs"><clover-tab value="about" label="About"><clover-about></clover-about></clover-tab><clover-tab value="contents" label="Contents"><clover-contents></clover-contents></clover-tab></clover-panel>`,
  ),
  split: inRoot(
    BOOK,
    `<clover-split><clover-split-pane><clover-label></clover-label></clover-split-pane><clover-split-handle></clover-split-handle><clover-split-pane id="side"><clover-summary></clover-summary></clover-split-pane></clover-split>`,
  ),
  "read more": `<clover-read-more><p style="max-height: 3em; overflow: hidden">${"Words, and more words. ".repeat(40)}</p></clover-read-more>`,
  tip: `<button class="clover-canvas-button" type="button">A<clover-tip label="A tip"></clover-tip></button>`,
  viewer: `<clover-viewer iiif-content="${BOOK}"></clover-viewer>`,
  "viewer, document": `<clover-viewer template="document" iiif-content="${TOC}"></clover-viewer>`,
  "viewer, gallery": `<clover-viewer template="gallery" iiif-content="${BOOK}"></clover-viewer>`,
  "viewer, video": `<clover-viewer iiif-content="${VIDEO}"></clover-viewer>`,
};

const PROPS = [
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "z-index",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top-width",
  "border-top-style",
  "border-top-color",
  "border-left-width",
  "border-left-style",
  "border-top-left-radius",
  "box-sizing",
  "box-shadow",
  "outline-style",
  "color",
  "background-color",
  "background-image",
  "opacity",
  "visibility",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "text-align",
  "text-decoration-line",
  "white-space",
  "text-overflow",
  "overflow-x",
  "overflow-y",
  "flex-direction",
  "flex-wrap",
  "flex-grow",
  "flex-shrink",
  "align-items",
  "justify-content",
  "gap",
  "grid-template-columns",
  "transform",
  "translate",
  "cursor",
  "pointer-events",
  "content",
  "list-style-type",
  "object-fit",
  "aspect-ratio",
  "clip-path",
  "inset",
  "fill",
  "stroke",
  "transition-property",
];

const browser = await chromium.launch({ channel: "chrome" });
const SELECTOR =
  "[class*='clover-'], [class*='clover-'] *, clover-tip, clover-read-more, clover-read-more *";
let problems = 0;
for (const [name, markup] of Object.entries(PAGES)) {
  if (only && name !== only) continue;
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    colorScheme: scheme,
  });
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      this.muted = true;
      return play.call(this);
    };
  });
  await page.route("http://localhost:4323/alone.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${name}</title></head><body><main>${markup}</main><script type="module">import "/@fs${pkg}/src/web-components/index.ts";</script></body></html>`,
    }),
  );
  await page.goto("http://localhost:4323/alone.html", { waitUntil: "load" });
  await page.waitForTimeout(5000);
  // Still, so two readings agree on what moves (a loading bar's sweep).
  await page.addStyleTag({
    content:
      "*, *::before, *::after { animation: none !important; transition: none !important; }",
  });
  for (const state of ["rest", "open"]) {
    if (state === "open")
      await page.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        for (const button of document.querySelectorAll(
          '[aria-expanded="false"]',
        )) {
          if (button.closest("[inert]")) continue;
          button.click();
          await wait(80);
        }
        for (const tab of document.querySelectorAll('[role="tab"]')) {
          tab.click();
          await wait(80);
        }
        await wait(1500);
      });
    const snapshot = () =>
      page.evaluate(
        ([props, selector]) =>
          [...document.querySelectorAll(selector)].map((element) =>
            ["", "::before", "::after"].map((pseudo) => {
              const style = getComputedStyle(element, pseudo || null);
              if (
                pseudo &&
                (style.content === "none" || style.content === "normal")
              )
                return "";
              return props.map((p) => style.getPropertyValue(p)).join("|");
            }),
          ),
        [PROPS, SELECTOR],
      );
    const names = await page.evaluate(
      (selector) =>
        [...document.querySelectorAll(selector)].map((element) => {
          const path = [];
          for (
            let e = element;
            e && e.localName !== "main" && path.length < 3;
            e = e.parentElement
          )
            path.unshift(
              e.localName +
                (typeof e.className === "string" && e.className
                  ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".")
                  : ""),
            );
          return path.join(" > ");
        }),
      SELECTOR,
    );
    const sheets = await page.evaluate(() =>
      [...document.head.querySelectorAll("style[data-clover-index]")].map(
        (style) => style.dataset.clover,
      ),
    );
    const before = await snapshot();
    await page.evaluate((css) => {
      const style = document.createElement("style");
      style.id = "whole-for-test";
      style.textContent = css;
      document.head.append(style);
    }, whole);
    await page.waitForTimeout(300);
    const after = await snapshot();
    await page.evaluate(() =>
      document.getElementById("whole-for-test")?.remove(),
    );
    const diffs = [];
    before.forEach((parts, at) =>
      parts.forEach((value, which) => {
        if (!after[at] || value === after[at][which]) return;
        const a = value.split("|"),
          b = after[at][which].split("|");
        diffs.push(
          `${names[at]}${["", "::before", "::after"][which]}: ` +
            PROPS.filter((p, i) => a[i] !== b[i])
              .slice(0, 4)
              .map(
                (p) => `${p} ${a[PROPS.indexOf(p)]} → ${b[PROPS.indexOf(p)]}`,
              )
              .join("; "),
        );
      }),
    );
    problems += diffs.length;
    console.log(
      `${name} (${state}): ${before.length} nodes, ${diffs.length} differ; sheets: ${sheets.join(" ")}`,
    );
    for (const d of [...new Set(diffs)].slice(0, 6))
      console.log("   •", d.slice(0, 260));
  }
  await page.close();
}
console.log(problems ? `\n${problems} differences` : "\nno differences");
await browser.close();
process.exitCode = problems ? 1 : 0;
