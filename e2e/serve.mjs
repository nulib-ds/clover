/**
 * The built docs (`out/`, `npm run build:docs`), served as CloudFront serves them, for
 * the e2e suite against a build: a page by its address with or without `.html`, a
 * folder's `index.html`, `404.html` for what is missing. The site is built for its base
 * path, none by default, and a base path is taken off here too, so with one the suite's
 * addresses (`/docs/…`) and the pages' own (`/clover/docs/…`) both answer.
 *
 *   node e2e/serve.mjs [port]
 *   DOCS_URL=http://localhost:4400 npm run e2e:docs
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../out/", import.meta.url));
const port = Number(process.argv[2] ?? 4400);
const BASE = process.env.DOCS_BASE_PATH ?? "";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".vtt": "text/vtt; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
};

/** A file under `out/`, if it is one. */
async function file(at) {
  const full = path.join(root, at);
  if (!full.startsWith(root)) return undefined;
  try {
    return (await stat(full)).isFile() ? full : undefined;
  } catch {
    return undefined;
  }
}

createServer(async (request, response) => {
  let pathname = decodeURIComponent(new URL(request.url, "http://x").pathname);
  if (BASE && (pathname === BASE || pathname.startsWith(`${BASE}/`)))
    pathname = pathname.slice(BASE.length) || "/";
  const found =
    (await file(pathname)) ??
    (await file(`${pathname}.html`)) ??
    (await file(path.join(pathname, "index.html")));
  const shown = found ?? (await file("404.html"));
  response.writeHead(found ? 200 : 404, {
    "Content-Type":
      TYPES[path.extname(shown ?? "")] ?? "application/octet-stream",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(shown ? await readFile(shown) : "Not found");
}).listen(port, () => console.log(`out/ at http://localhost:${port}`));
