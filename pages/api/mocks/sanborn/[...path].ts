import type { NextApiRequest, NextApiResponse } from "next";

import { respond } from "docs/mocks/sanborn/index.mjs";

/**
 * Sanborn's georeferenced maps, live, in `npm run dev`: the Annotation, the
 * AnnotationPage, the AnnotationCollection and its pages, with ids under this server
 * (http://localhost:3000/api/mocks/sanborn/…), so the Collection's pages load before they
 * are deployed. The published copy is static (`public/mocks/sanborn/`); both come from
 * `docs/mocks/sanborn`. See /docs/mocks.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const host = req.headers.host ?? "localhost:3000";
  const protocol = req.headers["x-forwarded-proto"] ?? "http";
  const base = `${protocol}://${host}/api/mocks/sanborn`;
  const segments = req.query.path;
  const path = Array.isArray(segments) ? segments.join("/") : String(segments);
  const body = respond(base, path);
  // Other viewers on other ports test against it too.
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!body) return res.status(404).json({ error: `No mock at ${path}` });
  return res.status(200).json(body);
}
