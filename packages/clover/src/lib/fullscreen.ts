/**
 * The Fullscreen API, with Safari's prefixes and a way to find Clover's own root.
 *
 * Full screen is always asked of Clover's root rather than the drawing surface, so the
 * controls, the transport and any panel beside the Canvas stay on screen with it.
 */

type PrefixedElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type PrefixedDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type PrefixedVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

/** The element currently full screen, if any. */
export const getFullscreenElement = (): Element | null => {
  if (typeof document === "undefined") return null;
  const doc = document as PrefixedDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
};

/**
 * Whether an element (Clover's root) can go full screen. False on iPhone Safari, which
 * offers full screen to a `<video>` alone, and in a frame not allowed it.
 */
export const isFullscreenSupported = (): boolean => {
  if (typeof document === "undefined") return false;
  const doc = document as PrefixedDocument;
  return Boolean(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled);
};

/**
 * What goes full screen, found from an element inside it: the Canvas, in a template as
 * on its own, as 3.x's Viewer full-screens its image and not the page around it.
 */
export const getCloverRoot = (from: Element | null): HTMLElement | null =>
  from?.closest(".clover-canvas") as HTMLElement | null;

/**
 * Hand `video` to the system player (iPhone Safari), which takes only a video on the page.
 * One not on the page (sound, which the scene never places) is placed in its Canvas for as
 * long as the player has it: first, at full size under the viewport, which paints over
 * it, so it is laid out like any video rather than hidden. It is the same element that
 * plays, so playback carries on in the page when the player closes.
 */
const enterNativeFullscreen = (video: PrefixedVideo, from: Element) => {
  if (typeof video.webkitEnterFullscreen !== "function") return;
  const canvas = from.closest(".clover-canvas");
  const placed = !video.isConnected && Boolean(canvas);
  if (placed && canvas) {
    const style = video.getAttribute("style");
    // In the viewport's layer, and first in it, so beneath the viewport.
    video.style.cssText =
      "position:absolute;inset:0;z-index:-1;width:100%;height:100%;object-fit:contain;pointer-events:none";
    canvas.prepend(video);
    video.addEventListener(
      "webkitendfullscreen",
      () => {
        video.remove();
        if (style === null) video.removeAttribute("style");
        else video.setAttribute("style", style);
      },
      { once: true },
    );
  }
  const enter = () => {
    try {
      video.webkitEnterFullscreen?.();
    } catch {
      // Declined: not ready, or not allowed. The reader stays in the page.
    }
  };
  /*
   * A video just placed has never been drawn, and a player handed it at once shows only
   * black: it is given a frame to be laid out first. Safari still counts the reader's
   * press as the gesture then. One on the page already goes at once.
   */
  if (placed) requestAnimationFrame(enter);
  else enter();
};

/**
 * Enter or leave full screen for the Clover root containing `from`.
 *
 * Must be called from within a user gesture — browsers reject a request that is not, and they
 * reject it silently enough that routing it through state and an effect can lose it.
 *
 * A refusal is swallowed rather than left to surface as an unhandled promise rejection. A
 * browser may decline for reasons that have nothing to do with the click: a permissions
 * policy, an embedded frame that was never allowed full screen.
 */
export const toggleFullscreen = async (
  from: Element | null,
  /** A video that may go full screen on its own where the root cannot (iPhone Safari). */
  video?: HTMLVideoElement | null,
) => {
  const root = getCloverRoot(from);
  if (!root) return;

  try {
    if (getFullscreenElement()) {
      const doc = document as PrefixedDocument;
      await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      return;
    }

    if (!isFullscreenSupported()) {
      // iPhone: the video alone, in the system player. It leaves by its own Done button.
      if (video && from) enterNativeFullscreen(video as PrefixedVideo, from);
      return;
    }
    const element = root as PrefixedElement;
    await (element.requestFullscreen?.() ??
      element.webkitRequestFullscreen?.());
  } catch {
    // Declined. Nothing to undo — the reader stays where they were.
  }
};
