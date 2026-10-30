import React from "react";

import { type ListedAnnotation, startOf } from "./Annotations";
import ControlMenu from "./ControlMenu";
import { CueTime } from "../../ui/Cue";
import { HideToggle } from "../../ui/HideToggle";
import { useContainerName } from "../../i18n/useContainerName";
import { languageProps } from "../../i18n/direction";

interface AnnotationMenuProps {
  id: string;
  /** The control that opens the menu, which toggles it itself. */
  triggerId: string;
  label: string;
  /** The language of `label`, where it is not the page's. */
  labelLang?: string;
  annotations: ListedAnnotation[];
  /** The pages whose annotations are hidden from the picture (each annotation's `pageId`). */
  hiddenPages?: string[];
  /** Hides a page's annotations, or shows them: with it, each page has its toggle. */
  onPageVisibilityChange?: (pageIds: string[], visible: boolean) => void;
  /** The annotation last picked, which is checked. */
  selected: string | null;
  onSelect: (annotation: ListedAnnotation) => void;
  /** Hovering or focusing an item highlights its hotspot; `null` when it leaves. */
  onActivate: (id: string | null) => void;
  /** Close, returning focus to the control that opened it when `restoreFocus`. */
  onClose: (restoreFocus: boolean) => void;
}

/**
 * The Canvas's annotations, listed by their text: picking one zooms to it, as clicking
 * its hotspot does, or, on a recording's time (Cookbook 0103), goes to where it starts,
 * shown beside it. One that follows the recording (`xywh=…&t=…`) shows where it starts
 * too, and is gone to there unless it is on the recording already. The menu stays open
 * to move on to the next. One without text is listed by its number.
 *
 * Drawn as the Annotations list draws its own, with its classes, so its rules: each page
 * under its `label` after its hide toggle (`HideToggle`; a page without a label has the
 * toggle alone), then its rows, the picked one marked. The list holds the whole
 * Manifest's; this, those of the Canvases in view. Hiding a page hides only its
 * annotations on the picture: its items stay here as they were, and a pick still goes
 * to where one is.
 */
const AnnotationMenu: React.FC<AnnotationMenuProps> = ({
  id,
  triggerId,
  label,
  labelLang,
  annotations,
  hiddenPages = [],
  onPageVisibilityChange,
  selected,
  onSelect,
  onActivate,
  onClose,
}) => {
  const name = useContainerName(label, labelLang);
  // Runs of one page, in the order given.
  const groups: Array<{ page?: ListedAnnotation["page"]; items: number[] }> =
    [];
  annotations.forEach((annotation, index) => {
    const last = groups[groups.length - 1];
    if (last && last.page?.text === annotation.page?.text)
      last.items.push(index);
    else groups.push({ page: annotation.page, items: [index] });
  });
  const unlabeled = groups.some((group) => !group.page);
  return (
    <ControlMenu
      // Drawn as the Annotations list draws its entries, the same parts and rules.
      className="clover-canvas-annotation-menu"
      data-testid="clover-canvas-annotation-menu"
      id={id}
      onClose={onClose}
      triggerId={triggerId}
    >
      {unlabeled && name.node}
      {groups.map((group, g) => {
        // The pages its annotations are from, hidden and shown together.
        const pageIds = [
          ...new Set(
            group.items.flatMap((index) => annotations[index].pageId ?? []),
          ),
        ];
        const labelId = `${id}-page-${g}`;
        const toggle = onPageVisibilityChange && pageIds.length > 0 && (
          <HideToggle
            hidden={pageIds.every((page) => hiddenPages.includes(page))}
            onChange={(hide) => onPageVisibilityChange(pageIds, !hide)}
            of={group.page ? labelId : undefined}
          />
        );
        return (
          <fieldset
            /*
             * Its key before the spread: after one, Next's compiler makes the element with
             * `createElement` and its children an array, which React wants keys in.
             */
            key={g}
            // Named by its page's label alone: its legend holds the toggle too.
            {...(group.page ? { "aria-labelledby": labelId } : name.props)}
            className="clover-canvas-menu-group clover-annotations-set"
          >
            {group.page ? (
              <legend className="clover-canvas-menu-legend clover-annotations-set-header">
                <span
                  className="clover-annotations-title"
                  id={labelId}
                  {...languageProps(group.page.lang)}
                >
                  {group.page.text}
                </span>
                {toggle}
              </legend>
            ) : (
              toggle && (
                <div className="clover-annotations-set-header">{toggle}</div>
              )
            )}
            <div className="clover-annotations-list">
              {group.items.map((index) => {
                const annotation = annotations[index];
                const start = startOf(annotation);
                const picked = selected === annotation.id;
                const image =
                  "image" in annotation ? annotation.image : undefined;
                return (
                  <label
                    className="clover-canvas-menu-item clover-annotations-entry"
                    data-selected={picked}
                    key={annotation.id}
                    onMouseEnter={() => onActivate(annotation.id)}
                    onMouseLeave={() => onActivate(null)}
                  >
                    <input
                      type="radio"
                      name={id}
                      checked={picked}
                      onChange={() => onSelect(annotation)}
                      // Re-picking the checked item goes back to it.
                      onClick={() => picked && onSelect(annotation)}
                      onFocus={() => onActivate(annotation.id)}
                      onBlur={() => onActivate(null)}
                    />
                    {start !== undefined && (
                      <CueTime
                        start={start}
                        className="clover-annotations-time"
                      />
                    )}
                    <span className="clover-annotations-body clover-cue-text">
                      {/*
                       * An image it carries (Cookbook 0377) over its words, as the
                       * Annotations list and its popover show it (Mat, 2026-10-29); the
                       * words beside it name it, so it is not read again.
                       */}
                      {image && (
                        <img
                          className="clover-annotations-image"
                          src={image}
                          alt=""
                          loading="lazy"
                        />
                      )}
                      <span
                        className="clover-annotations-text"
                        {...languageProps(
                          annotation.label ? annotation.lang : undefined,
                        )}
                      >
                        {annotation.label ?? String(index + 1)}
                      </span>
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

export default AnnotationMenu;
