import {
  type CameraState,
  type ViewportSize,
  worldToScreen,
} from "../camera/Camera";
import { toCssMatrix } from "../math/affine";

/**
 * A renderer's world layer, made the first time something is laid in it: over the DOM
 * layer, under the hotspots (`overlaysOf`), whichever of them comes first.
 */
export const worldLayerOf = (renderer: {
  host: HTMLElement;
  world: WorldLayer | null;
  overlays: { container: HTMLElement } | null;
}): WorldLayer =>
  (renderer.world ??= new WorldLayer(
    renderer.host,
    renderer.overlays?.container ?? null,
  ));

/**
 * Elements laid out in world units, the whole layer carried by the camera's transform:
 * many elements cost one transform a frame, never one each, where the hotspots'
 * (`OverlayLayer`) are each placed in screen pixels to keep their edges crisp. For what
 * has no edge to keep: a Canvas's text, read from its picture (`Canvas/TextLayer.tsx`).
 */
export class WorldLayer {
  readonly container: HTMLDivElement;

  constructor(parent: HTMLElement, before: Element | null = null) {
    const container = document.createElement("div");
    container.className = "clover-canvas-world";
    // Geometry inline, as every layer's is: placed without the stylesheet too.
    Object.assign(container.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "0",
      height: "0",
      transformOrigin: "0 0",
      pointerEvents: "none",
    });
    parent.insertBefore(
      container,
      before?.parentNode === parent ? before : null,
    );
    this.container = container;
  }

  position(camera: CameraState, viewport: ViewportSize): void {
    this.container.style.transform = toCssMatrix(
      worldToScreen(camera, viewport),
    );
  }

  dispose(): void {
    this.container.remove();
  }
}
