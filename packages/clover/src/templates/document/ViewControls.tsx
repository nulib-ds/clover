import React from "react";

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
          {/* Two arrows pointing at each other: the pages, out of the full viewer. */}
          <path {...SHAFT} d={BACK_SHAFTS} />
          <path {...HEAD} d={BACK_HEADS} />
        </svg>
        <span style={Clover.visuallyHidden}>{label}</span>
        <Clover.Tip label={label} lang={langOf(key)} />
      </button>
      {pages &&
        (rtl
          ? [<Clover.Next key="next" />, <Clover.Previous key="previous" />]
          : [<Clover.Previous key="previous" />, <Clover.Next key="next" />])}
    </div>
  );
}

/*
 * Two arrows on the diagonal, from its corners in to its middle, bold as the arrow before
 * them was (Mat, 2026-11-11: "something more bold and obvious"): each a heavy shaft,
 * rounded at its tail, into a solid head, its corners rounded as Clover's glyphs' joins
 * are, the two heads clear of each other. The Canvas's Full screen and Exit full screen
 * draw four such arrows, one to each corner (`ui/controlGlyphs.tsx`; Mat, 2026-11-13:
 * "use same arrows as expand/collapse for fullscreen", "it should be four arrows. all
 * directions"): keep their arrows alike.
 */
const SHAFT = {
  fill: "none",
  strokeLinecap: "round",
  strokeWidth: 56,
} as const;
const HEAD = { strokeLinejoin: "round", strokeWidth: 40 } as const;
const BACK_SHAFTS = "M440 72L368 144M72 440L144 368";
const BACK_HEADS = "M304 208V80L432 208ZM208 304V432L80 304Z";
