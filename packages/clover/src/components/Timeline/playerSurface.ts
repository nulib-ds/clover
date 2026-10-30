import type { CanvasRendererEvent } from "../../lib/renderer";
import { TAP_MS, TAP_SLOP, isDirect, isHovering } from "../../lib/pointer";
import type { MakeSurface } from "../Canvas/surface";

/**
 * A Timeline's surface (`Canvas/surface.ts`): the viewport `CanvasView` renders, with no
 * picture to draw and no camera, so a page that plays sound loads no image renderer and
 * holds none of the page's WebGL contexts. It answers as the renderer does over a lone
 * recording:
 *
 * - its first layout reports `open`, and each after it `change`;
 * - a click plays and pauses (`tap`, which `MediaBody` takes), unless it first lets go of
 *   a picked annotation; a finger's tap is left to the controls (`useControlsVisibility`);
 * - a video a Timeline paints all the same (Presentation 4 paints sound on one) is shown
 *   fitted, as a lone video is.
 */
export const playerSurface: MakeSurface = (host) => {
  const listeners = new Map<CanvasRendererEvent, Set<() => void>>();
  const emit = (event: CanvasRendererEvent) =>
    listeners.get(event)?.forEach((listener) => listener());
  let open = false;
  let dismiss: (() => boolean) | null = null;
  let video: HTMLVideoElement | null = null;
  let hovers = false;
  let down: { x: number; y: number; t: number; direct: boolean } | null = null;

  const onMove = (event: PointerEvent) => {
    if (isHovering(event)) hovers = true;
  };
  const onDown = (event: PointerEvent) => {
    down =
      event.isPrimary &&
      event.button === 0 &&
      (event.target === host || event.target === video)
        ? {
            x: event.clientX,
            y: event.clientY,
            t: event.timeStamp,
            direct: isDirect(event.pointerType, hovers),
          }
        : null;
  };
  const onUp = (event: PointerEvent) => {
    const pressed = down;
    down = null;
    if (
      !pressed ||
      event.timeStamp - pressed.t >= TAP_MS ||
      Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) >
        TAP_SLOP
    )
      return;
    if (!dismiss?.() && !pressed.direct) emit("tap");
  };
  const show = (next: HTMLVideoElement | null) => {
    if (next === video) return;
    video?.remove();
    video = next;
    if (!video) return;
    Object.assign(video.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      objectFit: "contain",
    });
    video.classList.add("clover-canvas-dom-media");
    host.append(video);
  };
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointerup", onUp);

  return {
    host,
    get isOpen() {
      return open;
    },
    on(event, listener) {
      const set = listeners.get(event) ?? new Set();
      listeners.set(event, set.add(listener));
      return () => set.delete(listener);
    },
    async setImages(images, { world } = {}) {
      const element = images.find((image) => image.media)?.media?.element;
      show(element instanceof HTMLVideoElement ? element : null);
      if (!world && !images.length) return;
      emit(open ? "change" : "open");
      open = true;
    },
    clear: () => show(null),
    setDismiss(handler) {
      dismiss = handler;
    },
    setGestures() {},
    dispose() {
      show(null);
      listeners.clear();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerup", onUp);
    },
  };
};
