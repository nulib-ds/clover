import type { NextApiRequest, NextApiResponse } from "next";

import { manifest, pageText } from "docs/mocks/page-transcript/index.mjs";

/**
 * The page transcript mock, live, in `npm run dev`: its Manifest and each page's text,
 * with ids under this server (http://localhost:3000/api/mocks/page-transcript/…), so the
 * text files it names are ones this server answers. The published copy is static
 * (`public/mocks/page-transcript/`); both come from `docs/mocks/page-transcript`. See
 * /docs/mocks.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const host = req.headers.host ?? "localhost:3000";
  const protocol = req.headers["x-forwarded-proto"] ?? "http";
  const base = `${protocol}://${host}/api/mocks/page-transcript`;
  const segments = req.query.path;
  const path = Array.isArray(segments) ? segments.join("/") : String(segments);
  // Other viewers on other ports test against it too.
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (path === "manifest.json") return res.status(200).json(manifest(base));
  const page = /^text\/p(\d+)\.txt$/.exec(path);
  const text = page && pageText(Number(page[1]));
  if (!text) return res.status(404).json({ error: `No mock at ${path}` });
  // As a library serves a page's OCR text: plain, in UTF-8.
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.status(200).send(text);
}
