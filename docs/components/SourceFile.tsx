import { readFile } from "node:fs/promises";
import path from "node:path";
import { compileMdx } from "nextra/compile";
import { evaluate } from "nextra/evaluate";

import { useMDXComponents as mdxComponents } from "../../mdx-components";

/** The package's source, which the pages quote. */
const SOURCE = path.join(process.cwd(), "packages/clover/src");

/**
 * A file of `@nulib/clover`'s source, or a stretch of it, read as the page is built and
 * highlighted as every code block on the site is (`next.config.mjs`'s themes), so what a
 * page quotes is always the code itself (the Default template's page; Mat, 2026-10-21).
 *
 * A stretch runs from the first line holding `from` to the first after it holding `to`
 * (or, with `toLine`, the first that is exactly that, its indent aside: a bare `)}`; with
 * `nth`, the nth such line), its common indent taken off. A quote that no longer matches fails the build rather than
 * showing stale code.
 *
 * ```mdx
 * <SourceFile file="templates/default/Default.tsx" from="<Clover.Split" to="</Clover.Split>" />
 * ```
 */
export async function SourceFile({
  file,
  from,
  to,
  toLine,
  nth = 1,
}: {
  /** Under `packages/clover/src/`. */
  file: string;
  from?: string;
  to?: string;
  toLine?: string;
  nth?: number;
}) {
  const text = await readFile(path.join(SOURCE, file), "utf8");
  let lines = text.replace(/\n+$/, "").split("\n");
  if (from) {
    const start = lines.findIndex((line) => line.includes(from));
    if (start < 0) throw new Error(`SourceFile: "${from}" is not in ${file}`);
    const ends = (line: string) =>
      toLine !== undefined ? line.trim() === toLine : line.includes(to ?? "");
    let end = start;
    if (to !== undefined || toLine !== undefined) {
      let seen = 0;
      end = lines.findIndex(
        (line, index) => index > start && ends(line) && ++seen === nth,
      );
    }
    if (end < 0)
      throw new Error(
        `SourceFile: "${toLine ?? to}" is not after "${from}" in ${file}`,
      );
    lines = lines.slice(start, end + 1);
  }
  const indent = Math.min(
    ...lines
      .filter((line) => line.trim())
      .map((line) => line.length - line.trimStart().length),
  );
  const code = lines.map((line) => line.slice(indent)).join("\n");
  const language = path.extname(file).slice(1);
  // A fence longer than any run of backticks in the code.
  const fence = "`".repeat(
    Math.max(3, ...(code.match(/`+/g) ?? []).map((run) => run.length + 1)),
  );
  const compiled = await compileMdx(
    `${fence}${language} filename="${path.basename(file)}"\n${code}\n${fence}`,
    {
      mdxOptions: {
        rehypePrettyCodeOptions: {
          theme: { light: "github-light-default", dark: "github-dark-default" },
        },
      },
    },
  );
  // Evaluated with the site's MDX components, as its pages are (`nextra/mdx-remote`
  // reaches them through an alias Turbopack does not resolve outside a page).
  const { default: Content } = evaluate(compiled, mdxComponents());
  return <Content />;
}
