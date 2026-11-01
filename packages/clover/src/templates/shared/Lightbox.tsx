import React, { Suspense, lazy, useEffect, useRef } from "react";

import * as Clover from "../../parts";
import type { PanelLayout } from "../../parts";
import { useGivenAnnotations } from "./givenAnnotations";

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
 * 2026-10-30: "backdrop should not extend beyond the bounds of the template"): over it,
 * a step back to the level it opened from, the Manifest's label as its title (Mat,
 * 2026-11-01: "the Manifest label stay up here in the title and be more obvious as a
 * heading") and Close; then the Body, the view's label under it (Mat, 2026-11-01: "move
 * the Canvas/Scene/Timeline label below the item"), and a short strip of thumbnails (Mat,
 * 2026-11-01: "carousel by default") or the pager (with the position). A modal
 * `<dialog>`'s backdrop always covers the whole window, so this is a layer in the Root, a
 * `dialog` to assistive technology, named by its title: while it is open the rest of the
 * Root is inert, focus is on the view in its strip (on Close with the pager), and Escape,
 * Close, Back or a press on the layer outside the panel closes it, focus going back to
 * what opened it.
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
  const viewTitleId = `${baseId}-view`;
  // Named by its title, the Manifest's label, else by its view's, so it always has a name.
  const manifestLabel = Clover.useLocalized(Clover.useManifest()?.label);
  const named = manifestLabel.text ? titleId : viewTitleId;
  // The grid's annotations, given as the content: the strip steps through them.
  const given = Boolean(useGivenAnnotations());
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
            <Back onOut={onClose} />
            {/* Past h6 no heading; the dialog is named by it either way. */}
            <Clover.Label
              as={Clover.titled(headingLevel, titleId).as}
              id={titleId}
              className="clover-template-lightbox-title clover-template-title clover-title"
            />
            {/* Hidden: a name reads it at once; the view's label under the Body loads later. */}
            {named === viewTitleId && (
              <Clover.Label of="canvas" id={viewTitleId} hidden />
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
              annotations={given}
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
 * A step back out to the level the lightbox opened from (Mat, 2026-11-01: "I do not like
 * the breadcrumb. but we want to retain ability to toggle back obviously to the level
 * above it"): the grid, a Collection's members or a Manifest's views. A round control at
 * the header's start, as Close is at its end, its caret pointing back (mirrored in a
 * language written right to left), named for where it goes, "Back to" the Collection's
 * label, the annotations' page's or the Manifest's; pressed, the lightbox closes, focus
 * going back to the cell.
 */
function Back({ onOut }: { onOut: () => void }) {
  const t = Clover.useT();
  const langOf = Clover.useLangOf();
  const collection = Clover.useCloverSelector((state) =>
    state.throughCollection ? state.collection : null,
  );
  // Opened on annotations given as the content, back to them, by their page's label.
  const set = useGivenAnnotations();
  const manifest = Clover.useManifest();
  const above = Clover.useLocalized(
    (set ? set.label : (collection?.label ?? manifest?.label)) as Parameters<
      typeof Clover.useLocalized
    >[0],
  );
  const key = above.text ? "templateBackTo" : "templateBack";
  const label = t(key, { label: above.text });
  return (
    <button
      type="button"
      className="clover-template-lightbox-back"
      aria-label={label}
      lang={langOf(key)}
      onClick={onOut}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        width="16"
        height="16"
        viewBox="0 0 16 16"
      >
        <path
          d="M10 3L5 8l5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <Clover.Tip label={label} lang={langOf(key)} />
    </button>
  );
}
