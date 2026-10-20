import type { NextApiRequest, NextApiResponse } from "next";

import {
  captions,
  manifest,
  transcript,
} from "docs/mocks/rudolf-hess-nuremberg/index.mjs";

/** The files the Manifest names, by path. */
const FILES: Record<string, { format: string; text: () => string }> = {
  "captions.vtt": { format: "text/vtt", text: captions },
  "transcript.txt": { format: "text/plain", text: transcript },
};

/**
 * The rudolf-hess-nuremberg mock, live, in `npm run dev`: its Manifest, its captions and
 * its transcript, with ids under this server
 * (http://localhost:3000/api/mocks/rudolf-hess-nuremberg/…), so the files it names are
 * ones this server answers. The published copy is static
 * (`public/mocks/rudolf-hess-nuremberg/`); both come from
 * `docs/mocks/rudolf-hess-nuremberg`. See /docs/mocks.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const host = req.headers.host ?? "localhost:3000";
  const protocol = req.headers["x-forwarded-proto"] ?? "http";
  const base = `${protocol}://${host}/api/mocks/rudolf-hess-nuremberg`;
  const segments = req.query.path;
  const path = Array.isArray(segments) ? segments.join("/") : String(segments);
  // Other viewers on other ports test against it too.
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (path === "manifest.json") return res.status(200).json(manifest(base));
  const file = FILES[path];
  if (!file) return res.status(404).json({ error: `No mock at ${path}` });
  res.setHeader("Content-Type", `${file.format}; charset=utf-8`);
  return res.status(200).send(`${file.text()}\n`);
}
