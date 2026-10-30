import { useEffect, useState } from "react";

import { getCloverRoot, getFullscreenElement } from "../lib/fullscreen";

/**
 * Whether `element`, a Canvas's or a Scene's figure, offers the way out of full screen
 * (`ExitFullscreen`): it is full screen itself, or it is the first in the Root that is
 * (`getCloverRoot`; Mat, 2026-10-29), so one way out shows, at its Body's top left,
 * wherever full screen was asked from.
 */
export default function useFullscreenExit(
  element: HTMLElement | null,
): boolean {
  const [offered, setOffered] = useState(false);

  useEffect(() => {
    if (!element) return;

    const sync = () => {
      const shown = getFullscreenElement();
      setOffered(
        shown === element ||
          (Boolean(shown) &&
            getCloverRoot(element) === shown &&
            shown?.querySelector(".clover-canvas") === element),
      );
    };
    sync();

    // The prefixed event is Safari's; both are harmless to listen for.
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);

    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [element]);

  return offered;
}
