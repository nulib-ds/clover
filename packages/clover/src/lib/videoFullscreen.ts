/*
 * iPhone Safari's full screen, which only a `<video>` has: what a transport hands
 * `toggleFullscreen` (`lib/fullscreen.ts`) for where the root cannot go full screen. Apart,
 * so it loads with the transport, never with a picture's controls.
 */

type PrefixedVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

/**
 * Hand `video` to the system player (iPhone Safari), which takes only a video on the page.
 * One not on the page (sound, which the scene never places) is placed in its Canvas for as
 * long as the player has it: first, at full size under the viewport, which paints over
 * it, so it is laid out like any video rather than hidden. It is the same element that
 * plays, so playback carries on in the page when the player closes.
 */
export const enterNativeFullscreen = (video: PrefixedVideo, from: Element) => {
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
