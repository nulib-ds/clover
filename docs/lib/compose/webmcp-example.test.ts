import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { compose } from "./write";

/*
 * WEBMCP.md shows a layout and the code `clover_compose_layout` writes for it ("A
 * layout, and its code"): written by hand, held here to what the engine writes, so the
 * plan never says otherwise.
 */
const plan = readFileSync(
  path.resolve(__dirname, "../../../WEBMCP.md"),
  "utf8",
);

const fence = (language: string) =>
  plan.match(new RegExp("```" + language + "\\n([\\s\\S]*?)\\n```"))?.[1];

describe("WEBMCP.md's example", () => {
  it("shows the code compose writes for its layout", () => {
    const layout = JSON.parse(fence("json")!);
    const composed = compose(layout);
    expect(composed.ok).toBe(true);
    expect(composed.ok && composed.code).toBe(fence("jsx"));
  });
});
