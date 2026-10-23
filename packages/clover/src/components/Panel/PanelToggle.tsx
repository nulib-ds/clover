import React from "react";
import { useUniqueId } from "../../ui/useUniqueId";

import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import Button from "../../ui/Button";

export interface PanelToggleProps {
  /** Whether the panel is showing. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The panel's `id`, for `aria-controls`. */
  controls?: string;
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
      onClick={() => onOpenChange(!open)}
    >
      {/* A page with a side panel: the panel half filled while it is open. */}
      <>
        <rect
          x="64"
          y="96"
          width="384"
          height="320"
          rx="40"
          fill="none"
          strokeWidth="36"
        />
        <path d="M320 96v320" fill="none" strokeWidth="36" />
        {open && (
          <path d="M320 96h88a40 40 0 0 1 40 40v240a40 40 0 0 1-40 40h-88z" />
        )}
      </>
    </Button>
  );
}
