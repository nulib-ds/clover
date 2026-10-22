// eslint-disable-next-line no-restricted-imports -- the one place `useId` is called
import { createContext, useContext, useId } from "react";

/**
 * A prefix for the ids Clover makes, given per render root. React keeps `useId` unique
 * across a page; Preact, which draws `<clover-viewer>`, starts again in each root, so two
 * elements on one page made the same ids, and a label or an `aria-controls` found the
 * other element's (WCAG 1.3.1, 4.1.2). Each element gives its own
 * (`web-components/element.tsx`); a React page needs none.
 */
export const IdPrefixContext = createContext("");

/**
 * An id unique on the page, across every render root, React's or Preact's: what Clover
 * uses wherever it would call `useId`, and what a part of your own can use too.
 */
export function useUniqueId(): string {
  return useContext(IdPrefixContext) + useId();
}
