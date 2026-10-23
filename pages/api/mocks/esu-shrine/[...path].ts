import { createReadStream, statSync } from "node:fs";
import { join } from "node:path";
import type { NextApiRequest, NextApiResponse } from "next";

import { MODEL_FILE, manifest } from "docs/mocks/esu-shrine/index.mjs";

/** Its 34.5 MB model: Next's warning past 4 MB is for pages, not this. */
export const config = { api: { responseLimit: false } };

/** The model's copy, as `npm run build:mocks` keeps it. */
const MODEL = join(process.cwd(), "public/mocks/esu-shrine", MODEL_FILE);

/**
 * The esu-shrine mock, live, in `npm run dev`: its Manifest, with ids under this server
 * (http://localhost:3000/api/mocks/esu-shrine/…), and its model, the copy in
 * `public/mocks/esu-shrine/`, so both answer before they are deployed. The published copy
 * is static; both come from `docs/mocks/esu-shrine`. See /docs/mocks.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const host = req.headers.host ?? "localhost:3000";
  const protocol = req.headers["x-forwarded-proto"] ?? "http";
  const base = `${protocol}://${host}/api/mocks/esu-shrine`;
  const segments = req.query.path;
  const path = Array.isArray(segments) ? segments.join("/") : String(segments);
  // Other viewers on other ports test against it too.
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (path === "manifest.json") return res.status(200).json(manifest(base));
  if (path !== MODEL_FILE)
    return res.status(404).json({ error: `No mock at ${path}` });
  let file: { size: number; mtime: Date };
  try {
    file = statSync(MODEL);
  } catch {
    return res
      .status(404)
      .json({ error: "No model yet: run `npm run build:mocks`." });
  }
  res.setHeader("Content-Type", "model/gltf-binary");
  res.setHeader("Content-Length", String(file.size));
  res.setHeader("Last-Modified", file.mtime.toUTCString());
  createReadStream(MODEL).pipe(res);
}
