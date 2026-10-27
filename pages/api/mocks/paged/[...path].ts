import type { NextApiRequest, NextApiResponse } from "next";

import { respond } from "docs/mocks/paged/index.mjs";

/**
 * The bicycle catalog mock, live, in `npm run dev`: its Manifest, each page's OCR and its
 * Content Search 2.0 service, any query and any page, with ids under this server
 * (http://localhost:3000/api/mocks/paged/…). The published copy is static
 * (`public/mocks/paged/`); both come from `docs/mocks/paged`. See /docs/mocks.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const host = req.headers.host ?? "localhost:3000";
  const protocol = req.headers["x-forwarded-proto"] ?? "http";
  const base = `${protocol}://${host}/api/mocks/paged`;
  const url = new URL(req.url ?? "", base);
  const segments = req.query.path;
  const path = Array.isArray(segments) ? segments.join("/") : String(segments);
  const body = respond(base, path, url.searchParams);
  // Other viewers on other ports test against it too.
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!body) return res.status(404).json({ error: `No mock at ${path}` });
  return res.status(200).json(body);
}
