import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/*
 * Clover gives no color token (`--clover-color-*`) a value of its own: a page sets it, and
 * every read falls back to a literal (AGENTS.md). Each token falls back to one literal
 * everywhere, the default Styling's Variables gives, so no fill drifts to a gray of its
 * own: three reads of `--clover-color-secondary-muted` fell back to #f1f1f1, the rest to
 * #e6e8eb, until 2026-11-07. Stylesheets, scripts that read a token (the Map's colors) and
 * their comments are all read.
 */
const SRC = resolve(__dirname, "..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(css|tsx?)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [path]
      : [];
  });
}

/** `#fff` and `#ffffff` alike. */
function hex(literal: string) {
  const value = literal.toLowerCase();
  return value.length === 4
    ? `#${[...value.slice(1)].map((digit) => digit + digit).join("")}`
    : value;
}

describe("color tokens", () => {
  it("each fall back to one literal everywhere", () => {
    const literals = new Map<string, Map<string, Set<string>>>();
    for (const file of sources(SRC))
      for (const [, token, literal] of readFileSync(file, "utf8").matchAll(
        // `var(--clover-color-accent, #0065c3)`, and `token("--clover-color-accent", "#0065c3")`.
        /(--clover-color-[a-z-]+)["']?,\s*["']?(#[0-9a-f]{3,8})\b/gi,
      )) {
        const of = literals.get(token) ?? new Map<string, Set<string>>();
        of.set(
          hex(literal),
          (of.get(hex(literal)) ?? new Set()).add(relative(SRC, file)),
        );
        literals.set(token, of);
      }

    expect(literals.size).toBeGreaterThan(0);
    const mixed = [...literals].flatMap(([token, of]) =>
      of.size > 1
        ? [
            `${token} falls back to ${[...of]
              .map(
                ([literal, files]) => `${literal} in ${[...files].join(", ")}`,
              )
              .join("; and to ")}`,
          ]
        : [],
    );
    expect(mixed).toEqual([]);
  });
});
