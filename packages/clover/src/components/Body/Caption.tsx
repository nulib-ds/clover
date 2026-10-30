import React, { Suspense, lazy, useEffect, useRef, useState } from "react";

import { Close } from "./glyphs";
import type { IIIFCanvas } from "../Canvas/layout";
import Button from "../../ui/Button";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { localize } from "../../core/value";
import { useOneOpen } from "../../ui/useOneOpen";
import { languageProps } from "../../core/direction";

/**
 * The summary and metadata, sanitized by the Primitives. Fetched the first time the
 * caption opens, so their HTML sanitizer (DOMPurify) costs a Canvas nothing until then.
 */
const CaptionDetails = lazy(() => import("./CaptionDetails"));

/**
 * Whether a Canvas has anything of its own for the caption to show: a `summary` or
 * `metadata`. Comments on the whole of it count too (`CanvasView`).
 */
export function hasInformation(canvas: IIIFCanvas): boolean {
  return Boolean(canvas.summary) || Boolean(canvas.metadata?.length);
}

/** The id of a captioned Canvas's label, which also names the `<figure>`. */
export const captionLabelId = (id: string, index: number) =>
  `${id}-label-${index}`;

interface CaptionProps {
  id: string;
  /** The shown Canvases that have information, in reading order. */
  canvases: IIIFCanvas[];
  /** Comments on a whole Canvas, by its id (Cookbook 0266), shown under its words. */
  comments?: Map<string, Record<string, any>[]>;
  open: boolean;
  /** Close, returning focus to the control that opened it when `restoreFocus`. */
  onClose: (restoreFocus: boolean) => void;
  /** The language to read the labels and details in. The reader's, by default. */
  language?: string;
}

/**
 * The `<figcaption>` of the Canvas's `<figure>`: each shown Canvas's label, `summary` and
 * `metadata` (Cookbook 0029, "metadata anywhere"), and the comments on the whole of it
 * (0266, with HTML as 0019 has it), in a box that slides out over the
 * picture from the information control.
 *
 * Not a menu: it stays open while the reader pans and zooms, and closes from its own
 * close button, the control, Escape inside it, or another popup opening (`useOneOpen`),
 * such as the annotations menu, which hangs in the same place. Opening moves focus into
 * it.
 */
const Caption: React.FC<CaptionProps> = ({
  id,
  canvases,
  comments,
  open,
  onClose,
  language,
}) => {
  const { t, langOf } = useCloverTranslation();
  const ref = useRef<HTMLElement>(null);
  // Kept once loaded, so the box slides away with its content still in it.
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  useOneOpen(open, () => onClose(false));

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  return (
    <figcaption
      className="clover-canvas-caption"
      data-open={open}
      data-testid="clover-canvas-caption"
      id={id}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        // It closes, and nothing around it: not a modal `<dialog>` (the Lightbox).
        event.preventDefault();
        event.stopPropagation();
        onClose(true);
      }}
      ref={ref}
      tabIndex={-1}
    >
      <Button
        className="clover-canvas-caption-close"
        id={`close-${id}`}
        label={t("commonClose")}
        lang={langOf("commonClose")}
        onClick={() => onClose(true)}
      >
        <Close />
      </Button>
      {canvases.map((canvas, index) => {
        const label = localize(canvas.label as any, language);
        return (
          <section className="clover-canvas-caption-canvas" key={canvas.id}>
            {label.text && (
              <p
                className="clover-canvas-caption-label"
                id={captionLabelId(id, index)}
                {...languageProps(label.lang)}
              >
                {label.text}
              </p>
            )}
            {opened && (
              <Suspense fallback={null}>
                <CaptionDetails
                  summary={canvas.summary}
                  metadata={canvas.metadata}
                  comments={comments?.get(canvas.id)}
                  language={language}
                />
              </Suspense>
            )}
          </section>
        );
      })}
    </figcaption>
  );
};

export default Caption;
