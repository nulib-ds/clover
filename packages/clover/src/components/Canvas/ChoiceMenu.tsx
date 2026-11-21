import React, { useMemo } from "react";

import ControlMenu from "./ControlMenu";
import { type ChoiceGroup, type ChoiceSelections, playsHere } from "./layout";
import { regionSource } from "../../core/region";
import type { CloverRequest } from "../../core/request";
import type { ThumbnailSource } from "../../core/thumbnail";
import { localize } from "../../core/value";
import { useContainerName } from "../../i18n/useContainerName";
import { languageProps } from "../../i18n/direction";
import { EntryPicture } from "../../ui/EntryPicture";

type CanvasLike = { id: string } & Record<string, any>;

interface ChoiceMenuProps {
  id: string;
  /** The control that opens the menu, which toggles it itself. */
  triggerId: string;
  label: string;
  /** The language of `label`: a Choice's own, or Clover's where it is not the page's. */
  labelLang?: string;
  /** Each group's key, its name and its items: a Canvas's Choices, or its frames. */
  choices: Array<
    Pick<ChoiceGroup, "key" | "label" | "items"> &
      Partial<Pick<ChoiceGroup, "canvasId">>
  >;
  selections: ChoiceSelections;
  onSelect: (key: string, index: number) => void;
  /** Close, returning focus to the control that opened it when `restoreFocus`. */
  onClose: (restoreFocus: boolean) => void;
  /** The language to read the labels in. The reader's, by default. */
  language?: string;
  /** The Canvases in view, whose images give each item its picture. */
  canvases?: readonly CanvasLike[];
  /** How the items' pictures are fetched. */
  request?: CloverRequest;
}

/**
 * An item's picture: a frame's own, else the whole of the image it paints, cut by its
 * image service at the size the Annotations list asks for (`regionSource`,
 * `AnnotationPicture`), so a Choice's images are told apart at a glance (Cookbook 0033,
 * a multispectral set). None for an item with no image service (a recording, an image
 * with no service, which could be the whole image).
 */
function pictureOf(
  item: ChoiceGroup["items"][number],
  canvas: CanvasLike | undefined,
): ThumbnailSource | null {
  if (item.image) return { src: item.image };
  if (!item.id || !canvas?.width || !canvas?.height) return null;
  return regionSource(
    canvas,
    { x: 0, y: 0, w: canvas.width, h: canvas.height },
    item.id,
  );
}

/**
 * The items of each `Choice` on the Canvas, as radio buttons: one is painted at a time.
 * Each is a row as the annotations menu lists its entries (Mat, 2026-11-20: "make choices
 * render more like annotations with thumbs. retain the radio choice"): its picture,
 * then its label, the one painted marked by the rows' accent edge and tint. The entry is
 * the radio (Mat, the same day: "the entries just behave as wai aria radios"): its native
 * radio is out of sight (`ControlMenu.css`), one tab stop moved by the arrow keys, its
 * focus drawn around the entry (WCAG 2.4.7). An animation's frames are offered the same way, each
 * with its picture. An item with no label shows its number, as an annotation that says
 * nothing does, its picture beside it. Titled as
 * the annotations menu is: by the Choice's own label, else, for one Choice, by the
 * control's name ("Views"). Each label carries its language (WCAG 3.1.2).
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
  canvases,
  request,
}) => {
  // Several groups with no label of their own are named by the control, unseen.
  const fallbackName = useContainerName(label, labelLang);
  const headings = choices.map((group) => {
    const own = localize(group.label as any, language);
    if (own.text) return own;
    return choices.length === 1 ? { text: label, lang: labelLang } : null;
  });
  const unlabeled = headings.some((heading) => !heading);
  const pictures = useMemo(
    () =>
      choices.map((group) => {
        const canvas = group.canvasId
          ? canvases?.find((one) => one.id === group.canvasId)
          : undefined;
        return group.items.map((item) => pictureOf(item, canvas));
      }),
    [choices, canvases],
  );
  return (
    <ControlMenu
      className="clover-canvas-choice-menu"
      data-testid="clover-canvas-choice"
      id={id}
      onClose={onClose}
      triggerId={triggerId}
    >
      {unlabeled && fallbackName.node}
      {choices.map((group, g) => {
        // Only text the Manifest provides, or the control's own name, is shown.
        const heading = headings[g];
        return (
          <fieldset
            // Its key before the spread, so Next's compiler keeps it out of `createElement`.
            key={group.key}
            {...(heading ? {} : fallbackName.props)}
            className="clover-canvas-menu-group"
          >
            {heading && (
              <legend
                className="clover-canvas-menu-legend"
                {...languageProps(heading.lang)}
              >
                {heading.text}
              </legend>
            )}
            <div className="clover-canvas-choice-list">
              {group.items.map((item, index) => {
                const text = localize(item.label as any, language);
                const picture = pictures[g][index];
                const shown = text.text || String(index + 1);
                const checked = (selections[group.key] ?? 0) === index;
                /*
                 * A recording this browser says it cannot play is listed, but cannot be
                 * chosen (`playsHere`; Mat, 2026-10-29).
                 */
                const unplayable = !playsHere(item);
                return (
                  <label
                    className="clover-canvas-menu-item clover-canvas-choice-entry"
                    key={index}
                    data-selected={checked}
                    data-disabled={unplayable || undefined}
                  >
                    <input
                      type="radio"
                      name={`${id}-${g}`}
                      checked={checked}
                      disabled={unplayable}
                      onChange={() => onSelect(group.key, index)}
                    />
                    {picture?.src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- This library also renders outside Next.js.
                      <img
                        alt=""
                        className="clover-entry-thumbnail"
                        decoding="async"
                        loading="lazy"
                        src={picture.src}
                      />
                    ) : (
                      <EntryPicture source={picture} request={request} />
                    )}
                    <span
                      className="clover-canvas-choice-text"
                      {...languageProps(text.text ? text.lang : undefined)}
                    >
                      {shown}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </ControlMenu>
  );
};

export default ChoiceMenu;
