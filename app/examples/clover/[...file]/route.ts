import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/*
 * The package's build, as a page outside the docs loads it: the elements and the
 * stylesheets in tiers, for an example that needs a page of its own, with none of the
 * docs' styles (the Styling page's, `StylesheetExample`, and the Colors page's). Files of the
 * static export, read from the package's build as `custom-elements.json` is (the docs'
 * build runs the package's first), every file of the elements', as their module loads
 * its chunks as it needs them.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

const DIST = path.join(process.cwd(), "packages/clover/dist");

const TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
};

/** Every file under `segments`, as path segments from the build, but its chunk maps (`.vite`). */
async function filesIn(...segments: string[]): Promise<string[][]> {
  const entries = await readdir(path.join(DIST, ...segments), {
    withFileTypes: true,
  });
  const found = await Promise.all(
    entries.map(async (entry) =>
      entry.isDirectory()
        ? entry.name === ".vite"
          ? []
          : filesIn(...segments, entry.name)
        : [[...segments, entry.name]],
    ),
  );
  return found.flat();
}

export async function generateStaticParams() {
  return [
    ["base.css"],
    ["spacing.css"],
    ...(await filesIn("web-components")),
  ].map((file) => ({ file }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string[] }> },
) {
  const { file } = await params;
  const target = path.join(DIST, ...file);
  if (!target.startsWith(DIST + path.sep))
    return new Response("Not found", { status: 404 });
  try {
    return new Response(new Uint8Array(await readFile(target)), {
      headers: {
        "Content-Type":
          TYPES[path.extname(target)] ?? "application/octet-stream",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
