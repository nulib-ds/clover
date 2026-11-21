import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SpeakerGlyph } from "./Speaker";

describe("SpeakerGlyph", () => {
  // Items draws its own copy (`Items/Item.tsx`), as the two seldom share a page; one
  // drawing for sound all the same.
  it("is the speaker Items draws for sound with nothing to picture", () => {
    const glyph = renderToStaticMarkup(<SpeakerGlyph />);
    const item = readFileSync(
      resolve(__dirname, "../../components/Items/Item.tsx"),
      "utf8",
    );
    const paths = [...glyph.matchAll(/ d="([^"]+)"/g)].map((match) => match[1]);
    expect(paths).toHaveLength(2);
    for (const d of paths) expect(item).toContain(`d="${d}"`);
    expect(glyph).toContain('stroke-width="40"');
    expect(item).toContain('strokeWidth="40"');
  });
});
