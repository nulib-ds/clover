import React from "react";

import type { PlacedAnnotation } from "./Annotations";
import ControlMenu from "./ControlMenu";
import { useContainerName } from "../../ui/useContainerName";

interface AnnotationMenuProps {
  id: string;
  /** The control that opens the menu, which toggles it itself. */
  triggerId: string;
  label: string;
  /** The language of `label`, where it is not the page's. */
  labelLang?: string;
  annotations: PlacedAnnotation[];
  /** The annotation last picked, which is checked. */
  selected: string | null;
  onSelect: (annotation: PlacedAnnotation) => void;
  /** Hovering or focusing an item highlights its hotspot; `null` when it leaves. */
  onActivate: (id: string | null) => void;
  /** Close, returning focus to the control that opened it when `restoreFocus`. */
  onClose: (restoreFocus: boolean) => void;
}

/**
 * The Canvas's annotations, listed by their text: picking one zooms to it, as clicking
 * its hotspot does, and the menu stays open to move on to the next. One without text is
 * listed by its number.
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
  return (
    <ControlMenu
      data-testid="clover-canvas-annotation-menu"
      id={id}
      onClose={onClose}
      triggerId={triggerId}
    >
      {name.node}
      <fieldset {...name.props} className="clover-canvas-menu-group">
        {annotations.map((annotation, index) => (
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
              // Re-picking the checked item zooms back to it.
              onClick={() => selected === annotation.id && onSelect(annotation)}
              onFocus={() => onActivate(annotation.id)}
              onBlur={() => onActivate(null)}
            />
            <span lang={annotation.label ? annotation.lang : undefined}>
              {annotation.label ?? String(index + 1)}
            </span>
          </label>
        ))}
      </fieldset>
    </ControlMenu>
  );
};

export default AnnotationMenu;
