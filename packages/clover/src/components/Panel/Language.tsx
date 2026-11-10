import React from "react";

import { LanguageToggle } from "./LanguageToggle";

export interface LanguageProps {
  /**
   * Whether it also offers Clover's interface languages (its control labels, section
   * titles and announcements) that the resource has none of, the visitor's and the
   * site's, where they differ. Default `true`.
   */
  interfaceLanguages?: boolean;
  /**
   * Folded into the globe and the code in use, which opens the rest as a menu, however
   * few there are. Default `false`: a row of their codes after the globe, folded past
   * five.
   */
  menu?: boolean;
}

/**
 * The languages to read the resource in, as a part of its own (Mat, 2026-11-09: "move
 * this to a globe icon in the top right"): About's language choice, for a layout to place
 * where it likes, About then given `languages={false}`. The languages the resource's
 * values come in, then Clover's interface languages it has none of, each once, the one
 * in use chosen; a choice sets the whole Root's reading, and Clover's interface language
 * with it where Clover has strings for it. A row of their codes after a globe, or, with
 * `menu`, the globe and the code in use, which opens them. Nothing under two languages.
 * Inside a `Root`. Its classes are About's (`clover-about-languages` and the rest).
 */
export function Language({
  interfaceLanguages = true,
  menu = false,
}: LanguageProps) {
  return (
    <LanguageToggle
      interfaceLanguages={interfaceLanguages}
      menu={menu}
      name="Language"
    />
  );
}
