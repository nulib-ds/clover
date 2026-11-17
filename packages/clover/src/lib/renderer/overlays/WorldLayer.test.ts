import { WorldLayer, worldLayerOf } from "./WorldLayer";

describe("WorldLayer", () => {
  it("lies under the hotspots, and is carried whole by the camera", () => {
    const host = document.createElement("div");
    const overlays = document.createElement("div");
    host.appendChild(overlays);
    const renderer = {
      host,
      world: null as WorldLayer | null,
      overlays: { container: overlays },
    };
    const layer = worldLayerOf(renderer);
    expect(worldLayerOf(renderer)).toBe(layer);
    expect(host.firstChild).toBe(layer.container);
    // World (400, 300) at the Body's center, twice as large.
    layer.position(
      { x: 400, y: 300, zoom: 2, rotation: 0 },
      { width: 800, height: 600 },
    );
    expect(layer.container.style.transform).toBe("matrix(2,0,0,2,-400,-300)");
    layer.dispose();
    expect(layer.container.parentElement).toBeNull();
  });
});
