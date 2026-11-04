import React, { Suspense, lazy, useEffect, useRef } from "react";

import * as Clover from "../../parts";
import type {
  CloverCanvasOptions,
  PanelLayout,
  PanelSection,
  PanelSectionLabels,
} from "../../parts";
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
  /**
   * The panel's sections, from Clover's own: with
   * `["contents", "search", "transcript", "annotations"]` it has those four, each still
   * only where the resource has data for it, and no panel at all where it has none of
   * them. Default: every section.
   */
  panelSections?: readonly PanelSection[];
  /**
   * What a panel section's tab or heading says, in place of Clover's own word for it:
   * `{ annotations: "Chapters" }`, or a word by language tag to say it in several (the
   * Panel's `labels`).
   */
  panelLabels?: PanelSectionLabels;
  /** The downloads in the panel's About, where there is a `rendering`. Default `true`. */
  download?: boolean;
  /** The languages to read the resource in, beside the panel's About heading. Default `true`. */
  languages?: boolean;
  /** Where the panel's width is remembered once dragged; `false` forgets it. */
  storageKey?: string | false;
  /** The Body's `collapseControls`: when the view's controls collapse behind one button. */
  collapseControls?: "auto" | "always";
  /** The Body's Canvas `options`: its gestures, zoom limits and motion. */
  canvasOptions?: CloverCanvasOptions;
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
 * Root is inert but what speaks, focus is on the view in its strip (on Close with the
 * pager), Tab comes round inside it, and Escape, Close, Back or a press on the layer
 * outside the panel closes it, focus going back to the grid's cell of the view shown.
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
    /*
     * Modal within the layout: the rest of the Root is out of reach (WCAG 2.4.3), but
     * not what speaks: the Root's announcer, which tells of each move, and the Status,
     * which tells that a member chosen in the lightbox is loading (4.1.3).
     */
    const others = Array.from(root.children).filter(
      (child): child is HTMLElement =>
        child !== element &&
        !child.classList.contains("clover-announcer") &&
        !child.classList.contains("clover-status"),
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
    /*
     * And where a browser's own Tab leaves it all the same (WebKit's skips links, so
     * from the stop before one it goes on past the dialog, to the document itself): once
     * a Tab from inside has moved focus, focus outside comes back, to the dialog's first
     * stop, or its last for Shift+Tab. Only a Tab: a pointer's press on the page around
     * the layout is its own.
     */
    const doc = element.ownerDocument;
    let check: ReturnType<typeof setTimeout> | undefined;
    const onTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panel.current?.contains(event.target as Node))
        return;
      const back = event.shiftKey;
      clearTimeout(check);
      check = setTimeout(() => {
        const dialog = panel.current;
        if (!dialog || dialog.contains(doc.activeElement)) return;
        const stops = stopsOf(dialog);
        (back ? stops.at(-1) : stops[0])?.focus();
      });
    };
    doc.addEventListener("keydown", onTab, true);
    return () => {
      doc.removeEventListener("keydown", onTab, true);
      clearTimeout(check);
      others.forEach((child) => (child.inert = false));
      /*
       * Back to the view now shown, in the grid that opened it (the strip may have
       * stepped on from the one opened), else to what opened it, brought into sight: the
       * grid may have scrolled its box to keep the shown view's cell in view (2.4.3,
       * 2.4.11).
       */
      const shown = opener
        ?.closest('[role="listbox"]')
        ?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
      const back = shown ?? opener;
      if (!back?.isConnected) return;
      back.focus({ preventScroll: true });
      back.scrollIntoView?.({ block: "nearest" });
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
        if (event.defaultPrevented) return;
        if (event.key === "Tab" && panel.current) {
          wrapFocus(panel.current, event);
          return;
        }
        if (event.key !== "Escape") return;
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

/** What Tab stops on: what takes focus, shown and live (not inert, nor disabled). */
const STOPS =
  'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/** The dialog's stops, in their order. */
const stopsOf = (dialog: HTMLElement) =>
  Array.from(dialog.querySelectorAll<HTMLElement>(STOPS)).filter(
    (stop) =>
      stop.tabIndex >= 0 &&
      !stop.matches(":disabled") &&
      !stop.closest("[inert]") &&
      (stop.checkVisibility?.({ visibilityProperty: true }) ?? true),
  );

/**
 * Tab from the dialog's last stop comes round to its first, and Shift+Tab from its first
 * to its last, as a modal dialog keeps focus (`aria-modal`; 4.0.0's `showModal()` did):
 * the rest of the Root is inert, so Tab would go on into the page around it, which a
 * screen reader hides while the dialog is modal. Only the keyboard's way out is held: a
 * pointer still reaches the page around the layout, which the lightbox does not cover.
 */
function wrapFocus(dialog: HTMLElement, event: React.KeyboardEvent) {
  const stops = stopsOf(dialog);
  const first = stops[0];
  const last = stops.at(-1);
  if (!first || !last) return;
  const at = dialog.ownerDocument.activeElement;
  if (event.shiftKey ? at === first : at === last) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
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
