import React, {
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import * as Clover from "../../parts";
import type {
  CloverCanvasOptions,
  PanelLayout,
  PanelSection,
  PanelSectionLabels,
  RootProps,
} from "../../parts";
import { preloadDrag } from "../shared/useDragToClose";
import { useDrawer } from "../shared/useDrawer";
import { useFollowFocus } from "../shared/useFollowFocus";
import {
  BESIDE_REM,
  PAGE_MIN,
  PANEL_MIN,
  useWideEnough,
} from "../shared/useSlide";
import { Sheets } from "./Sheets";
import { SectionControls } from "./SectionControls";
import { ViewControls } from "./ViewControls";
import { hasInformation, usePageMarks, useViewCanvases } from "./marks";
import { mediaOf } from "./media";

/* A section's content, loaded as the aside first opens (`SectionContent.tsx`). */
const SectionContent = lazy(() => import("./SectionContent"));
const ExpandedMap = lazy(() =>
  import("./SectionContent").then((module) => ({
    default: module.ExpandedMap,
  })),
);

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export type DocumentProps = Omit<RootProps, "children"> & {
  /**
   * Whether the page thumbnails start shown beside the page. By default, where the
   * resource has several pages, and put away for a single one (Mat, 2026-11-10: "if only
   * one item, automatically close this sidebar by default at open"). On a phone, where
   * they would float over the page, they start put away.
   */
  defaultSidebarOpen?: boolean;
  /**
   * The page thumbnails, and their toggle, where the resource has one page too. Default
   * `true` (Mat, 2026-11-09: "on single canvas items, still show the left bar"); `false`
   * leaves them out for a single page, which has nothing to choose between.
   */
  singleItem?: boolean;
  /**
   * Whether the information panel starts open beside the page. Default `false`. Where it
   * has no room there and would slide over the page, it starts closed.
   */
  defaultPanelOpen?: boolean;
  /**
   * Not read by Document, whose aside shows one section at a time, chosen by its toolbar
   * button: kept so a page that gives it keeps working. Default's and Gallery's panels
   * read it.
   */
  panelLayout?: PanelLayout;
  /**
   * The sections the toolbar offers, each a button opening it alone in the aside, from
   * Clover's own: with `["contents", "search", "transcript", "annotations"]` those four,
   * each still only where the resource has data for it. Default: every section.
   */
  panelSections?: readonly PanelSection[];
  /**
   * What a section's button and the aside's heading say, in place of its word in Clover's
   * interface language: `{ annotations: "Chapters" }`, or a word by language tag to say
   * it in several (the Panel's `labels`).
   */
  panelLabels?: PanelSectionLabels;
  /**
   * The downloads behind the toolbar's Download button: the page's and the Manifest's
   * `rendering`. Default `true`.
   */
  download?: boolean;
  /**
   * Where what the resource says of itself comes in several languages, a globe first
   * among the toolbar's controls, which offers them (`Clover.Language`). Default `true`.
   */
  languages?: boolean;
  /**
   * Whether the globe also offers Clover's interface languages that the resource has none
   * of. Default `true`.
   */
  interfaceLanguages?: boolean;
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
  /**
   * When the Body's view controls (zoom, the turns, reset, full screen) wait behind
   * More: `"auto"` (the default), only where its row cannot hold them all; `"always"`.
   * The Body's `collapseControls`.
   */
  collapseControls?: "auto" | "always";
  /** The Body's Canvas `options`: its gestures, zoom limits and motion. */
  canvasOptions?: CloverCanvasOptions;
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
  singleItem = true,
  defaultPanelOpen = false,
  panelSections,
  panelLabels,
  download = true,
  headingLevel = 2,
  storageKey = "clover-template-document",
  collapseControls,
  canvasOptions,
  ...given
}: DocumentProps) {
  // The Panel's own prop, which Document does not read, left out of the Root's.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { panelLayout, languages, interfaceLanguages, ...root } = given;
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
        singleItem={singleItem}
        defaultPanelOpen={defaultPanelOpen}
        panelSections={panelSections}
        panelLabels={panelLabels}
        download={download}
        languages={languages}
        interfaceLanguages={interfaceLanguages}
        headingLevel={headingLevel}
        storageKey={storageKey}
        collapseControls={collapseControls}
        canvasOptions={canvasOptions}
      />
    </Clover.Root>
  );
}

/** Each section's name, in Clover's interface language, as the Panel names it. */
const SECTION_KEYS: Record<PanelSection, string> = {
  about: "informationPanelTabsAbout",
  targets: "informationPanelTabsTargets",
  collection: "informationPanelTabsCollection",
  contents: "informationPanelTabsContents",
  search: "informationPanelTabsSearch",
  map: "informationPanelTabsMap",
  transcript: "transcriptLabel",
  annotations: "informationPanelTabsAnnotations",
};

/** The heading level under another. Past 6, the parts' titles name what they head. */
const below = (level: number) => level + 1;

/**
 * Beside the page and the panel (`BESIDE_REM`), the thumbnails' narrowest and their bar,
 * when they show. Any narrower and the panel slides over the page instead.
 */
const SIDEBAR_REM = 8 + 1;
/**
 * Narrower than this (a phone, or a narrow column of a wide page: the template measures
 * its own width), the thumbnails float over the page instead.
 */
const SIDEBAR_BESIDE_REM = 40;
/** A toolbar this wide holds Search's field open beside the title and the controls. */
const SEARCH_OPEN_REM = 56;

function DocumentLayout({
  defaultSidebarOpen,
  singleItem,
  defaultPanelOpen,
  download,
  languages = true,
  interfaceLanguages = true,
  headingLevel = 2,
  storageKey,
  panelSections,
  panelLabels,
  collapseControls,
  canvasOptions,
  title,
}: { title: Clover.Titled } & Pick<
  DocumentProps,
  | "defaultSidebarOpen"
  | "singleItem"
  | "defaultPanelOpen"
  | "download"
  | "languages"
  | "interfaceLanguages"
  | "headingLevel"
  | "storageKey"
  | "panelSections"
  | "panelLabels"
  | "collapseControls"
  | "canvasOptions"
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
  // Put away on its own as a resource opens (below), focus stays where it is.
  const quiet = useRef(false);
  const sidebar = useDrawer({
    id: `${id}-sidebar`,
    beside: useWideEnough(panes, SIDEBAR_BESIDE_REM),
    defaultOpen: defaultSidebarOpen ?? true,
    side: "start",
    focus: (pane) =>
      pane.querySelector<HTMLElement>('[role="option"][aria-selected="true"]'),
    slides: false,
    alongside: sidebarSpine,
    followFocus: (find) => {
      if (quiet.current) quiet.current = false;
      else followFocus(find);
    },
  });
  /*
   * Thumbnails for every page, one too, unless the host leaves one out (`singleItem`).
   * Until the content has loaded there are none, so the sidebar never shows empty first. The pane stays in the tree, hidden, so
   * the page beside it is never remounted.
   */
  /*
   * Unless the host says (`defaultSidebarOpen`), a single page's thumbnail starts put
   * away, as each resource opens, before it is drawn; a resource of several pages after
   * one brings them back, unless the reader put them away.
   */
  const manifest = Clover.useManifest();
  const manifestId = manifest?.id;
  // Its Canvases, once they are there: what it is made of, never a count on its way.
  const canvases = (manifest?.items as unknown[] | undefined)?.length ?? 0;
  const startedFor = useRef<string | undefined>(undefined);
  const putAway = useRef(false);
  useIsomorphicLayoutEffect(() => {
    if (defaultSidebarOpen !== undefined || !manifestId || !canvases) return;
    if (startedFor.current === manifestId) return;
    startedFor.current = manifestId;
    if (canvases === 1) {
      if (!sidebar.open) return;
      putAway.current = true;
      quiet.current = true;
      sidebar.setOpen(false);
    } else if (putAway.current) {
      putAway.current = false;
      if (sidebar.open) return;
      quiet.current = true;
      sidebar.setOpen(true);
    }
  });
  const pages = navigation.total > (singleItem ? 0 : 1);
  const showSidebar = pages && sidebar.open;
  /*
   * While the resource loads, the thumbnails' room is held where they will open beside
   * the page, empty, so the page beside them does not move as they arrive (a layout
   * shift of a fifth of the window); a single page, its thumbnail put away, gives it back.
   */
  const holdRoom = navigation.total === 0 && sidebar.open && !sidebar.over;
  const sidebarRoom = showSidebar || holdRoom;
  /*
   * The aside, Document's own (Mat, 2026-11-09: "each button should control a specific
   * panel section. sections should not stack as accordions or act as tabs for the Panel
   * component. they should be their own custom aside with content. handle all active
   * sections for this resource"): one section at a time, the one its toolbar button
   * chose (`SectionControls`), beside the page with a bar to share the width where there
   * is room for both, and where there is not, over the page, taking focus, put away by
   * its close button, Escape, or a press on the page beside it (`useDrawer`). Its
   * sections are those the resource has data for (`usePanelSections`), narrowed to
   * `panelSections`; its content loads as it first opens (`SectionContent`).
   */
  const { clover, language } = Clover.useClover("Document");
  const offered = Clover.usePanelSections(panelSections);
  const [section, setSection] = useState<PanelSection>("about");
  const asideId = `${id}-aside`;
  /*
   * Put away, focus goes back to the button for the section it showed, not the first of
   * them (WCAG 2.4.3): Search's field, or its magnifier, for the search's hits.
   */
  const showing = useRef(section);
  showing.current = section;
  const aside = useDrawer({
    id: asideId,
    beside: useWideEnough(panes, BESIDE_REM + (sidebarRoom ? SIDEBAR_REM : 0)),
    defaultOpen: Boolean(defaultPanelOpen),
    side: "end",
    focus: (pane) =>
      pane.querySelector<HTMLElement>(".clover-template-document-aside-close"),
    toggle: () => {
      const root = panes.current?.closest(".clover-template-document");
      return showing.current === "search"
        ? root?.querySelector<HTMLElement>(
            ".clover-template-document-search input, .clover-template-document-search-toggle",
          )
        : root?.querySelector<HTMLElement>(
            `button[aria-controls~="${asideId}"][data-section="${showing.current}"]`,
          );
    },
    followFocus,
  });
  const asideOpen = aside.open && offered.includes(section);
  // Its section gone (another resource, another view without it): put away.
  useEffect(() => {
    if (aside.open && offered.length && !offered.includes(section))
      aside.close();
    // `aside.close` is new each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offered.join(" "), section, aside.open]);
  // A button's section, or the same one again to put it away.
  const chooseSection = (next: PanelSection) => {
    // The map, expanded over the pages, goes back into the aside for its button.
    if (next === "map" && mapShown) return collapseMap();
    if (asideOpen && section === next) return aside.close();
    setSection(next);
    aside.setOpen(true);
  };
  /*
   * The aside's map, expanded over the pages, as the Canvas's map box expands into its
   * Body (Mat, 2026-11-09: "someone should be able to do this from the sidebar panel
   * map"): out of the aside, which it leaves, over the pages' column, which goes out of
   * sight and out of reach meanwhile, with the view's controls; Collapse map puts it back
   * in the aside, Close and Escape put it away. Focus goes with it each way (WCAG 2.4.3).
   */
  const [mapExpanded, setMapExpanded] = useState(false);
  const mapShown = mapExpanded && offered.includes("map");
  useEffect(() => {
    if (!offered.includes("map")) setMapExpanded(false);
    // The sections, by their names: a new array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offered.join(" ")]);
  const expandMap = () => {
    setMapExpanded(true);
    aside.setOpen(false);
    followFocus(() => document.getElementById(`${id}-map-collapse`));
  };
  const collapseMap = () => {
    setMapExpanded(false);
    setSection("map");
    aside.setOpen(true);
    followFocus(() => document.getElementById(`${id}-map-expand`));
  };
  const closeMap = () => {
    setMapExpanded(false);
    followFocus(() =>
      panes.current
        ?.closest(".clover-template-document")
        ?.querySelector<HTMLElement>(
          `button[aria-controls~="${asideId}"][data-section="map"]`,
        ),
    );
  };
  const labelOf = (key: PanelSection) => {
    const own = panelLabels?.[key];
    if (typeof own === "string") return { text: own };
    if (own) {
      const value = Clover.localize(own as never, language);
      return { text: value.text, lang: value.lang };
    }
    return { text: t(SECTION_KEYS[key]), lang: langOf(SECTION_KEYS[key]) };
  };
  // A search made in the toolbar's field opens the aside on its hits.
  const searched = () => {
    setSection("search");
    aside.setOpen(true);
  };
  // Its query cleared (the field's X), the aside's hits go with it.
  const query = Clover.useCloverSelector((state) => state.search.query);
  useEffect(() => {
    if (!query && section === "search" && aside.open) aside.close();
    // `aside.close` is new each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Over the page, reaching for the thumbnails' toggle loads the drag's code too.
  const reach = (event: React.SyntheticEvent) => {
    if (
      sidebar.over &&
      (event.target as Element).closest?.(`[aria-controls~="${id}-sidebar"]`)
    )
      preloadDrag();
  };

  // Over the page the thumbnails cover it: choosing a page puts them away.
  const choose = () => {
    if (sidebar.over) sidebar.close();
  };

  const several = navigation.total > 1;
  /*
   * Where the template's controls over the page end, `xs` on, which the Canvas's own (its
   * map, its information) start from, and their boxes hang from (`Document.css`; Mat,
   * 2026-11-09: "put this on the left"): measured from the page's start as they change
   * (the thumbnails' toggle comes and goes, the magnifier's tray opens), on the page's
   * pane, which the Canvas inherits it from. None while the template has none there.
   */
  const lead = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = lead.current;
    const main = element?.parentElement;
    if (!element || !main || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      if (!element.firstElementChild) {
        main.style.removeProperty("--clover-template-document-lead-end");
        return;
      }
      const box = element.getBoundingClientRect();
      const room = main.getBoundingClientRect();
      const end =
        getComputedStyle(main).direction === "rtl"
          ? room.right - box.left
          : box.right - room.left;
      const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
      main.style.setProperty(
        "--clover-template-document-lead-end",
        `${Math.round(end + gap)}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const docked = !aside.over && asideOpen;
  /*
   * Where the toolbar has room (a wide page), Search's field is open, its magnifier gone
   * (Mat, 2026-11-09: "on larger viewports, have it automatically be open").
   */
  const toolbar = useRef<HTMLElement>(null);
  const roomy = useWideEnough(toolbar, SEARCH_OPEN_REM) === true;
  /*
   * The full viewer: a press into a page, a zoom, or the template's magnifier (+ and −,
   * `ViewControls`) opens it over the whole of the pages' column, and the magnifier or
   * Escape closes it (Mat, 2026-11-09: "clicking into an item should expand the canvas
   * to fit the whole wrapping container"; "it should just be zoom in and zoom out like
   * the placeholder toggle"), a single page too, whose view's controls are the full
   * viewer's (Mat, 2026-11-09: "don't treat video differently across number of items").
   */
  const [expanded, setExpanded] = useState(false);
  /*
   * An annotation asked for, from the aside's lists (Annotations, a search's hits, a
   * region in Contents, a place on the map) or a hotspot, on whichever page it is: the
   * full viewer opens on it (Mat, 2026-11-10: "clicking an annotation from sidebar should
   * automatically expand the targeted resource. this should apply to all resource
   * types"). The Root goes to its Canvas, so its thumbnail is chosen and its page comes
   * under the viewer at once, not scrolled to through the pages between, and the Canvas
   * frames it, or plays from its time. A Transcript's cue pressed in the aside, which
   * plays from its time, opens it too ("the same should work for transcripts"). Chosen in
   * the aside where it lies over the page (a phone), the aside goes, as the thumbnails go
   * there once one is chosen, so the viewer shows; focus to the section's button. A
   * search's first hit, chosen as its answer arrives, keeps the hits in sight.
   */
  const asideNow = useRef(aside);
  asideNow.current = aside;
  const choseInAside = useRef(false);
  const openOnIt = () => {
    setExpanded(true);
    const drawer = asideNow.current;
    if (drawer.over && drawer.open && choseInAside.current) drawer.close();
  };
  const openNow = useRef(openOnIt);
  openNow.current = openOnIt;
  useEffect(
    () =>
      clover.found.subscribe((id) => {
        if (id) openNow.current();
      }),
    [clover],
  );
  // The active page's Canvas, once it is there: the magnifier waits for it.
  const [handle, setHandle] = useState<Clover.CanvasHandle | null>(null);

  /*
   * The title stands alone in the toolbar: the place line under it (the view's place,
   * "11 / 17", and its Canvases' labels) is put away until it has a better spot (Mat,
   * 2026-11-10: "let's remove this for now. I need to find a better spot for it"). The
   * thumbnails mark the page in view, and a step through the pages says its place.
   */
  const viewCanvases = useViewCanvases();
  // What the active page plays, if anything: its toggle is then Play.
  const media = mediaOf(viewCanvases);
  const full = expanded;
  // The sections holding something of the page in sight, each marked in the toolbar.
  const marked = usePageMarks(viewCanvases);
  // The pages in sight that describe themselves, which About shows after the resource.
  const described = viewCanvases.filter(hasInformation);

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
       * The panel toggle's glyph, mirrored (Mat, 2026-11-09: "make the icon for the info
       * toggle instead"): a page with its pane at the start, the pane filled while the
       * thumbnails show, so open and closed differ by more than color. Its name is what
       * it does.
       */}
      <svg
        aria-hidden="true"
        focusable="false"
        width="16"
        height="16"
        viewBox="0 0 512 512"
        fill="currentColor"
        stroke="currentColor"
      >
        <rect
          x="64"
          y="96"
          width="384"
          height="320"
          rx="40"
          fill="none"
          strokeWidth="36"
        />
        <path d="M192 96v320" fill="none" strokeWidth="36" />
        {sidebar.open && (
          <path d="M192 96h-88a40 40 0 0 0-40 40v240a40 40 0 0 0 40 40h88z" />
        )}
      </svg>
      <span style={Clover.visuallyHidden}>{t("templateSidebarToggle")}</span>
      <Clover.Tip label={t("templateSidebarToggle")} />
    </button>
  );

  return (
    <>
      <header
        ref={toolbar}
        className="clover-template-document-toolbar"
        // Escape here too puts the aside away over the page, its buttons being here.
        onKeyDown={aside.onKeyDown}
      >
        <div className="clover-template-document-heading">
          <Clover.Label
            id={`${id}-title`}
            as={title.as}
            className="clover-template-document-title clover-template-title clover-title"
            {...title.title}
          />
        </div>
        {/*
         * Its controls once the resource has loaded, with its title and pages, never a
         * section offered before its data is in (Mat, 2026-11-10: "don't show the `i`
         * until things are loaded in").
         */}
        {canvases > 0 && (
          <SectionControls
            aside={asideId}
            sections={offered.filter((each) => each !== "search")}
            open={asideOpen ? section : null}
            marked={marked}
            onChoose={chooseSection}
            labelOf={labelOf}
            groupLabel={{
              text: t("informationPanelTabs"),
              lang: langOf("informationPanelTabs"),
            }}
            search={offered.includes("search")}
            searchOpen={roomy}
            onSearched={searched}
            download={download !== false}
            downloadHeadingLevel={below(headingLevel)}
            language={
              /*
               * The languages to read in, as a globe first among the toolbar's controls,
               * always in sight (Mat, 2026-11-09: "move this to a globe icon in the top
               * right", "I wanted it up top. always visible"); About offers none of its own.
               */
              languages && (
                <Clover.Language menu interfaceLanguages={interfaceLanguages} />
              )
            }
            provider={
              /*
               * Who provided it, in the toolbar before its controls, whichever section
               * the aside shows or none (Mat, 2026-11-10: "move logo to header. to the
               * left of controls. remove it from bottom"): each provider's logo, linked to
               * its homepage and named by the provider (Mat, 2026-10-24).
               */
              <Clover.Provider className="clover-template-document-provider">
                <Clover.Logo />
              </Clover.Provider>
            }
          />
        )}
      </header>
      {/* The Body shows the loading; announced here, nothing moves. */}
      <Clover.Status loading={false} />
      <Clover.Split
        ref={panes}
        className="clover-template-document-panes clover-template-panes"
        data-sidebar={showSidebar ? "open" : "closed"}
        data-narrow={sidebar.over || undefined}
        // Where the aside is: beside the page, or over it (`Default.css`'s drawer).
        data-panel={aside.over ? "over" : "beside"}
        storageKey={storageKey || undefined}
        onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
          // Escape anywhere puts what floats over the page away, the aside first,
          // uncovering a control focus reached under it, and leaves focus there.
          aside.onKeyDown(event);
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
          // Floating over a narrow page, a pane over the page (`Default.css`).
          className={[
            "clover-template-document-sidebar",
            sidebar.over && "clover-template-float",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={sidebarLang ? undefined : t("templateSidebar")}
          aria-labelledby={sidebarLang ? `${id}-sidebar-name` : undefined}
          size="13rem"
          // On a phone Items slides over the Canvas, so it takes no room from it.
          min={sidebar.over ? undefined : "8rem"}
          max="24rem"
          hidden={!sidebarRoom}
        >
          {sidebarLang && (
            <span hidden id={`${id}-sidebar-name`} lang={sidebarLang}>
              {t("templateSidebar")}
            </span>
          )}
          {/*
           * What scrolls: inside the pane's inset, so a thumbnail Items brings into view
           * (to the scrolling box's edge) stands as far from the top as from the sides.
           */}
          <div className="clover-template-document-thumbnails">
            <Clover.Items
              layout="list"
              singleItem={singleItem}
              aria-label={sidebarLang ? undefined : t("templateSidebar")}
              thumbnailSize={320}
              onSelect={choose}
            />
          </div>
        </Clover.SplitPane>
        {/* The bar between the thumbnails and the page; none where they cover it. */}
        {sidebarRoom && !sidebar.over && (
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
          ref={aside.main}
          className="clover-template-document-main"
          data-map={mapShown || undefined}
          // A minimum only beside another pane: Items, or the Panel docked.
          min={(showSidebar && !sidebar.over) || docked ? PAGE_MIN : undefined}
        >
          {/*
           * Over the page's top left, the template's own controls there: the thumbnails'
           * toggle while they are put away, then the view's (`ViewControls`), steering
           * the active page, before the page in reading order as on the screen.
           */}
          <div ref={lead} className="clover-template-document-lead">
            {pages && !sidebar.open && (
              <div className="clover-template-document-sidebar-closed">
                {toggle}
              </div>
            )}
            {(handle || several || media) && !mapShown && (
              <ViewControls
                id={`${id}-view`}
                open={expanded}
                onOpenChange={setExpanded}
                pages={several}
                view={() =>
                  panes.current?.querySelector<HTMLElement>(
                    ".clover-template-document-live-play",
                  ) ??
                  panes.current?.querySelector<HTMLElement>(
                    ".clover-template-document-live :is(.clover-canvas-viewport, [tabindex='0'])",
                  )
                }
              />
            )}
          </div>
          {/* The pages, a Body entry for each view, the one in view live. */}
          <Sheets
            collapseControls={collapseControls}
            canvasOptions={canvasOptions}
            expanded={full}
            onExpandedChange={setExpanded}
            onHandle={setHandle}
            labelledBy={`${id}-title`}
          />
          {mapShown && (
            <Suspense fallback={null}>
              <ExpandedMap
                collapseId={`${id}-map-collapse`}
                onCollapse={collapseMap}
                onClose={closeMap}
              />
            </Suspense>
          )}
        </Clover.SplitPane>
        {/* The bar between the page and the aside, beside it; none over the page. */}
        {docked && <Clover.SplitHandle aria-controls={asideId} />}
        {/*
         * The aside: the section its button chose, alone, under its name, a level under
         * the title, its close button on its inner edge (Escape too, over the page).
         * Drawn as the Panel's pane is (`Default.css`), its content Clover's part for it.
         */}
        <Clover.SplitPane
          ref={aside.pane}
          as="aside"
          id={asideId}
          name="panel"
          data-side="end"
          data-section={section}
          className={[
            "clover-template-document-aside clover-template-panel clover-template-drawer",
            aside.over && "clover-template-float",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-labelledby={`${asideId}-title`}
          // A choice made in it, a press or Enter, as it bubbles (`found`, above).
          onClickCapture={() => {
            choseInAside.current = true;
            requestAnimationFrame(() => (choseInAside.current = false));
          }}
          onClick={(event) => {
            if ((event.target as Element).closest?.(".clover-transcript-cue"))
              openOnIt();
          }}
          size="24rem"
          min={aside.over ? undefined : PANEL_MIN}
          data-open={aside.opened}
          hidden={!(aside.shown && offered.includes(section))}
        >
          {/*
           * Its close, on its inner edge, beside the page and over it alike, as the
           * Panel's sits on a pane sliding over the page (`Panel.css`; Mat, 2026-11-09:
           * "add a close button on the left. like we do for the dragtoclose on
           * responsive size"): Clover's round control and its cross, outside what
           * scrolls, so it stays as the section scrolls under it.
           */}
          <button
            type="button"
            className="clover-canvas-button clover-template-document-aside-close"
            lang={langOf("informationPanelClose")}
            onClick={aside.close}
          >
            <svg
              aria-hidden="true"
              focusable="false"
              width="16"
              height="16"
              viewBox="0 0 512 512"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeWidth="45"
                d="M154 154L358 358M358 154L154 358"
              />
            </svg>
            <span style={Clover.visuallyHidden}>
              {t("informationPanelClose")}
            </span>
            <Clover.Tip label={t("informationPanelClose")} />
          </button>
          <div className="clover-template-document-aside-scroll">
            <div className="clover-template-document-aside-head">
              <AsideTitle
                id={`${asideId}-title`}
                level={below(headingLevel)}
                {...labelOf(section)}
              />
            </div>
            {aside.shown && (
              <Suspense fallback={null}>
                <SectionContent
                  section={section}
                  headingLevel={below(below(headingLevel))}
                  pages={described}
                  expandMapId={`${id}-map-expand`}
                  onExpandMap={expandMap}
                />
              </Suspense>
            )}
          </div>
        </Clover.SplitPane>
        {aside.scrim && (
          <div className="clover-template-scrim" {...aside.scrim} />
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

/** The aside's name, a heading at `level`, or past 6 a paragraph that names it. */
function AsideTitle({
  id,
  level,
  text,
  lang,
}: {
  id: string;
  level: number;
  text: string;
  lang?: string;
}) {
  const Tag = (level <= 6 ? `h${level}` : "p") as React.ElementType;
  return (
    <Tag id={id} className="clover-template-document-aside-title" lang={lang}>
      {text}
    </Tag>
  );
}
