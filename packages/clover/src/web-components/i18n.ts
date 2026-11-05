import type { CloverI18n, CloverI18nOptions } from "../i18n/config";

/**
 * Configure Clover's interface language (its control labels, section titles and
 * announcements), or add strings, for every element on the page, as `initCloverI18n` does
 * in React; it gives the translator, whose `chooseInterfaceLanguage` speaks one language
 * whatever the visitor's. Clover's translator loads with the elements' code, so the first
 * call loads it; an element drawn before it arrives speaks the new language as soon as it
 * does.
 */
export function initCloverI18n(
  options: CloverI18nOptions = {},
): Promise<CloverI18n> {
  return import("../i18n/config").then((module) =>
    module.initCloverI18n(options),
  );
}
