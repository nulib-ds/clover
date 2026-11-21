import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = resolve(__dirname, "../..");

/** Every file of the package that `keep` takes, the tests left out. */
function files(dir: string, keep: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path, keep);
    return keep.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}
const modules = (dir: string) => files(dir, /\.tsx?$/);

describe("--clover-glyph-weight", () => {
  // A glyph writes its weight as its stroke's width, which `styles/scale.css` multiplies,
  // one rule a weight: a weight with none would never take the page's setting. A weight
  // one glyph alone draws has its rule in that glyph's sheet (the languages glyph's
  // outline, `ui/Codes.css`).
  it("scales every weight Clover's glyphs draw with", () => {
    const scaled = new Set(
      files(src, /\.css$/).flatMap((file) =>
        [
          ...readFileSync(file, "utf8").matchAll(/\[stroke-width="(\d+)"\]/g),
        ].map((match) => match[1]),
      ),
    );
    const drawn = new Map<string, string>();
    for (const file of modules(src)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(
        /strokeWidth(?:=\{?"?|:\s*|\s*=\s*)(\d+)/g,
      ))
        drawn.set(match[1], file.slice(src.length + 1));
    }
    expect(drawn.size).toBeGreaterThan(3);
    for (const [weight, file] of drawn)
      expect(
        scaled,
        `${file} draws a stroke ${weight} wide: give it a rule in styles/scale.css, or in its own sheet`,
      ).toContain(weight);
  });
});
