import React, {
  Suspense,
  lazy,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useCloverTranslation } from "../i18n/useCloverTranslation";
import { autonym } from "../i18n/autonym";
import { languageCode } from "../i18n/languageCode";
import { Tip } from "./Tip";
import { useContainerName } from "../i18n/useContainerName";
import { useUniqueId } from "./useUniqueId";
import { visuallyHidden } from "./visuallyHidden";
import { languageProps } from "../i18n/direction";
import { GlobeGlyph } from "./GlobeGlyph";

// The folded form, loaded only where there are more than five.
const LanguageMenu = lazy(() => import("./LanguageMenu"));

/** Where nothing says how much room there is, at most this many show as codes. */
const ROW_MOST = 5;

/** What a row must leave room for: a label beside it, and the box the row is drawn in. */
export interface LanguageRowFit {
  label: Element;
  box: Element;
}

/** Where a label's words end on one line, in its inline direction. */
function naturalEnd(label: HTMLElement, rtl: boolean): number {
  const was = label.style.whiteSpace;
  label.style.whiteSpace = "nowrap";
  const rect = label.getBoundingClientRect();
  label.style.whiteSpace = was;
  return rtl ? rect.left : rect.right;
}

/**
 * Whether the row is folded, where `fit` finds the label it sits beside (Mat,
 * 2026-11-05: "the dropdown should happen as soon as lang codes intersect the section
 * label. note how the text of label wraps."): folded once the label's words, on one line,
 * would reach the box drawn with the row in it, less the room the box keeps at its start;
 * drawn out again once they would not. The box's width with the row in it is taken each
 * time the row draws, so the answer is the same folded or not, and never flickers.
 */
function useFolded(
  fit: ((place: HTMLElement) => LanguageRowFit | null | undefined) | undefined,
  count: number,
  shown: string,
) {
  // The row or its folded menu, as each draws (the menu loads after the row is gone).
  const [element, place] = useState<HTMLElement | null>(null);
  const width = useRef(0);
  const [folded, setFolded] = useState(false);
  // Whether `fit` found a label to measure against; else the count decides.
  const [measured, setMeasured] = useState(false);
  // Other languages (another resource): the row is drawn out again, to be measured anew.
  const [shownWas, setShownWas] = useState(shown);
  if (shownWas !== shown) {
    setShownWas(shown);
    setFolded(false);
  }
  useLayoutEffect(() => {
    const found = element && fit?.(element);
    if (element) setMeasured(!!found);
    if (!element || !found) return;
    const { label, box } = found;
    const check = () => {
      const rtl = getComputedStyle(box).direction === "rtl";
      const rect = box.getBoundingClientRect();
      if (!folded) width.current = rect.width;
      const end = rtl ? rect.left : rect.right;
      const start = rtl ? end + width.current : end - width.current;
      const room = parseFloat(getComputedStyle(box).paddingInlineStart) || 0;
      const words = naturalEnd(label as HTMLElement, rtl);
      const crosses = rtl ? words < start + room : words > start - room;
      if (crosses !== folded) setFolded(crosses);
    };
    check();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(label);
    if (label.parentElement) observer.observe(label.parentElement);
    return () => observer.disconnect();
  }, [fit, folded, count, element]);
  return { place, folded: measured ? folded : count > ROW_MOST };
}

/**
 * Clover's one choice of languages (Mat, 2026-11-05: "build the globe in. one
 * construct"): a globe, then a row of the languages' codes ("AR", "EN"), drawn as the
 * Transcript's are (`ui/Codes.css`), one chosen: About's, and an annotation set's where
 * About draws none. Past five, folded into the globe and the code in use, which opens
 * them (`LanguageMenu`), as a row so long crushed the heading beside it. Native radios, one stop in the
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
  fit,
}: {
  languages: string[];
  chosen: string;
  onChange: (tag: string) => void;
  /** The key of Clover's string the row is named by. */
  nameKey: string;
  /** The part's class the row's are named for (`clover-annotations`). */
  part: string;
  /**
   * The label the row sits beside and the box it is drawn in, found from the row: it
   * folds as soon as it would reach the label's words (About's heading). Without it,
   * past five languages.
   */
  fit?: (place: HTMLElement) => LanguageRowFit | null | undefined;
}) {
  const { t, langOf } = useCloverTranslation();
  const id = useUniqueId();
  const name = useContainerName(t(nameKey), langOf(nameKey));
  const { place, folded } = useFolded(
    fit,
    languages.length,
    languages.join(" "),
  );
  if (folded)
    return (
      <Suspense fallback={null}>
        <LanguageMenu
          languages={languages}
          chosen={chosen}
          onChange={onChange}
          nameKey={nameKey}
          part={part}
          placeRef={place}
        />
      </Suspense>
    );
  return (
    <>
      {name.node}
      <fieldset {...name.props} className={`${part}-languages`} ref={place}>
        {/* What the codes are: their row's name says it to assistive technology. */}
        <span className="clover-languages-glyph" aria-hidden="true">
          <GlobeGlyph />
        </span>
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
              <span style={visuallyHidden} {...languageProps(tag)}>
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
