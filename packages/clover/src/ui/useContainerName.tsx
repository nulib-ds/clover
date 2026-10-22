import React from "react";
import { useUniqueId } from "./useUniqueId";

import { langWithin } from "../i18n/config";
import { useCloverTranslation } from "../i18n/useCloverTranslation";

/**
 * Props that name a container (a `nav`, a list, a group), and the element they may need.
 *
 * A name in the page's language, or in none given, is the container's `aria-label`. One
 * in another language (a French label on an English page, Clover's strings in the reader's
 * language) cannot be: `aria-label` takes the container's language, and a `lang` on the
 * container would pass to everything inside it. Then the name goes in a hidden element
 * carrying its `lang`, which `aria-labelledby` points at; render `node` anywhere in the
 * document (WCAG 3.1.2). With `named`, the host named the container itself, and nothing is
 * added. A Clover root naming its own container passes the `hostLanguage` it read.
 */
export function useContainerName(
  text: string,
  lang?: string,
  named = false,
  hostLanguage?: string,
): {
  props: { "aria-label"?: string; "aria-labelledby"?: string };
  node: React.ReactNode;
} {
  const id = useUniqueId();
  const { hostLanguage: host } = useCloverTranslation(undefined, hostLanguage);
  if (named) return { props: {}, node: null };
  const other = langWithin(lang, host);
  if (other === undefined) return { props: { "aria-label": text }, node: null };
  return {
    props: { "aria-labelledby": id },
    node: (
      <span hidden id={id} lang={other}>
        {text}
      </span>
    ),
  };
}
