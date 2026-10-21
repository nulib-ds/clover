import React, { useEffect, useId, useRef } from "react";

import * as Clover from "../../parts";

export interface LightboxProps {
  open: boolean;
  onClose: () => void;
  /** The level of its title, a level under the layout's. Default 3. */
  headingLevel?: number;
  className?: string;
}

/**
 * The current Canvas in a modal `<dialog>`: its label, the stage, and the pager (with the
 * position). A native dialog keeps focus inside, closes on Escape, and returns focus to
 * whatever opened it. The stage mounts only while open, so it is sized when drawn.
 */
export function Lightbox({
  open,
  onClose,
  headingLevel = 3,
  className,
}: LightboxProps) {
  const t = Clover.useT();
  const langOf = Clover.useLangOf();
  const dialog = useRef<HTMLDialogElement>(null);
  const baseId = useId().replace(/:/g, "");
  const titleId = `${baseId}-title`;
  const manifestTitleId = `${baseId}-manifest`;
  // Named by the Canvas's label, else by the Manifest's, so it always has a name.
  const canvasLabel = Clover.useLocalized(Clover.useActiveCanvas()?.label);
  const named = canvasLabel.text ? titleId : manifestTitleId;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal?.();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={["clover-template-lightbox", className]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={named}
      onClose={onClose}
      // A press on the backdrop (the dialog itself, outside its content) closes it.
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      {open && (
        <div className="clover-template-lightbox-body">
          <header className="clover-template-lightbox-header">
            {/* Past h6 no heading; the dialog is named by it either way. */}
            <Clover.Label
              of="canvas"
              as={Clover.titled(headingLevel, titleId).as}
              id={titleId}
              className="clover-template-lightbox-title"
            />
            {/* Hidden: a name still reads it, and the content does not repeat it. */}
            {named === manifestTitleId && (
              <Clover.Label id={manifestTitleId} hidden />
            )}
            <button
              type="button"
              className="clover-template-lightbox-close"
              aria-label={t("commonClose")}
              lang={langOf("commonClose")}
              onClick={onClose}
            >
              <svg
                aria-hidden="true"
                focusable="false"
                width="16"
                height="16"
                viewBox="0 0 16 16"
              >
                <path
                  d="M3 3l10 10M13 3L3 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <Clover.Tip label={t("commonClose")} />
            </button>
          </header>
          <Clover.Content className="clover-template-lightbox-stage" />
          <Clover.Items layout="pager" />
        </div>
      )}
    </dialog>
  );
}
