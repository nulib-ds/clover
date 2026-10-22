import type { CloverI18n, CloverI18nOptions } from "../i18n/config";

/**
 * Set the language of Clover's own words, or add strings, for every element on the page,
 * as `initCloverI18n` does in React. Clover's translator loads with the elements' code, so
 * the first call loads it; an element drawn before it arrives speaks the new language as
 * soon as it does.
 */
export function initCloverI18n(
  options: CloverI18nOptions = {},
): Promise<CloverI18n> {
  return import("../i18n/config").then((module) =>
    module.initCloverI18n(options),
  );
}
