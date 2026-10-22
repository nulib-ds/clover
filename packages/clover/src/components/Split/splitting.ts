/*
 * The Split's logic, apart from React: lengths, the sizes remembered, the panes beside a
 * handle and the limits between them, a click's steps, the keys, and a press that is a
 * click or a drag. `SplitHandle` and `<clover-split-handle>` both run it, so the two
 * behave as one.
 */

/** A length: pixels as a number, or a CSS length in `px`, `rem` or `%` of the split. */
export type SplitLength = number | string;

/** What a pane asks for: its width to start with, and its limits. */
export interface PaneSpec {
  min?: SplitLength;
  max?: SplitLength;
  size?: SplitLength;
}

/** How far an arrow key moves the handle; four times that with Shift. */
const KEY_STEP_REM = 1;

/** How far a press may wander, in pixels, and still be a click: a finger wanders more. */
const CLICK_SLOP_PX = 4;
const TAP_SLOP_PX = 8;

/**
 * How long after a click, and how near it (in slops), a second press is taken for the
 * other half of a double click.
 */
const DOUBLE_CLICK_MS = 500;
const DOUBLE_CLICK_SLOPS = 4;

/** What a double click's second half sends, from the press to the click. */
const PRESS_EVENTS = [
  "pointerdown",
  "mousedown",
  "pointerup",
  "mouseup",
  "click",
  "dblclick",
];

export const rootFontSize = () =>
  typeof document === "undefined"
    ? 16
    : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

/** A length in pixels, against the split's own width for `%`. */
export function toPixels(
  length: SplitLength | undefined,
  across: number,
): number | undefined {
  if (length === undefined) return undefined;
  if (typeof length === "number") return length;
  const value = parseFloat(length);
  if (Number.isNaN(value)) return undefined;
  if (length.endsWith("rem")) return value * rootFontSize();
  if (length.endsWith("%")) return (value / 100) * across;
  return value;
}

/** A length as CSS: a number is pixels. */
export const cssLength = (length: SplitLength | undefined) =>
  typeof length === "number" ? `${length}px` : length;

/** The sizes remembered under a key, by pane. */
export const readSizes = (storageKey?: string): Record<string, number> => {
  if (!storageKey || typeof localStorage === "undefined") return {};
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
};

/** Remember the sizes under a key, for the same layout next time. */
export const writeSizes = (
  storageKey: string | undefined,
  sizes: Record<string, number>,
) => {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(sizes));
  } catch {
    // Storage refused (a private window): the size holds for this visit only.
  }
};

/** A split's panes, its own children marked as panes, in order. */
export const paneElements = (split: HTMLElement | null | undefined) =>
  split
    ? (Array.from(split.children).filter((node) =>
        node.classList.contains("clover-split-pane"),
      ) as HTMLElement[])
    : [];

/** The panes either side of a handle, and which of them it sizes. */
export function neighbors(handle: HTMLElement) {
  const sibling = (step: "previousElementSibling" | "nextElementSibling") => {
    let node = handle[step];
    while (node && !node.classList.contains("clover-split-pane")) {
      node = node[step];
    }
    return node as HTMLElement | null;
  };
  const before = sibling("previousElementSibling");
  const after = sibling("nextElementSibling");
  const sized = after?.hasAttribute("data-sized")
    ? after
    : before?.hasAttribute("data-sized")
      ? before
      : null;
  const other = sized === after ? before : after;
  return { sized, other };
}

/** The pane a handle sizes, and its limits in pixels. */
export interface Limits {
  sized: HTMLElement;
  /** The pane's key, its size remembered under it. */
  key: string;
  min: number;
  max: number;
  /** Whether the sized pane is after the bar (to its right, or its left in RTL). */
  after: boolean;
}

/** The sized pane's limits, in pixels, given the room the split has. */
export function limitsOf(
  handle: HTMLElement,
  container: HTMLElement,
  specs: Record<string, PaneSpec>,
): Limits | null {
  const { sized, other } = neighbors(handle);
  if (!sized) return null;
  const across = container.clientWidth;
  const key = sized.dataset.splitKey ?? "";
  const spec = specs[key] ?? {};
  const otherSpec = specs[other?.dataset.splitKey ?? ""] ?? {};
  const min = toPixels(spec.min, across) ?? 0;
  /*
   * The room is what the two panes either side share, less the other's minimum. The
   * split's other panes and bars keep theirs: past that, the layout would squeeze them,
   * and the pane would never reach the width it was given.
   */
  const shared =
    sized.getBoundingClientRect().width +
    (other?.getBoundingClientRect().width ?? 0);
  const room = shared - (toPixels(otherSpec.min, across) ?? 0);
  const max = Math.max(min, Math.min(toPixels(spec.max, across) ?? room, room));
  const after =
    sized.getBoundingClientRect().left >=
    handle.getBoundingClientRect().left - 1;
  return { sized, key, min, max, after };
}

/**
 * A click's step: on to the next of the pane's narrowest, own and widest sizes. From the
 * width it was given (the reader's, or its own), not the one it has: a narrow layout may
 * squeeze it below either, and measured, it would be given the same width again and never
 * move on. `own` is true where the step is to its own size, which forgets the reader's.
 */
export function nextStop(
  found: Limits,
  own: number | undefined,
  given: number | undefined,
): { to: number; own: boolean } {
  const stops =
    own !== undefined && own > found.min + 1 && own < found.max - 1
      ? [found.min, own, found.max]
      : [found.min, found.max];
  const now = given ?? own ?? found.sized.getBoundingClientRect().width;
  const to = stops.find((stop) => stop > now + 1) ?? stops[0];
  return { to, own: own !== undefined && Math.abs(to - own) <= 1 };
}

/** Where a key moves the sized pane to, or `undefined` for a key the handle leaves alone. */
export function keyTarget(
  event: { key: string; shiftKey: boolean },
  found: Limits,
): number | undefined {
  const now = found.sized.getBoundingClientRect().width;
  const by = KEY_STEP_REM * rootFontSize() * (event.shiftKey ? 4 : 1);
  // Toward the sized pane shrinks it: which arrow that is depends on its side.
  const grow = found.after ? "ArrowLeft" : "ArrowRight";
  const shrink = found.after ? "ArrowRight" : "ArrowLeft";
  if (event.key === grow) return now + by;
  if (event.key === shrink) return now - by;
  if (event.key === "Home") return found.min;
  if (event.key === "End") return found.max;
  return undefined;
}

/** What a handle does with what the reader does to it. */
export interface HandleActions {
  limits(): Limits | null;
  resize(px: number): void;
  /** A click's step (`nextStop`). */
  step(): void;
}

/** What a handle reads of a pointer's event: React's or the browser's. */
interface PressEvent {
  type: string;
  button: number;
  clientX: number;
  clientY: number;
  pointerId: number;
  pointerType: string;
  defaultPrevented: boolean;
  preventDefault(): void;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
}

/**
 * The popover hangs over the next pane and takes the pointer (WCAG 1.4.13): a press on
 * it, reaching for what it covers, neither steps nor drags the bar.
 */
function onTip(event: {
  target: EventTarget | null;
  currentTarget: EventTarget | null;
}) {
  const tip = (event.target as Element | null)?.closest?.(".clover-tip");
  return Boolean(tip && (event.currentTarget as Element | null)?.contains(tip));
}

/** What a handle answers: a pointer's press, move and release, a click, a key. */
export interface HandleGestures {
  down(event: PressEvent): void;
  move(event: PressEvent): void;
  /** The press let go, or lost. */
  up(event: PressEvent): void;
  click(
    event: Pick<PressEvent, "defaultPrevented" | "target" | "currentTarget">,
  ): void;
  key(event: {
    key: string;
    shiftKey: boolean;
    defaultPrevented: boolean;
    preventDefault(): void;
  }): void;
  /** Let go of what it holds, as the handle goes. */
  dispose(): void;
}

/**
 * A handle's presses, clicks and keys. A press turns into a drag past its slop, and the
 * click that ends a drag does not step; a click steps, and holds off the second half of a
 * double click; the keys move it. Its state is closed over, not kept on an object, so
 * what every page with a Split loads stays as small as it was inside `SplitHandle`.
 */
export function handleGestures(
  bar: () => HTMLElement | null,
  actions: () => HandleActions,
): HandleGestures {
  /** The press under way: where it began, the pane's width then, if it is a drag. */
  let press: {
    found: Limits;
    x: number;
    from: number;
    slop: number;
    moved: boolean;
  } | null = null;
  /** Whether the last press was a drag, so the click that ends it does not step too. */
  let dragged = false;
  /** Where the last press that stayed put was let go: a click by a pointer. */
  let clicked: { x: number; y: number; reach: number } | null = null;
  let guard: (() => void) | null = null;

  /*
   * A click's step moves the bar out from under the pointer, so the second click of a
   * double click (a habit with split views, and a slip of an unsteady hand) would land on
   * what the step uncovered: a thumbnail, a link, the Canvas. Until a double click's time
   * has passed, or the pointer has moved away, a press near where the bar was goes
   * nowhere. On the bar itself, it is a click of its own.
   */
  const holdOff = (at: { x: number; y: number; reach: number }) => {
    guard?.();
    const handle = bar();
    const win = handle?.ownerDocument.defaultView;
    if (!handle || !win) return;
    const far = (event: Event) =>
      Math.hypot(
        (event as MouseEvent).clientX - at.x,
        (event as MouseEvent).clientY - at.y,
      ) > at.reach;
    const stop = () => {
      PRESS_EVENTS.forEach((type) =>
        win.removeEventListener(type, swallow, true),
      );
      win.removeEventListener("pointermove", away, true);
      clearTimeout(timer);
      guard = null;
    };
    const swallow = (event: Event) => {
      if (handle.contains(event.target as Node)) return;
      if (event.type === "pointerdown" && far(event)) return stop();
      event.preventDefault();
      event.stopPropagation();
    };
    const away = (event: Event) => far(event) && stop();
    PRESS_EVENTS.forEach((type) => win.addEventListener(type, swallow, true));
    win.addEventListener("pointermove", away, true);
    const timer = setTimeout(stop, DOUBLE_CLICK_MS);
    guard = stop;
  };

  return {
    down(event) {
      dragged = false;
      clicked = null;
      if (event.defaultPrevented || event.button !== 0 || onTip(event)) return;
      const found = actions().limits();
      if (!found) return;
      event.preventDefault();
      press = {
        found,
        x: event.clientX,
        from: found.sized.getBoundingClientRect().width,
        slop: event.pointerType === "touch" ? TAP_SLOP_PX : CLICK_SLOP_PX,
        moved: false,
      };
      const handle = event.currentTarget as HTMLElement;
      handle.dataset.dragging = "";
      handle.setPointerCapture?.(event.pointerId);
    },
    move(event) {
      const held = press;
      if (!held) return;
      const moved = event.clientX - held.x;
      // Within the slop it is still a click. Past it, a drag to the end: the bar follows
      // the pointer from where it was taken, toward the pane to narrow it.
      if (!held.moved && Math.abs(moved) < held.slop) return;
      held.moved = true;
      actions().resize(held.from + (held.found.after ? -moved : moved));
    },
    up(event) {
      const held = press;
      dragged = held?.moved ?? false;
      clicked =
        held && !held.moved && event.type === "pointerup"
          ? {
              x: event.clientX,
              y: event.clientY,
              reach: held.slop * DOUBLE_CLICK_SLOPS,
            }
          : null;
      press = null;
      delete (event.currentTarget as HTMLElement).dataset.dragging;
    },
    click(event) {
      const drag = dragged;
      const at = clicked;
      dragged = false;
      clicked = null;
      if (event.defaultPrevented || drag || onTip(event)) return;
      actions().step();
      if (at) holdOff(at);
    },
    key(event) {
      if (event.defaultPrevented) return;
      const found = actions().limits();
      if (!found) return;
      const to = keyTarget(event, found);
      if (to === undefined) return;
      actions().resize(to);
      event.preventDefault();
    },
    dispose() {
      guard?.();
    },
  };
}
