import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useUniqueId } from "./useUniqueId";

import { useCloverTranslation } from "../i18n/useCloverTranslation";
import { useRootLanguage } from "../react/language";
import { languageProps } from "../core/direction";

/** A layout effect in the browser, an effect on the server (where there is no layout). */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * "Read more" for text cut short. Its one child is clamped by its own CSS (a
 * `-webkit-line-clamp`, as `Summary` is: `components/Primitives/Primitives.css`); a
 * button under it, shown only once the text runs past that, opens it in full ("Read
 * more", `aria-expanded`) and cuts it short again ("Read less"). While open, the child
 * carries `data-read-more="open"`, which its clamp leaves alone.
 *
 * For text of your own: wrap one element (or a component that forwards its ref), and
 * clamp it in your CSS.
 *
 * ```tsx
 * <Clover.ReadMore>
 *   <p className="my-note">{text}</p>
 * </Clover.ReadMore>
 * ```
 */
export function ReadMore({ children }: { children: React.ReactElement }) {
  const { t } = useCloverTranslation();
  // Outside a Root (a Summary on its own), the button reads the page's language itself.
  const own = useRootLanguage();
  const ref = useRef<HTMLElement>(null);
  const fallbackId = useUniqueId();
  const child = React.Children.only(children);
  const id = (child.props as { id?: string }).id ?? fallbackId;
  const { open, cut, toggle } = useReadMore(ref);

  return (
    <div className="clover-read-more">
      {React.cloneElement(
        child as React.ReactElement<Record<string, unknown>>,
        {
          ref,
          id,
          "data-read-more": open ? "open" : "",
        },
      )}
      {(cut || open) && (
        <button
          type="button"
          className="clover-read-more-button"
          aria-expanded={open}
          aria-controls={id}
          onClick={toggle}
          ref={own.ref}
          {...languageProps(own.langOf(open ? "readLess" : "readMore"))}
        >
          {open ? t("readLess") : t("readMore")}
        </button>
      )}
    </div>
  );
}

/**
 * Whether a clamped element's text runs past its box, and whether the reader opened it:
 * ReadMore's measuring, for `ReadMore` and `<clover-read-more>` alike. Measured after
 * every render (its text may have changed), whenever it is resized, and when the page's
 * styles or fonts change: a reader's text spacing, or a web font arriving, can lengthen
 * text whose clamped box stays the same size.
 */
export function useReadMore(ref: React.RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);
  // Cut short when what it holds is taller than the box its clamp leaves it.
  const measure = () => {
    const node = ref.current;
    if (node && !open) setCut(node.scrollHeight > node.clientHeight + 1);
  };
  useIsomorphicLayoutEffect(measure);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Resized or restyled, measured a frame later: a measure sets state, which Preact (the
    // elements') renders at once, mid-report (`templates/shared/useSlide.ts`).
    let frame = 0;
    const again = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resized =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(again);
    resized?.observe(node);
    const styled =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(again);
    styled?.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    styled?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    // Its own style only: React's `data-read-more` must not set it off.
    styled?.observe(node, { attributes: true, attributeFilter: ["style"] });
    document.fonts?.addEventListener?.("loadingdone", again);
    return () => {
      cancelAnimationFrame(frame);
      resized?.disconnect();
      styled?.disconnect();
      document.fonts?.removeEventListener?.("loadingdone", again);
    };
    // `measure` reads the latest `open` through its closure, renewed with each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ref.current]);
  return { open, cut, toggle: () => setOpen((value) => !value) };
}
