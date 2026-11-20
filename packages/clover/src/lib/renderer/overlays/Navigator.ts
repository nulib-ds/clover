import { Canvas2DBackend } from "../backends/canvas2d/Canvas2DBackend";
import type { DrawSource } from "../backends/backend";
import {
  type CameraState,
  fitCamera,
  screenPointToWorld,
  worldPointToScreen,
} from "../camera/Camera";
import type { LoadedImage } from "../io/decode";
import type { Point } from "../math/affine";
import type { Rect } from "../math/rect";
import { planFrame } from "../scene/planFrame";
import type { SceneItem } from "../scene/sceneItem";

/**
 * A small overview of the whole scene with the visible region outlined — OpenSeadragon's
 * navigator. Press or drag in it to move the main view there.
 *
 * It is a second camera over the same scene, drawn with Canvas2D (a few coarse tiles do
 * not need a GPU context of their own, and Canvas2D draws pixels without CORS too). Its
 * picture is redrawn only when the scene or its tiles change; the region outline moves
 * with every frame of the main view.
 */
export class Navigator {
  private canvas: HTMLCanvasElement;
  private region: HTMLDivElement;
  private painter: Canvas2DBackend | null;
  private camera: CameraState | null = null;
  private size = { width: 0, height: 0 };
  private drawnVersion = -1;
  private resized = true;
  private dragging: number | null = null;
  private observer: ResizeObserver | null = null;

  constructor(
    private readonly element: HTMLElement,
    private readonly onNavigate: (world: Point, immediate: boolean) => void,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "clover-canvas-navigator-image";
    this.canvas.setAttribute("aria-hidden", "true");
    this.region = document.createElement("div");
    this.region.className = "clover-canvas-navigator-region";
    element.append(this.canvas, this.region);
    this.painter = Canvas2DBackend.create(this.canvas);

    // Measured on resize, never per frame: reading layout right after the frame's style
    // writes would force a synchronous reflow every frame.
    this.measure();
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.measure());
      this.observer.observe(element);
    }

    element.addEventListener("pointerdown", this.onPointerDown);
    element.addEventListener("pointermove", this.onPointerMove);
    element.addEventListener("pointerup", this.onPointerUp);
    element.addEventListener("pointercancel", this.onPointerUp);
  }

  /**
   * @param version bumps whenever the scene or its loaded tiles change
   */
  render(
    items: SceneItem[],
    world: Rect | null,
    visible: Rect,
    pixelRatio: number,
    getTile: (url: string) => LoadedImage | undefined,
    version: number,
  ): void {
    if (!world) return;
    const { width, height } = this.size;
    this.camera = fitCamera(world, this.size);

    if (this.painter && (this.resized || version !== this.drawnVersion)) {
      this.drawnVersion = version;
      this.resized = false;
      this.painter.resize(width, height, pixelRatio);
      const plan = planFrame({
        items,
        camera: this.camera,
        viewport: this.size,
        pixelRatio,
        getTile,
      });
      this.painter.begin();
      for (const draw of plan.draws) {
        this.painter.draw({
          key: draw.url,
          source: draw.image.source as DrawSource,
          width: draw.image.width,
          height: draw.image.height,
          transform: draw.transform,
          crop: draw.crop,
          bleed: draw.bleed,
        });
      }
      this.painter.end();
    }

    // The visible region, clamped to the overview so the outline never leaves it.
    const a = worldPointToScreen(this.camera, this.size, {
      x: visible.x,
      y: visible.y,
    });
    const b = worldPointToScreen(this.camera, this.size, {
      x: visible.x + visible.width,
      y: visible.y + visible.height,
    });
    const left = Math.max(0, Math.min(a.x, b.x));
    const top = Math.max(0, Math.min(a.y, b.y));
    const right = Math.min(width, Math.max(a.x, b.x));
    const bottom = Math.min(height, Math.max(a.y, b.y));
    Object.assign(this.region.style, {
      transform: `translate(${left}px, ${top}px)`,
      width: `${Math.max(0, right - left)}px`,
      height: `${Math.max(0, bottom - top)}px`,
    });
  }

  private measure(): void {
    const rect = this.element.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    if (width === this.size.width && height === this.size.height) return;
    this.size = { width, height };
    this.resized = true;
  }

  dispose(): void {
    this.observer?.disconnect();
    const el = this.element;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointercancel", this.onPointerUp);
    this.painter?.dispose();
    this.canvas.remove();
    this.region.remove();
  }

  private worldAt(event: PointerEvent): Point | null {
    if (!this.camera) return null;
    const rect = this.element.getBoundingClientRect();
    return screenPointToWorld(this.camera, this.size, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  private onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragging = event.pointerId;
    this.element.setPointerCapture?.(event.pointerId);
    const world = this.worldAt(event);
    if (world) this.onNavigate(world, false);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (this.dragging !== event.pointerId) return;
    const world = this.worldAt(event);
    if (world) this.onNavigate(world, true);
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.dragging !== event.pointerId) return;
    this.dragging = null;
    this.element.releasePointerCapture?.(event.pointerId);
  };
}
