import React from "react";

import ControlMenu from "./ControlMenu";
import { type ChoiceGroup, type ChoiceSelections, playsHere } from "./layout";
import { localize } from "../../core/value";
import { useContainerName } from "../../ui/useContainerName";
import { languageProps } from "../../core/direction";

interface ChoiceMenuProps {
  id: string;
  /** The control that opens the menu, which toggles it itself. */
  triggerId: string;
  label: string;
  /** The language of `label`: a Choice's own, or Clover's where it is not the page's. */
  labelLang?: string;
  /** Each group's key, its name and its items: a Canvas's Choices, or its frames. */
  choices: Array<Pick<ChoiceGroup, "key" | "label" | "items">>;
  selections: ChoiceSelections;
  onSelect: (key: string, index: number) => void;
  /** Close, returning focus to the control that opened it when `restoreFocus`. */
  onClose: (restoreFocus: boolean) => void;
  /** The language to read the labels in. The reader's, by default. */
  language?: string;
}

/**
 * The items of each `Choice` on the Canvas, as radio buttons: one is painted at a time.
 * An animation's frames are offered the same way, each with its picture. An item with no
 * label shows its number, unless it has a picture, which then carries the number as its
 * name for assistive technology alone. Each label carries its language (WCAG 3.1.2).
 */
const ChoiceMenu: React.FC<ChoiceMenuProps> = ({
  id,
  triggerId,
  label,
  labelLang,
  choices,
  selections,
  onSelect,
  onClose,
  language,
}) => {
  // A group with no label of its own is named by the control, for assistive technology.
  const fallbackName = useContainerName(label, labelLang);
  const unlabeled = choices.some(
    (group) => !localize(group.label as any, language).text,
  );
  return (
    <ControlMenu
      data-testid="clover-canvas-choice"
      id={id}
      onClose={onClose}
      triggerId={triggerId}
    >
      {unlabeled && fallbackName.node}
      {choices.map((group, g) => {
        // Only text the Manifest provides is shown.
        const heading = localize(group.label as any, language);
        return (
          <fieldset
            // Its key before the spread, so Next's compiler keeps it out of `createElement`.
            key={group.key}
            {...(heading.text ? {} : fallbackName.props)}
            className="clover-canvas-menu-group"
          >
            {heading.text && (
              <legend
                className="clover-canvas-menu-legend"
                {...languageProps(heading.lang)}
              >
                {heading.text}
              </legend>
            )}
            {group.items.map((item, index) => {
              const text = localize(item.label as any, language);
              const shown = text.text || (item.image ? "" : String(index + 1));
              /*
               * A recording this browser says it cannot play is listed, but cannot be
               * chosen (`playsHere`; Mat, 2026-10-29).
               */
              const unplayable = !playsHere(item);
              return (
                <label
                  className="clover-canvas-menu-item"
                  key={index}
                  data-disabled={unplayable || undefined}
                >
                  <input
                    type="radio"
                    name={`${id}-${g}`}
                    aria-label={shown ? undefined : String(index + 1)}
                    checked={(selections[group.key] ?? 0) === index}
                    disabled={unplayable}
                    onChange={() => onSelect(group.key, index)}
                  />
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- This library also renders outside Next.js.
                    <img
                      alt=""
                      className="clover-canvas-menu-image"
                      decoding="async"
                      loading="lazy"
                      src={item.image}
                    />
                  )}
                  {shown && (
                    <span {...languageProps(text.text ? text.lang : undefined)}>
                      {shown}
                    </span>
                  )}
                </label>
              );
            })}
          </fieldset>
        );
      })}
    </ControlMenu>
  );
};

export default ChoiceMenu;
