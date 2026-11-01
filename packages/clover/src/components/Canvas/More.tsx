import React, { useLayoutEffect, useRef } from "react";

import Button from "../../ui/Button";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { useContainerName } from "../../i18n/useContainerName";
import { useOneOpen } from "../../ui/useOneOpen";
import { CloseViewer, OpenViewer } from "../Body/glyphs";

/*
 * A Canvas's controls on one row, never wrapped (Mat, 2026-11-01: "I don't like when
 * controls wrap lines … have a (More...) style button"). Where they do not all fit, the
 * view's own (zoom, the turns, reset, full screen) wait behind More, at the row's end,
 * the others before it in their order (Mat, 2026-11-01: "let's not cause other items to
 * lose their ordering"; "put it far right"); pressed, its tray of them runs left from
 * where it was, on one ground, More its close at the tray's end, the others kept in
 * sight (Mat, 2026-11-01: "the more tray popping out shows the zoom/pan
 * controls to be more obviously connect[ed]"; "make it so the other controls are still
 * visible and don't disappear. just expand the controls to the left"). Loaded, with the
 * measuring that says when (`Fits`), as a Canvas draws its controls (`Controls.tsx`), so
 * a Timeline, which draws on `CanvasView` too, never carries any of it; until it arrives,
 * the row holds them all. Styled in `Canvas.css`.
 */

/** Whether controls this wide fit a row `room` wide, every two `gap` apart. */
export function fitsRow(widths: number[], room: number, gap: number) {
  return widths.reduce((sum, width) => sum + width + gap, -gap) <= room;
}

/** Focus `id`, else More, else the first control in sight: one the change took away. */
function refocus(cluster: HTMLElement, id: string, more: string) {
  const page = cluster.ownerDocument;
  const shown = (node: Element | null): node is HTMLElement =>
    node instanceof HTMLElement &&
    cluster.contains(node) &&
    !node.closest("[hidden]");
  const target = [
    page.getElementById(id),
    page.getElementById(more),
    ...Array.from(cluster.querySelectorAll("button")),
  ].find(shown);
  target?.focus();
}

/**
 * Measures whether the controls `ids` all fit on the row of `cluster`, beside the page's
 * own (the panel's toggle, placed in its corner, takes no room in it), as the Body's
 * width changes and as controls come and go, and says so (`onFits`): drawn by
 * `Controls.tsx`, which keeps `fits`, and draws nothing. Each control's width is read
 * while it is laid out and remembered while it is away; one never yet seen is taken to be
 * as wide as the widest that has been.
 *
 * A control the change takes away (behind More, or More itself) hands focus on: to itself
 * where it is drawn again, else to More (WCAG 2.4.3).
 */
export function Fits({
  cluster,
  ids,
  more,
  fits,
  onFits,
}: {
  cluster: HTMLElement;
  ids: string[];
  /** More's id. */
  more: string;
  fits: boolean;
  onFits: (fits: boolean) => void;
}) {
  const shown = useRef(fits);
  shown.current = fits;
  const report = useRef(onFits);
  report.current = onFits;
  const widths = useRef(new Map<string, number>());
  const latest = useRef(ids);
  latest.current = ids;
  const moved = useRef<string | null>(null);
  const key = ids.join(" ");

  useLayoutEffect(() => {
    const page = cluster.ownerDocument;
    const measure = () => {
      const ids = latest.current;
      const style = getComputedStyle(cluster);
      const gap = parseFloat(style.columnGap) || 0;
      let room =
        cluster.clientWidth -
        (parseFloat(style.paddingLeft) || 0) -
        (parseFloat(style.paddingRight) || 0);
      let unit = 0;
      for (const id of ids) {
        const width = page.getElementById(id)?.offsetWidth;
        if (width) widths.current.set(id, width);
        unit = Math.max(unit, widths.current.get(id) ?? 0);
      }
      // The page's own controls keep their places in the row, after the Canvas's.
      for (const child of Array.from(cluster.children)) {
        if (
          !(child instanceof HTMLElement) ||
          ids.includes(child.id) ||
          child.id === more ||
          child.classList.contains("clover-canvas-more") ||
          !child.offsetWidth ||
          getComputedStyle(child).position === "absolute"
        )
          continue;
        room -= child.offsetWidth + gap;
      }
      const next = fitsRow(
        ids.map((id) => widths.current.get(id) ?? unit),
        room,
        gap,
      );
      if (next === shown.current) return;
      const active = page.activeElement;
      moved.current =
        active instanceof HTMLElement && cluster.contains(active)
          ? active.id
          : null;
      shown.current = next;
      report.current(next);
    };
    measure();
    // Its width follows the Body's; a control coming or going changes the room.
    const resize = new ResizeObserver(() => measure());
    resize.observe(cluster);
    const mutation = new MutationObserver(() => measure());
    mutation.observe(cluster, { childList: true });
    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, [cluster, key, more]);

  useLayoutEffect(() => {
    const id = moved.current;
    moved.current = null;
    if (id === null) return;
    const active = cluster.ownerDocument.activeElement;
    if (!active || !cluster.contains(active) || active.closest("[hidden]"))
      refocus(cluster, id, more);
  }, [fits, cluster, more]);

  return null;
}

interface MoreProps {
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
export function More({
  instance,
  open,
  onOpenChange,
  toggle: placeholder,
  children,
}: MoreProps) {
  const { t, langOf } = useCloverTranslation();
  const id = `more-${instance}`;
  const listId = `${id}-list`;
  const listRef = useRef<HTMLDivElement>(null);
  const label = t("canvasMoreControls");
  const name = useContainerName(label, langOf("canvasMoreControls"));
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
    /*
     * How far its controls run past the box at either side: theirs, never what it can
     * scroll, which a control's Tip, hanging past them while it shows, adds to.
     */
    const past = () => {
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
    };
    const mark = () => {
      // Never up or down: only across (`Canvas.css`).
      if (list.scrollTop) list.scrollTop = 0;
      const { left, right } = past();
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
    mark();
    list.addEventListener("scroll", mark, { passive: true });
    list.addEventListener("focusin", reveal);
    // Read again as its controls come to rest, having slid in.
    list.addEventListener("animationend", mark);
    const resize = new ResizeObserver(() => mark());
    resize.observe(list);
    return () => {
      list.removeEventListener("scroll", mark);
      list.removeEventListener("focusin", reveal);
      list.removeEventListener("animationend", mark);
      resize.disconnect();
      delete list.dataset.past;
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
      label={label}
      lang={langOf("canvasMoreControls")}
      expanded={open}
      controls={listId}
      onClick={(event) =>
        toggle(!open, document.activeElement === event.currentTarget)
      }
    >
      {open ? <CloseViewer /> : <OpenViewer />}
    </Button>
  );
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
    </div>
  );
}
