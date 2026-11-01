import React, { Suspense, lazy, useEffect, useRef } from "react";

import * as Clover from "../../parts";
import type { PanelLayout } from "../../parts";

/*
 * What it shows under its title (the Body, the thumbnails, the information panel and its
 * panes), a chunk of its own (`LightboxView`): a Gallery's page draws only thumbnails
 * until the reader opens one.
 */
const load = () => import("./LightboxView");
const LightboxView = lazy(load);

/**
 * Starts loading the lightbox's view before it is first opened: as the reader's pointer or
 * focus first comes to the layout, so the Body is there, or nearly, by the time they open
 * a view.
 */
export const preloadLightbox = () => void load();

export interface LightboxProps {
  open: boolean;
  onClose: () => void;
  /** The level of its title, a level under the layout's. Default 3. */
  headingLevel?: number;
  /**
   * How the reader moves on from the view shown: a short strip of thumbnails (`slider`,
   * Items' carousel), or `pager`, Previous, the position and Next. Default `slider`.
   */
  items?: "slider" | "pager";
  /**
   * The information panel beside the view, as every template's is (`PanelPane`): its
   * toggle among the Body's controls, or on the bar beside it. Default `true`.
   */
  panel?: boolean;
  /** Whether the panel starts open beside the view; over it, closed. Default `true`. */
  defaultPanelOpen?: boolean;
  /** The panel's sections as stacked boxes (`"accordion"`, the default) or tabs. */
  panelLayout?: PanelLayout;
  /** The downloads in the panel's About, where there is a `rendering`. Default `true`. */
  download?: boolean;
  /** The languages to read the resource in, beside the panel's About heading. Default `true`. */
  languages?: boolean;
  /** Where the panel's width is remembered once dragged; `false` forgets it. */
  storageKey?: string | false;
  className?: string;
}

/**
 * The current Canvas in a modal layer over the layout, and only the layout (Mat,
 * 2026-10-30: "backdrop should not extend beyond the bounds of the template"): its label,
 * the Body, and a short strip of thumbnails (Mat, 2026-11-01: "carousel by default") or
 * the pager (with the position). A modal `<dialog>`'s backdrop always covers the whole
 * window, so this is a layer in the Root, a `dialog` to assistive technology: while it is
 * open the rest of the Root is inert, focus is on the view in its strip (on Close with the
 * pager), and Escape, Close, a press on the layer outside the panel or a step out in its
 * trail closes it, focus going back to what opened it.
 * By default it fills the layout's bounds; `--clover-template-lightbox-inset`,
 * `-backdrop` and `-radius` give it room, a backdrop and corners (`Lightbox.css`). The
 * layout positions it and holds its stacking (`position: relative` and `isolation:
 * isolate`, as the Gallery does), so its layer never stacks over the page around it.
 *
 * Beside the view, the information panel, as every template's is (`PanelPane`; Mat,
 * 2026-11-01: "show the pane like we have for document/default"), its every interaction
 * theirs.
 *
 * Its view mounts only while open, so it is sized when drawn, and its code (the Body, the
 * panes and the panel's pane) loads the first time (`preloadLightbox` starts it sooner):
 * until then a busy box holds its place under the title and Close. The Panel's own code
 * loads as it opens, the chunk Document's is (`PanelPart`).
 */
export function Lightbox({
  open,
  onClose,
  headingLevel = 3,
  items = "slider",
  className,
  ...view
}: LightboxProps) {
  const t = Clover.useT();
  const langOf = Clover.useLangOf();
  const layer = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const baseId = Clover.useUniqueId().replace(/:/g, "");
  const titleId = `${baseId}-title`;
  const manifestTitleId = `${baseId}-manifest`;
  // Named by the Canvas's label, else by the Manifest's, so it always has a name.
  const canvasLabel = Clover.useLocalized(Clover.useActiveCanvas()?.label);
  const named = canvasLabel.text ? titleId : manifestTitleId;
  const closing = useRef(onClose);
  closing.current = onClose;

  useEffect(() => {
    const element = layer.current;
    const root = element?.parentElement;
    if (!open || !element || !root) return;
    const opener = element.ownerDocument.activeElement as HTMLElement | null;
    // Modal within the layout: the rest of the Root is out of reach (WCAG 2.4.3), but
    // not the Root's announcer, which still tells of each move.
    const others = Array.from(root.children).filter(
      (child): child is HTMLElement =>
        child !== element && !child.classList.contains("clover-announcer"),
    );
    others.forEach((child) => (child.inert = true));
    // The whole panel in the window (it may open partly past its edge), then focus.
    panel.current?.scrollIntoView?.({ block: "nearest" });
    /*
     * On the view shown, in its strip, so the arrow keys go on through the views at once
     * (Mat, 2026-11-01); with the pager, or nothing to choose between, on Close.
     */
    const chosen = panel.current?.querySelector<HTMLElement>(
      '[role="listbox"] [role="option"][aria-selected="true"]',
    );
    (chosen ?? close.current)?.focus({ preventScroll: true });
    return () => {
      others.forEach((child) => (child.inert = false));
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <div
      ref={layer}
      className={["clover-template-lightbox", className]
        .filter(Boolean)
        .join(" ")}
      hidden={!open}
      // A press on the layer, outside the panel, closes it.
      onClick={(event) => {
        if (event.target === layer.current) onClose();
      }}
      /*
       * Escape closes it, unless what is inside took it first: a menu, a caption, the
       * information panel over the Body or its pane (each before the layer, as React
       * bubbles), so Escape puts those away first, as in every template.
       */
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        closing.current();
      }}
    >
      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={named}
          className="clover-template-lightbox-content"
        >
          <header className="clover-template-lightbox-header">
            <div className="clover-template-lightbox-heading">
              <Trail id={baseId} onOut={onClose} />
              {/* Past h6 no heading; the dialog is named by it either way. */}
              <Clover.Label
                of="canvas"
                as={Clover.titled(headingLevel, titleId).as}
                id={titleId}
                className="clover-template-lightbox-title clover-template-title clover-title"
              />
            </div>
            {/* Hidden: a name still reads it, and the content does not repeat it. */}
            {named === manifestTitleId && (
              <Clover.Label id={manifestTitleId} hidden />
            )}
            <button
              ref={close}
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
            <LightboxView
              id={baseId}
              items={items}
              headingLevel={headingLevel}
              {...view}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

/**
 * The levels over the view the lightbox shows, by their labels, so opening a view never
 * loses where it sits (Mat, 2026-11-01: "always show the labels and it should be obvious
 * that a user can navigate in/out of the levels"): the Manifest's, and over it, opened
 * through a Collection, the Collection's. The level the reader came in from (the grid's:
 * the Manifest's views, or the Collection's members) is a button that steps back out to
 * it, closing the lightbox with focus back on the cell; the Manifest inside a Collection
 * is the level the lightbox shows, named only. In a `nav` named for a breadcrumb, each
 * a step smaller than the title, the steps apart by a chevron (`Lightbox.css`).
 */
function Trail({ id, onOut }: { id: string; onOut: () => void }) {
  const t = Clover.useT();
  const langOf = Clover.useLangOf();
  const collection = Clover.useCloverSelector((state) =>
    state.throughCollection ? state.collection : null,
  );
  // In the page's language, its `aria-label`; else a hidden element's, carrying `lang`.
  const nameLang = langOf("templateTrail");
  const manifest = <Clover.Label as="span" />;
  return (
    <nav
      className="clover-template-lightbox-trail"
      aria-label={nameLang ? undefined : t("templateTrail")}
      aria-labelledby={nameLang ? `${id}-trail` : undefined}
    >
      {nameLang && (
        <span hidden id={`${id}-trail`} lang={nameLang}>
          {t("templateTrail")}
        </span>
      )}
      <ol>
        {collection ? (
          <>
            <li>
              <button type="button" onClick={onOut}>
                <Clover.Label
                  as="span"
                  label={collection.label as Clover.LabelProps["label"]}
                />
              </button>
            </li>
            <li>{manifest}</li>
          </>
        ) : (
          <li>
            <button type="button" onClick={onOut}>
              {manifest}
            </button>
          </li>
        )}
      </ol>
    </nav>
  );
}
