/*
 * The Styling page's example (`content/docs/styling/index.mdx`,
 * `StylesheetExample`): a page as a site writes one, with none of the docs' styles, its
 * Viewer drawn by the elements from the package's build (`/examples/clover/…`): on
 * base.css alone, on base.css then spacing.css, or in Clover's look, each linked before
 * the elements' script. It
 * opens the catalog from the site's own mocks, and takes the docs page around it as its
 * own page's CSS would (`HOST`). Files of the static export, kept out of search
 * (`noindex`, and no canonical link, so `scripts/check-site.mjs` passes them by).
 */
export const dynamic = "force-static";
export const dynamicParams = false;

/** Each page, by its file, and the stylesheets it links. */
const PAGES: Record<string, { title: string; sheets: string[] }> = {
  "base.html": { title: "base.css", sheets: ["base.css"] },
  "spacing.html": {
    title: "base.css and spacing.css",
    sheets: ["base.css", "spacing.css"],
  },
  "styles.html": { title: "Clover's look", sheets: [] },
};

/*
 * The docs page around the frame, read as the frame's page opens (Mat, 2026-11-07: "send
 * in the consuming page font family and accent color"), from the same origin, before the
 * Viewer draws, so nothing changes under it: its font (the homepage's Font family), with
 * the `@font-face` rules that define it, as `next/font` names its families for the docs
 * alone; its accent (the homepage's Color, `--accent-9` on the docs' root) in the steps
 * the docs mix from it on a light page, read off a mark of theirs given that accent
 * (`[data-page-theme]`, `docs/styles/tokens.css`), as this page is light whatever the
 * docs' is; its headings as the docs set them (their family, weight and tracking, and a
 * title's size and lines for its level in an example, `[data-example]`,
 * `docs/styles/tokens.css`; Mat, 2026-11-07: "maybe we are not passing down some other
 * font treatments from the docs?"); and its higher-contrast mode (`data-high-contrast`),
 * which an accent that cannot carry white text turns on (WCAG 1.4.3). Opened alone, the
 * page keeps its own. `?level=` sets its Viewer's title level.
 */
const HOST = `(function () {
  var host;
  try {
    host = window.parent !== window && window.parent.document;
  } catch (error) {
    return;
  }
  if (!host) return;
  var view = host.defaultView;
  var root = document.documentElement;
  var unquote = function (name) {
    return name.trim().replace(/^["']|["']$/g, "");
  };
  var font = view.getComputedStyle(host.body).fontFamily;
  var rootSize = parseFloat(view.getComputedStyle(host.documentElement).fontSize) || 16;
  var probes = host.createElement("div");
  probes.setAttribute("data-example", "");
  probes.style.cssText = "position:absolute;visibility:hidden;inset-inline-start:-100vw";
  var bare = host.createElement("h2");
  bare.textContent = "Aa";
  probes.append(bare);
  var titles = ["h1", "h2", "h3", "h4", "h5", "h6"].map(function (tag) {
    var title = host.createElement(tag);
    title.className = "clover-title";
    title.textContent = "Aa";
    probes.append(title);
    return title;
  });
  host.body.append(probes);
  var heading = view.getComputedStyle(bare);
  var relative = function (value, size) {
    var number = parseFloat(value);
    return isNaN(number) ? value : number / size;
  };
  var headings =
    "h1, h2, h3, h4, h5, h6 { font-family: " + heading.fontFamily + "; font-weight: " +
    heading.fontWeight + "; letter-spacing: " +
    (heading.letterSpacing === "normal"
      ? "normal"
      : relative(heading.letterSpacing, parseFloat(heading.fontSize)) + "em") + "; }";
  titles.forEach(function (title) {
    var computed = view.getComputedStyle(title);
    var size = parseFloat(computed.fontSize);
    headings +=
      "\\n" + title.tagName.toLowerCase() + ":is(.clover-label, .clover-title) { font-size: " +
      size / rootSize + "rem; line-height: " + relative(computed.lineHeight, size) + "; }";
  });
  probes.remove();
  var families = (font + "," + heading.fontFamily).split(",").map(unquote);
  var faces = [];
  var walk = function (rules, base) {
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (rule.cssRules) walk(rule.cssRules, base);
      else if (
        rule.cssText.indexOf("@font-face") === 0 &&
        families.indexOf(unquote(rule.style.getPropertyValue("font-family"))) !== -1
      )
        faces.push(
          rule.cssText.replace(/url\\((["']?)([^"')]+)\\1\\)/g, function (_, quote, url) {
            return 'url("' + new URL(url, base).href + '")';
          }),
        );
    }
  };
  for (var i = 0; i < host.styleSheets.length; i++) {
    var sheet = host.styleSheets[i];
    try {
      walk(sheet.cssRules, sheet.href || host.baseURI);
    } catch (error) {}
  }
  var style = document.createElement("style");
  style.textContent =
    faces.join("\\n") + "\\nbody { font-family: " + font + "; }\\n" + headings;
  document.head.append(style);
  var probe = host.createElement("div");
  probe.setAttribute("data-page-theme", "");
  probe.hidden = true;
  var page = view.getComputedStyle(host.documentElement);
  ["--accent-9", "--accent-text-share"].forEach(function (name) {
    var value = page.getPropertyValue(name).trim();
    if (value) probe.style.setProperty(name, value);
  });
  host.body.append(probe);
  var steps = view.getComputedStyle(probe);
  [
    "--clover-color-accent",
    "--clover-color-accent-text",
    "--clover-color-accent-muted",
    "--clover-color-accent-alt",
  ].forEach(function (name) {
    var value = steps.getPropertyValue(name).trim();
    if (value) root.style.setProperty(name, value);
  });
  probe.remove();
  root.toggleAttribute(
    "data-high-contrast",
    host.documentElement.hasAttribute("data-high-contrast"),
  );
})();`;

export function generateStaticParams() {
  return Object.keys(PAGES).map((page) => ({ page }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page } = await params;
  const shown = PAGES[page];
  if (!shown) return new Response("Not found", { status: 404 });
  const links = shown.sheets
    .map((sheet) => `    <link rel="stylesheet" href="../clover/${sheet}" />\n`)
    .join("");
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>The Viewer in ${shown.title}</title>
${links}    <style>
      /*
       * The page's own: light, its type, which Clover reads, and the Viewer the frame's
       * height (\`fill\`).
       */
      :root {
        color-scheme: light;
      }
      html,
      body,
      clover-viewer {
        height: 100%;
      }
      body {
        margin: 0;
        font-family: system-ui, sans-serif;
      }
    </style>
    <script>
      ${HOST}
    </script>
    <script src="../clover/web-components/index.umd.js"></script>
  </head>
  <body>
    <clover-viewer fill></clover-viewer>
    <script>
      // The catalog, from the site's own mocks, wherever the site is served.
      var viewer = document.querySelector("clover-viewer");
      // Its title at the level the frame asks for, one below the heading it sits under.
      var level = new URLSearchParams(location.search).get("level");
      if (/^[2-6]$/.test(level || "")) viewer.setAttribute("heading-level", level);
      viewer
        .setAttribute(
          "iiif-content",
          new URL("../../mocks/paged/manifest.json", location.href).href,
        );
    </script>
  </body>
</html>
`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
