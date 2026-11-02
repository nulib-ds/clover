import { describe, expect, it } from "vitest";

import { buildContentState } from "./content-state";
import {
  decodeContentState,
  resolveContentState,
} from "./content-state-reader";

const manifestId = "https://example.org/manifest";
const canvasId = "https://example.org/canvas/1";

describe("buildContentState", () => {
  it("names the Canvas within its Manifest, with the region in view, in both forms", () => {
    const { json, encoded } = buildContentState({
      manifestId,
      canvasId,
      region: { x: 10.4, y: 20, w: 300.6, h: 400 },
    });
    expect(json).toMatchObject({
      "@context": "http://iiif.io/api/presentation/3/context.json",
      type: "Annotation",
      motivation: ["contentState"],
      target: {
        type: "SpecificResource",
        source: {
          id: canvasId,
          type: "Canvas",
          partOf: [{ id: manifestId, type: "Manifest" }],
        },
        selector: { type: "FragmentSelector", value: "xywh=10,20,301,400" },
      },
    });
    // The encoded form is the same annotation, and Clover reads it back.
    expect(decodeContentState(encoded)).toEqual(json);
    expect(resolveContentState(json)).toMatchObject({
      id: manifestId,
      target: { canvasId, region: { x: 10, y: 20, w: 301, h: 400 } },
    });
  });

  // A Manifest made around a lone Canvas carries the Canvas's own id (`loneCanvas`).
  it("names a Canvas shown on its own without a Manifest", () => {
    for (const id of [undefined, canvasId]) {
      const { json } = buildContentState({ manifestId: id, canvasId });
      expect(json.target).toEqual({ id: canvasId, type: "Canvas" });
    }
  });

  it("names a Timeline or a Scene by its own type, in Presentation 4's context", () => {
    const { json } = buildContentState({
      manifestId,
      canvasId,
      type: "Scene",
    });
    expect(json["@context"]).toBe(
      "http://iiif.io/api/presentation/4/context.json",
    );
    expect(json.target).toMatchObject({ id: canvasId, type: "Scene" });
    expect(resolveContentState(json)).toMatchObject({
      id: manifestId,
      target: { canvasId },
    });
  });
});
