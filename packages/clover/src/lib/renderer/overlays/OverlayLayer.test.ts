import { OverlayLayer } from "./OverlayLayer";

describe("OverlayLayer", () => {
  it("clips its hotspots rather than hiding them, so focus never scrolls it", () => {
    const parent = document.createElement("div");
    const layer = new OverlayLayer(parent);
    expect(layer.container.style.overflow).toBe("clip");
    layer.dispose();
  });

  /*
   * What a hotspot shows beside itself (its popover) is kept inside the stage from its
   * centre across, its edges, and the side of it with more room.
   */
  describe("each overlay's place in the layer", () => {
    const viewport = { width: 800, height: 600 };
    const setup = () => {
      const layer = new OverlayLayer(document.createElement("div"));
      const element = document.createElement("button");
      layer.add(element, { x: 100, y: 400, width: 50, height: 20 });
      return { layer, element };
    };
    const value = (element: HTMLElement, name: string) =>
      element.style.getPropertyValue(`--clover-overlay-${name}`);

    it("is its centre across, its edges, and the side with more room", () => {
      const { layer, element } = setup();
      // The camera's centre on the stage's: world (400, 300) at screen (400, 300).
      layer.position({ x: 400, y: 300, zoom: 1, rotation: 0 }, viewport);
      expect(value(element, "x")).toBe("125px");
      expect(value(element, "top")).toBe("400px");
      expect(value(element, "bottom")).toBe("420px");
      expect(element.dataset.overlayRoom).toBe("above");

      layer.position({ x: 400, y: 600, zoom: 1, rotation: 0 }, viewport);
      expect(element.dataset.overlayRoom).toBe("below");
      layer.dispose();
    });

    it("is not given while the view is turned, as the popover turns with it", () => {
      const { layer, element } = setup();
      layer.position({ x: 400, y: 300, zoom: 1, rotation: 0 }, viewport);
      layer.position(
        { x: 400, y: 300, zoom: 1, rotation: Math.PI / 2 },
        viewport,
      );
      for (const name of ["x", "top", "bottom"])
        expect(value(element, name)).toBe("");
      expect(element.dataset.overlayRoom).toBeUndefined();

      // A whole turn is upright again.
      layer.position(
        { x: 400, y: 300, zoom: 1, rotation: 2 * Math.PI },
        viewport,
      );
      expect(element.dataset.overlayRoom).toBe("above");
      layer.dispose();
    });
  });
});
