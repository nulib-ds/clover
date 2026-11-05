import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { folderKeys } from "./agents";

const DOCS = resolve(__dirname, "../../content/docs");

describe("the docs' folders", () => {
  // A folder with a menu of its own lists its pages after its index, in llms.txt and the
  // Markdown, only once `FOLDERS` names it. 3.x's is read on its own (`isEarlierVersion`).
  it("are each in FOLDERS, so llms.txt lists their pages", () => {
    const folders = readdirSync(DOCS, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name !== "deprecated-versions" &&
          existsSync(join(DOCS, entry.name, "_meta.ts")),
      )
      .map((entry) => entry.name);
    const listed = folderKeys();
    for (const folder of folders)
      expect(
        listed,
        `content/docs/${folder}/ has a menu: add it to FOLDERS in docs/lib/agents.ts`,
      ).toContain(folder);
  });
});
