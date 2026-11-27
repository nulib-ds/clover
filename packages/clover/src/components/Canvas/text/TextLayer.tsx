import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  type SelectedPiece,
  type TextUnit,
  selectedPieces,
  selectedText,
} from "../textUnits";
import { languageProps } from "../../../i18n/direction";
import { useCloverTranslation } from "../../../i18n/useCloverTranslation";
import type { CanvasRenderer } from "../../../lib/renderer";
import { overlaysOf } from "../../../lib/renderer/overlays/OverlayLayer";
import { worldLayerOf } from "../../../lib/renderer/overlays/WorldLayer";
import { visuallyHidden } from "../../../ui/visuallyHidden";

/** How long a selection holds still before its popover shows what it copies. */
const SETTLE_MS = 400;
/** How long Copy says it copied. */
const COPIED_MS = 2000;

type Elements = { element: HTMLElement; unit: TextUnit }[];

/** The selection's range, where it is over `layer`'s text. */
const rangeOver = (layer: HTMLElement | null) => {
  const selection = document.getSelection();
  if (!layer || !selection || selection.isCollapsed || !selection.rangeCount)
    return null;
  const range = selection.getRangeAt(0);
  return layer.contains(range.commonAncestorContainer) ? range : null;
};

/**
 * The Canvas's text, read from its picture, laid over it to select and copy as a PDF's
 * is (Mat, 2026-11-16): its `supplementing` annotations on regions, and any with a text
 * granularity, each a run of text the size of its region, in reading order, unseen but
 * for the selection. A mouse or a pen drags across them to select (`GestureController`),
 * and clicks on them as on the picture, zooming (Mat, 2026-11-25; WCAG 2.5.1), and
 * Control or Command with A on the viewport takes all of it, for the keyboard (WCAG
 * 2.1.1); a copy writes each run's text, a space between.
 *
 * Hidden from assistive technology: thousands of runs, placed by their pixels, read as
 * noise beside the view's own name, and what they say a Transcript or a search reads in
 * order. Drawn imperatively, its own layer under the hotspots, the camera carrying it
 * whole (`WorldLayer`), so a view's move costs one transform, never one per word.
 *
 * A selection left in place shows what it copies (Mat, 2026-11-16), in a popover under
 * it, or over it where the Body has no room below, with Copy and Close (which lets the
 * selection go): once it has held still, and no button is down, so it never chases a
 * drag. It follows the view while it shows, and goes with the selection, Close or Escape
 * (WCAG 1.4.13). Its words are a status, kept mounted, so a screen reader hears what
 * Control+A took (4.1.3), and so is Copy's "Copied".
 */
export function TextLayer({
  renderer,
  units,
}: {
  renderer: CanvasRenderer;
  units: TextUnit[];
}) {
  const { t, langOf } = useCloverTranslation();
  // What the popover shows: the selection's text, and its pieces, each in its language.
  const [shown, setShown] = useState("");
  const [pieces, setPieces] = useState<SelectedPiece[]>([]);
  const [copied, setCopied] = useState(false);
  const popover = useRef<HTMLDivElement>(null);
  const words = useRef<HTMLParagraphElement>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const host = renderer.host;

  useLayoutEffect(() => {
    if (!units.length) return;
    const layer = document.createElement("div");
    layer.className = "clover-canvas-text";
    layer.dataset.cloverCanvasText = "";
    layer.setAttribute("aria-hidden", "true");
    /*
     * Functional, inline, so it holds without the stylesheet: the text is the picture's,
     * so it is never painted, forced colors included, and it can be selected inside a
     * viewport that cannot.
     */
    Object.assign(layer.style, {
      position: "absolute",
      top: "0",
      left: "0",
      color: "transparent",
      userSelect: "text",
      webkitUserSelect: "text",
      forcedColorAdjust: "none",
      whiteSpace: "pre",
    });
    const elements: Elements = units.map((unit) => {
      const element = document.createElement("span");
      element.textContent = unit.text;
      const { lang, dir } = languageProps(unit.lang);
      if (lang) element.lang = lang;
      if (dir) element.dir = dir;
      const { x, y, height } = unit.world;
      Object.assign(element.style, {
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        height: `${height}px`,
        fontSize: `${height}px`,
        lineHeight: `${height}px`,
        transformOrigin: "0 0",
        pointerEvents: "auto",
      });
      layer.appendChild(element);
      return { element, unit };
    });
    worldLayerOf(renderer).container.appendChild(layer);
    layerRef.current = layer;

    /*
     * Each run stretched across its region: measured once at its region's height, all
     * read before any is written, so the page lays out once. A paragraph wraps instead,
     * at the size that fills its region with its lines.
     */
    const fit = () => {
      const natural = elements.map(({ element }) => element.offsetWidth);
      elements.forEach(({ element, unit }, index) => {
        const { width, height } = unit.world;
        const measured = natural[index];
        if (!(measured > 0)) return;
        /*
         * A paragraph wraps, and so does a run that says no granularity and would be
         * squeezed to a third of its width on one line: a block of text, not a line.
         */
        if (
          unit.granularity === "paragraph" ||
          (!unit.granularity && measured > 3 * width)
        ) {
          element.dataset.wraps = "";
          const size = Math.sqrt((height * width * height) / measured);
          Object.assign(element.style, {
            whiteSpace: "normal",
            width: `${width}px`,
            fontSize: `${size}px`,
            lineHeight: `${size}px`,
            transform: "",
          });
        } else {
          element.style.transform = `scaleX(${width / measured})`;
        }
      });
    };
    fit();
    // Measured again once the page's fonts are in, as they change the runs' widths.
    let live = true;
    void document.fonts?.ready.then(() => {
      if (!live) return;
      elements.forEach(({ element, unit }) => {
        if (element.dataset.wraps !== undefined) {
          delete element.dataset.wraps;
          Object.assign(element.style, {
            whiteSpace: "",
            width: "",
            fontSize: `${unit.world.height}px`,
            lineHeight: `${unit.world.height}px`,
          });
        }
        element.style.transform = "";
      });
      fit();
    });

    // A copy of a selection over it writes its text, plain, a space between its runs.
    const onCopy = (event: ClipboardEvent) => {
      const range = rangeOver(layer);
      const text = range && selectedText(range, elements);
      if (!text || !event.clipboardData) return;
      event.clipboardData.setData("text/plain", text);
      event.preventDefault();
    };
    // Control or Command with A, on the viewport, selects all of it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target !== host ||
        event.defaultPrevented ||
        event.altKey ||
        event.shiftKey ||
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "a"
      )
        return;
      event.preventDefault();
      document.getSelection()?.selectAllChildren(layer);
    };

    // The popover: shown once a selection over the text holds still, no button down.
    let held = false;
    let settle = 0;
    const say = (said: SelectedPiece[]) => {
      setPieces(said);
      setShown(said.map((piece) => piece.text).join(" "));
    };
    const show = () => {
      const range = rangeOver(layer);
      say(range ? selectedPieces(range, elements) : []);
    };
    const onSelection = () => {
      clearTimeout(settle);
      if (!rangeOver(layer)) return say([]);
      if (!held) settle = window.setTimeout(show, SETTLE_MS);
    };
    const onDown = (event: PointerEvent) => {
      if (popover.current?.contains(event.target as Node)) return;
      held = true;
      clearTimeout(settle);
    };
    // Let go, or taken by the browser (a finger's scroll, a long press's own selection).
    const onUp = () => {
      if (!held) return;
      held = false;
      onSelection();
    };
    // Escape lets the selection go, before it lets go of a picked annotation.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || !rangeOver(layer))
        return;
      event.preventDefault();
      document.getSelection()?.removeAllRanges();
    };
    const figure = host.parentElement;
    document.addEventListener("copy", onCopy);
    document.addEventListener("selectionchange", onSelection);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("keydown", onKeyDown);
    figure?.addEventListener("keydown", onEscape);
    renderer.invalidate();
    return () => {
      live = false;
      clearTimeout(settle);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("selectionchange", onSelection);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("keydown", onKeyDown);
      figure?.removeEventListener("keydown", onEscape);
      if (rangeOver(layer)) document.getSelection()?.removeAllRanges();
      layer.remove();
      layerRef.current = null;
      setShown("");
      setPieces([]);
    };
  }, [renderer, units, host]);

  /*
   * While it shows, it follows the selection, frame by frame, as the view moves: under
   * it, else over it, inside the Body. A long one's words scroll, and the keyboard can
   * reach them to (WCAG 2.1.1).
   */
  useLayoutEffect(() => {
    setCopied(false);
    const box = popover.current;
    // A tab stop only while it shows and scrolls: put away, it is none (WCAG 2.4.7).
    const scroller = words.current;
    if (scroller) {
      if (shown && scroller.scrollHeight > scroller.clientHeight)
        scroller.tabIndex = 0;
      else scroller.removeAttribute("tabindex");
    }
    if (!shown || !box) return;
    let frame = 0;
    const place = () => {
      const range = rangeOver(layerRef.current);
      const frameBox = box.offsetParent?.getBoundingClientRect();
      // Where a browser cannot measure a range (a test's DOM), it stays where it is.
      if (range?.getBoundingClientRect && frameBox) {
        const at = range.getBoundingClientRect();
        const gap = 8;
        const width = box.offsetWidth;
        const height = box.offsetHeight;
        const middle = at.left + at.width / 2 - frameBox.left;
        const left = Math.min(
          Math.max(gap, middle - width / 2),
          Math.max(gap, frameBox.width - width - gap),
        );
        const below = at.bottom - frameBox.top + gap;
        const top =
          below + height <= frameBox.height - gap
            ? below
            : Math.max(gap, at.top - frameBox.top - gap - height);
        box.style.transform = `translate(${left}px, ${top}px)`;
      }
      frame = requestAnimationFrame(place);
    };
    place();
    return () => {
      cancelAnimationFrame(frame);
      // Focus in it goes back to the view it was over, never to the page (WCAG 2.4.3).
      if (box.contains(document.activeElement))
        host.focus({ preventScroll: true });
    };
  }, [shown, host]);

  useLayoutEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    const done = () => setCopied(true);
    const fallback = () => {
      // The selection is still there: the browser's copy, which `onCopy` writes.
      if (document.execCommand?.("copy")) done();
    };
    if (navigator.clipboard?.writeText)
      navigator.clipboard.writeText(shown).then(done, fallback);
    else fallback();
  };
  const close = () => {
    host.focus({ preventScroll: true });
    document.getSelection()?.removeAllRanges();
  };
  const copyKey = copied ? "canvasTextCopied" : "canvasTextCopy";

  return createPortal(
    <div
      ref={popover}
      className="clover-canvas-text-copy"
      data-clover-canvas-interactive=""
      data-shown={shown ? "" : undefined}
      // A press in it keeps the selection it shows.
      onMouseDown={(event) => event.preventDefault()}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: shown ? "auto" : "none",
      }}
    >
      <p
        ref={words}
        className="clover-canvas-text-copy-words"
        role="status"
        style={{ margin: 0 }}
      >
        {/* Each run of one language marked with it, a space between (WCAG 3.1.2). */}
        {byLanguage(pieces).map(({ text, lang }, index) => (
          <React.Fragment key={index}>
            {index > 0 && " "}
            <span {...languageProps(lang)}>{text}</span>
          </React.Fragment>
        ))}
      </p>
      {shown && (
        <div className="clover-canvas-text-copy-actions">
          <button
            type="button"
            className="clover-canvas-text-copy-button"
            {...languageProps(langOf(copyKey))}
            onClick={copy}
          >
            {t(copyKey)}
          </button>
          <button
            type="button"
            className="clover-canvas-text-copy-button"
            {...languageProps(langOf("commonClose"))}
            onClick={close}
          >
            {t("commonClose")}
          </button>
        </div>
      )}
      <span
        role="status"
        style={visuallyHidden}
        {...languageProps(copied ? langOf("canvasTextCopied") : undefined)}
      >
        {copied ? t("canvasTextCopied") : ""}
      </span>
    </div>,
    overlaysOf(renderer).container,
  );
}

/** Pieces side by side in one language as one, a space between, in order. */
function byLanguage(pieces: SelectedPiece[]): SelectedPiece[] {
  const runs: SelectedPiece[] = [];
  for (const piece of pieces) {
    const last = runs[runs.length - 1];
    if (last && last.lang === piece.lang) last.text += ` ${piece.text}`;
    else runs.push({ ...piece });
  }
  return runs;
}
