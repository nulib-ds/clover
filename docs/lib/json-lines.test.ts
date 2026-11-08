import { describe, expect, it } from "vitest";

import { jsonLines, markedRuns } from "docs/lib/json-lines";
import type { Line } from "docs/lib/live-code";

const text = (lines: Line[]) =>
  lines
    .map(
      (line) =>
        "  ".repeat(line.depth) +
        line.tokens.map((token) => token.text).join(""),
    )
    .join("\n");

const canvas = {
  id: "https://example.org/canvas/1",
  type: "Canvas",
  width: 4755,
  height: 2391,
  items: [
    {
      id: "https://example.org/canvas/1/page",
      type: "AnnotationPage",
      items: [
        {
          id: "https://example.org/canvas/1/page/1",
          type: "Annotation",
          motivation: "painting",
          body: { id: "https://example.org/image.jpg", type: "Image" },
          target: "https://example.org/canvas/1",
        },
      ],
    },
  ],
  annotations: [],
  behavior: ["paged"],
  extra: { on: true, none: null },
};

describe("jsonLines", () => {
  it("writes what JSON.stringify writes, two spaces a level", () => {
    expect(text(jsonLines(canvas))).toBe(JSON.stringify(canvas, null, 2));
  });

  it("marks every line of an Annotation, its braces too, and nothing else", () => {
    const lines = jsonLines(canvas);
    const marked = lines.filter((line) => line.mark);
    expect(marked[0].tokens.map((token) => token.text).join("")).toBe("{");
    // The marked lines, taken back to their own depth, are the Annotation as JSON.
    const base = marked[0].depth;
    expect(
      text(marked.map((line) => ({ ...line, depth: line.depth - base }))),
    ).toBe(JSON.stringify(canvas.items[0].items[0], null, 2));
    expect(markedRuns(lines)).toHaveLength(1);
  });

  it("colors keys, strings, numbers and literals by kind", () => {
    const [, id] = jsonLines({ id: "a", n: 1, t: true });
    expect(id.tokens.map((token) => token.kind)).toEqual([
      "property",
      "punctuation",
      "string",
      "punctuation",
    ]);
    const kinds = jsonLines({ n: 1, t: true }).flatMap((line) =>
      line.tokens.map((token) => token.kind),
    );
    expect(kinds).toContain("number");
    expect(kinds).toContain("keyword");
  });
});

describe("markedRuns", () => {
  it("numbers each run of marked lines from 1", () => {
    const lines = jsonLines({
      items: [
        { type: "Annotation", id: "a" },
        { type: "Canvas" },
        { type: "Annotation", id: "b" },
      ],
    });
    expect(markedRuns(lines)).toEqual([
      [3, 6],
      [10, 13],
    ]);
  });
});
