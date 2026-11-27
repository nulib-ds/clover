import { IDENTITY } from "../../math/affine";
import { DomLayers, type DomLayerItem } from "./DomLayers";

const item = (key: string): DomLayerItem => ({
  key,
  element: document.createElement("img"),
  width: 960,
  height: 960,
  transform: IDENTITY,
  opacity: 1,
});

describe("DomLayers", () => {
  /*
   * An image served without CORS is drawn here, a tile an element. Its tiles are stacked
   * by paint order; the hotspots' layer, after it in the host, must stay over every one
   * of them, or a picked annotation's outline is hidden wherever a later tile lies.
   */
  it("keeps its items' depths inside itself, under the layers after it", () => {
    const host = document.createElement("div");
    const layers = new DomLayers(host);
    layers.sync([item("a"), item("b"), item("c")]);

    const boxes = [
      ...layers.container.querySelectorAll<HTMLElement>(
        ".clover-canvas-dom-item",
      ),
    ];
    expect(boxes.map((box) => box.style.zIndex)).toEqual(["0", "1", "2"]);
    // A stacking context of its own, so no item's depth rises past it.
    expect(layers.container.getAttribute("style")).toContain(
      "isolation: isolate",
    );
    layers.dispose();
  });
});
