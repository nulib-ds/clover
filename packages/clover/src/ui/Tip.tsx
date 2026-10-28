import React, { useEffect, useRef } from "react";

import { useCloverTranslation } from "../i18n/useCloverTranslation";

/**
 * A key a control answers to: as `aria-keyshortcuts` names it (WAI-ARIA key names, `Plus`
 * and `Space` spelled out, alternatives space-separated), and as its popover shows it.
 */
export interface Shortcut {
  keys: string;
  glyph: string;
}

/**
 * The keys the Canvas answers to, by control. A Canvas takes them while it, or any of its
 * own controls, has focus (`forwardShortcut`). Name a key here only once the
 * Canvas handles it: a popover that names a key that does nothing misleads.
 */
export const SHORTCUTS = {
  zoomIn: { keys: "Plus", glyph: "+" },
  zoomOut: { keys: "-", glyph: "−" },
  reset: { keys: "0", glyph: "0" },
  rotateRight: { keys: "R", glyph: "R" },
  rotateLeft: { keys: "Shift+R", glyph: "⇧R" },
  play: { keys: "K Space", glyph: "K" },
  mute: { keys: "M", glyph: "M" },
} satisfies Record<string, Shortcut>;

/** The characters those shortcuts are typed with, as `KeyboardEvent.key` reports them. */
export const SHORTCUT_KEYS = new Set([
  "+",
  "=",
  "-",
  "_",
  "0",
  "r",
  "R",
  "k",
  "K",
  "m",
  "M",
  "j",
  "J",
  "l",
  "L",
]);

/**
 * The popover a control shows on hover and on keyboard focus: its name, the same string
 * its `aria-label` gives assistive technology (WCAG 2.5.3, Label in Name), and its key
 * when it has one. Put it inside the control, last; the control carries the name and
 * `aria-keyshortcuts`, so the popover itself is hidden from assistive technology.
 *
 * WCAG 1.4.13 (Content on Hover or Focus): it shows on focus as well as hover; Escape
 * hides it without moving the pointer or focus; the pointer can move onto it without it
 * closing; and it stays until the pointer or focus leaves. Styles are `ui/Tip.css`.
 */
export function Tip({
  label,
  lang,
  shortcut,
  scrolls = false,
  image,
  lead,
  after,
}: {
  label: string;
  /** The language of `label`, where it is not its control's. */
  lang?: string;
  shortcut?: Shortcut;
  /**
   * It may run longer than the room it is kept in (a hotspot's note, kept inside the
   * Body): capped there, it scrolls (`scrollNote` in `Canvas/Annotations.tsx`). It never takes focus, which a scroller
   * might, hidden as it is from assistive technology: a press on it focuses its control.
   */
  scrolls?: boolean;
  /**
   * A picture above the words (a hotspot's image, Cookbook 0377): fetched only once it
   * shows, and named by them, as the control is.
   */
  image?: string;
  /**
   * A line over the words, set apart from them: the time under the pointer, over a
   * chapter's title in the seek bar's popover (`ui/Tip.css`). Shown only: its control
   * says it for assistive technology.
   */
  lead?: string;
  /**
   * A figure after the words, smaller, as the step through a list sets its place (a
   * Range's region's "1 / 4", `ui/Steps.css`). Shown only: its control says it for
   * assistive technology.
   */
  after?: React.ReactNode;
}) {
  const { t } = useCloverTranslation();
  const ref = useRef<HTMLSpanElement>(null);
  const text = shortcut
    ? t("controlShortcut", { label, shortcut: shortcut.glyph })
    : label;
  useTips();
  // Its words change while it shows (Play, then Pause): measured again.
  useEffect(() => {
    const tip = ref.current;
    if (tip && isShown(tip)) keepInside(tip);
  }, [text, lead]);
  return (
    <span
      ref={ref}
      className="clover-tip"
      aria-hidden="true"
      lang={lang}
      {...(scrolls && {
        tabIndex: -1,
        onMouseDown: (event: React.MouseEvent<HTMLSpanElement>) => {
          event.preventDefault();
          event.currentTarget.parentElement?.focus({ preventScroll: true });
        },
      })}
    >
      {image && (
        <img
          className="clover-tip-image"
          src={image}
          alt=""
          loading="lazy"
          // Its size known only now: kept inside again, as a change of words is.
          onLoad={() => {
            const tip = ref.current;
            if (tip && isShown(tip)) keepInside(tip);
          }}
        />
      )}
      {lead && <span className="clover-tip-lead">{lead}</span>}
      {text}
      {after != null && after !== false && (
        <span className="clover-tip-after">{after}</span>
      )}
    </span>
  );
}

/*
 * A popover is placed by its family (`ui/Tip.css`), and then kept inside what clips it:
 * the Body, a scrolling panel, the window. Each time it shows (the pointer comes to its
 * control, or focus does), it is measured as it is then, after any zoom, text spacing or
 * longer language, and wraps to the room there is and moves in from the edge, `xs` clear
 * (WCAG 1.4.10, 1.4.12).
 */
function placeTip(event: Event) {
  const control = event.target instanceof Element && controlOf(event.target);
  const tip = control && tipOf(control);
  if (tip) keepInside(tip);
}

/** A control's popover, if it has one. */
function tipOf(control: Element) {
  return Array.from(control.children).find((child) =>
    child.classList.contains("clover-tip"),
  ) as HTMLElement | undefined;
}

/**
 * The control whose popover an element shows: the element itself, or, for an input, what
 * holds it and the popover while focus is on the input: a radio's or a checkbox's label,
 * or the seek bar's area, whose popover names the chapter (`Transport.tsx`).
 */
function controlOf(element: Element): Element {
  const holder = element.matches("input") ? element.parentElement : null;
  return holder && tipOf(holder) ? holder : element;
}

function isShown(tip: HTMLElement) {
  try {
    return Boolean(
      tip.parentElement?.matches(
        ":hover, :focus-visible, :has(> input:focus-visible)",
      ),
    );
  } catch {
    return false;
  }
}

/** Wraps the popover to the room there is, then moves it inward from the edge it passes. */
function keepInside(tip: HTMLElement) {
  const control = tip.parentElement;
  if (!control) return;
  tip.style.removeProperty("--clover-tip-room");
  tip.style.removeProperty("--clover-tip-shift");
  const bounds = clipOf(control);
  // Kept clear of the edge by its own inline padding, `xs`.
  const clear = parseFloat(getComputedStyle(tip).paddingLeft) || 0;
  const start = bounds.left + clear;
  const end = bounds.right - clear;
  const own = control.getBoundingClientRect();
  let box = tip.getBoundingClientRect();
  // Beside its control (the cluster as a column), it has only the room on its own side.
  const room =
    box.right <= own.left
      ? box.right - start
      : box.left >= own.right
        ? end - box.left
        : end - start;
  if (box.width > room) {
    tip.style.setProperty("--clover-tip-room", `${Math.max(room, 0)}px`);
    box = tip.getBoundingClientRect();
  }
  const shift =
    box.left < start ? start - box.left : box.right > end ? end - box.right : 0;
  if (shift) tip.style.setProperty("--clover-tip-shift", `${shift}px`);
}

/**
 * Across, the box that clips an element: every ancestor's that cuts its overflow across,
 * and the window's.
 */
function clipOf(element: HTMLElement) {
  let left = 0;
  let right = document.documentElement.clientWidth || window.innerWidth;
  for (
    let node = element.parentElement;
    node && node !== document.documentElement;
    node = node.parentElement
  ) {
    const { display, overflow, overflowX } = getComputedStyle(node);
    // Overflow cuts only a box's content: not an inline element's, nor one with no box.
    if (display === "inline" || display === "contents") continue;
    // (JSDOM gives only the shorthand.)
    const across = overflowX || overflow;
    if (!across || across === "visible") continue;
    // Its padding box, where overflow is cut.
    const rect = node.getBoundingClientRect();
    left = Math.max(left, rect.left + node.clientLeft);
    right = Math.min(right, rect.left + node.clientLeft + node.clientWidth);
  }
  return { left, right };
}

/*
 * Escape hides the popover of whatever is hovered or focused, until the pointer comes to
 * it again or it loses focus. One listener per document, however many popovers there are.
 *
 * Hidden, the popover takes no pointer, so what it covered is within reach. Taken from
 * under a pointer resting on it, it is the pointer leaving the control: shown again on
 * that, it would come straight back. So it comes back when the pointer next enters, which
 * it can do only through the control's own box.
 */
let listening = 0;

function hideTips(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  const shown = new Set<HTMLElement>();
  document
    .querySelectorAll<HTMLElement>(":hover > .clover-tip")
    .forEach((tip) => tip.parentElement && shown.add(tip.parentElement));
  const focused = document.activeElement;
  const control = focused && (controlOf(focused) as HTMLElement);
  if (control && tipOf(control)) shown.add(control);
  // Back once the pointer comes again, or focus leaves it (or the input in it).
  shown.forEach((control) =>
    hideUntilBack(control, "tipHidden", ["pointerenter", "focusout"]),
  );
}

/**
 * Hide a popover Escape put away (WCAG 1.4.13): `data-<key>` on `element`, until one of
 * `back` happens on it (the pointer coming again, focus leaving or coming afresh).
 */
export function hideUntilBack(
  element: HTMLElement,
  key: string,
  back: string[],
) {
  element.dataset[key] = "";
  const show = () => {
    delete element.dataset[key];
    back.forEach((type) => element.removeEventListener(type, show));
  };
  back.forEach((type) => element.addEventListener(type, show));
}

/**
 * What every popover listens for, once per document: Escape, and the pointer or focus
 * coming to a control. Neither `pointerenter` nor `focus` bubbles, but both pass the
 * document as they capture.
 */
function useTips() {
  useEffect(() => {
    if (listening++ === 0) {
      document.addEventListener("keydown", hideTips, true);
      document.addEventListener("pointerenter", placeTip, true);
      document.addEventListener("focus", placeTip, true);
    }
    return () => {
      if (--listening) return;
      document.removeEventListener("keydown", hideTips, true);
      document.removeEventListener("pointerenter", placeTip, true);
      document.removeEventListener("focus", placeTip, true);
    };
  }, []);
}

/**
 * A Canvas's shortcuts, taken from its own controls too: the keydown is sent on to the
 * viewport, which handles them. A key a focused control uses itself (Space, Enter, the
 * arrows) and anything typed into a field is left alone.
 */
export function forwardShortcut(
  event: React.KeyboardEvent,
  viewport: HTMLElement | null,
) {
  const target = event.target as HTMLElement;
  if (!viewport || target === viewport || viewport.contains(target)) return;
  if (!SHORTCUT_KEYS.has(event.key)) return;
  if (event.altKey || event.metaKey || event.ctrlKey) return;
  if (target.closest("input, select, textarea, [contenteditable]")) return;
  event.preventDefault();
  viewport.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: event.key,
      shiftKey: event.shiftKey,
      bubbles: true,
      cancelable: true,
    }),
  );
}
