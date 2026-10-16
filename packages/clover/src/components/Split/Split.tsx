import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { Tip } from "../../ui/Tip";

/** A length: pixels as a number, or a CSS length in `px`, `rem` or `%` of the split. */
export type SplitLength = number | string;

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

interface PaneSpec {
  min?: SplitLength;
  max?: SplitLength;
  size?: SplitLength;
}

interface SplitContextValue {
  /** Each sized pane's width in pixels, once the reader has moved its handle. */
  sizes: Record<string, number>;
  setSize: (key: string, px: number | undefined) => void;
  /** What each pane asked for, by key, for the handle to clamp against. */
  specs: React.MutableRefObject<Record<string, PaneSpec>>;
  element: React.MutableRefObject<HTMLElement | null>;
}

const SplitContext = createContext<SplitContextValue | null>(null);

const rootFontSize = () =>
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

const cssLength = (length: SplitLength | undefined) =>
  typeof length === "number" ? `${length}px` : length;

const read = (storageKey?: string): Record<string, number> => {
  if (!storageKey || typeof localStorage === "undefined") return {};
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
};

/** Hands `node` to a forwarded ref of either kind. */
function assign<T>(ref: React.ForwardedRef<T>, node: T | null) {
  if (typeof ref === "function") ref(node);
  else if (ref) ref.current = node;
}

export type SplitProps = React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  /**
   * Remember the sizes the reader drags to, in `localStorage` under this key, so the
   * same layout opens at them next time.
   */
  storageKey?: string;
};

/**
 * Panes side by side, divided by handles the reader drags (or moves by keyboard) to share
 * the width between them. One pane beside each handle is given a `size`; the other takes
 * what is left. Not tied to any part: split the stage from the information panel, or
 * anything from anything.
 *
 * ```jsx
 * <Clover.Split>
 *   <Clover.SplitPane min="16rem"><Clover.Content /></Clover.SplitPane>
 *   <Clover.SplitHandle />
 *   <Clover.SplitPane size="24rem" min="14rem"><Clover.InformationPanel /></Clover.SplitPane>
 * </Clover.Split>
 * ```
 *
 * Without the stylesheet the panes still sit side by side (that much is inline); the
 * sizes, the bar and its grip are the stylesheet's.
 */
export const Split = forwardRef<HTMLElement, SplitProps>(function Split(
  { as: Tag = "div", storageKey, className, style, children, ...rest },
  ref,
) {
  const element = useRef<HTMLElement | null>(null);
  const specs = useRef<Record<string, PaneSpec>>({});
  const [sizes, setSizes] = useState<Record<string, number>>({});

  // Stored sizes arrive after the first render, so the server's markup and the first
  // client render agree.
  useEffect(() => setSizes(read(storageKey)), [storageKey]);

  const setSize = useCallback(
    (key: string, px: number | undefined) =>
      setSizes((current) => {
        const next = { ...current };
        if (px === undefined) delete next[key];
        else next[key] = Math.round(px);
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {
            // Storage refused (a private window): the size holds for this visit only.
          }
        }
        return next;
      }),
    [storageKey],
  );

  const value = useMemo(
    () => ({ sizes, setSize, specs, element }),
    [sizes, setSize],
  );

  return (
    <SplitContext.Provider value={value}>
      <Tag
        ref={(node: HTMLElement | null) => {
          element.current = node;
          assign(ref, node);
        }}
        className={["clover-split", className].filter(Boolean).join(" ")}
        style={{ display: "flex", ...style }}
        {...rest}
      >
        {children}
      </Tag>
    </SplitContext.Provider>
  );
});

export type SplitPaneProps = React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  /** Its width to start with. A pane without one takes the width that is left. */
  size?: SplitLength;
  /** The narrowest it may be, beside the others and under a handle. */
  min?: SplitLength;
  /** The widest a handle may make it. */
  max?: SplitLength;
  /**
   * The name its size is remembered under (with the Split's `storageKey`). Default: its
   * place among the Split's panes.
   */
  name?: string;
};

/** One side of a `Split`. */
export const SplitPane = forwardRef<HTMLElement, SplitPaneProps>(
  function SplitPane(
    {
      as: Tag = "div",
      size,
      min,
      max,
      name,
      className,
      style,
      children,
      ...rest
    },
    ref,
  ) {
    const split = useContext(SplitContext);
    const self = useRef<HTMLElement | null>(null);
    const [key, setKey] = useState(name ?? "");

    // Its key: the given name, or its place among the panes (known once it is placed).
    useEffect(() => {
      if (name) return setKey(name);
      const panes = paneElements(split?.element.current);
      setKey(String(panes.indexOf(self.current as HTMLElement)));
    }, [name, split]);

    if (split && key) split.specs.current[key] = { min, max, size };
    const dragged = split && key ? split.sizes[key] : undefined;

    return (
      <Tag
        ref={(node: HTMLElement | null) => {
          self.current = node;
          assign(ref, node);
        }}
        className={["clover-split-pane", className].filter(Boolean).join(" ")}
        data-split-key={key || undefined}
        data-sized={size !== undefined ? "" : undefined}
        style={
          {
            /*
             * Its minimum holds in the layout as well as while dragging: inline, so it
             * holds without the stylesheet, and 0 without one, so a pane can shrink past
             * its content. Beside a sized pane, it is the sized pane that gives way.
             */
            minWidth: cssLength(min) ?? 0,
            "--clover-split-size":
              dragged !== undefined ? `${dragged}px` : cssLength(size),
            "--clover-split-max": cssLength(max),
            ...style,
          } as React.CSSProperties
        }
        {...rest}
      >
        {children}
      </Tag>
    );
  },
);

const paneElements = (split: HTMLElement | null | undefined) =>
  split
    ? (Array.from(split.children).filter((node) =>
        node.classList.contains("clover-split-pane"),
      ) as HTMLElement[])
    : [];

/** The panes either side of a handle, and which of them it sizes. */
function neighbours(handle: HTMLElement) {
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

export type SplitHandleProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * The bar between two panes, with a grip at its middle. Drag it. Or click or tap it: each
 * click steps the pane on to its next width, from its narrowest to its own size to its
 * widest and round again, so one pointer resizes it without a drag (WCAG 2.5.7). A double
 * click steps it once. Or focus it and use the arrow keys (Shift for bigger steps, Home
 * and End for the limits). It is a focusable `separator` carrying the sized pane's share
 * of the width, and names itself in a popover on hover and focus.
 */
export const SplitHandle = forwardRef<HTMLDivElement, SplitHandleProps>(
  function SplitHandle(
    { className, children, onPointerDown, onClick, onKeyDown, ...rest },
    ref,
  ) {
    const split = useContext(SplitContext);
    const { t, langOf } = useCloverTranslation();
    const self = useRef<HTMLDivElement | null>(null);
    const [value, setValue] = useState<{
      now: number;
      min: number;
      max: number;
    }>();

    /** The sized pane's limits, in pixels, given the room the split has. */
    const limits = useCallback(() => {
      const handle = self.current;
      const container = split?.element.current;
      if (!handle || !container || !split) return null;
      const { sized, other } = neighbours(handle);
      if (!sized) return null;
      const across = container.clientWidth;
      const key = sized.dataset.splitKey ?? "";
      const spec = split.specs.current[key] ?? {};
      const otherSpec =
        split.specs.current[other?.dataset.splitKey ?? ""] ?? {};
      const min = toPixels(spec.min, across) ?? 0;
      /*
       * The room is what the two panes either side share, less the other's minimum. The
       * split's other panes and bars keep theirs: past that, the layout would squeeze
       * them, and the pane would never reach the width it was given.
       */
      const shared =
        sized.getBoundingClientRect().width +
        (other?.getBoundingClientRect().width ?? 0);
      const room = shared - (toPixels(otherSpec.min, across) ?? 0);
      const max = Math.max(
        min,
        Math.min(toPixels(spec.max, across) ?? room, room),
      );
      // Whether the sized pane is after the bar (to its right, or its left in RTL).
      const after =
        sized.getBoundingClientRect().left >=
        handle.getBoundingClientRect().left - 1;
      return { sized, key, min, max, after };
    }, [split]);

    const resize = useCallback(
      (px: number) => {
        const found = limits();
        if (!found || !split) return;
        const clamped = Math.min(found.max, Math.max(found.min, px));
        split.setSize(found.key, clamped);
        setValue({ now: clamped, min: found.min, max: found.max });
      },
      [limits, split],
    );

    // The separator's value, for assistive technology: refreshed as the split resizes.
    const update = useCallback(() => {
      const found = limits();
      if (found)
        setValue({
          now: found.sized.getBoundingClientRect().width,
          min: found.min,
          max: found.max,
        });
    }, [limits]);
    useEffect(() => {
      const container = split?.element.current;
      update();
      if (!container || typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(update);
      observer.observe(container);
      return () => observer.disconnect();
    }, [update, split, split?.sizes]);

    const percent = (px: number) =>
      Math.round((px / (split?.element.current?.clientWidth || 1)) * 100);

    /** A click's step: on to the next of the pane's narrowest, own and widest sizes. */
    const step = () => {
      const found = limits();
      if (!found || !split) return;
      const across = split.element.current?.clientWidth ?? 0;
      const own = toPixels(split.specs.current[found.key]?.size, across);
      const stops =
        own !== undefined && own > found.min + 1 && own < found.max - 1
          ? [found.min, own, found.max]
          : [found.min, found.max];
      /*
       * From the width it was given (the reader's, or its own), not the one it has: a
       * narrow layout may squeeze it below either, and measured, it would be given the
       * same width again and never move on.
       */
      const now =
        split.sizes[found.key] ??
        own ??
        found.sized.getBoundingClientRect().width;
      const next = stops.find((stop) => stop > now + 1) ?? stops[0];
      if (own === undefined || Math.abs(next - own) > 1) return resize(next);
      // Its own size: the reader's is forgotten, so the pane takes its `size` again.
      split.setSize(found.key, undefined);
      setValue({ now: own, min: found.min, max: found.max });
    };

    /*
     * A click's step moves the bar out from under the pointer, so the second click of a
     * double click (a habit with split views, and a slip of an unsteady hand) would land
     * on what the step uncovered: a thumbnail, a link, the Canvas. Until a double click's
     * time has passed, or the pointer has moved away, a press near where the bar was
     * goes nowhere. On the bar itself, it is a click of its own.
     */
    const guard = useRef<(() => void) | null>(null);
    useEffect(() => () => guard.current?.(), []);
    const holdOff = (at: { x: number; y: number; reach: number }) => {
      guard.current?.();
      const bar = self.current;
      const win = bar?.ownerDocument.defaultView;
      if (!bar || !win) return;
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
        guard.current = null;
      };
      const swallow = (event: Event) => {
        if (bar.contains(event.target as Node)) return;
        if (event.type === "pointerdown" && far(event)) return stop();
        event.preventDefault();
        event.stopPropagation();
      };
      const away = (event: Event) => far(event) && stop();
      PRESS_EVENTS.forEach((type) => win.addEventListener(type, swallow, true));
      win.addEventListener("pointermove", away, true);
      const timer = setTimeout(stop, DOUBLE_CLICK_MS);
      guard.current = stop;
    };

    /** The press under way: where it began, the pane's width then, if it is a drag. */
    const press = useRef<{
      found: NonNullable<ReturnType<typeof limits>>;
      x: number;
      from: number;
      slop: number;
      moved: boolean;
    } | null>(null);
    /** Whether the last press was a drag, so the click that ends it does not step too. */
    const dragged = useRef(false);
    /** Where the last press that stayed put was let go: a click by a pointer. */
    const clicked = useRef<{ x: number; y: number; reach: number } | null>(
      null,
    );
    const release = (event: React.PointerEvent<HTMLDivElement>) => {
      const held = press.current;
      dragged.current = held?.moved ?? false;
      clicked.current =
        held && !held.moved && event.type === "pointerup"
          ? {
              x: event.clientX,
              y: event.clientY,
              reach: held.slop * DOUBLE_CLICK_SLOPS,
            }
          : null;
      press.current = null;
      delete event.currentTarget.dataset.dragging;
    };
    /*
     * The popover hangs over the next pane and takes the pointer (WCAG 1.4.13): a press
     * on it, reaching for what it covers, neither steps nor drags the bar.
     */
    const onTip = (event: React.SyntheticEvent<HTMLDivElement>) => {
      const tip = (event.target as Element).closest?.(".clover-tip");
      return Boolean(tip && event.currentTarget.contains(tip));
    };
    const label = rest["aria-label"] ?? t("splitHandle");

    return (
      <div
        ref={(node) => {
          self.current = node;
          assign(ref, node);
        }}
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        lang={
          rest["aria-label"] === undefined ? langOf("splitHandle") : undefined
        }
        aria-valuenow={value ? percent(value.now) : undefined}
        aria-valuemin={value ? percent(value.min) : undefined}
        aria-valuemax={value ? percent(value.max) : undefined}
        tabIndex={0}
        className={["clover-split-handle", className].filter(Boolean).join(" ")}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          dragged.current = false;
          clicked.current = null;
          if (event.defaultPrevented || event.button !== 0 || onTip(event))
            return;
          const found = limits();
          if (!found) return;
          event.preventDefault();
          press.current = {
            found,
            x: event.clientX,
            from: found.sized.getBoundingClientRect().width,
            slop: event.pointerType === "touch" ? TAP_SLOP_PX : CLICK_SLOP_PX,
            moved: false,
          };
          event.currentTarget.dataset.dragging = "";
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const held = press.current;
          if (!held) return;
          const moved = event.clientX - held.x;
          // Within the slop it is still a click. Past it, a drag to the end: the bar
          // follows the pointer from where it was taken, toward the pane to narrow it.
          if (!held.moved && Math.abs(moved) < held.slop) return;
          held.moved = true;
          resize(held.from + (held.found.after ? -moved : moved));
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onClick={(event) => {
          onClick?.(event);
          const drag = dragged.current;
          const at = clicked.current;
          dragged.current = false;
          clicked.current = null;
          if (event.defaultPrevented || drag || onTip(event)) return;
          step();
          if (at) holdOff(at);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          const found = limits();
          if (!found) return;
          const now = found.sized.getBoundingClientRect().width;
          const by = KEY_STEP_REM * rootFontSize() * (event.shiftKey ? 4 : 1);
          // Toward the sized pane shrinks it: which arrow that is depends on its side.
          const grow = found.after ? "ArrowLeft" : "ArrowRight";
          const shrink = found.after ? "ArrowRight" : "ArrowLeft";
          if (event.key === grow) resize(now + by);
          else if (event.key === shrink) resize(now - by);
          else if (event.key === "Home") resize(found.min);
          else if (event.key === "End") resize(found.max);
          else return;
          event.preventDefault();
        }}
        {...rest}
      >
        {children}
        <Tip label={label} />
      </div>
    );
  },
);
