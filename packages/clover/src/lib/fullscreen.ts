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
 * What goes full screen, found from an element inside it: the Root a Canvas is in, a
 * template's Viewer or a page's own layout, so a reader goes on through the resource
 * there, its Items and Panel too (Mat, 2026-10-29); else the Canvas, on its own. Not
 * across a `<dialog>` in the Root (a page's own modal one): full screen over it would
 * hide the dialog, so its Canvas goes alone. The Gallery's lightbox is a layer in its
 * Root, not a `<dialog>`: the Root goes, the lightbox filling it.
 */
export const getCloverRoot = (from: Element | null): HTMLElement | null => {
  const root = from?.closest(".clover-root");
  const dialog = from?.closest("dialog");
  if (root && !(dialog && root.contains(dialog))) return root as HTMLElement;
  return (from?.closest(".clover-canvas") as HTMLElement | null) ?? null;
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
  /**
   * What may go full screen instead where the root cannot (iPhone Safari), called within
   * the same press: a transport hands its video to the system player
   * (`enterNativeFullscreen`, `lib/videoFullscreen.ts`).
   */
  alone?: (from: Element) => void,
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
      if (alone && from) alone(from);
      return;
    }
    const element = root as PrefixedElement;
    await (element.requestFullscreen?.() ??
      element.webkitRequestFullscreen?.());
  } catch {
    // Declined. Nothing to undo — the reader stays where they were.
  }
};
