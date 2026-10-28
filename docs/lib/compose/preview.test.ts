import { describe, expect, it } from "vitest";

import { textOf, codeLines, publishedAddress } from "docs/lib/live-code";
import { RESOURCES } from "docs/lib/part-demo-resources";
import { pageSubject, planPreview } from "./preview";
import { compose } from "./write";

/** A preview that holds, on the page at `route`. */
function planned(input: unknown, route = "/docs/composing") {
  const result = planPreview(input, route);
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.plan;
}

const code = (plan: ReturnType<typeof planned>) =>
  textOf(codeLines(plan.tree, [], {}, "react"));

describe("pageSubject", () => {
  it("knows a part's own page, and the Viewer's", () => {
    expect(pageSubject("/docs/primitives/rights")).toBe("Rights");
    expect(pageSubject("/docs/panel")).toBe("Panel");
    expect(pageSubject("/docs/items")).toBe("Items");
    expect(pageSubject("/docs/viewer")).toBe("Viewer");
    expect(pageSubject("/docs/composing")).toBeUndefined();
  });
});

describe("planPreview", () => {
  it("shows a part's page's own part, given nothing, over its sample", () => {
    const plan = planned({}, "/docs/primitives/rights");
    expect(plan).toMatchObject({
      page: "Rights",
      sample: "paged",
      shows: "Rights",
      layout: { parts: [{ part: "Rights" }] },
    });
  });

  it("titles what it shows a level under the page's title, and says so", () => {
    const plan = planned({}, "/docs/annotations");
    expect(plan.layout).toEqual({
      parts: [
        { part: "Body" },
        { part: "Annotations", props: { headingLevel: 2 } },
      ],
    });
    expect(plan.sample).toBe("tagging");
    expect(plan.notes).toContain(
      "Gave Annotations headingLevel 2: the preview sits under the page's title.",
    );
  });

  it("titles what it shows a level under the heading its frame sits under", () => {
    const result = planPreview({}, "/docs/annotations", 3);
    if (!result.ok) throw new Error(result.says);
    expect(result.plan.layout).toEqual({
      parts: [
        { part: "Body" },
        { part: "Annotations", props: { headingLevel: 3 } },
      ],
    });
    expect(result.plan.notes).toContain(
      "Gave Annotations headingLevel 3: the preview sits under the level 2 heading before its frame.",
    );
    // The Viewer too, where its own 2 would not fit.
    const viewer = planPreview({}, "/docs/viewer", 4);
    if (!viewer.ok) throw new Error(viewer.says);
    expect(viewer.plan.layout).toMatchObject({
      viewer: { props: { headingLevel: 4 } },
    });
    const own = planPreview({}, "/docs/viewer");
    if (!own.ok) throw new Error(own.says);
    expect(own.plan.layout).toEqual({ viewer: {} });
  });

  it("shows the Viewer on the Viewer's page", () => {
    expect(planned({}, "/docs/viewer")).toMatchObject({
      page: "Viewer",
      layout: { viewer: {} },
      shows: "the Viewer",
    });
  });

  it("shows a capability over a sample that has it", () => {
    expect(planned({ capability: "3d" })).toMatchObject({
      sample: "model",
      shows: "Body",
    });
    expect(planned({ capability: "captions" })).toMatchObject({
      sample: "transcripts",
    });
  });

  it("draws a layout over its own resource, else a sample that has its parts", () => {
    const own = planned({
      layout: {
        resource: "https://example.org/manifest.json",
        parts: [{ part: "Body" }],
      },
    });
    expect(own.sample).toBeUndefined();
    expect(code(own)).toContain("https://example.org/manifest.json");
    const map = planned({ layout: { parts: [{ part: "Map" }] } });
    expect(map.sample).toBe("navplace");
    expect(code(map)).toContain(publishedAddress(RESOURCES.navplace));
  });

  it("writes the code compose writes for what it draws", () => {
    const plan = planned({
      layout: { parts: [{ part: "Label" }, { part: "Body" }] },
      capability: "video",
    });
    expect(plan.sample).toBe("footage");
    const composed = compose({
      ...plan.layout,
      resource: publishedAddress(RESOURCES.footage),
    });
    expect(composed.ok && composed.code).toBe(code(plan));
  });

  it("says why it cannot show what it was given", () => {
    expect(planPreview({}, "/docs/composing")).toMatchObject({
      ok: false,
      says: expect.stringMatching(/Give a layout or a capability/),
    });
    expect(
      planPreview({ layout: { parts: [{ part: "Itms" }] } }, "/docs"),
    ).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({ says: expect.stringMatching(/Items/) }),
      ],
    });
    expect(planPreview({ capability: "zebra" }, "/docs")).toMatchObject({
      ok: false,
    });
    expect(planPreview({}, "/docs/primitives/value")).toMatchObject({
      ok: false,
      says: expect.stringMatching(/own content/),
    });
  });
});
