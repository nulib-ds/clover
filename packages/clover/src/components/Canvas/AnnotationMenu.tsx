import React from "react";

import { type ListedAnnotation, isTimed } from "./Annotations";
import ControlMenu from "./ControlMenu";
import { formatTime } from "./media/useMediaController";
import { useContainerName } from "../../ui/useContainerName";

interface AnnotationMenuProps {
  id: string;
  /** The control that opens the menu, which toggles it itself. */
  triggerId: string;
  label: string;
  /** The language of `label`, where it is not the page's. */
  labelLang?: string;
  annotations: ListedAnnotation[];
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
 * shown beside it. The menu stays open to move on to the next. One without text is listed
 * by its number. Those of an AnnotationPage with a `label` are grouped under it, as the
 * Annotations list groups them.
 */
const AnnotationMenu: React.FC<AnnotationMenuProps> = ({
  id,
  triggerId,
  label,
  labelLang,
  annotations,
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
  const unlabelled = groups.some((group) => !group.page);
  return (
    <ControlMenu
      data-testid="clover-canvas-annotation-menu"
      id={id}
      onClose={onClose}
      triggerId={triggerId}
    >
      {unlabelled && name.node}
      {groups.map((group, g) => (
        <fieldset
          {...(group.page ? {} : name.props)}
          className="clover-canvas-menu-group"
          key={g}
        >
          {group.page && (
            <legend
              className="clover-canvas-menu-legend"
              lang={group.page.lang}
            >
              {group.page.text}
            </legend>
          )}
          {group.items.map((index) => {
            const annotation = annotations[index];
            return (
              <label
                className="clover-canvas-menu-item"
                data-active={selected === annotation.id ? "true" : undefined}
                key={annotation.id}
                onMouseEnter={() => onActivate(annotation.id)}
                onMouseLeave={() => onActivate(null)}
              >
                <input
                  type="radio"
                  name={id}
                  checked={selected === annotation.id}
                  onChange={() => onSelect(annotation)}
                  // Re-picking the checked item goes back to it.
                  onClick={() =>
                    selected === annotation.id && onSelect(annotation)
                  }
                  onFocus={() => onActivate(annotation.id)}
                  onBlur={() => onActivate(null)}
                />
                {isTimed(annotation) && (
                  <span className="clover-canvas-menu-time">
                    {formatTime(annotation.start)}
                  </span>
                )}
                <span lang={annotation.label ? annotation.lang : undefined}>
                  {annotation.label ?? String(index + 1)}
                </span>
              </label>
            );
          })}
        </fieldset>
      ))}
    </ControlMenu>
  );
};

export default AnnotationMenu;
