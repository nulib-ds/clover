import React from "react";
import { PanelGlyph } from "../../ui/glyphs/Panel";
import { useUniqueId } from "../../ui/useUniqueId";

import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import Button from "../../ui/Button";

export interface PanelToggleProps {
  /** Whether the panel is showing. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The panel's `id`, for `aria-controls`. */
  controls?: string;
  /**
   * The side of the Body the panel is on: `"end"` (the default) or `"start"`. Among the
   * Body's controls it keeps that side's top corner, and its glyph draws the panel there.
   */
  side?: "start" | "end";
}

/**
 * A button that shows and hides an `Panel`. It is styled as a Canvas control,
 * so it sits in the cluster when given to `Clover.Body` as a child:
 *
 * ```jsx
 * <Clover.Body>
 *   <Clover.PanelToggle open={open} onOpenChange={setOpen} controls="panel" />
 * </Clover.Body>
 * <Clover.Panel id="panel" hidden={!open} />
 * ```
 */
export function PanelToggle({
  open,
  onOpenChange,
  controls,
  side,
}: PanelToggleProps) {
  const { t, langOf } = useCloverTranslation();
  const id = useUniqueId().replace(/:/g, "");
  return (
    <Button
      id={`panel-${id}`}
      label={t("informationPanelToggle")}
      lang={langOf("informationPanelToggle")}
      expanded={open}
      controls={controls}
      side={side === "start" ? side : undefined}
      onClick={() => onOpenChange(!open)}
    >
      {/* A page with a side panel: the panel filled while it is open. */}
      <PanelGlyph open={open} />
    </Button>
  );
}
