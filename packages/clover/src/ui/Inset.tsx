import React, {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { join } from "../lib/classnames";
import { useOptionalClover } from "../react/context";
import { Tip } from "./Tip";
import { visuallyHidden } from "./visuallyHidden";

export interface InsetProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  /**
   * What a press does, in words: its expand button's name and Tip ("Expand map"), in
   * Clover's interface language where the words are Clover's.
   */
  label: string;
  /** The language of `label`, where it is not the page's. */
  lang?: string;
  /** Expands what it is a thumb of: a press anywhere on it but its buttons, or its expand button. */
  onExpand: () => void;
  /** Its expand button's `id`, for focus to follow it as it moves. */
  expandId: string;
  /** The element it expands, where that is another (`aria-controls` on its expand button). */
  controls?: string;
  /** Its own other controls, in its corner after its expand button: a Close. */
  actions?: React.ReactNode;
  /**
   * Expanded: its content as it is, with no box and no buttons, laid out as its `className`
   * says (a map filling what it covered). Its content stays mounted as it goes small and
   * back, so a map in it keeps its place.
   */
  expanded?: boolean;
  /**
   * The element it lies in, where not where it is written. `"body"`, inside a Root: its
   * Body's, in the box the view is drawn in, so the Body's controls and their Tips lie
   * over it, as over the Canvas's own popups, at its top end under them unless its
   * `className` places it, following the Body as it changes from a Canvas to a Timeline or
   * a Scene. Given another, it moves there, keeping what it holds (a map in it is never
   * made again); until there is one, it shows nowhere.
   */
  container?: Element | "body" | null;
}

/* Layout effects only where there is a layout: a server render has none. */
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;
const noBody = () => () => {};
const none = () => null;

/**
 * A thumb of something larger, in a small box, a press on it expanding what it is a thumb
 * of (Mat, 2026-11-14: "we should think about this inset a utility component used for many
 * cases. it holds a thumb, and expands targeted content"): a page's picture over a map, a
 * map kept small over the pages. Its expand button is in its top end corner, the
 * keyboard's way to the same press, the same glyph wherever it is ("keep icon consistent
 * for expanding the inset"), with any controls of its own after it; a press anywhere else
 * on it but those expands it too. No wider than 14rem, its thumb no taller than 10rem,
 * `xs` round it, on the ground, ringed under the pointer as Items rings an item
 * (`Inset.css`). Where it sits is its host's.
 */
export function Inset({
  label,
  lang,
  onExpand,
  expandId,
  controls,
  actions,
  expanded = false,
  container,
  className,
  children,
  ...rest
}: InsetProps) {
  /*
   * Where it lies, given a `container`: a node of its own, with no box, moved from one
   * container to the next and never made again, so what it holds stays as it is. Before a
   * figure's caption, which is first or last in it.
   */
  const [host] = useState(() => {
    if (typeof document === "undefined") return null;
    const node = document.createElement("div");
    // Named, so styles reach what it holds by it, never by a `:has()` on every element.
    node.className = "clover-inset-host";
    return node;
  });
  /*
   * `"body"`: its Root's Body's box (`clover.body`), and in it the box its renderer draws
   * in, a Canvas's, a Timeline's or a Scene's (`.clover-canvas`), else the Body's own,
   * found again as the renderer changes.
   */
  const root = useOptionalClover();
  const channel = root ? root.clover.body : null;
  const body = useSyncExternalStore(
    channel ? channel.subscribe : noBody,
    channel ? channel.get : none,
    none,
  );
  const [view, setView] = useState<HTMLElement | null>(null);
  useLayout(() => {
    if (container !== "body" || !body) return;
    const find = () =>
      setView(
        body.querySelector<HTMLElement>(":scope > .clover-canvas") || body,
      );
    find();
    const watch = new MutationObserver(find);
    watch.observe(body, { childList: true });
    return () => watch.disconnect();
  }, [container, body]);
  const into = container === "body" ? view : container;
  useLayout(() => {
    if (!host || !into || host.parentElement === into) return;
    host.style.display = "contents";
    into.insertBefore(
      host,
      into.querySelector(":scope > figcaption:last-child"),
    );
  }, [host, into]);
  useEffect(() => () => host?.remove(), [host]);
  /*
   * One shape, small or expanded, its content always first, so React keeps it, a map in
   * it never remounted as it trades places; small, a box with its buttons after it.
   */
  const inset = (
    <div
      className={expanded ? className : join("clover-inset", className)}
      onClick={(event) => {
        if (!expanded && !(event.target as Element).closest("button, a"))
          onExpand();
      }}
      {...rest}
    >
      {children}
      {!expanded && (
        <div className="clover-inset-actions">
          <InsetExpand
            id={expandId}
            label={label}
            lang={lang}
            controls={controls}
            onClick={onExpand}
          />
          {actions}
        </div>
      )}
    </div>
  );
  // Given a container, always through its node, so a move never makes it again.
  if (container === undefined) return inset;
  return host ? createPortal(inset, host) : null;
}

/**
 * An Inset's expand button, the same wherever it is ("keep icon consistent for expanding
 * the inset"): `Inset`'s, and `<clover-inset>`'s (`web-components/elements/inset.tsx`).
 */
export function InsetExpand({
  id,
  label,
  lang,
  controls,
  onClick,
}: {
  id: string;
  label: string;
  lang?: string;
  controls?: string;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      className="clover-canvas-button"
      lang={lang}
      aria-controls={controls}
      onClick={onClick}
    >
      {/*
       * A frame open at its upper right, a box inside it at the lower left, and an arrow
       * from the opening down to the box (Mat, 2026-11-14: "do the opposite icon. one point
       * to bottom left.").
       */}
      <svg
        aria-hidden="true"
        focusable="false"
        width="16"
        height="16"
        viewBox="0 0 512 512"
        fill="currentColor"
        stroke="currentColor"
      >
        <path {...LINE} d="M232 72H72V440H440V280" />
        <rect stroke="none" x="144" y="244" width="124" height="124" rx="16" />
        <path {...LINE} d="M429.77 82.2L312 200M424 200H312V88" />
      </svg>
      <span style={visuallyHidden}>{label}</span>
      <Tip label={label} lang={lang} />
    </button>
  );
}

const LINE = {
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 40,
} as const;
