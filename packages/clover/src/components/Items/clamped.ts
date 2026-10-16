/**
 * Titles that a line clamp cuts short, under a carousel's or grid's pictures (`Items.css`).
 * A title cut short shows in full while its item is hovered or focused (WCAG 1.4.12), so
 * each label is watched here and told when it is cut and when it is not.
 *
 * One watcher for every title on the page, however many carousels there are: a title is
 * measured when its box is resized, and every title again, a frame later, when the page's
 * styles or fonts change. A reader's text spacing, or a web font arriving, can lengthen a
 * title whose clamped box stays the same size.
 *
 * Escape hides a full title that shows, without moving the pointer or focus, until the
 * pointer comes back to its item or focus leaves it (WCAG 1.4.13), as a Tip does. It takes
 * that Escape, so the same press does not close what is around the item too.
 */

type Change = (cut: boolean) => void;

const ITEM = '.clover-items-item[role="option"], .clover-items-link';

const watched = new Map<HTMLElement, { change: Change; cut?: boolean }>();
let resized: ResizeObserver | null = null;
let styled: MutationObserver | null = null;
let frame = 0;

function measure(text: HTMLElement) {
  const entry = watched.get(text);
  if (!entry) return;
  const cut = text.scrollHeight > text.clientHeight + 1;
  if (cut === entry.cut) return;
  entry.cut = cut;
  entry.change(cut);
}

function measureAll() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() =>
    watched.forEach((_, text) => measure(text)),
  );
}

/** Escape over or in an item whose full title shows: hidden until the reader comes back. */
function hideFull(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  const items = new Set<HTMLElement>();
  const focused = (document.activeElement as HTMLElement | null)?.closest?.(
    ITEM,
  ) as HTMLElement | null;
  if (focused) items.add(focused);
  try {
    document
      .querySelectorAll<HTMLElement>(`:is(${ITEM}):hover`)
      .forEach((item) => items.add(item));
  } catch {
    // An engine without `:hover` in `querySelectorAll` has no pointer to rest anywhere.
  }
  const shown = [...items].filter(
    (item) =>
      item.dataset.fullHidden === undefined &&
      item.querySelector(".clover-items-label-full"),
  );
  if (!shown.length) return;
  event.preventDefault();
  event.stopPropagation();
  shown.forEach((item) => {
    item.dataset.fullHidden = "";
    // Back when the pointer comes again; and when focus leaves, or, for an item hidden
    // from under the pointer only, when focus comes to it afresh.
    const back = ["pointerenter", item === focused ? "blur" : "focus"];
    const show = () => {
      delete item.dataset.fullHidden;
      back.forEach((type) => item.removeEventListener(type, show));
    };
    back.forEach((type) => item.addEventListener(type, show));
  });
}

function start() {
  resized =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) =>
          entries.forEach((entry) => measure(entry.target as HTMLElement)),
        );
  styled =
    typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(measureAll);
  styled?.observe(document.head, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  styled?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style", "class"],
  });
  document.fonts?.addEventListener?.("loadingdone", measureAll);
  document.addEventListener("keydown", hideFull, true);
}

function stop() {
  cancelAnimationFrame(frame);
  resized?.disconnect?.();
  styled?.disconnect();
  resized = styled = null;
  document.fonts?.removeEventListener?.("loadingdone", measureAll);
  document.removeEventListener("keydown", hideFull, true);
}

/**
 * Watch a title's clamped box; `change` hears whether it is cut short, now and whenever
 * that changes. Returns the way to stop.
 */
export function watchClamp(text: HTMLElement, change: Change): () => void {
  if (!watched.size) start();
  watched.set(text, { change });
  resized?.observe?.(text);
  measure(text);
  return () => {
    watched.delete(text);
    resized?.unobserve?.(text);
    if (!watched.size) stop();
  };
}
