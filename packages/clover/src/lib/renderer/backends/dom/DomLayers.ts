import {
  type Affine,
  compose,
  toCssMatrix,
  translate,
} from "../../math/affine";
import type { Rect } from "../../math/rect";

export interface DomLayerItem {
  key: string;
  element: HTMLImageElement | HTMLVideoElement | HTMLElement;
  width: number;
  height: number;
  /** Source pixels → the Body's CSS pixels: the same transform the GPU path is given. */
  transform: Affine;
  crop?: Rect;
  opacity: number;
}

/**
 * Real `<img>` and `<video>` elements, placed by the same camera as everything the GPU
 * draws.
 *
 * Two kinds of drawable live here:
 *
 * - **Video, by default.** A visible element the browser composites itself keeps
 *   zero-copy decode, HDR, picture-in-picture and native fullscreen, and is never
 *   mistaken for a hidden element and throttled.
 * - **Pixels WebGL may not read.** An image or video served without CORS cannot be
 *   uploaded as a texture; as an element it displays fine.
 *
 * Each item is a crop box (`overflow: hidden`) carrying the transform, with the element
 * offset inside it, so a `body.region` clip works the same way here as on the GPU.
 */
export class DomLayers {
  readonly container: HTMLDivElement;
  private boxes = new Map<string, HTMLDivElement>();

  constructor(parent: HTMLElement) {
    const container = document.createElement("div");
    container.className = "clover-canvas-dom-layer";
    // Geometry inline: the layer works without the stylesheet (see CanvasRenderer).
    Object.assign(container.style, {
      position: "absolute",
      inset: "0",
      overflow: "hidden",
      pointerEvents: "none",
    });
    parent.appendChild(container);
    this.container = container;
  }

  /** Place every item for this frame, in paint order; anything not listed is removed. */
  sync(items: DomLayerItem[]): void {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      seen.add(item.key);
      const box = this.boxFor(item);
      const crop = item.crop ?? {
        x: 0,
        y: 0,
        width: item.width,
        height: item.height,
      };

      box.style.width = `${crop.width}px`;
      box.style.height = `${crop.height}px`;
      box.style.transform = toCssMatrix(
        compose(item.transform, translate(crop.x, crop.y)),
      );
      box.style.opacity = String(item.opacity);
      box.style.zIndex = String(index);

      const el = item.element;
      el.style.width = `${item.width}px`;
      el.style.height = `${item.height}px`;
      el.style.transform = `translate(${-crop.x}px, ${-crop.y}px)`;
    });

    for (const [key, box] of this.boxes) {
      if (!seen.has(key)) {
        box.remove();
        this.boxes.delete(key);
      }
    }
  }

  dispose(): void {
    this.boxes.clear();
    this.container.remove();
  }

  private boxFor(item: DomLayerItem): HTMLDivElement {
    let box = this.boxes.get(item.key);
    if (box && box.firstChild !== item.element) {
      box.remove();
      box = undefined;
    }
    if (!box) {
      box = document.createElement("div");
      box.className = "clover-canvas-dom-item";
      box.dataset.key = item.key;
      Object.assign(box.style, {
        position: "absolute",
        top: "0",
        left: "0",
        overflow: "hidden",
        transformOrigin: "0 0",
      });
      item.element.classList.add("clover-canvas-dom-media");
      Object.assign(item.element.style, {
        position: "absolute",
        top: "0",
        left: "0",
        maxWidth: "none",
        maxHeight: "none",
        transformOrigin: "0 0",
      });
      box.appendChild(item.element);
      this.container.appendChild(box);
      this.boxes.set(item.key, box);
    }
    return box;
  }
}
