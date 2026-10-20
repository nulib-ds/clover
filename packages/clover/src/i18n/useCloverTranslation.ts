import { useCallback, useContext, useSyncExternalStore } from "react";

import { CLOVER_I18N_NAMESPACE, cloverI18n } from "./config";
import { HostLanguageContext } from "./hostLanguage";

/**
 * Clover's strings in the current language. Re-renders when `initCloverI18n` changes the
 * language or adds strings.
 *
 * `langOf(key)` is the language of a string where it is not the page's, for the element
 * that shows it, or is named by it, to carry as `lang` (WCAG 3.1.2). It is undefined for
 * every other string, which takes the page's language. The page's is the one around the
 * Clover root (`hostLanguage`); a root, which reads it, passes its own.
 */
export function useCloverTranslation(
  namespace = CLOVER_I18N_NAMESPACE,
  hostLanguage?: string,
) {
  const version = useSyncExternalStore(
    cloverI18n.subscribe,
    cloverI18n.getSnapshot,
    cloverI18n.getSnapshot,
  );
  const around = useContext(HostLanguageContext);
  const host = hostLanguage ?? around;

  const t = useCallback(
    (key: string, values?: Record<string, unknown>) =>
      cloverI18n.t(key, values, namespace),
    // `version` stands for "the strings changed": a new `t` re-renders memoized readers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [namespace, version],
  );

  const langOf = useCallback(
    (key: string) => cloverI18n.langOf(key, host, namespace),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [namespace, version, host],
  );

  return { t, langOf, hostLanguage: host, i18n: cloverI18n };
}
