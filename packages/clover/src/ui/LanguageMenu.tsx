import React, { useCallback, useState } from "react";

import ControlMenu from "../components/Canvas/ControlMenu";
import { autonym } from "../i18n/autonym";
import { languageProps } from "../i18n/direction";
import { languageCode } from "../i18n/languageCode";
import { useCloverTranslation } from "../i18n/useCloverTranslation";
import { Chevron } from "./Chevron";
import { GlobeGlyph } from "./GlobeGlyph";
import { Tip } from "./Tip";
import { useUniqueId } from "./useUniqueId";

interface Choice {
  languages: string[];
  chosen: string;
  onChange: (tag: string) => void;
}

/**
 * A choice of languages, folded (`LanguageChoice`): a button as About's Download button
 * is drawn, a globe, the code of the language in use ("JA") and a caret that turns as it
 * opens (no edge: Mat, 2026-11-05, "this hairline is unlike what we do elsewhere"), named
 * by that code and the row's name ("Language"; WCAG 2.5.3), that discloses a menu drawn as the Canvas's are
 * (`ControlMenu`): native radios in a fieldset under its legend, each language by its own
 * name in that language (3.1.2). Choosing keeps the menu open and focus on the radio
 * chosen, as its words change language (2.4.3); Escape, a press outside, another popup,
 * or focus moving on closes it, Escape handing focus back to the button.
 */
export default function LanguageMenu({
  languages,
  chosen,
  onChange,
  nameKey,
  part,
  placeRef,
}: Choice & {
  nameKey: string;
  part: string;
  /** Where the row it stands for measures from (`LanguageChoice`'s `fit`). */
  placeRef?: (element: HTMLElement | null) => void;
}) {
  const { t, langOf } = useCloverTranslation();
  const [open, setOpen] = useState(false);
  const id = useUniqueId();
  const button = `${id}-languages`;
  const close = useCallback(
    (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) document.getElementById(button)?.focus();
    },
    [button],
  );
  const name = t(nameKey);
  const nameLang = langOf(nameKey);
  return (
    <span
      ref={placeRef}
      className={`${part}-languages clover-languages-folded`}
      onBlur={(event) => {
        // Focus gone elsewhere, not a press inside it, which takes focus nowhere.
        const next = event.relatedTarget as Node | null;
        if (open && next && !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        type="button"
        id={button}
        className="clover-languages-button"
        aria-label={`${languageCode(chosen)}, ${name}`}
        {...languageProps(nameLang)}
        aria-expanded={open}
        aria-controls={open ? `${button}-menu` : undefined}
        onClick={() => setOpen((was) => !was)}
      >
        <GlobeGlyph />
        <span className="clover-languages-code" aria-hidden="true">
          {languageCode(chosen)}
        </span>
        {/* A menu, so it says so (Mat, 2026-11-05: "if dropdown, make it obvious"). */}
        <Chevron open={open} className="clover-languages-caret" />
        <Tip label={name} lang={nameLang} />
      </button>
      {open && (
        <ControlMenu
          id={`${button}-menu`}
          triggerId={button}
          onClose={close}
          className="clover-languages-menu"
        >
          <fieldset>
            <legend {...languageProps(nameLang)}>{name}</legend>
            {languages.map((tag) => (
              <label key={tag} className="clover-languages-option">
                <input
                  type="radio"
                  name={`${button}-language`}
                  checked={tag === chosen}
                  onChange={() => onChange(tag)}
                />
                <span {...languageProps(tag)}>{autonym(tag)}</span>
              </label>
            ))}
          </fieldset>
        </ControlMenu>
      )}
    </span>
  );
}
