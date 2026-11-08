import type { Line, Token } from "docs/lib/live-code";

/**
 * JSON as the docs' code blocks draw it (`Line`, `docs/lib/live-code.ts`): a line a
 * member or value, pretty-printed as `JSON.stringify(value, null, 2)` writes it, each run
 * of text colored by its kind, and every line of an Annotation (an object whose `type` is
 * `Annotation`, its braces too) marked, as a fence's `{3}` marks what it is about.
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const isAnnotation = (value: Json): boolean =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  value.type === "Annotation";

const scalar = (value: Json): Token => {
  if (typeof value === "string")
    return { text: JSON.stringify(value), kind: "string" };
  if (typeof value === "number") return { text: String(value), kind: "number" };
  return { text: String(value), kind: "keyword" };
};

const punctuation = (text: string): Token => ({ text, kind: "punctuation" });

export function jsonLines(value: unknown): Line[] {
  const lines: Line[] = [];
  /** Writes `value` from a line that already holds `lead` (its key, say), at `depth`. */
  const write = (
    node: Json,
    depth: number,
    lead: Token[],
    tail: string,
    marked: boolean,
  ) => {
    const mark = marked || isAnnotation(node);
    const end = tail ? [punctuation(tail)] : [];
    if (node === null || typeof node !== "object") {
      lines.push({ depth, mark, tokens: [...lead, scalar(node), ...end] });
      return;
    }
    const entries: [string | null, Json][] = Array.isArray(node)
      ? node.map((each) => [null, each])
      : Object.entries(node);
    const [open, close] = Array.isArray(node) ? ["[", "]"] : ["{", "}"];
    if (entries.length === 0) {
      lines.push({
        depth,
        mark,
        tokens: [...lead, punctuation(`${open}${close}`), ...end],
      });
      return;
    }
    lines.push({ depth, mark, tokens: [...lead, punctuation(open)] });
    entries.forEach(([key, child], index) => {
      const comma = index < entries.length - 1 ? "," : "";
      const keyTokens: Token[] =
        key === null
          ? []
          : [
              { text: JSON.stringify(key), kind: "property" },
              punctuation(": "),
            ];
      write(child, depth + 1, keyTokens, comma, mark);
    });
    lines.push({ depth, mark, tokens: [punctuation(close), ...end] });
  };
  write(value as Json, 0, [], "", false);
  return lines;
}

/** The marked lines' runs, numbered from 1: "23–48" for each Annotation. */
export function markedRuns(lines: Line[]): [number, number][] {
  const runs: [number, number][] = [];
  lines.forEach((line, index) => {
    if (!line.mark) return;
    const last = runs[runs.length - 1];
    if (last && last[1] === index) last[1] = index + 1;
    else runs.push([index + 1, index + 1]);
  });
  return runs;
}
