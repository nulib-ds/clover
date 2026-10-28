import React, { useEffect, useRef, useState } from "react";

import * as Clover from "../../parts";
import type { PanelLayout, RootProps } from "../../parts";
import { useDrawer } from "../shared/useDrawer";
import { useFollowFocus } from "../shared/useFollowFocus";
import { useWideEnough } from "../shared/useSlide";
import type DocumentPanelPart from "./DocumentPanel";
import { Sheets } from "./Sheets";

// The information panel, a chunk of its own (`DocumentPanel`).
const loadPanel = () => import("./DocumentPanel");

export type DocumentProps = Omit<RootProps, "children"> & {
  /**
   * Whether the page thumbnails start shown beside the page. Default `true`. On a phone,
   * where they would float over the page, they start put away.
   */
  defaultSidebarOpen?: boolean;
  /**
   * Whether the information panel starts open beside the page. Default `false`. Where it
   * has no room there and would slide over the page, it starts closed.
   */
  defaultPanelOpen?: boolean;
  /**
   * How the information panel lays out its sections: `"accordion"` (the default, as
   * Default's), stacked boxes each opened by its heading, or `"tabs"`.
   */
  panelLayout?: PanelLayout;
  /** The downloads in the toolbar, as links: the page's and the Manifest's `rendering`. Default `true`. */
  download?: boolean;
  /**
   * The languages to read the resource in, beside the panel's About heading, where what
   * it says of itself comes in several (the Panel's `languages`). Default `true`.
   */
  languages?: boolean;
  /**
   * The title's heading level, to fit the outline of the page around the layout (under
   * an `h2`, 3). The panel's sections, and the downloads' groups, are a level below
   * it. Default 2.
   */
  headingLevel?: number;
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
  languages = true,
  headingLevel = 2,
  storageKey = "clover-template-document",
  ...root
}: DocumentProps) {
  // Past h6 the title is no heading, and names the Viewer instead (`Clover.titled`).
  const title = Clover.titled(
    headingLevel,
    `${Clover.useUniqueId().replace(/:/g, "")}-title`,
  );
  return (
    <Clover.Root
      className={["clover-template-document", className]
        .filter(Boolean)
        .join(" ")}
      {...title.group}
      {...root}
    >
      <DocumentLayout
        title={title}
        defaultSidebarOpen={defaultSidebarOpen}
        defaultPanelOpen={defaultPanelOpen}
        panelLayout={panelLayout}
        download={download}
        languages={languages}
        headingLevel={headingLevel}
        storageKey={storageKey}
      />
    </Clover.Root>
  );
}

/** The heading level under another. Past 6, the parts' titles name what they head. */
const below = (level: number) => level + 1;

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
/**
 * Narrower than this (a phone, or a narrow column of a wide page: the template measures
 * its own width), the thumbnails float over the page instead.
 */
const SIDEBAR_BESIDE_REM = 40;

function DocumentLayout({
  defaultSidebarOpen,
  defaultPanelOpen,
  download,
  languages,
  headingLevel = 2,
  storageKey,
  panelLayout,
  title,
}: { title: Clover.Titled } & Pick<
  DocumentProps,
  | "defaultSidebarOpen"
  | "defaultPanelOpen"
  | "download"
  | "languages"
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
  const id = Clover.useUniqueId().replace(/:/g, "");
  const navigation = Clover.useNavigation();
  const panes = useRef<HTMLElement>(null);
  /*
   * The page thumbnails' toggle is where they are: on the spine, the bar between them and
   * the page (on a phone, where they float over it, their inner edge), while they show,
   * so they keep their pane's whole height; and over the page's top left while they are
   * put away. So every press moves it, and focus on it, or in the pane as the pane goes,
   * follows it to its new place (`useDrawer`). On a phone, opened, they take focus at the
   * page the reader is on, and can be dragged back off to the start.
   */
  const sidebarSpine = useRef<HTMLDivElement>(null);
  const followFocus = useFollowFocus();
  const sidebar = useDrawer({
    id: `${id}-sidebar`,
    beside: useWideEnough(panes, SIDEBAR_BESIDE_REM),
    defaultOpen: defaultSidebarOpen ?? true,
    side: "start",
    focus: (pane) =>
      pane.querySelector<HTMLElement>('[role="option"][aria-selected="true"]'),
    slides: false,
    alongside: sidebarSpine,
    followFocus,
  });
  /*
   * Thumbnails only when there is more than one page to choose. Until the content has
   * loaded there are none, so a one-page document never shows an empty sidebar first.
   * The pane stays in the tree, hidden, so the page beside it is never remounted.
   */
  const pages = navigation.total > 1;
  const showSidebar = pages && sidebar.open;
  /*
   * The panel sits beside the page, its own pane with a bar to share the width, where
   * there is room for both, as Default's does; where there is not, it slides over the
   * page, takes focus, and closes on its own button, Escape, a press on the page beside
   * it, or a drag back off to the end. Its toggle sits on the spine, the bar between the
   * pages and the panel, while the panel is open beside them, and among the Canvas's
   * controls otherwise; a press moves it, and focus follows it there.
   */
  const panel = useDrawer({
    id: `${id}-panel`,
    beside: useWideEnough(panes, BESIDE_REM + (showSidebar ? SIDEBAR_REM : 0)),
    defaultOpen: Boolean(defaultPanelOpen),
    side: "end",
    followFocus,
  });
  const over = panel.over;
  /*
   * The panel's code loads as the reader reaches for its toggle (pointed at or focused),
   * or as it opens (the host's, or beside the page again). A first press waits for it,
   * then opens the panel whole, so focus has its section to go to.
   */
  const [PanelPart, setPanelPart] = useState<typeof DocumentPanelPart>();
  const loadPart = () =>
    loadPanel().then((module) => setPanelPart(() => module.default));
  useEffect(() => {
    if (panel.open) void loadPart();
  }, [panel.open]);
  const reach = (event: React.SyntheticEvent) => {
    if (
      !PanelPart &&
      (event.target as Element).closest?.(`[aria-controls~="${id}-panel"]`)
    )
      void loadPart();
  };

  // Over the page the thumbnails cover it: choosing a page puts them away.
  const choose = () => {
    if (sidebar.over) sidebar.close();
  };

  const docked = !over && panel.open;
  // Each toggle on its spine is placed by the stylesheet (`Document.css`): over the
  // thumbnails it belongs to, but for its far rounded end, over the page.
  const panelToggle = (
    <Clover.PanelToggle
      open={panel.open}
      onOpenChange={(next) =>
        next && !PanelPart
          ? loadPart().then(() => panel.setOpen(true))
          : panel.setOpen(next)
      }
      controls={`${id}-panel`}
    />
  );

  const toggle = pages && (
    <button
      type="button"
      className="clover-template-document-sidebar-toggle"
      aria-expanded={sidebar.open}
      aria-controls={`${id}-sidebar`}
      lang={langOf("templateSidebarToggle")}
      onClick={() => sidebar.setOpen(!sidebar.open)}
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
        fill={sidebar.open ? "currentColor" : "none"}
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
          as={title.as}
          className="clover-template-document-title"
          {...title.title}
        />
        {download && <Clover.Download headingLevel={below(headingLevel)} />}
        {/*
         * Who provided it: each provider's logo at the toolbar's end, linked to its
         * homepage and named by the provider (Mat, 2026-10-24).
         */}
        <Clover.Provider className="clover-template-document-provider">
          <Clover.Logo />
        </Clover.Provider>
      </header>
      {/* The Body shows the loading; announced here, nothing moves. */}
      <Clover.Status loading={false} />
      <Clover.Split
        ref={panes}
        className="clover-template-document-panes clover-template-panes"
        data-sidebar={showSidebar ? "open" : "closed"}
        data-narrow={sidebar.over || undefined}
        data-panel={over ? "over" : "beside"}
        storageKey={storageKey || undefined}
        onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
          // Escape anywhere puts what floats over the page away, the panel first,
          // uncovering a control focus reached under it, and leaves focus there (the
          // panel's own Escape, handled first, hands focus to its toggle).
          panel.onKeyDown(event);
          sidebar.onKeyDown(event);
        }}
        onPointerOver={reach}
        onFocus={reach}
      >
        <Clover.SplitPane
          ref={sidebar.pane}
          as="aside"
          id={`${id}-sidebar`}
          name="sidebar"
          className="clover-template-document-sidebar"
          aria-label={sidebarLang ? undefined : t("templateSidebar")}
          aria-labelledby={sidebarLang ? `${id}-sidebar-name` : undefined}
          size="13rem"
          // On a phone Items slides over the Canvas, so it takes no room from it.
          min={sidebar.over ? undefined : "8rem"}
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
        {/* The bar between the thumbnails and the page; none where they cover it. */}
        {showSidebar && !sidebar.over && (
          <Clover.SplitHandle aria-controls={`${id}-sidebar`} />
        )}
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
          min={(showSidebar && !sidebar.over) || docked ? PAGE_MIN : undefined}
        >
          {/* Put away, their toggle waits over the page's top left. */}
          {pages && !sidebar.open && (
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
          <div className="clover-template-document-spine">{panelToggle}</div>
        )}
        <Clover.SplitPane
          ref={panel.pane}
          id={`${id}-panel`}
          data-spine={over || undefined}
          name="panel"
          className="clover-template-document-panel clover-template-drawer"
          size="24rem"
          min={over ? undefined : PANEL_MIN}
          data-open={panel.opened}
          hidden={!panel.shown}
        >
          {/*
           * Over the page it floats, so Escape and its own button put it away too. Its
           * About offers no downloads: the toolbar has them.
           */}
          {PanelPart && (
            <PanelPart
              layout={panelLayout}
              headingLevel={below(headingLevel)}
              download={false}
              languages={languages}
              onClose={over ? panel.close : undefined}
              closeOnEscape={over}
            />
          )}
        </Clover.SplitPane>
        {/* A press on the page beside what covers it puts that away. */}
        {panel.scrim && (
          <div
            className="clover-template-document-scrim clover-template-scrim"
            {...panel.scrim}
          />
        )}
        {pages && sidebar.scrim && (
          <div
            className="clover-template-document-scrim clover-template-scrim"
            data-for="sidebar"
            {...sidebar.scrim}
          />
        )}
      </Clover.Split>
    </>
  );
}
