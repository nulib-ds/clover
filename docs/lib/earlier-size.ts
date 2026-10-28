import { readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { kB } from "docs/lib/sizes";

/*
 * What Clover 3.x's web component loads up front, measured from the release the 3.x pages
 * pin (`@samvera/clover-iiif`): its module and what it imports statically, gzipped one by
 * one, as the package's build measures Clover 4's pages (`build/element-size.mjs`). Read
 * on the server as the docs build, so Get started compares with the code, never a figure
 * written down. Not for a page's script: it reads files.
 */
const DIR = path.join(
  process.cwd(),
  "node_modules/@samvera/clover-iiif/dist/web-components",
);

const IMPORT =
  /(?:^|[;\s}])import\s*(?:[\w*{}\s,$]+from\s*)?["'](\.\/[^"']+)["']/g;

function measure() {
  const seen = new Set<string>();
  let bytes = 0;
  const visit = (name: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    const source = readFileSync(path.join(DIR, name), "utf8");
    bytes += gzipSync(source, { level: 9 }).length;
    for (const match of source.matchAll(IMPORT)) visit(match[1].slice(2));
  };
  visit("index.mjs");
  return kB(bytes);
}

/** 3.x's element, up front, in kB gzipped, rounded as `kB` rounds Clover 4's. */
export const earlierElement = measure();
