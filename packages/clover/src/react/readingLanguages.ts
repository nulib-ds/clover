import { useMemo } from "react";

import {
  descriptionLanguages,
  startingLanguage,
} from "../core/language-choice";
import { sameLanguage } from "../i18n/languages";
import { useClover, useCloverSelector } from "./context";

/**
 * The languages to read the resource in, what the Manifest says of itself in, and the one
 * chosen; null where there is no choice. Where there is one, it is the Root's (Mat,
 * 2026-10-28: "there should be one language toggle. always let root win"): `drawn` says
 * About draws it, and then a part whose languages it holds follows it (an annotation
 * set's, the Transcript's caption files, the Canvas's captions). A part with languages it
 * does not hold offers its own, for itself alone (Mat, 2026-11-05: "in cases where
 * language changes can be isolated to a section. only show the lang option to that
 * section"), as does every part where About draws none (`covers`).
 */
export function useReadingLanguages() {
  const { language, chooseLanguage, toggleDrawn } = useClover("About");
  const manifest = useCloverSelector(
    (state) => state.manifest as Record<string, any> | null,
  );
  const languages = useMemo(() => descriptionLanguages(manifest), [manifest]);
  const chosen = startingLanguage(languages, language);
  return chosen && chooseLanguage
    ? {
        languages,
        chosen,
        onChange: chooseLanguage,
        drawn: toggleDrawn ?? false,
      }
    : null;
}

/**
 * Whether About's toggle stands for a part's own choice of `languages`: it is drawn, and
 * holds each of them (`pt` for `pt-BR`). Else the part offers its own, for itself alone.
 */
export function covers(
  offered: ReturnType<typeof useReadingLanguages>,
  languages: (string | undefined)[],
): boolean {
  if (!offered?.drawn) return false;
  return languages.every(
    (tag) =>
      !!tag &&
      tag !== "none" &&
      offered.languages.some((each) => sameLanguage(each, tag)),
  );
}
