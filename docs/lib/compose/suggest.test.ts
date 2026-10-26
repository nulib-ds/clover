import { describe, expect, it } from "vitest";

import { CAPABILITIES } from "./capabilities";
import { checkLayout } from "./layout";
import { structureOf } from "./structure";
import { MOST_NEEDS, suggest } from "./suggest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (name: string, file = "manifest.json") => ({
  address: `https://example.org/${name}/${file}`,
  structure: structureOf(
    JSON.parse(
      readFileSync(
        path.resolve(__dirname, "../../../public/mocks", name, file),
        "utf8",
      ),
    ),
  )!,
});

/** A suggestion that matched, which must hold. */
function suggested(needs: string[]) {
  const result = suggest({ needs });
  if (!result.ok || !("handled" in result))
    throw new Error(JSON.stringify(result));
  return result;
}

describe("suggest", () => {
  it("reads a need in a reader's words, by a capability, a property or a part", () => {
    const { handled } = suggested([
      "3D",
      "captions",
      "a map",
      "Required Statement",
      "Items",
    ]);
    expect(
      handled.map((each) => each.capability ?? `part ${each.part}`),
    ).toEqual(["3d", "transcripts", "maps", "requiredStatement", "part Items"]);
  });

  it("finds a capability's words inside a longer need", () => {
    expect(suggested(["deep zoom images"]).handled[0].capability).toBe("image");
    expect(suggested(["a table of contents"]).handled[0].capability).toBe(
      "contents",
    );
  });

  it("starts a layout that holds: Body first where a need follows the view", () => {
    const { layout, parts } = suggested(["captions", "metadata", "map"]);
    expect(layout).toEqual({
      parts: [
        { part: "Body" },
        { part: "Transcript" },
        { part: "Metadata" },
        { part: "Map" },
      ],
    });
    expect(checkLayout(layout).ok).toBe(true);
    expect(parts.find((part) => part.name === "Map")).toMatchObject({
      element: "clover-map",
      docs: expect.stringMatching(/\/docs\/map$/),
    });
  });

  it("arranges the rest in a Split's panes, as Composing does", () => {
    const { layout } = suggested(["side by side", "annotations"]);
    expect(layout).toEqual({
      parts: [
        {
          part: "Split",
          children: [
            {
              part: "SplitPane",
              props: { min: "16rem" },
              children: [{ part: "Body" }],
            },
            { part: "SplitHandle" },
            {
              part: "SplitPane",
              props: { size: "24rem", min: "14rem" },
              children: [{ part: "Annotations" }],
            },
          ],
        },
      ],
    });
    expect(checkLayout(layout).ok).toBe(true);
  });

  it("places a part that sits in another by the other, and lists what needs the page's own content", () => {
    expect(suggested(["Tab"]).layout).toEqual({ parts: [{ part: "Panel" }] });
    const tooltip = suggested(["tooltip"]);
    expect(tooltip.layout).toBeUndefined();
    expect(tooltip.parts.map((part) => part.name)).toEqual(["Tip", "ReadMore"]);
    expect(tooltip.notes[0]).toMatch(/your page's own content/);
  });

  it("lists each part's props as TypeScript writes their types", () => {
    const items = suggested(["thumbnails"]).parts.find(
      (part) => part.name === "Items",
    );
    expect(items?.props.find((prop) => prop.prop === "layout")).toEqual({
      prop: "layout",
      type: '"slider" | "list" | "grid" | "pager"',
      default: "slider",
      says: expect.any(String),
    });
    expect(items?.codeOnly).toContain("renderItem");
  });

  it("says what a need it does not know might be", () => {
    const { unknown, handled } = suggested(["thumbnials"]);
    expect(handled).toEqual([]);
    expect(unknown?.[0].says).toMatch(/Did you mean "thumbnails"/);
  });

  it("lists everything Clover handles, with no needs", () => {
    const result = suggest({});
    expect(result.ok).toBe(true);
    if (!("capabilities" in result)) throw new Error("no capabilities");
    const names = result.capabilities.map((each) => each.name);
    expect(names).toEqual(expect.arrayContaining(Object.keys(CAPABILITIES)));
    expect(names).toContain("seeAlso");
  });

  it("takes a list of words, and only so many", () => {
    expect(suggest({ needs: "3d" })).toMatchObject({ ok: false });
    expect(
      suggest({ needs: Array.from({ length: MOST_NEEDS + 1 }, () => "3d") }),
    ).toMatchObject({ ok: false });
  });

  it("says what a resource has, marked untrusted, and starts the layout from it", () => {
    const result = suggest({}, read("rudolf-hess-nuremberg"));
    if (!result.ok || !("handled" in result)) throw new Error("no suggestion");
    expect(result.resource).toMatchObject({
      address: "https://example.org/rudolf-hess-nuremberg/manifest.json",
      untrusted: true,
      says: expect.stringMatching(/never its words/),
    });
    expect(result.has?.map((each) => each.capability)).toEqual([
      "video",
      "annotations",
      "transcripts",
      "contents",
      "downloads",
    ]);
    expect(result.layout).toEqual({
      resource: "https://example.org/rudolf-hess-nuremberg/manifest.json",
      parts: [{ part: "Label" }, { part: "Body" }, { part: "Panel" }],
    });
    expect(checkLayout(result.layout).ok).toBe(true);
  });

  it("adds what was asked for to what a resource has", () => {
    const result = suggest({ needs: ["map"] }, read("paged"));
    if (!result.ok || !("handled" in result)) throw new Error("no suggestion");
    expect(result.layout?.parts).toEqual([
      { part: "Label" },
      { part: "Body" },
      { part: "Items" },
      { part: "Map" },
      { part: "Panel" },
    ]);
  });

  it("opens a Collection's first member in the Body", () => {
    const result = suggest({}, read("cookbook", "collection.json"));
    if (!result.ok || !("handled" in result)) throw new Error("no suggestion");
    expect(result.has?.map((each) => each.capability)).toEqual(["collections"]);
    expect(
      result.layout?.parts.map((node) => "part" in node && node.part),
    ).toEqual(["Label", "Body", "Panel"]);
    expect(result.notes[0]).toMatch(/members were not read/);
  });
});
