import React, { useEffect, useMemo, useState } from "react";

import * as Clover from "../../parts";

/**
 * The view's control, the template's own, over the page's top left (Mat, 2026-11-09:
 * "simply make it absolute in top left"; "just think of document as a consuming app"):
 * among the pages nothing, a picture's page opening from itself, its cursor saying so
 * (Mat, 2026-11-10: "don't show the expand button on hover/focus. just use the cursor"),
 * a keyboard's from its Canvas, whose zoom opens it, and a page that plays from its own
 * play button (`Sheets`; "I'm seeing an invisible small play button up in top left. this
 * should not be here"). In the full viewer, a button back to the scrolling pages, its two
 * arrows pointing at each other across its diagonal, as a player's full screen closes
 * (Mat, 2026-11-13: "let's do a youtube still expand collapse two arrows pointing at or
 * away from eachother diagonallly"), and beside it the pager's steps, Clover's
 * `Previous` and `Next` through the pages, in the book's reading order, with no count,
 * the toolbar's being in sight (Mat, 2026-11-10: "place a pager over here on the left.
 * it should have 3 controls next/prev", "it should indicate back to a scrolling
 * behavior"); one row centered at the foot of a picture's (`Document.css`). The view's
 * own controls are then the Canvas's, at its top end, as in Default ("don't try it
 * different than how we align it in default viewer"). Drawn as Clover's round controls
 * are, in Clover's interface language, each named by its words and its Tip.
 *
 * The button is named "Back to" the resource's label, as the Gallery's lightbox goes back
 * (`shared/Lightbox.tsx`). It, or Escape, closes the full viewer, focus going to what
 * opened it: the page's Canvas, or Play.
 */
export function ViewControls({
  id,
  open,
  onOpenChange,
  pages,
  view,
}: {
  /** The button's id. */
  id: string;
  /** The full viewer open. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether there are pages to step through, for the pager. */
  pages: boolean;
  /** What focus goes back to as the full viewer closes: the page's Canvas, or its Play. */
  view: () => HTMLElement | null | undefined;
}) {
  const t = Clover.useT();
  const langOf = Clover.useLangOf();
  const manifest = Clover.useManifest();
  const title = Clover.useLocalized(
    manifest?.label as Parameters<typeof Clover.useLocalized>[0],
  );
  const rtl = manifest?.viewingDirection === "right-to-left";

  // Closed, focus goes to what opens it again, once it is drawn.
  const close = () => {
    onOpenChange(false);
    requestAnimationFrame(() => view()?.focus());
  };
  if (!open) return null;
  const key = title.text ? "templateBackTo" : "templateBack";
  const label = t(key, { label: title.text });
  return (
    <div
      className="clover-template-document-view"
      data-open
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        close();
      }}
    >
      <button
        id={id}
        type="button"
        className="clover-canvas-button"
        lang={langOf(key)}
        onClick={close}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          width="16"
          height="16"
          viewBox="0 0 512 512"
          fill="currentColor"
          stroke="currentColor"
        >
          {/* Two arrows pointing in: the pages, out of the full viewer, as full screen's way out. */}
          <Clover.ExitFullScreenGlyph />
        </svg>
        <span style={Clover.visuallyHidden}>{label}</span>
        <Clover.Tip label={label} lang={langOf(key)} />
      </button>
      {pages &&
        (rtl
          ? [
              <StepPreview key="next" step="next" />,
              <StepPreview key="previous" step="previous" />,
            ]
          : [
              <StepPreview key="previous" step="previous" />,
              <StepPreview key="next" step="next" />,
            ])}
    </div>
  );
}

/*
 * Back to pages is Exit full screen's glyph, two arrows on the diagonal in from its
 * corners (`Clover.ExitFullScreenGlyph`; Mat, 2026-11-22: "make back to pages and exit
 * full screen the same. use back to pages."). Its own two arrows came first (Mat,
 * 2026-11-11: "something more bold and obvious", a thin arrow before), Regular since
 * 2026-11-21 (Mat: "this feels too bold compared to others", then "Match full screen").
 */

/** The pictures' height in a step's preview: a page about Items' own size. */
const PREVIEW_SIZE = 160;

/**
 * Clover's `Previous` or `Next`, and over it, under the pointer or focused, a small
 * picture of the view it goes to, its pages side by side, each page's label a Tip over
 * its picture under the pointer,
 * drawn as the Inset is (Mat, 2026-11-16: "have prev/next show little image popovers
 * styled like the inset when focused/hovered"): Clover's ground, `xs` round, one radius
 * and one shadow (`Document.css`). It takes the step's Tip's place, saying where the step
 * goes, and is the step's name for nobody else: the button keeps its own (WCAG 2.5.3), so
 * the preview is hidden from assistive technology. Its pictures load the first time it is
 * pointed at or focused. Hoverable, the pointer crossing onto it, and dismissed by Escape
 * until the pointer or focus leaves (1.4.13). None at either end, where the step has
 * nowhere to go.
 */
function StepPreview({ step }: { step: "previous" | "next" }) {
  const sequence = Clover.useSequence();
  const navigation = Clover.useNavigation();
  const [armed, setArmed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const target = navigation.position + (step === "next" ? 1 : -1);
  const view = sequence.views[target];
  const canvases = useMemo(
    () => (view ?? []).map((index) => sequence.canvases[index]),
    [view, sequence.canvases],
  );
  const shown =
    sequence.direction === "right-to-left" ? [...canvases].reverse() : canvases;
  const Step = step === "next" ? Clover.Next : Clover.Previous;
  useEffect(() => {
    if (!armed || dismissed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [armed, dismissed]);
  const arm = () => {
    setArmed(true);
    setDismissed(false);
  };
  return (
    <span
      className="clover-template-document-step"
      data-preview={view ? "" : undefined}
      data-dismissed={dismissed || undefined}
      onPointerEnter={arm}
      onFocus={arm}
      onPointerLeave={() => setDismissed(false)}
      onBlur={() => setDismissed(false)}
    >
      <Step />
      {view && (
        <span
          className="clover-template-document-step-preview"
          aria-hidden="true"
        >
          <span className="clover-template-document-step-pages">
            {shown.map((canvas) => (
              <span
                key={canvas.id}
                className="clover-template-document-step-page"
              >
                <PreviewPage canvas={canvas} load={armed} />
                <PageLabel canvas={canvas} />
              </span>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}

type Container = ReturnType<typeof Clover.useSequence>["canvases"][number];

/** A page's picture, Items' thumbnail of it, once asked for, at its own shape. */
function PreviewPage({ canvas, load }: { canvas: Container; load: boolean }) {
  const { clover } = Clover.useClover("Document");
  const source = useMemo(
    () => Clover.thumbnailSource(canvas) ?? Clover.stillSource(canvas),
    [canvas],
  );
  const [src, setSrc] = useState<string | undefined>(source?.src);
  useEffect(() => {
    if (!load || !source || src) return;
    let current = true;
    void Clover.resolveThumbnail(source, PREVIEW_SIZE, clover.request).then(
      (url) => current && setSrc(url),
    );
    return () => {
      current = false;
    };
  }, [load, source, src, clover]);
  const { width, height } = canvas as { width?: number; height?: number };
  const style =
    width && height ? { aspectRatio: `${width} / ${height}` } : undefined;
  return src ? (
    <img alt="" decoding="async" src={src} style={style} />
  ) : (
    <span className="clover-template-document-step-blank" style={style} />
  );
}

/**
 * A page's label, in the language it is read in, as a Tip over its picture, shown as the
 * pointer rests on it (Mat, 2026-11-16: "don't show labels on insets. allow a user to
 * hover over the thumb to see it if they'd like").
 */
function PageLabel({ canvas }: { canvas: Container }) {
  const label = Clover.useLocalized(
    (canvas as { label?: unknown }).label as Parameters<
      typeof Clover.useLocalized
    >[0],
  );
  return label.text ? (
    <Clover.Tip label={label.text} lang={label.lang || undefined} />
  ) : null;
}
