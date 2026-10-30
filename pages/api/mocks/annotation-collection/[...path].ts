import type { NextApiRequest, NextApiResponse } from "next";

import { respond } from "docs/mocks/annotation-collection/index.mjs";

/**
 * The catalog's lines as one AnnotationCollection, live, in `npm run dev`: its Manifest,
 * the Collection and each page of lines, with ids under this server
 * (http://localhost:3000/api/mocks/annotation-collection/…). The published copy is static
 * (`public/mocks/annotation-collection/`); both come from
 * `docs/mocks/annotation-collection`. See /docs/mocks.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const host = req.headers.host ?? "localhost:3000";
  const protocol = req.headers["x-forwarded-proto"] ?? "http";
  const base = `${protocol}://${host}/api/mocks/annotation-collection`;
  const segments = req.query.path;
  const path = Array.isArray(segments) ? segments.join("/") : String(segments);
  const body = respond(base, path);
  // Other viewers on other ports test against it too.
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!body) return res.status(404).json({ error: `No mock at ${path}` });
  return res.status(200).json(body);
}
