import React, { Suspense, lazy, useEffect, useRef } from "react";

import * as Clover from "../../parts";

// The Body, a chunk of its own (`LightboxBody`).
const load = () => import("./LightboxBody");
const LightboxBody = lazy(load);

/**
 * Starts loading the lightbox's Body before it is first opened: as the reader's pointer or
 * focus first comes to the layout, so the Body is there, or nearly, by the time they open
 * a view.
 */
export const preloadLightbox = () => void load();

export interface LightboxProps {
  open: boolean;
  onClose: () => void;
  /** The level of its title, a level under the layout's. Default 3. */
  headingLevel?: number;
  className?: string;
}

/**
 * The current Canvas in a modal `<dialog>`: its label, the Body, and the pager (with the
 * position). A native dialog keeps focus inside, closes on Escape, and returns focus to
 * whatever opened it. The Body mounts only while open, so it is sized when drawn, and its
 * code loads the first time (`preloadLightbox` starts it sooner): until then its box holds
 * its place, busy, while the title, Close and the pager are already there.
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
  const baseId = Clover.useUniqueId().replace(/:/g, "");
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
        <div className="clover-template-lightbox-content">
          <header className="clover-template-lightbox-header">
            {/* Past h6 no heading; the dialog is named by it either way. */}
            <Clover.Label
              of="canvas"
              as={Clover.titled(headingLevel, titleId).as}
              id={titleId}
              className="clover-template-lightbox-title clover-template-title"
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
          <Suspense
            fallback={
              <div
                className="clover-template-lightbox-body clover-template-lightbox-pending"
                aria-busy="true"
              />
            }
          >
            <LightboxBody />
          </Suspense>
          <Clover.Items layout="pager" />
        </div>
      )}
    </dialog>
  );
}
