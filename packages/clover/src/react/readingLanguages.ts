import { useMemo } from "react";

import {
  descriptionLanguages,
  startingLanguage,
} from "../core/language-choice";
import { useClover, useCloverSelector } from "./context";

/**
 * The languages to read the resource in, and the one chosen; null where there is no
 * choice. Where there is one, it is the Root's, and every part follows it rather than
 * offering one of its own (Mat, 2026-10-28: "there should be one language toggle. always
 * let root win"): the Transcript's files, the Canvas's captions, an annotation set's
 * languages.
 */
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
