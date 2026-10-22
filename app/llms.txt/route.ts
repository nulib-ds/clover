import { llmsTxt } from "docs/lib/agents";

/*
 * `llms.txt` (llmstxt.org), for agents: what Clover is, at a glance, and the docs as their
 * menu lists them, built with the site from its menu, its pages' descriptions and its
 * figures (`docs/lib/agents.ts`), so it never drifts. A file in the static export.
 */
export const dynamic = "force-static";

export async function GET() {
  return new Response(await llmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
