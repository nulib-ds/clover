import type { NextApiRequest, NextApiResponse } from "next";

import { captions, manifest } from "docs/mocks/hindenburg/index.mjs";

/** The files the Manifest names, by path. */
const FILES: Record<string, { format: string; text: () => string }> = {
  "captions.vtt": { format: "text/vtt", text: captions },
};

/**
 * The hindenburg mock, live, in `npm run dev`: its Manifest and its captions, with ids
 * under this server (http://localhost:3000/api/mocks/hindenburg/…), so the files it names
 * are ones this server answers. The published copy is static (`public/mocks/hindenburg/`);
 * both come from `docs/mocks/hindenburg`. See /docs/mocks.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const host = req.headers.host ?? "localhost:3000";
  const protocol = req.headers["x-forwarded-proto"] ?? "http";
  const base = `${protocol}://${host}/api/mocks/hindenburg`;
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
