/**
 * Any value as a list, as IIIF writes one thing or several alike: none for `null` or
 * `undefined`, a list as it is, anything else a list of it.
 */
export const asArray = <T>(value: T | readonly T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : value == null ? [] : [value as T];
