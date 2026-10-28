import { readFile } from "node:fs/promises";
import path from "node:path";

/*
 * The elements' Custom Elements Manifest, published with the site for agents and tools
 * (`packages/clover/AGENTS.md`, "One table per element"): each element's attributes,
 * properties, events and slots, as the package's build writes it from the elements' specs
 * (`npm run build`, which the docs' build runs first). A file in the static export.
 */
export const dynamic = "force-static";

export async function GET() {
  const manifest = await readFile(
    path.join(
      process.cwd(),
      "packages/clover/dist/web-components/custom-elements.json",
    ),
    "utf8",
  );
  return new Response(manifest, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
