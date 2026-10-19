import { keepFragments } from "./keep-fragments";
import { upgradePage } from "./pages";

/*
 * `@iiif/parser`'s upgrader reads a target written as an object with a fragment in its id
 * as a path (`…/canvas/1/xywh=…`); Clover rewrites it first, so the annotation keeps its
 * region and its Canvas.
 */
describe("keepFragments", () => {
  const page = (target: unknown) => ({
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: "https://example.org/page",
    type: "AnnotationPage",
    items: [
      {
        id: "https://example.org/a",
        type: "Annotation",
        motivation: "commenting",
        body: { type: "TextualBody", value: "x" },
        target,
      },
    ],
  });

  it("keeps an object target's fragment through the upgrade", async () => {
    const upgraded = (await upgradePage(
      page({ id: "https://example.org/canvas/1#xywh=1,2,3,4", type: "Canvas" }),
    )) as any;
    expect(JSON.stringify(upgraded.items[0].target)).toContain("xywh=1,2,3,4");
    expect(JSON.stringify(upgraded.items[0].target)).not.toContain(
      "canvas/1/xywh",
    );
  });

  it("leaves what needs no rewriting as it is, the very same object", () => {
    const plain = page("https://example.org/canvas/1#xywh=1,2,3,4");
    expect(keepFragments(plain)).toBe(plain);
  });

  it("rewrites a fragmented object target as the SpecificResource it means", () => {
    const rewritten = keepFragments(
      page({
        id: "https://example.org/canvas/1#xywh=1,2,3,4",
        type: "Canvas",
        partOf: [{ id: "https://example.org/manifest", type: "Manifest" }],
      }),
    ) as any;
    expect(rewritten.items[0].target).toEqual({
      type: "SpecificResource",
      source: {
        id: "https://example.org/canvas/1",
        type: "Canvas",
        partOf: [{ id: "https://example.org/manifest", type: "Manifest" }],
      },
      selector: { type: "FragmentSelector", value: "xywh=1,2,3,4" },
    });
  });
});
