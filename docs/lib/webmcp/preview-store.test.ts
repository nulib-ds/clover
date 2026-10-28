import { afterEach, describe, expect, it } from "vitest";

import type { PreviewPlan } from "docs/lib/compose/preview";
import {
  closePreview,
  firstHost,
  levelUnder,
  registerHost,
  showPreview,
  snapshot,
} from "./preview-store";

const PLAN = { shows: "Body and Items" } as PreviewPlan;

/** Frames on a page, in this order. */
function frames(count: number) {
  const elements = Array.from({ length: count }, () =>
    document.body.appendChild(document.createElement("figure")),
  );
  const keys = elements.map((_, at) => Symbol(`frame ${at}`));
  const gone = elements.map((element, at) =>
    registerHost(keys[at], () => element, "/docs/items"),
  );
  return { elements, keys, gone };
}

afterEach(() => {
  closePreview();
  document.body.innerHTML = "";
});

describe("the preview store", () => {
  it("draws in the first frame on the page, whatever the order they came in", () => {
    const later = document.body.appendChild(document.createElement("figure"));
    const earlier = document.createElement("figure");
    document.body.prepend(earlier);
    const [a, b] = [Symbol("later"), Symbol("earlier")];
    const goneA = registerHost(a, () => later, "/docs/items");
    const goneB = registerHost(b, () => earlier, "/docs/items");
    expect(firstHost()).toMatchObject({ key: b, route: "/docs/items" });
    goneA();
    goneB();
  });

  it("draws only in a frame the page shows, never one it hides", () => {
    // Get started keeps every setup's example, showing the one chosen.
    document.body.innerHTML = `<div style="display: none"><figure id="react"></figure></div>
      <div><figure id="elements"></figure></div>`;
    const [react, elements] = [Symbol("react"), Symbol("elements")];
    const goneA = registerHost(
      react,
      () => document.getElementById("react"),
      "/docs",
    );
    const goneB = registerHost(
      elements,
      () => document.getElementById("elements"),
      "/docs",
    );
    expect(firstHost()).toMatchObject({ key: elements });
    goneA();
    goneB();
  });

  it("titles a level under the heading its frame sits under", () => {
    document.body.innerHTML = `<main><h1>Composing layouts</h1>
      <h2>A layout of your own</h2>
      <div style="display: none"><h3>Another setup</h3></div>
      <figure id="frame"><h2>The example's own</h2></figure></main>`;
    const frame = document.getElementById("frame")!;
    expect(levelUnder(frame)).toBe(3);
    const gone = registerHost(Symbol("frame"), () => frame, "/docs/composing");
    expect(firstHost()).toMatchObject({ level: 3 });
    gone();
    document.body.innerHTML = `<main><figure id="first"></figure><h2>Later</h2></main>`;
    expect(levelUnder(document.getElementById("first")!)).toBe(2);
    document.body.innerHTML = `<main><div role="heading" aria-level="3">Add it to a page</div>
      <figure id="step"></figure></main>`;
    expect(levelUnder(document.getElementById("step")!)).toBe(4);
  });

  it("says when a preview comes, and when the page's example is back", () => {
    const { keys, gone } = frames(2);
    showPreview(PLAN, keys[0]);
    expect(snapshot()).toMatchObject({
      shown: { host: keys[0], plan: PLAN, reveal: false },
      announcement:
        "Your agent's preview, Body and Items, is in the page's first example.",
    });
    closePreview();
    expect(snapshot()).toEqual({
      shown: null,
      announcement: "The page's own example is back.",
    });
    gone.forEach((each) => each());
  });

  it("lets a preview go with its page, unannounced", () => {
    const { keys, gone } = frames(1);
    showPreview(PLAN, keys[0], true);
    expect(snapshot().shown?.reveal).toBe(true);
    gone[0]();
    expect(snapshot()).toEqual({ shown: null, announcement: "" });
    expect(firstHost()).toBeUndefined();
  });
});
