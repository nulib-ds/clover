import type React from "react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";

import { HostLanguageContext } from "./hostLanguage";
import { useCloverTranslation } from "./useCloverTranslation";

/**
 * A Clover root's reading of the page's language (a `Root`, or a part shown outside one),
 * for Clover's strings to be compared with (WCAG 3.1.2).
 *
 * Clover's strings are in the interface language: the page's where Clover has strings for
 * it, else the reader's browser's, or the one a host sets. So it can differ from the page's. A string in another language than the page's carries its own
 * `lang`, on the element that shows it or is named by it (`langOf`). No root carries one:
 * a root also holds the host's own content, which is in the page's language.
 *
 * The page's language is a `lang` given to the root, else the nearest `lang` around it,
 * read after mount. Until then it is empty, and only strings that fell back from the
 * interface language are marked; nothing more is marked on the server. Inside another
 * root, that root's reading stands. A root provides `hostLanguage` to its parts through
 * `HostLanguageContext`.
 */
export function useRootLanguage(
  forwardedRef?: React.ForwardedRef<HTMLElement>,
  own?: string,
): {
  ref: (element: HTMLElement | null) => void;
  hostLanguage: string;
  langOf: (key: string) => string | undefined;
} {
  const outer = useContext(HostLanguageContext);
  const element = useRef<HTMLElement | null>(null);
  const [measured, setMeasured] = useState("");

  const ref = useCallback(
    (node: HTMLElement | null) => {
      element.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  /*
   * After every render: cheap, and the page may change its language. Setting the same
   * value again renders nothing.
   */
  const measure = () => {
    const parent = element.current?.parentElement;
    if (own !== undefined || outer !== undefined || !parent) return;
    setMeasured(parent.closest("[lang]")?.getAttribute("lang") ?? "");
  };
  useEffect(measure);

  const hostLanguage = own ?? outer ?? measured;
  const { langOf } = useCloverTranslation(undefined, hostLanguage);
  return { ref, hostLanguage, langOf };
}
