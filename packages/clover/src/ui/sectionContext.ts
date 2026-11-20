import { createContext, useContext } from "react";

/*
 * What a section's content reads of the section it is in, which `Sections` provides: here
 * apart from it, so the code of a section that reads them (Search's, a Transcript's)
 * imports no `Sections`, which it never draws, and the Panel's sheet stays the Panel's
 * (`partSheets`, `build/clover-sheets.mjs`).
 */

/**
 * Where a section's content may put controls of its own beside its heading: the element
 * to portal them into (`createPortal`), while its section is laid out as an accordion's
 * box; elsewhere (tabs, or no `Sections` around it) `null`, and the content shows them
 * itself. A transcript puts its languages there.
 */
export const SectionActionsContext = createContext<HTMLElement | null>(null);

export function useSectionActions() {
  return useContext(SectionActionsContext);
}

/**
 * How many times the reader has opened this section with a press, in an accordion: 0
 * until they do. A section's content that the reader came to use can take focus as it
 * changes (Search's field; Mat, 2026-10-26: "search should focus when section is
 * expanded"); one opened any other way (a search started elsewhere, a `value`) never
 * moves focus.
 */
export const SectionOpenedContext = createContext(0);

export function useSectionOpened() {
  return useContext(SectionOpenedContext);
}

/**
 * Whether this section is open (its box, or its tab, chosen), however it came to be: a
 * press, a `value`, a search started elsewhere. True where no `Sections` is around it. A
 * closed section's content stays mounted, so a list that follows the recording can bring
 * its current entry into view as it is shown again (Transcript; Mat, 2026-11-09).
 */
export const SectionShownContext = createContext(true);

export function useSectionShown() {
  return useContext(SectionShownContext);
}
