import React, { useLayoutEffect, useRef } from "react";

import Button from "../../ui/Button";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { useContainerName } from "../../i18n/useContainerName";
import { useOneOpen } from "../../ui/useOneOpen";
import { CloseViewer, OpenViewer } from "../Body/glyphs";
import { languageProps } from "../../i18n/direction";
import { Tip, placeTipAgain } from "../../ui/Tip";

/*
 * A Canvas's controls on one row, never wrapped (Mat, 2026-11-01: "I don't like when
 * controls wrap lines … have a (More...) style button"). Where they do not all fit, the
 * view's own (zoom, the turns, reset, full screen) wait behind More, at the row's end,
 * the others before it in their order (Mat, 2026-11-01: "let's not cause other items to
 * lose their ordering"; "put it far right"); pressed, its tray of them runs left from
 * where it was, on one ground, More its close at the tray's end, the others kept in
 * sight (Mat, 2026-11-01: "the more tray popping out shows the zoom/pan
 * controls to be more obviously connect[ed]"; "make it so the other controls are still
 * visible and don't disappear. just expand the controls to the left"). Loaded only where it is needed (`Controls.tsx`): where the row cannot hold them all
 * (`RowFits.tsx` measures it), or always where asked (`collapseControls`); until it
 * arrives, the row holds them all. Named `More` until 2026-11-01. Styled in `Canvas.css`.
 */

interface ImageControlsProps {
  /** The Canvas's instance: More is `more-<instance>`, its tray's controls `-list`. */
  instance: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * A placeholder's toggle in More's place (`PlaceholderToggle`): the tray opens and
   * closes with the view it opens and closes, and has no More, nor Escape, of its own.
   */
  toggle?: React.ReactNode;
  /** The view's controls, waiting behind it. */
  children: React.ReactNode;
}

/**
 * More, at the end of a Canvas's controls, and its tray: open, those controls and then
 * More, drawn as a cross at its end, which closes it, on one ground between them all
 * (Mat, 2026-11-01: "a semi transparent bg between all"; "the close should be on the
 * right"), running left from where More was, the row's other controls kept in sight
 * beside it, as far as the row has room. More stays where it was, far right, its close.
 * More is a disclosure (`aria-expanded`, `aria-controls`): pressed, by Enter or Space
 * too, focus stays on it, and Shift+Tab goes back through its tray; Escape in the tray
 * closes it, focus to More. The tray stays while its controls are pressed and the
 * picture is moved.
 *
 * Opening, it closes the popup open (the information, a menu, the place: the others'), as
 * Clover's popups open one at a time (`useOneOpen`); one opening leaves it be.
 *
 * Its controls run on past a row too narrow for them all (a phone's Body), scrolled
 * across, never wrapped or cut off: faded at an end with more past it (`data-past`).
 */
/*
 * How far a tray's controls run past its box at either side: theirs, never what it can
 * scroll, which a control's Tip, hanging past them while it shows, adds to.
 */
function overhang(list: HTMLElement) {
  const box = list.getBoundingClientRect();
  const ring = parseFloat(getComputedStyle(list).paddingLeft) || 0;
  const first = list.firstElementChild?.getBoundingClientRect();
  const last = list.lastElementChild?.getBoundingClientRect();
  return {
    box,
    ring,
    left: first ? box.left - (first.left - ring) : 0,
    right: last ? last.right + ring - box.right : 0,
  };
}

export function ImageControls({
  instance,
  open,
  onOpenChange,
  toggle: placeholder,
  children,
}: ImageControlsProps) {
  const { t, langOf } = useCloverTranslation();
  const id = `more-${instance}`;
  const listId = `${id}-list`;
  const listRef = useRef<HTMLDivElement>(null);
  /*
   * Named for what it does now (Mat, 2026-11-01: "just say 'Expand viewer controls' and
   * 'Collapse viewer controls'"), as an image's placeholder toggle, which is More, is; its
   * tray, for what is in it.
   */
  const labelKey = open ? "canvasCollapseControls" : "canvasExpandControls";
  const name = useContainerName(
    t("canvasViewerControls"),
    langOf("canvasViewerControls"),
  );
  useOneOpen(open && !placeholder, () => undefined);
  /*
   * Opening, More goes to the tray's end, after its controls, and closing, back before
   * them: the same control moved in the page, which drops its focus, so focus it had
   * comes back to it.
   */
  const refocus = useRef(false);
  const toggle = (value: boolean, focused: boolean) => {
    refocus.current = focused;
    onOpenChange(value);
  };
  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    document.getElementById(id)?.focus();
  }, [open, id]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    const past = () => overhang(list);
    const mark = () => {
      // Never up or down: only across (`Canvas.css`).
      if (list.scrollTop) list.scrollTop = 0;
      const { box, left, right } = past();
      /*
       * Scrolling, never past the controls' ends, into a Tip's room: back to the last.
       * (Not while they slide in as it opens, offset from where they come to rest; nor
       * as a touch screen springs back from past an end, which it takes back itself.)
       */
      const sprung =
        list.scrollLeft < 0 ||
        list.scrollLeft > list.scrollWidth - list.clientWidth;
      if (list.dataset.past && !sprung && right < -0.5 && left > 0.5) {
        list.scrollLeft -= Math.min(-right, left);
        return;
      }
      if (list.dataset.past && !sprung && left < -0.5 && right > 0.5) {
        list.scrollLeft += Math.min(-left, right);
        return;
      }
      const ends = [left > 1 && "left", right > 1 && "right"]
        .filter(Boolean)
        .join(" ");
      if (ends) list.dataset.past = ends;
      else delete list.dataset.past;
      /*
       * A control an end with more past it cuts, under the fade and its arrow, is faded
       * further and takes no press (`data-partial`, `Canvas.css`; Mat, 2026-11-01: "if a
       * button is only partially visible in the dock, then disable it … we don't want
       * accidental clicks"): never `disabled`, which would take it from the keyboard,
       * whose Tab brings it clear (WCAG 2.1.1).
       */
      const fade = parseFloat(getComputedStyle(list).scrollPaddingLeft) || 0;
      for (const control of Array.from(list.children)) {
        const own = control.getBoundingClientRect();
        const cut =
          (left > 1 && own.left < box.left + fade - 0.5) ||
          (right > 1 && own.right > box.right - fade + 0.5);
        if (cut !== control.hasAttribute("data-partial"))
          control.toggleAttribute("data-partial", cut);
      }
    };
    /*
     * A control reached by Tab comes clear of the fade (its `scroll-padding`) where more
     * lies past it, which a browser does not ask of one already in the box: under it,
     * its focus would fade too (WCAG 2.4.7, 2.4.11). Never past the controls' own ends.
     */
    const reveal = (event: FocusEvent) => {
      const control = event.target;
      if (!(control instanceof HTMLElement) || control.parentElement !== list)
        return;
      // It scrolls only while its controls run past it: so it does, before it scrolls.
      mark();
      const { box, ring, left, right } = past();
      const own = control.getBoundingClientRect();
      const fade = parseFloat(getComputedStyle(list).scrollPaddingLeft) || 0;
      const over =
        own.right - (box.right - (control.nextElementSibling ? fade : ring));
      const under =
        box.left + (control.previousElementSibling ? fade : ring) - own.left;
      if (over > 0) list.scrollLeft += Math.min(over, Math.max(right, 0));
      else if (under > 0) list.scrollLeft -= Math.min(under, Math.max(left, 0));
      mark();
    };
    /*
     * The focused control's popover measured itself before the tray scrolled it into
     * sight (here, or the browser's own scroll to focus): placed again as it scrolls.
     */
    const scrolled = () => {
      mark();
      const active = list.ownerDocument.activeElement;
      if (active && list.contains(active)) placeTipAgain(active);
    };
    mark();
    list.addEventListener("scroll", scrolled, { passive: true });
    list.addEventListener("focusin", reveal);
    // Read again as its controls come to rest, having slid in.
    list.addEventListener("animationend", mark);
    const resize = new ResizeObserver(() => mark());
    resize.observe(list);
    return () => {
      list.removeEventListener("scroll", scrolled);
      list.removeEventListener("focusin", reveal);
      list.removeEventListener("animationend", mark);
      resize.disconnect();
      delete list.dataset.past;
      for (const control of Array.from(list.children))
        control.removeAttribute("data-partial");
    };
  }, [open]);

  /*
   * Its glyph is a placeholder's toggle's, the magnifier, + to open and − to close, so
   * More looks the same where a placeholder's toggle is More and where it is not (Mat,
   * 2026-11-01: "make icon always the placeholder toggle"; a picture in a viewfinder, an
   * ellipsis, move arrows and others were tried that day).
   */
  const more = placeholder ? (
    <React.Fragment key="more">{placeholder}</React.Fragment>
  ) : (
    <Button
      key="more"
      id={id}
      label={t(labelKey)}
      lang={langOf(labelKey)}
      expanded={open}
      controls={listId}
      onClick={(event) =>
        toggle(!open, document.activeElement === event.currentTarget)
      }
    >
      {open ? <CloseViewer /> : <OpenViewer />}
    </Button>
  );
  /*
   * The arrows at the tray's ends, shown while controls lie past that end (`Canvas.css`),
   * as the Panel's tabs have them (Mat, 2026-11-01: "bring the next/prev buttons like we
   * have on tabs to the expanded controls deck"; `ui/Sections.tsx`). They page the tray
   * for a pointer, by most of what shows, never past its controls' ends. The keyboard
   * reaches every control already, each brought clear of the fade, so they sit out of the
   * tab order and the accessibility tree, and a press leaves focus where it was.
   */
  const page = (forward: boolean) => {
    const list = listRef.current;
    if (!list) return;
    const { box, left, right } = overhang(list);
    const style = getComputedStyle(list);
    const most = box.width - 2 * (parseFloat(style.scrollPaddingLeft) || 0);
    const rightward = forward !== (style.direction === "rtl");
    list.scrollBy({
      left: rightward ? Math.min(most, right) : -Math.min(most, left),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  const step = (forward: boolean) => {
    const key = forward ? "canvasScrollForward" : "canvasScrollBack";
    return (
      <button
        key={key}
        type="button"
        // A step, drawn as the tabs' are (`ui/Steps.css`), placed at the tray's end.
        className="clover-steps-step clover-canvas-more-step"
        data-step={forward ? "next" : "prev"}
        aria-hidden="true"
        tabIndex={-1}
        {...languageProps(langOf(key))}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => page(forward)}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          width="12"
          height="12"
          viewBox="0 0 16 16"
        >
          <path
            d={forward ? "M6 3l5 5-5 5" : "M10 3L5 8l5 5"}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <Tip label={t(key)} />
      </button>
    );
  };
  const list = (
    <div
      key="list"
      className="clover-canvas-more-list"
      hidden={!open}
      id={listId}
      ref={listRef}
      role="group"
      {...name.props}
    >
      {children}
    </div>
  );

  return (
    <div
      className="clover-canvas-more"
      data-open={open || undefined}
      onKeyDown={(event) => {
        // One Escape closes one thing, and nothing around it (a Lightbox).
        if (placeholder || !open || event.key !== "Escape") return;
        if (event.defaultPrevented) return;
        event.preventDefault();
        toggle(false, true);
      }}
    >
      {/*
        Closed, More alone; open, its tray's controls first, running left from More, the
        close, at its end (Mat, 2026-11-01: "the close should be on
        the right. and the controls should extend[] to [the] left side of things as long
        as there is room"), in reading order either way (WCAG 1.3.2, 2.4.3).
      */}
      {open ? [list, more] : [more, list]}
      {name.node}
      {open && [step(false), step(true)]}
    </div>
  );
}
