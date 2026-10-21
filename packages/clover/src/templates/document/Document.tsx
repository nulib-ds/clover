import React, { useEffect, useId, useRef, useState } from "react";

import * as Clover from "../../parts";
import type { PanelLayout, RootProps } from "../../parts";
import { useDragToClose } from "../shared/useDragToClose";
import { useFocusOnOpen, useSlide, useWideEnough } from "../shared/useSlide";
import { useFollowFocus } from "../shared/useFollowFocus";
import { useSpine } from "../shared/useSpine";
import { Sheets } from "./Sheets";

export type DocumentProps = Omit<RootProps, "children"> & {
  /** Whether the page thumbnails start shown. Default: shown on a wide screen. */
  defaultSidebarOpen?: boolean;
  /** Whether the information panel starts open. Default `false`. */
  defaultPanelOpen?: boolean;
  /**
   * How the information panel lays out its sections: `"accordion"` (the default, as
   * Default's), stacked boxes each opened by its heading, or `"tabs"`.
   */
  panelLayout?: PanelLayout;
  /** A Download button in the toolbar, listing the Manifest's and the page's `rendering`. Default `true`. */
  download?: boolean;
  /**
   * The title's heading level, to fit the outline of the page around the layout (under
   * an `h2`, 3). The panel's sections, and the Download menu's groups, are a level below
   * it. Default 2.
   */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /**
   * Where the thumbnails' width is remembered once the reader drags the bar beside them
   * (`localStorage`). Default `"clover-template-document"`; `false` forgets it.
   */
  storageKey?: string | false;
};

/**
 * A layout that reads like a PDF viewer: a toolbar, page thumbnails down the left, and
 * the pages down one column, a spread to a sheet, the top of the next always showing:
 * scrolling moves through them as a PDF reader's continuous view does, coming to rest on
 * a sheet near its top, and PageUp and PageDown go a sheet at a time (`Sheets.tsx`). A
 * bar between the thumbnails and the pages widens or narrows them. The information panel sits to the right of the page, with its own bar,
 * where there is room for both, and slides out over the page where there is not. Size
 * it with `--clover-template-document-height`.
 */
export function Document({
  className,
  defaultSidebarOpen,
  defaultPanelOpen = false,
  panelLayout = "accordion",
  download = true,
  headingLevel = 2,
  storageKey = "clover-template-document",
  ...root
}: DocumentProps) {
  return (
    <Clover.Root
      className={["clover-template-document", className]
        .filter(Boolean)
        .join(" ")}
      {...root}
    >
      <DocumentLayout
        defaultSidebarOpen={defaultSidebarOpen}
        defaultPanelOpen={defaultPanelOpen}
        panelLayout={panelLayout}
        download={download}
        headingLevel={headingLevel}
        storageKey={storageKey}
      />
    </Clover.Root>
  );
}

const NARROW = "(max-width: 40rem)";

/** The heading level under another, no deeper than 6. */
const below = (level: number) => Math.min(level + 1, 6) as 2 | 3 | 4 | 5 | 6;

/** The narrowest the page and the panel may be dragged, side by side. */
const PAGE_MIN = "16rem";
const PANEL_MIN = "14rem";
/**
 * The room the page and the panel need beside each other, with the bar between them,
 * and the thumbnails' narrowest and their bar when they show. Any narrower and the panel
 * slides over the page instead.
 */
const BESIDE_REM = 16 + 14 + 1;
const SIDEBAR_REM = 8 + 1;

function DocumentLayout({
  defaultSidebarOpen,
  defaultPanelOpen,
  download,
  headingLevel = 2,
  storageKey,
  panelLayout,
}: Pick<
  DocumentProps,
  | "defaultSidebarOpen"
  | "defaultPanelOpen"
  | "download"
  | "headingLevel"
  | "storageKey"
  | "panelLayout"
>) {
  const t = Clover.useT();
  const langOf = Clover.useLangOf();
  /*
   * The sidebar's name. In a language other than the page's (the reader's, or a string
   * that fell back), it is a hidden element's, which carries its `lang`; Items then
   * names its own list.
   */
  const sidebarLang = langOf("templateSidebar");
  const id = useId().replace(/:/g, "");
  const navigation = Clover.useNavigation();
  const [sidebar, setSidebar] = useState(
    () =>
      defaultSidebarOpen ??
      !(typeof window !== "undefined" && window.matchMedia?.(NARROW).matches),
  );
  /*
   * Thumbnails only when there is more than one page to choose. Until the content has
   * loaded there are none, so a one-page document never shows an empty sidebar first.
   * The pane stays in the tree, hidden, so the page beside it is never remounted.
   */
  const pages = navigation.total > 1;
  const showSidebar = pages && sidebar;
  const [panel, setPanel] = useState(Boolean(defaultPanelOpen));
  /*
   * The panel sits beside the page, its own pane with a bar to share the width, where
   * there is room for both, as Default's does; where there is not, it slides over the
   * page, takes focus, and closes on its own button or Escape.
   */
  const body = useRef<HTMLElement>(null);
  const beside = useWideEnough(
    body,
    BESIDE_REM + (showSidebar ? SIDEBAR_REM : 0),
  );
  const over = !beside;
  const slide = useSlide(over && panel);
  const panelRef = useRef<HTMLElement>(null);
  useFocusOnOpen(panelRef, over && slide.mounted);
  const panelShown = over ? slide.mounted : panel;

  /*
   * Whatever floats over the page can be dragged back off the way it came, as an app's
   * drawer can, and a press on the page beside it puts it away: the panel to the end, and
   * on a phone the thumbnails to the start.
   */
  const narrow = useMatches(NARROW);
  const panelPane = useRef<HTMLElement>(null);
  const sidebarPane = useRef<HTMLElement>(null);
  const sidebarToggle = useRef<HTMLButtonElement>(null);
  // Focus in a pane as it goes is handed to its toggle, never left on what is hidden.
  const closePanel = () => {
    if (panelPane.current?.contains(document.activeElement))
      document
        .querySelector<HTMLElement>(`[aria-controls~="${id}-panel"]`)
        ?.focus();
    setPanel(false);
  };
  /*
   * The page thumbnails' toggle is where they are: on the spine, the bar between them and
   * the page (on a phone, where they float over it, their inner edge), while they show,
   * so they keep their pane's whole height; and over the page's top left while they are
   * put away. So every press moves it, and focus on it, or in the pane as the pane goes,
   * follows it to its new place.
   */
  const sidebarSpine = useRef<HTMLDivElement>(null);
  const followFocus = useFollowFocus();
  const followToggle = () => followFocus(() => sidebarToggle.current);
  const toggleSidebar = () => {
    followToggle();
    setSidebar((open) => !open);
  };
  const closeSidebar = () => {
    if (sidebarPane.current?.contains(document.activeElement)) followToggle();
    setSidebar(false);
  };
  const scrim = useRef<HTMLDivElement>(null);
  useDragToClose(panelPane, {
    enabled: over && slide.open,
    side: "end",
    onClose: closePanel,
    scrim,
  });
  useDragToClose(sidebarPane, {
    enabled: narrow && showSidebar,
    side: "start",
    onClose: closeSidebar,
    alongside: sidebarSpine,
    exits: true,
  });

  // On a narrow screen the sidebar covers the page: choosing a page puts it away.
  const choose = () => {
    if (window.matchMedia?.(NARROW).matches) closeSidebar();
  };

  /*
   * The panel's toggle sits on the spine, the bar between the pages and the panel, while
   * the panel is open beside them, and among the Canvas's controls otherwise; a press
   * moves it, and focus follows it there.
   */
  const docked = !over && panel;
  const spine = useRef<HTMLDivElement>(null);
  const main = (element: React.RefObject<HTMLElement | null>) => () =>
    element.current?.parentElement?.querySelector<HTMLElement>(
      ".clover-template-document-main",
    );
  useSpine(spine, main(spine), docked);
  // Over the thumbnails it belongs to, but for its far rounded end, over the page.
  useSpine(sidebarSpine, main(sidebarSpine), showSidebar, { cap: true });
  const panelToggle = (
    <Clover.PanelToggle
      open={panel}
      onOpenChange={(next) => {
        if (!over)
          followFocus(() =>
            document.querySelector<HTMLElement>(
              `[data-button="panel"][aria-controls~="${id}-panel"]`,
            ),
          );
        setPanel(next);
      }}
      controls={`${id}-panel`}
    />
  );

  const toggle = pages && (
    <button
      ref={sidebarToggle}
      type="button"
      className="clover-template-document-sidebar-toggle"
      aria-expanded={sidebar}
      aria-controls={`${id}-sidebar`}
      lang={langOf("templateSidebarToggle")}
      onClick={toggleSidebar}
    >
      {/*
       * A toggle, plainly: a list of thumbnails, each a small picture beside a line,
       * the pictures filled while the list shows; and where the reader is. Its name
       * is what it does, then the place in words ("Item 3 of 17").
       */}
      <svg
        aria-hidden="true"
        focusable="false"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill={sidebar ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="1.5" y="2" width="5.5" height="4.5" rx="1" />
        <rect x="1.5" y="9.5" width="5.5" height="4.5" rx="1" />
        <path d="M9.5 4.25h5M9.5 11.75h5" fill="none" />
      </svg>
      <span style={Clover.visuallyHidden}>{t("templateSidebarToggle")}</span>
      <Clover.Position className="clover-template-document-position" />
      <Clover.Tip label={t("templateSidebarToggle")} />
    </button>
  );

  return (
    <>
      <header className="clover-template-document-toolbar">
        <Clover.Label
          as={`h${headingLevel}`}
          className="clover-template-document-title"
        />
        {download && <Clover.Download headingLevel={below(headingLevel)} />}
      </header>
      {/* Its stage shows the loading; announced here, nothing moves. */}
      <Clover.Status loading={false} />
      <Clover.Split
        ref={body}
        className="clover-template-document-body"
        data-sidebar={showSidebar ? "open" : "closed"}
        data-panel={over ? "over" : "beside"}
        storageKey={storageKey || undefined}
        onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
          // Escape anywhere puts the floating panel away, uncovering a control focus
          // reached under it, and leaves focus there (the panel's own Escape, handled
          // first, hands focus to its toggle).
          if (
            over &&
            panel &&
            event.key === "Escape" &&
            !event.defaultPrevented
          ) {
            event.preventDefault();
            setPanel(false);
          }
        }}
      >
        <Clover.SplitPane
          ref={sidebarPane}
          as="aside"
          id={`${id}-sidebar`}
          name="sidebar"
          className="clover-template-document-sidebar"
          aria-label={sidebarLang ? undefined : t("templateSidebar")}
          aria-labelledby={sidebarLang ? `${id}-sidebar-name` : undefined}
          size="13rem"
          // On a phone Items slides over the Canvas, so it takes no room from it.
          min={narrow ? undefined : "8rem"}
          max="24rem"
          hidden={!showSidebar}
        >
          {sidebarLang && (
            <span hidden id={`${id}-sidebar-name`} lang={sidebarLang}>
              {t("templateSidebar")}
            </span>
          )}
          <Clover.Items
            layout="list"
            aria-label={sidebarLang ? undefined : t("templateSidebar")}
            thumbnailSize={320}
            onSelect={choose}
          />
        </Clover.SplitPane>
        {/* The bar between the thumbnails and the page; hidden where they cover it. */}
        {showSidebar && <Clover.SplitHandle aria-controls={`${id}-sidebar`} />}
        {/* Open, their toggle on its spine, right after the bar (on a phone, the edge). */}
        {showSidebar && (
          <div
            ref={sidebarSpine}
            className="clover-template-document-spine"
            data-for="sidebar"
          >
            {toggle}
          </div>
        )}
        <Clover.SplitPane
          className="clover-template-document-main"
          // A minimum only beside another pane: Items, or the Panel docked.
          min={
            (showSidebar && !narrow) || (panel && !over) ? PAGE_MIN : undefined
          }
        >
          {/* Put away, their toggle waits over the page's top left. */}
          {pages && !sidebar && (
            <div className="clover-template-document-sidebar-closed">
              {toggle}
            </div>
          )}
          {/* The pages, and the one Canvas, which holds the panel's toggle. */}
          <Sheets>{!docked && panelToggle}</Sheets>
        </Clover.SplitPane>
        {/* The bar between the page and the panel beside it; over the page, none. */}
        {docked && <Clover.SplitHandle aria-controls={`${id}-panel`} />}
        {/* Open beside the pages, its toggle on the spine, right after the bar. */}
        {docked && (
          <div ref={spine} className="clover-template-document-spine">
            {panelToggle}
          </div>
        )}
        <Clover.SplitPane
          ref={panelPane}
          id={`${id}-panel`}
          data-spine={over || undefined}
          name="panel"
          className="clover-template-document-panel"
          size="24rem"
          min={over ? undefined : PANEL_MIN}
          data-open={over ? slide.open : panel}
          hidden={!panelShown}
        >
          {/* Over the page it floats, so Escape and its own button put it away too. */}
          <Clover.Panel
            ref={panelRef}
            layout={panelLayout}
            headingLevel={below(headingLevel)}
            onClose={over ? () => setPanel(false) : undefined}
            closeOnEscape={over}
          />
        </Clover.SplitPane>
        {/*
         * A press on the page beside what covers it puts that away. It takes no focus, so
         * focus in the pane is still there to hand back to its toggle, never left to fall
         * to the page (WCAG 2.4.3).
         */}
        {over && slide.mounted && (
          <div
            ref={scrim}
            className="clover-template-document-scrim"
            data-open={slide.open}
            aria-hidden="true"
            onMouseDown={(event) => event.preventDefault()}
            onClick={closePanel}
          />
        )}
        {narrow && showSidebar && (
          <div
            className="clover-template-document-scrim"
            data-for="sidebar"
            data-open="true"
            aria-hidden="true"
            onMouseDown={(event) => event.preventDefault()}
            onClick={closeSidebar}
          />
        )}
      </Clover.Split>
    </>
  );
}

/** Whether a media query matches, following it as it changes. */
function useMatches(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return;
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener?.("change", update);
    return () => list.removeEventListener?.("change", update);
  }, [query]);
  return matches;
}
