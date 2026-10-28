import React, { Suspense, createContext, lazy, useMemo } from "react";

import {
  descriptionLanguages,
  startingLanguage,
} from "../../core/language-choice";
import { useClover, useCloverSelector } from "../../react/context";

/*
 * The row itself, loaded only for a resource that has languages to offer: most come in
 * one, and their pages never fetch it.
 */
const LanguageChoice = lazy(() =>
  import("../../ui/LanguageChoice").then((module) => ({
    default: module.LanguageChoice,
  })),
);

/** Whether a part is inside a `Panel`, which holds the languages beside About's heading. */
export const InPanelContext = createContext(false);

/**
 * The languages the resource can be read in, where what its Manifest says of itself comes
 * in several, one of them in two or more (Cookbook 0006, 0118): a row of their codes
 * ("EN", "FR"), drawn as an annotation set's are (`LanguageChoice`), the Root's `language`
 * to start, else the reader's. The choice is the Root's (`chooseLanguage`): every part in
 * it reads IIIF text in the language chosen, the title over the Viewer as About. Nothing
 * where there is no choice. Its classes are `part`'s (`clover-about-languages`).
 */
export function ReadingLanguages({ part }: { part: string }) {
  const choice = useReadingLanguages();
  if (!choice) return null;
  return (
    <Suspense fallback={null}>
      <LanguageChoice {...choice} nameKey="readingLanguage" part={part} />
    </Suspense>
  );
}

/** The languages to read the resource in, and the one chosen; null where there is no choice. */
export function useReadingLanguages() {
  const { language, chooseLanguage } = useClover("About");
  const manifest = useCloverSelector(
    (state) => state.manifest as Record<string, any> | null,
  );
  const languages = useMemo(() => descriptionLanguages(manifest), [manifest]);
  const chosen = startingLanguage(languages, language);
  return chosen && chooseLanguage
    ? { languages, chosen, onChange: chooseLanguage }
    : null;
}
