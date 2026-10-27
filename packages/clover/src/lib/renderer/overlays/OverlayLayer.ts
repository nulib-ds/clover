import {
  type CameraState,
  type ViewportSize,
  worldPointToScreen,
} from "../camera/Camera";
import type { Rect } from "../math/rect";

/**
 * A renderer's overlay layer, made the first time something is pinned to it: after the
 * renderer's own layers, as it was when every renderer made one.
 */
export const overlaysOf = (renderer: {
  host: HTMLElement;
  overlays: OverlayLayer | null;
}): OverlayLayer => (renderer.overlays ??= new OverlayLayer(renderer.host));

/**
 * Interactive elements pinned to world rectangles — annotation hotspots, chiefly.
 *
 * They stay real, focusable DOM so a reader can tab to them and a screen reader can name
 * them. Each is sized in screen pixels rather than scaled by a transform, so borders and
 * label text stay crisp at every zoom, and turned with the view (OpenSeadragon's `EXACT`
 * overlay rotation).
 */
export class OverlayLayer {
  readonly container: HTMLDivElement;
  private overlays = new Map<HTMLElement, Rect>();
  /** The view last positioned in, so one element can be moved between frames. */
  private view?: [CameraState, ViewportSize];

  constructor(parent: HTMLElement) {
    const container = document.createElement("div");
    container.className = "clover-canvas-overlays";
    // Geometry inline: hotspots are placed without the stylesheet too. Clipped, not
    // hidden: a hidden overflow still scrolls to a focused hotspot out of view, which
    // would move every hotspot off its region.
    Object.assign(container.style, {
      position: "absolute",
      inset: "0",
      overflow: "clip",
      pointerEvents: "none",
    });
    parent.appendChild(container);
    this.container = container;
  }

  /** Pin `element` to `rect` (world units). Returns a function that unpins it. */
  add(element: HTMLElement, rect: Rect): () => void {
    this.overlays.set(element, rect);
    element.classList.add("clover-canvas-overlay");
    Object.assign(element.style, {
      position: "absolute",
      top: "0",
      left: "0",
      pointerEvents: "auto",
    });
    if (element.parentElement !== this.container) {
      this.container.appendChild(element);
    }
    return () => {
      this.overlays.delete(element);
    };
  }

  /**
   * Pin `element`, already added, to another `rect` and place it there now, in the view
   * last drawn: a hotspot following a recording, moved frame by frame with no frame of
   * the renderer's. Nothing, for an element not pinned.
   */
  move(element: HTMLElement, rect: Rect): void {
    if (!this.overlays.has(element)) return;
    this.overlays.set(element, rect);
    if (this.view) this.position(...this.view, element);
  }

  /** Place every element pinned, or `only` that one, in the view. */
  position(
    camera: CameraState,
    viewport: ViewportSize,
    only?: HTMLElement,
  ): void {
    this.view = [camera, viewport];
    const degrees = (camera.rotation * 180) / Math.PI;
    const upright = Math.cos(camera.rotation) > 0.9999;
    /*
     * Upright, each edge on a whole device pixel. Between pixels, a hairline is shared
     * by two, and one gliding with a recording pulses as the share changes frame by
     * frame; snapped, it stays crisp and steps a pixel at a time.
     */
    const ratio = upright ? window.devicePixelRatio || 1 : 0;
    const snap = (value: number) =>
      ratio ? Math.round(value * ratio) / ratio : value;
    for (const [element, rect] of this.overlays) {
      if (only && element !== only) continue;
      const center = worldPointToScreen(camera, viewport, {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      });
      const left = snap(center.x - (rect.width * camera.zoom) / 2);
      const top = snap(center.y - (rect.height * camera.zoom) / 2);
      const width = snap(rect.width * camera.zoom);
      const height = snap(rect.height * camera.zoom);
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      element.style.transform =
        `translate(${left}px, ${top}px)` +
        (degrees ? ` rotate(${degrees}deg)` : "");
      /*
       * Where it sits in the layer, so what it shows beside itself (a hotspot's popover)
       * can stay inside: its center across, its top and bottom edges, and the side with
       * more room, above it in the lower half and below it in the upper. Not while the
       * view is turned, since what it shows turns with it.
       */
      const { style, dataset } = element;
      if (upright) {
        style.setProperty("--clover-overlay-x", `${center.x}px`);
        style.setProperty("--clover-overlay-top", `${top}px`);
        style.setProperty("--clover-overlay-bottom", `${top + height}px`);
        const room = center.y > viewport.height / 2 ? "above" : "below";
        if (dataset.overlayRoom !== room) dataset.overlayRoom = room;
      } else {
        style.removeProperty("--clover-overlay-x");
        style.removeProperty("--clover-overlay-top");
        style.removeProperty("--clover-overlay-bottom");
        delete dataset.overlayRoom;
      }
    }
  }

  dispose(): void {
    this.overlays.clear();
    this.container.remove();
  }
}
