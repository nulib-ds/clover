import React from "react";

import { useCloverTranslation } from "../i18n/useCloverTranslation";
import { languageCode } from "./languageCode";
import { Tip } from "./Tip";
import { useContainerName } from "./useContainerName";
import { useUniqueId } from "./useUniqueId";
import { visuallyHidden } from "./visuallyHidden";

/**
 * A language's name in itself ("العربية", "English", "Français"), for a reader of that
 * language to find it by; the tag where the browser cannot name it.
 */
export function autonym(tag: string): string {
  try {
    return new Intl.DisplayNames([tag], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}

/**
 * A row of languages' codes ("AR", "EN"), drawn as the Transcript's are (`ui/Codes.css`),
 * one chosen: an annotation set's languages, and About's. Native radios, one stop in the
 * tab order, the arrow keys moving between them; the row named by `nameKey` ("Language"),
 * each radio by its code and then its language's own name in that language (WCAG 2.5.3,
 * 3.1.2), which its popover shows. Its classes are `part`'s: `<part>-languages` on the
 * row, `<part>-language` on each, `<part>-language-code` on its code.
 */
export function LanguageChoice({
  languages,
  chosen,
  onChange,
  nameKey,
  part,
}: {
  languages: string[];
  chosen: string;
  onChange: (tag: string) => void;
  /** The key of Clover's string the row is named by. */
  nameKey: string;
  /** The part's class the row's are named for (`clover-annotations`). */
  part: string;
}) {
  const { t, langOf } = useCloverTranslation();
  const id = useUniqueId();
  const name = useContainerName(t(nameKey), langOf(nameKey));
  return (
    <>
      {name.node}
      <fieldset {...name.props} className={`${part}-languages`}>
        {languages.map((tag) => {
          const own = autonym(tag);
          return (
            <label key={tag} className={`${part}-language`}>
              <input
                type="radio"
                name={`${id}-language`}
                checked={tag === chosen}
                onChange={() => onChange(tag)}
              />
              <span className={`${part}-language-code`}>
                {languageCode(tag)}
              </span>{" "}
              <span style={visuallyHidden} lang={tag}>
                {own}
              </span>
              <Tip label={own} lang={tag} />
            </label>
          );
        })}
      </fieldset>
    </>
  );
}
