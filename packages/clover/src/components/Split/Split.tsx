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
import {
  handleGestures,
  type HandleActions,
  type PaneSpec,
  type SplitLength,
  cssLength,
  limitsOf,
  nextStop,
  paneElements,
  readSizes,
  toPixels,
  writeSizes,
} from "./splitting";

export { toPixels, type SplitLength };

interface SplitContextValue {
  /** Each sized pane's width in pixels, once the reader has moved its handle. */
  sizes: Record<string, number>;
  setSize: (key: string, px: number | undefined) => void;
  /** What each pane asked for, by key, for the handle to clamp against. */
  specs: React.MutableRefObject<Record<string, PaneSpec>>;
  element: React.MutableRefObject<HTMLElement | null>;
}

const SplitContext = createContext<SplitContextValue | null>(null);

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
 * what is left. Not tied to any part: split the Body from the information panel, or
 * anything from anything.
 *
 * ```jsx
 * <Clover.Split>
 *   <Clover.SplitPane min="16rem"><Clover.Body /></Clover.SplitPane>
 *   <Clover.SplitHandle />
 *   <Clover.SplitPane size="24rem" min="14rem"><Clover.Panel /></Clover.SplitPane>
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
  useEffect(() => setSizes(readSizes(storageKey)), [storageKey]);

  const setSize = useCallback(
    (key: string, px: number | undefined) =>
      setSizes((current) => {
        const next = { ...current };
        if (px === undefined) delete next[key];
        else next[key] = Math.round(px);
        writeSizes(storageKey, next);
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

export type SplitHandleProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * The bar between two panes, with a grip at its middle. Drag it. Or click or tap it: each
 * click steps the pane on to its next width, from its narrowest to its own size to its
 * widest and around again, so one pointer resizes it without a drag (WCAG 2.5.7). A double
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
      return limitsOf(handle, container, split.specs.current);
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
      /*
       * A frame after each resize, not as the observer reports: the value is state, and
       * Preact (the elements') renders it at once, which changes the layout mid-report,
       * and the browser tells the page's error handlers "ResizeObserver loop completed
       * with undelivered notifications".
       */
      let frame = 0;
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(update);
      });
      observer.observe(container);
      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
      };
    }, [update, split, split?.sizes]);

    const percent = (px: number) =>
      Math.round((px / (split?.element.current?.clientWidth || 1)) * 100);

    /** A click's step: on to the next of the pane's narrowest, own and widest sizes. */
    const step = () => {
      const found = limits();
      if (!found || !split) return;
      const across = split.element.current?.clientWidth ?? 0;
      const own = toPixels(split.specs.current[found.key]?.size, across);
      const next = nextStop(found, own, split.sizes[found.key]);
      if (!next.own) return resize(next.to);
      // Its own size: the reader's is forgotten, so the pane takes its `size` again.
      split.setSize(found.key, undefined);
      setValue({ now: own!, min: found.min, max: found.max });
    };

    // Its presses, clicks and keys, as `<clover-split-handle>`'s are (`splitting.ts`).
    const actions = useRef<HandleActions>({ limits, resize, step });
    actions.current = { limits, resize, step };
    const [gestures] = useState(() =>
      handleGestures(
        () => self.current,
        () => actions.current,
      ),
    );
    useEffect(() => () => gestures.dispose(), [gestures]);
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
          gestures.down(event);
        }}
        onPointerMove={(event) => gestures.move(event)}
        onPointerUp={(event) => gestures.up(event)}
        onPointerCancel={(event) => gestures.up(event)}
        onClick={(event) => {
          onClick?.(event);
          gestures.click(event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          gestures.key(event);
        }}
        {...rest}
      >
        {children}
        <Tip label={label} />
      </div>
    );
  },
);
