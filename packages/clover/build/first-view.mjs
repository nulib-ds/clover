/*
 * Holds the figures the site states to what a browser fetches (Mat, 2026-10-27: "to first
 * view"). `build/sizes.mjs` measures each page to its first view without a browser, by the
 * lazy chunks it says that view loads (`FIRST_VIEW`, `UPGRADER`, the elements' module
 * keys); this builds each page as an app would, opens it in Chrome until it draws, gzips
 * every file of Clover's it fetched, as `sizes.mjs` counts them, and fails where the two
 * disagree, naming what was fetched. Locally only: it needs Chrome and the network (the
 * resources' images and the published mocks).
 *
 *     npm run build -w @nulib/clover && npm run check:first-view -w @nulib/clover
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const elements = join(root, "dist/web-components");
const sizes = JSON.parse(readFileSync(join(root, "build/sizes.json"), "utf8"));
// Under the workspace's `node_modules`, so the app resolves React and `@nulib/clover`.
const app = resolve(root, "../../node_modules/.cache/clover-first-view");
const PORT = 4499;
const HERE = `http://localhost:${PORT}`;
const MOCKS = "https://nulib-ds.github.io/clover/mocks";

/** The plainest resources: an image (written here), MP4 audio, a model, a navPlace point. */
const IMAGE = `${HERE}/image.json`;
const AUDIO =
  "https://iiif.io/api/cookbook/recipe/0002-mvm-audio/manifest.json";
const MODEL = `${MOCKS}/esu-shrine/manifest.json`;
const PLACE = `${MOCKS}/navplace/manifest.json`;
// Gallery draws no grid for a Manifest of one item: the catalog has many.
const PAGES_OF = `${MOCKS}/paged/manifest.json`;
const IMAGE_SERVICE =
  "https://iiif.dc.library.northwestern.edu/iiif/3/1ece48b0-8a49-491d-9f3f-90dc8bcca1ac";
const image = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: IMAGE,
  type: "Manifest",
  label: { en: ["A bus on State Street"] },
  items: [
    {
      id: `${HERE}/canvas/1`,
      type: "Canvas",
      width: 3968,
      height: 2685,
      items: [
        {
          id: `${HERE}/canvas/1/page`,
          type: "AnnotationPage",
          items: [
            {
              id: `${HERE}/canvas/1/page/1`,
              type: "Annotation",
              motivation: "painting",
              target: `${HERE}/canvas/1`,
              body: {
                id: `${IMAGE_SERVICE}/full/600,/0/default.jpg`,
                type: "Image",
                format: "image/jpeg",
                width: 3968,
                height: 2685,
                service: [
                  {
                    id: IMAGE_SERVICE,
                    profile: "level2",
                    type: "ImageService3",
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
};

/** A part alone, in a box it can fill, as a page gives it one. */
const boxed = (element) => `<div style="height: 600px">${element}</div>`;

/** React pages: `[figure, its value, the app, what it counts]`. */
const REACT = [
  ...[
    ["Default", "defaultTemplateFirstViewGzip", IMAGE, ""],
    ["Document", "documentTemplateFirstViewGzip", IMAGE, "Document"],
    ["Gallery", "galleryTemplateFirstViewGzip", PAGES_OF, "Gallery"],
  ].map(([name, key, url, template]) => [
    `<Viewer>, ${name}`,
    sizes[key],
    [
      `import Viewer from "@nulib/clover";`,
      template && `import { ${template} } from "@nulib/clover/templates";`,
      `import "@nulib/clover/styles.css";`,
      template && `import "@nulib/clover/templates.css";`,
      `export default () => <Viewer ${template ? `template={${template}} ` : ""}iiifContent="${url}" />;`,
    ]
      .filter(Boolean)
      .join("\n"),
    { template: true },
  ]),
  ...[
    ["Canvas", "canvasFirstViewGzip", IMAGE, "index"],
    ["Timeline", "timelineFirstViewGzip", AUDIO, "index"],
    ["Scene", "sceneFirstViewGzip", MODEL, "index"],
    ["Map", "mapFirstViewGzip", PLACE, "map"],
  ].map(([part, key, url, entry]) => [
    `<${part}> alone`,
    sizes[key],
    [
      `import { ${part} } from "@nulib/clover${entry === "map" ? "/map" : ""}";`,
      `import "@nulib/clover/styles.css";`,
      `export default () => <div style={{ height: 600 }}><${part} iiifContent="${url}" style={{ height: "100%" }} /></div>;`,
    ].join("\n"),
    { template: false },
  ]),
];

/** Web component pages, as a CDN serves `dist/web-components/`: `[figure, value, entry, markup, counts]`. */
const ELEMENTS = [
  [
    "<clover-viewer>, its own entry",
    sizes.viewerEntryGzip,
    "viewer/index.mjs",
    `<clover-viewer iiif-content="${IMAGE}"></clover-viewer>`,
    { template: true },
  ],
  [
    "<clover-viewer>",
    sizes.webComponentsGzip,
    "index.mjs",
    `<clover-viewer iiif-content="${IMAGE}"></clover-viewer>`,
    { template: true },
  ],
  [
    "<clover-viewer> in Document",
    sizes.documentElementGzip,
    "index.mjs",
    `<clover-viewer template="document" iiif-content="${IMAGE}"></clover-viewer>`,
    { template: true },
  ],
  [
    "<clover-root> and <clover-label>",
    sizes.labelPageGzip,
    "index.mjs",
    `<clover-root iiif-content="${IMAGE}"><clover-label></clover-label></clover-root>`,
    { template: false },
  ],
  ...[
    ["Canvas", IMAGE],
    ["Timeline", AUDIO],
    ["Scene", MODEL],
    ["Map", PLACE],
  ].map(([part, url]) => [
    `<clover-${part.toLowerCase()}> alone`,
    sizes.elementPartsAlone[part],
    "index.mjs",
    boxed(
      `<clover-${part.toLowerCase()} iiif-content="${url}" style="display: block; height: 100%"></clover-${part.toLowerCase()}>`,
    ),
    { template: false },
  ]),
];

/** Never counted: engines others make, loaded on demand; a part's, the upgrader too. */
const THEIRS = /^(maplibre-gl|maplibre-gl-worker|worker|hls)-/;
const UPGRADER = /^(upgrader|keep-fragments)-/;
// What `sizes.mjs` measures as `gzipSync(…, { level: 9 })`.
const gzip = (code) => gzipSync(code, { level: 9 }).length;
// Gzip does not add up file by file: a few hundred bytes either way are its rounding.
const SLACK = 300;

let serving = { dir: app, page: "" };
const TYPES = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".html": "text/html",
};
const server = createServer((request, response) => {
  const path = decodeURIComponent(request.url.split("?")[0]);
  if (path === "/image.json") {
    response.writeHead(200, {
      "content-type": TYPES[".json"],
      "access-control-allow-origin": "*",
    });
    return response.end(JSON.stringify(image));
  }
  if (path === "/" && serving.page) {
    response.writeHead(200, { "content-type": TYPES[".html"] });
    return response.end(serving.page);
  }
  const file = path.startsWith("/wc/")
    ? join(elements, path.slice("/wc/".length))
    : join(serving.dir, path === "/" ? "index.html" : path);
  if (!existsSync(file)) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
  });
  response.end(readFileSync(file));
}).listen(PORT);

const browser = await chromium
  .launch({ channel: "chrome" })
  .catch(() => chromium.launch());

/** Opens the page until it draws, and resolves to the files of ours it fetched. */
async function fetched(prefix) {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();
  const files = new Set();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfinished", (request) => {
    const url = new URL(request.url());
    if (url.origin === HERE && url.pathname.startsWith(prefix))
      files.add(url.pathname.slice(prefix.length));
  });
  await page.goto(HERE);
  // Long enough for the resource, its renderer and what it draws with.
  await page.waitForTimeout(10_000);
  await context.close();
  if (errors.length) throw new Error(errors.join("\n"));
  return files;
}

const failures = [];
const report = (name, stated, counted, files, css = 0) => {
  const kB = (bytes) => (bytes / 1000).toFixed(1);
  const off = counted - stated;
  console.log(
    `${name.padEnd(36)} stated ${kB(stated).padStart(6)} kB, fetched ${kB(counted).padStart(6)} kB${css ? ` (CSS ${kB(css)})` : ""}`,
  );
  if (Math.abs(off) > SLACK)
    failures.push(
      `${name}: sizes.json says ${stated} B, a browser fetched ${counted} B (${off > 0 ? "+" : ""}${off}). ` +
        `Fetched: ${files.join(", ")}. Update what it says the first view loads in build/sizes.mjs ` +
        `(FIRST_VIEW, UPGRADER) or build/element-size.mjs (UPGRADER, the pages' module keys).`,
    );
};

/** Builds the app around `App.jsx` as a production app builds, into `dist/`. */
async function buildApp(code) {
  writeFileSync(join(app, "App.jsx"), code);
  const outDir = join(app, "dist");
  await build({
    configFile: false,
    root: app,
    logLevel: "error",
    esbuild: { jsx: "automatic" },
    build: {
      outDir,
      emptyOutDir: true,
      // As `consumer-bundle.mjs` builds: no polyfill, which is not Clover's.
      modulePreload: { polyfill: false },
      chunkSizeWarningLimit: Infinity,
      rollupOptions: {
        onwarn() {},
        // React in a chunk of its own, never counted.
        output: {
          manualChunks: (id) =>
            /node_modules\/(react|react-dom|scheduler)\//.test(id)
              ? "react"
              : undefined,
        },
      },
    },
  });
  return outDir;
}

try {
  mkdirSync(app, { recursive: true });
  writeFileSync(
    join(app, "index.html"),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>First view</title></head><body><div id="app"></div><script type="module" src="./main.jsx"></script></body></html>`,
  );
  writeFileSync(
    join(app, "main.jsx"),
    `import { createRoot } from "react-dom/client";\nimport App from "./App.jsx";\ncreateRoot(document.getElementById("app")).render(<App />);\n`,
  );
  /*
   * What an app with no Clover in it loads besides React (its `createRoot`, its imports),
   * taken off each page: the app's own code, never Clover's.
   */
  const bare = await buildApp("export default () => <div />;");
  const own = readdirSync(join(bare, "assets"))
    .filter((file) => file.endsWith(".js") && !file.startsWith("react-"))
    .reduce(
      (sum, file) => sum + gzip(readFileSync(join(bare, "assets", file))),
      0,
    );
  for (const [name, stated, code, { template }] of REACT) {
    const outDir = await buildApp(code);
    // Its entry counts: what a page imports statically of Clover's is bundled into it.
    serving = { dir: outDir, page: "" };
    const files = [...(await fetched("/"))].filter(
      (file) => /\.(js|css)$/.test(file) && !/^assets\/react-/.test(file),
    );
    const counted = files.filter((file) => {
      const base = file.split("/").pop();
      if (THEIRS.test(base) || (!template && UPGRADER.test(base))) return false;
      // A part's React figure is its script; `styles.css` is every part's at once.
      return template || !file.endsWith(".css");
    });
    const css = counted.filter((file) => file.endsWith(".css"));
    const js = counted.filter((file) => !file.endsWith(".css"));
    const styles = css.length
      ? gzip(
          css
            .map((file) => readFileSync(join(outDir, file), "utf8"))
            .join("\n"),
        )
      : 0;
    const size =
      js.reduce(
        (sum, file) => sum + gzip(readFileSync(join(outDir, file))),
        0,
      ) +
      styles -
      own;
    report(name, stated, size, counted, styles);
  }
  for (const [name, stated, entry, markup, { template }] of ELEMENTS) {
    serving = {
      dir: app,
      page: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>First view</title><script type="module" src="/wc/${entry}"></script></head><body>${markup}</body></html>`,
    };
    const files = [...(await fetched("/wc/"))].filter((file) =>
      /\.(m?js|css)$/.test(file),
    );
    const counted = files.filter((file) => {
      const base = file.split("/").pop();
      return !THEIRS.test(base) && (template || !UPGRADER.test(base));
    });
    report(
      name,
      stated,
      counted.reduce(
        (sum, file) => sum + gzip(readFileSync(join(elements, file))),
        0,
      ),
      counted,
    );
  }
} finally {
  await browser.close();
  server.close();
  rmSync(app, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n${failures.join("\n\n")}`);
  process.exit(1);
}
