import React, { Suspense, lazy, useEffect } from "react";

import { cloverI18n } from "../../i18n/config";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { useClover } from "../../react/context";
import { useReadingLanguages } from "../../react/readingLanguages";

// The row, loaded only where there is a choice: most resources come in one language,
// and most visitors' is the site's.
const LanguageChoice = lazy(() =>
  import("../../ui/LanguageChoice").then((module) => ({
    default: module.LanguageChoice,
  })),
);

/**
 * In a Panel's heading, what the toggle must leave room for: the section's label, and the
 * box over the heading's end that holds About's controls (`Sections`), whose width the
 * heading keeps clear.
 */
const besideHeading = (place: HTMLElement) => {
  const box = place.closest(".clover-sections-actions");
  const label = box
    ?.closest(".clover-sections-item")
    ?.querySelector(".clover-sections-heading .clover-sections-label");
  return box && label ? { box, label } : null;
};

const chooseInterface = (tag: string) =>
  void cloverI18n.chooseInterfaceLanguage(tag);

/**
 * Clover's interface languages to offer, and the one in use: the visitor's, where Clover
 * has strings for it, and the languages the site configured (`initCloverI18n`'s
 * `languages`, and the page's `<html lang>`). Null where they agree.
 */
export function useInterfaceLanguages() {
  // Read again as the interface language or its strings change.
  useCloverTranslation();
  const { languages, chosen } = cloverI18n.interfaceLanguages();
  return languages.length > 1 ? { languages, chosen } : null;
}

/**
 * About's one language choice (Mat, 2026-11-05: "we should [not] be seeing multiple `en`
 * values"): the languages the resource comes in, then the interface languages it does
 * not already name (`zh-CN` names `zh-Hans`, `en-GB` names `en`), each once. A language
 * the resource has sets the Root's reading (`chooseLanguage`), which moves Clover's
 * interface language with it where Clover has strings for it; one only the site offers
 * sets the interface language alone. The one shown chosen is the Root's reading, or an
 * interface language chosen that the resource has none of. Null under two languages.
 * `values` and `interfaceLanguages` leave either set out (the Panel's `languages` and
 * `interfaceLanguages`).
 */
export function useLanguageToggle({
  values = true,
  interfaceLanguages = true,
}: { values?: boolean; interfaceLanguages?: boolean } = {}) {
  const reading = useReadingLanguages();
  const spoken = useInterfaceLanguages();
  const own = values ? (reading?.languages ?? []) : [];
  const names = (tag: string) =>
    own.some((each) => each === tag || cloverI18n.stringsFor(each) === tag);
  const languages = [
    ...own,
    ...(interfaceLanguages ? (spoken?.languages ?? []) : []).filter(
      (tag) => !names(tag),
    ),
  ];
  if (languages.length < 2) return null;
  const picked = cloverI18n.chosenLanguage;
  const pickedTag = picked && cloverI18n.stringsFor(picked);
  const chosen =
    pickedTag && languages.includes(pickedTag) && !names(pickedTag)
      ? pickedTag
      : values && reading
        ? reading.chosen
        : (spoken?.chosen ?? languages[0]);
  const onChange = (tag: string) =>
    own.includes(tag) && reading ? reading.onChange(tag) : chooseInterface(tag);
  return { languages, chosen, onChange };
}

/**
 * About's language toggle, Clover's one choice of languages (`ui/LanguageChoice`): a
 * globe, then the codes of the languages to read in ("EN", "FR", "FI"), or, past five,
 * the globe and the code in use, which opens them. Nothing under two languages. Drawn,
 * it tells the Root so (`drawsToggle`), and an annotation set or a Transcript follows it
 * rather than offering its own. Its classes are `clover-about-languages` and the rest.
 */
export function LanguageToggle({
  values,
  interfaceLanguages,
  menu,
  name = "About",
}: {
  values?: boolean;
  interfaceLanguages?: boolean;
  /** Folded into the globe and the code in use however few there are. */
  menu?: boolean;
  /** The part that draws it, for the message outside a Root. */
  name?: string;
}) {
  const choice = useLanguageToggle({ values, interfaceLanguages });
  const { drawsToggle } = useClover(name);
  const drawn = !!choice;
  useEffect(() => (drawn ? drawsToggle?.() : undefined), [drawn, drawsToggle]);
  if (!choice) return null;
  return (
    <Suspense fallback={null}>
      <LanguageChoice
        {...choice}
        nameKey="readingLanguage"
        part="clover-about"
        fit={besideHeading}
        menu={menu}
      />
    </Suspense>
  );
}
