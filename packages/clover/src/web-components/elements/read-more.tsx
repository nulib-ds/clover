import React, { useLayoutEffect, useRef } from "react";

import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { useRootLanguage } from "../../i18n/useRootLanguage";
import { useReadMore } from "../../ui/ReadMore";
import { useUniqueId } from "../../ui/useUniqueId";
import type { HostedProps } from "../host";
import { useWatched } from "./nodes";
import { languageProps } from "../../i18n/direction";

/** The text it opens: its first child of the page's, never its own button. */
const textOf = (element: Element) =>
  ([...element.children].find(
    (child) => !child.classList.contains("clover-read-more-button"),
  ) as HTMLElement | undefined) ?? null;

/**
 * `<clover-read-more>` (`specs/read-more.ts`): `ReadMore` for the page's own text, which
 * `ReadMore` cannot clone. Its measuring is the same (`useReadMore`); here it marks the
 * page's element, giving it an id where it has none, and draws the button after it. The
 * element takes ReadMore's box, `clover-read-more`.
 */
export function ReadMoreElement({ hosted }: HostedProps) {
  const element = hosted.element;
  const text = useWatched(element, () => textOf(element), Object.is);
  const { t } = useCloverTranslation();
  const own = useRootLanguage();
  const fallbackId = useUniqueId();
  const ref = useRef<HTMLElement | null>(null);
  ref.current = text;
  const { open, cut, toggle } = useReadMore(ref);

  useLayoutEffect(() => {
    element.classList.add("clover-read-more");
    return () => element.classList.remove("clover-read-more");
  }, [element]);
  // Its id, where the page gave none, and its state, as ReadMore sets them on its child.
  useLayoutEffect(() => {
    if (!text) return;
    const given = text.id;
    if (!given) text.id = fallbackId;
    return () => {
      if (!given) text.removeAttribute("id");
      text.removeAttribute("data-read-more");
    };
  }, [text, fallbackId]);
  useLayoutEffect(() => {
    text?.setAttribute("data-read-more", open ? "open" : "");
  }, [text, open]);

  if (!text || !(cut || open)) return null;
  return (
    <button
      type="button"
      className="clover-read-more-button"
      aria-expanded={open}
      aria-controls={text.id || fallbackId}
      onClick={toggle}
      ref={own.ref}
      {...languageProps(own.langOf(open ? "readLess" : "readMore"))}
    >
      {open ? t("readLess") : t("readMore")}
    </button>
  );
}
