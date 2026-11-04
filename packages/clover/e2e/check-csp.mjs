/*
 * Clover under a strict Content Security Policy, in a browser (Mat, 2026-11-03): pages
 * built from `dist/` as an app builds them, and the elements from `dist/web-components`,
 * each served with a policy that allows no `'unsafe-inline'`, no `data:` and no `blob:`,
 * then with Trusted Types required (`trusted-types clover`), and each compared with the
 * same page served with no policy. It fails on a policy violation Clover causes (but the
 * elements' one refused `<style>`, after which they adopt their sheets, and a map's
 * refused `blob:` worker, which it says it could not draw), on captions with no cues, on
 * IIIF HTML that does not show, on an element styled otherwise, and on a map with a worker
 * of the page's own that does not draw.
 *
 *   node e2e/check-csp.mjs [chromium|firefox|webkit] [page]
 *
 * Run `npm run build -w @nulib/clover` first. The resources are the docs' mocks, served
 * from `public/mocks` at their published addresses, and the Cookbook's video on
 * fixtures.iiif.io, so it needs the network. Every playback stays muted.
 */
import { createServer } from "node:http";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(pkg, "../..");
const require = createRequire(join(pkg, "package.json"));
const playwright = require("playwright");

const args = process.argv.slice(2);
const engine =
  args.find((arg) => ["chromium", "firefox", "webkit"].includes(arg)) ??
  "chromium";
const only = args.find((arg) => arg !== engine);

const MOCKS = "https://clover.iiif.library.northwestern.edu/mocks";
const VIDEO = `${MOCKS}/transcripts/manifest.json`;
const PLACE = `${MOCKS}/navplace/manifest.json`;
const RECORDING = `${MOCKS}/hindenburg/manifest.json`;
const STRICT =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; " +
  "media-src 'self' https:; connect-src 'self' https:; font-src 'self' https:; " +
  "worker-src 'self'; object-src 'none'; base-uri 'self'";
const POLICIES = {
  none: "",
  strict: STRICT,
  "trusted types": `${STRICT}; require-trusted-types-for 'script'; trusted-types clover`,
};

const react = (body, before = "") =>
  `import { createRoot } from "react-dom/client";
import Viewer, * as Clover from "@nulib/clover";
import "@nulib/clover/styles.css";
${before}
createRoot(document.getElementById("app")).render(<div className="tall">${body}</div>);
`;
/** Each page: its React module or its markup, and what it holds. */
const PAGES = {
  video: { react: react(`<Viewer iiifContent="${VIDEO}" />`), video: true },
  // A stream (HLS), which hls.js plays.
  /*
   * A stream (HLS): hls.js plays it through Media Source Extensions, whose media is a
   * `blob:` address, as every such player's is, so its page allows `media-src blob:`.
   */
  recording: {
    react: react(`<Clover.Timeline iiifContent="${RECORDING}" />`),
    stream: true,
    allow: { "media-src": "blob:" },
  },
  // A Viewer whose values hold HTML, with a Map tab on Clover's own worker.
  viewer: { react: react(`<Viewer iiifContent="${PLACE}" />`), html: true },
  // A map on a worker the page serves, as a strict policy's page does.
  map: {
    react: react(
      `<Clover.Map iiifContent="${PLACE}" />`,
      `Clover.setMapWorkerUrl("/maplibre/maplibre-gl-worker.mjs");`,
    ),
    map: true,
  },
  "elements, video": {
    markup: `<clover-viewer class="tall" iiif-content="${VIDEO}"></clover-viewer>`,
    video: true,
    compare: true,
  },
  // The elements' map: its worker a file beside the element, on the page's own host.
  "elements, map": {
    markup: `<clover-map iiif-content="${PLACE}"></clover-map>`,
    compare: true,
    map: true,
  },
};
const slug = (name) => name.replace(/\W+/g, "-");

// In the workspace, as `build/first-view.mjs` builds, so the app finds Clover and React.
const app = join(site, "node_modules/.cache/clover-check-csp");
rmSync(app, { recursive: true, force: true });
mkdirSync(app, { recursive: true });
const page = (title, head, body) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="/page.css">${head}</head><body><main id="app">${body}</main></body></html>`;
writeFileSync(
  join(app, "page.css"),
  "clover-viewer, clover-map { display: block } .tall { height: 640px }\n",
);
for (const [name, { react: code, markup }] of Object.entries(PAGES)) {
  if (only && name !== only) continue;
  const out = join(app, slug(name));
  if (markup) {
    mkdirSync(out, { recursive: true });
    writeFileSync(
      join(out, "index.html"),
      page(
        name,
        `<script type="module" src="/elements/index.mjs"></script>`,
        markup,
      ),
    );
    continue;
  }
  writeFileSync(join(app, "main.jsx"), code);
  writeFileSync(
    join(app, "index.html"),
    page(name, "", "").replace(
      "</body>",
      `<script type="module" src="./main.jsx"></script></body>`,
    ),
  );
  await build({
    configFile: false,
    root: app,
    base: `/${slug(name)}/`,
    logLevel: "error",
    esbuild: { jsx: "automatic" },
    build: {
      outDir: out,
      emptyOutDir: true,
      modulePreload: { polyfill: false },
      chunkSizeWarningLimit: Infinity,
      rollupOptions: { onwarn() {} },
    },
  });
}

const maplibre = dirname(require.resolve("maplibre-gl/dist/maplibre-gl.css"));
const TYPES = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
};
let policy = "";
const server = createServer((request, response) => {
  const { pathname } = new URL(request.url, "http://localhost");
  const file = pathname.startsWith("/elements/")
    ? join(pkg, "dist/web-components", pathname.slice(10))
    : pathname.startsWith("/maplibre/")
      ? join(maplibre, pathname.slice(10))
      : join(
          app,
          decodeURIComponent(pathname),
          pathname.endsWith("/") ? "index.html" : "",
        );
  if (!existsSync(file)) {
    response.writeHead(404);
    return response.end();
  }
  const headers = {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
  };
  if (extname(file) === ".html" && policy)
    headers["content-security-policy"] = policy;
  response.writeHead(200, headers);
  response.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(4330, resolve));

// Chrome itself where asked (`CHANNEL=chrome`): Playwright's Chromium plays no H.264 or AAC.
const browser = await playwright[engine].launch(
  process.env.CHANNEL ? { channel: process.env.CHANNEL } : {},
);
const failures = [];

/** A page as served with a policy: what it violated, and what it shows. */
async function visit(name, policyName) {
  policy = Object.entries(PAGES[name].allow ?? {}).reduce(
    (written, [directive, source]) =>
      written.replace(
        new RegExp(`${directive} ([^;]*)`),
        `${directive} $1 ${source}`,
      ),
    POLICIES[policyName],
  );
  const tab = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const warnings = [];
  tab.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await tab.addInitScript(() => {
    // Muted, whatever plays.
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      this.muted = true;
      // Kept, as a recording's element need not be in the page.
      window.__media = this;
      return play.call(this);
    };
    window.__violations = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      window.__violations.push(
        `${event.effectiveDirective} ${String(event.blockedURI).replace(/^(blob|data):.*/, "$1")}`,
      ),
    );
  });
  await tab.route(`${MOCKS}/**`, (route) => {
    const path = new URL(route.request().url()).pathname.slice(
      "/mocks/".length,
    );
    const file = join(site, "public/mocks", decodeURIComponent(path));
    return existsSync(file)
      ? route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: readFileSync(file),
        })
      : route.fulfill({ status: 404 });
  });
  await tab.goto(`http://localhost:4330/${slug(name)}/`);
  await tab.waitForTimeout(6000);
  // The Map tab, where there is one, so its map draws.
  await tab.evaluate(() =>
    [...document.querySelectorAll("button, [role=tab]")]
      .find((button) => /^Map$/.test(button.textContent.trim()))
      ?.click(),
  );
  await tab.waitForTimeout(4000);
  // A recording, played a little (muted).
  if (PAGES[name].stream) {
    await tab
      .getByRole("button", { name: "Play", exact: true })
      .first()
      .click();
    await tab.waitForTimeout(6000);
  }
  const shown = await tab.evaluate(() => {
    const video = document.querySelector("video");
    for (const track of video?.textTracks ?? [])
      if (track.mode === "disabled") track.mode = "hidden";
    const media = window.__media;
    return {
      // Whether the media played.
      played: media ? media.currentTime > 0 : null,
      cues: [...(video?.textTracks ?? [])].reduce(
        (total, track) => total + (track.cues?.length ?? 0),
        0,
      ),
      // IIIF's HTML, Clover's to write: not the map's credits, MapLibre's.
      html: [...document.querySelectorAll("[class*=clover] :is(p, a)")].filter(
        (element) => !element.closest(".clover-geomap"),
      ).length,
      map: document.querySelector(".clover-geomap")?.dataset.status,
      styles: [...document.querySelectorAll("#app *")].map((element) => {
        const style = getComputedStyle(element);
        const values = [];
        for (let i = 0; i < style.length; i++)
          if (!/^(--|transition|animation)/.test(style[i]))
            values.push(`${style[i]}:${style.getPropertyValue(style[i])}`);
        return values.join("|");
      }),
      violations: [...new Set(window.__violations)],
    };
  });
  await tab.close();
  return { ...shown, warnings };
}

for (const [name, expected] of Object.entries(PAGES)) {
  if (only && name !== only) continue;
  const open = await visit(name, "none");
  for (const policyName of ["strict", "trusted types"]) {
    const seen = await visit(name, policyName);
    const fail = (what) => failures.push(`${name}, ${policyName}: ${what}`);
    const allowed = new Set([
      // The elements' first `<style>`, refused: they adopt their sheets.
      ...(expected.markup ? ["style-src-elem inline"] : []),
      // Clover's own map worker, refused: the map says it could not be drawn.
      ...(name === "viewer"
        ? ["worker-src blob", "require-trusted-types-for trusted-types-sink"]
        : []),
      // MapLibre makes its worker and reads its credits from strings: the page's to allow.
      ...(expected.map && policyName === "trusted types"
        ? ["require-trusted-types-for trusted-types-sink"]
        : []),
    ]);
    for (const violation of seen.violations)
      if (!allowed.has(violation)) fail(`refused ${violation}`);
    if (expected.video && !seen.cues) fail("its captions have no cues");
    if (expected.stream && seen.played !== open.played)
      fail(`its stream ${seen.played ? "played" : "never played"}`);
    if (expected.html && seen.html !== open.html)
      fail(`${seen.html} of its ${open.html} HTML elements show`);
    // MapLibre makes its worker and reads its credits from strings, which Trusted Types
    // refuse but where the page's own default policy lets them through: no map to check.
    const mapless = expected.map && policyName === "trusted types";
    if (expected.compare && !mapless) {
      const differ = seen.styles.filter(
        (style, i) => style !== open.styles[i],
      ).length;
      if (differ || seen.styles.length !== open.styles.length)
        fail(`${differ} of ${open.styles.length} nodes styled otherwise`);
    }
    if (expected.map && policyName === "strict" && seen.map !== "ready")
      fail(`its map is ${seen.map}, on a worker of the page's own`);
    if (name === "viewer" && seen.map) {
      if (seen.map !== "error")
        fail(`its map is ${seen.map}, its worker refused`);
      if (!seen.warnings.some((warning) => warning.includes("setMapWorkerUrl")))
        fail("its console never names setMapWorkerUrl");
    }
    console.log(
      `${engine} ${name}, ${policyName}: ${seen.violations.length ? seen.violations.join("; ") : "no violations"}; cues ${seen.cues}, HTML ${seen.html}, played ${seen.played}${seen.map ? `, map ${seen.map}` : ""}`,
    );
  }
}

await browser.close();
server.close();
rmSync(app, { recursive: true, force: true });
for (const failure of failures) console.log(`✗ ${failure}`);
console.log(failures.length ? `\n${failures.length} failures` : "\nall held");
process.exitCode = failures.length ? 1 : 0;
