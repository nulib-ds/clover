import { OverlayLayer } from "./OverlayLayer";

describe("OverlayLayer", () => {
  it("clips its hotspots rather than hiding them, so focus never scrolls it", () => {
    const parent = document.createElement("div");
    const layer = new OverlayLayer(parent);
    expect(layer.container.style.overflow).toBe("clip");
    layer.dispose();
  });

  /*
   * What a hotspot shows beside itself (its popover) is kept inside the Body from its
   * center across, its edges, and the side of it with more room.
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

    it("is its center across, its edges, and the side with more room", () => {
      const { layer, element } = setup();
      // The camera's center on the Body's: world (400, 300) at screen (400, 300).
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

  /*
   * Upright, every edge falls on a whole device pixel: between two, a hairline is shared
   * by both, and a hotspot gliding with a recording pulses as the share changes.
   */
  describe("its edges", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("fall on whole device pixels while upright", () => {
      vi.stubGlobal("devicePixelRatio", 2);
      const layer = new OverlayLayer(document.createElement("div"));
      const element = document.createElement("button");
      layer.add(element, { x: 100.3, y: 400.1, width: 50.37, height: 20.2 });
      layer.position(
        { x: 400, y: 300, zoom: 1, rotation: 0 },
        { width: 800, height: 600 },
      );
      expect(element.style.transform).toBe("translate(100.5px, 400px)");
      expect(element.style.width).toBe("50.5px");
      expect(element.style.height).toBe("20px");
      // Its popover keeps within the Body from the edges as drawn.
      expect(element.style.getPropertyValue("--clover-overlay-top")).toBe(
        "400px",
      );
      expect(element.style.getPropertyValue("--clover-overlay-bottom")).toBe(
        "420px",
      );
      layer.dispose();
    });
  });

  /*
   * A hotspot following a recording is moved frame by frame, in the view last drawn,
   * with no frame of the renderer's.
   */
  describe("moving one", () => {
    const viewport = { width: 800, height: 600 };

    it("places it at once, in the view last drawn, and keeps it there", () => {
      const layer = new OverlayLayer(document.createElement("div"));
      const element = document.createElement("button");
      layer.add(element, { x: 100, y: 400, width: 50, height: 20 });
      const camera = { x: 400, y: 300, zoom: 2, rotation: 0 };
      layer.position(camera, viewport);
      layer.move(element, { x: 300, y: 250, width: 40, height: 30 });
      // At twice the size, about the camera's center: (300 - 400) * 2 + 400 = 200.
      expect(element.style.width).toBe("80px");
      expect(element.style.height).toBe("60px");
      expect(element.style.transform).toBe("translate(200px, 200px)");
      expect(element.style.getPropertyValue("--clover-overlay-x")).toBe(
        "240px",
      );
      // The next frame keeps it where it was moved.
      layer.position(camera, viewport);
      expect(element.style.transform).toBe("translate(200px, 200px)");
      layer.dispose();
    });

    it("moves nothing it does not hold", () => {
      const layer = new OverlayLayer(document.createElement("div"));
      const element = document.createElement("button");
      layer.position({ x: 400, y: 300, zoom: 1, rotation: 0 }, viewport);
      layer.move(element, { x: 0, y: 0, width: 10, height: 10 });
      expect(element.style.transform).toBe("");
      expect(layer.size).toBe(0);
      layer.dispose();
    });
  });
});
