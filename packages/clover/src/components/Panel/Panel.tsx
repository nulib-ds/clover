import React, {
  Suspense,
  forwardRef,
  lazy,
  useEffect,
  useRef,
  useState,
} from "react";

import { About } from "./About";
import { AboutActions } from "./AboutActions";
import { InPanelContext } from "./ReadingLanguages";
import { Tip } from "../../ui/Tip";
import { Close } from "../Body/glyphs";
import { SEARCH_SET_ID } from "../../core/search-service";
import { type PanelSection, usePanelSections } from "./sections";
import { langWithin } from "../../i18n/config";
import { languageToRead } from "../../i18n/languages";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useClover, useCloverSelector } from "../../react/context";
import {
  type SectionSpec,
  type SectionsLayout,
  Sections,
} from "../../ui/Sections";
import { useContainerName } from "../../i18n/useContainerName";
import { languageProps } from "../../i18n/direction";

/*
 * The map, and MapLibre with it, load only when a Manifest with places or georeferences
 * opens its Map tab. Its module imports no `Root`, so the lazy chunk adds nothing to what
 * a page without a map loads.
 */
const RootMap = lazy(() =>
  import("../Map/ConnectedMap").then((module) => ({
    default: module.RootMap,
  })),
);

/*
 * The other default sections load when first opened, as the Map does: the panel opens on
 * About, and a page whose reader opens no other section loads none of them. Each is a
 * part of its own too (`Clover.Search`…), which a layout that places it imports directly.
 */
const Collection = lazy(() =>
  import("../Collection/Collection").then((m) => ({ default: m.Collection })),
);
const Targets = lazy(() =>
  import("../Items/TargetItems").then((m) => ({ default: m.TargetsSection })),
);
const Contents = lazy(() =>
  import("../Contents/Contents").then((m) => ({ default: m.Contents })),
);
const Search = lazy(() =>
  import("../Search/Search").then((m) => ({ default: m.Search })),
);
const Transcript = lazy(() =>
  import("../Transcript/Transcript").then((m) => ({ default: m.Transcript })),
);
const Annotations = lazy(() =>
  import("../Annotations/Annotations").then((m) => ({
    default: m.Annotations,
  })),
);

/** A section's content, shown once its module has loaded. */
const later = (content: React.ReactNode) => (
  <Suspense fallback={null}>{content}</Suspense>
);

export type { PanelSection };

/**
 * What a page calls a section, in place of its word in Clover's interface language: its words, taken to
 * be in the page's language, or its words by language tag, one of which the tab carries
 * as its `lang` where it is not the page's (WCAG 3.1.2).
 */
export type PanelSectionLabel = string | Readonly<Record<string, string>>;

/** A label for any of the default sections, by its value. */
export type PanelSectionLabels = Partial<
  Record<PanelSection, PanelSectionLabel>
>;

export interface TabProps {
  /** Identifies the tab, for `value` / `defaultValue` on the panel. */
  value: string;
  /** What the tab says. */
  label: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * One tab of an `Panel`: its label and what it shows. Anything can go in a
 * tab — `Clover.About`, your own component reading the Root through hooks — which is how
 * 3.x's information panel plugins are written now.
 *
 * It renders nothing itself: `Panel` reads its props and renders the tab.
 */
export const Tab: React.FC<TabProps> = () => null;

/** How an information panel lays out its sections. */
export type PanelLayout = SectionsLayout;

export interface PanelProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "defaultValue"> {
  /**
   * `tabs` (the default): a row of tabs, one section shown at a time. `accordion`: the
   * sections stacked as boxes, each opened by its heading, one always open.
   */
  layout?: PanelLayout;
  /** The tab shown, controlled (`tabs`). */
  value?: string;
  /**
   * The tab shown first (`tabs`), or the box open to start with (`accordion`). Default:
   * the first.
   */
  defaultValue?: string;
  /** Called with the tab chosen, or the box opened. */
  onValueChange?: (value: string) => void;
  /**
   * The panel can be closed: a close button appears in it. Closing from inside the panel
   * hands focus back to the control that opens it (whatever has `aria-controls` naming the
   * panel or an element around it), so focus is never left on something hidden.
   */
  onClose?: () => void;
  /**
   * The panel floats over the page: Escape inside it closes it too, and its close button
   * sits at its inner edge (the start, for a panel over the end of the page) rather than
   * the end of its first row. A panel docked beside the Body needs neither, and is
   * better without `onClose` at all: the toggle that opens it closes it.
   */
  closeOnEscape?: boolean;
  /**
   * The level of the sections' headings (`accordion`), one under the heading the panel
   * belongs to. The default sections' own headings are a level below them; tabs are not
   * headings, so there they start at this level. Default 3.
   */
  headingLevel?: number;
  /** The element to render. Default `aside`. */
  as?: React.ElementType;
  /**
   * Whether About's heading offers the downloads, by a Download button that lists the
   * `rendering` of the page in view and of the Manifest. Default `true`.
   */
  download?: boolean;
  /**
   * Where what the resource says of itself comes in several languages, About's heading
   * offers them, and the whole Root reads in the one chosen. Default `true`; `false`
   * leaves the choice out, and the Root reads in its `language`, else the reader's.
   */
  languages?: boolean;
  /**
   * Whether About's language toggle also offers Clover's interface languages (its
   * control labels, section titles and announcements) that the resource has none of: the
   * visitor's and the site's, where they differ, one choice for the page. Default
   * `true`; `false` leaves them out, and Clover speaks the visitor's.
   */
  interfaceLanguages?: boolean;
  /**
   * Which of the default sections the panel may have, in Clover's own order: with
   * `["contents", "search"]` it has those two and no About. Each still shows only where
   * the resource has data for it, so a resource with none of them draws no panel at all.
   * `Tab` children win over it. Default: every section.
   */
  sections?: readonly PanelSection[];
  /**
   * What a default section's tab or heading says, in place of its word in Clover's interface language:
   * `{ annotations: "Chapters" }`, or `{ annotations: { en: "Chapters", de: "Kapitel" } }`
   * to say it in several, read in the one Clover speaks and marked with its language
   * where that is not the page's (WCAG 3.1.2). A `Tab` of your own says it in `label`.
   */
  labels?: PanelSectionLabels;
  /**
   * `Clover.Tab`s, the panel's sections whole, in their order: they win over `sections`.
   * Without any, the panel has the tabs Clover has data for: About,
   * Contents when the Manifest has Ranges, Search when it has a Content Search service, a
   * Map when it (or a Canvas or annotation) has navPlace or a georeference,
   * a Transcript when the view's media has captions or a plain-text transcript, and
   * Annotations when there are any.
   */
  children?: React.ReactNode;
}

/**
 * Information about the Root's resource, in sections: tabs by default, or stacked boxes
 * with `layout="accordion"`. Its default sections are the ones Clover has data for; give
 * it `Clover.Tab` children to choose them, in order, including your own (a `Tab` is a
 * section in either layout):
 *
 * ```jsx
 * <Clover.Panel>
 *   <Clover.Tab value="about" label="About"><Clover.About /></Clover.Tab>
 *   <Clover.Tab value="notes" label="Notes"><MyNotes /></Clover.Tab>
 * </Clover.Panel>
 * ```
 *
 * To keep Clover's own sections but not all of them, name the ones you want in
 * `sections`: each still shows only where the resource has data for it, and a resource
 * with none of them has no panel.
 *
 * ```jsx
 * <Clover.Panel sections={["contents", "search", "transcript", "annotations"]} />
 * ```
 */
export const Panel = forwardRef<HTMLElement, PanelProps>(function Panel(
  {
    layout = "tabs",
    value,
    defaultValue,
    onValueChange,
    onClose,
    closeOnEscape = false,
    headingLevel = 3,
    as: Tag = "aside",
    download = true,
    languages = true,
    interfaceLanguages = true,
    sections,
    labels,
    className,
    children,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const { clover } = useClover("Panel");
  const element = useRef<HTMLElement | null>(null);
  const { t, langOf, hostLanguage, i18n } = useCloverTranslation();
  /*
   * Its landmark named as its sections are, so a list of landmarks tells it from another
   * (the Document template's thumbnails, "Items"). A name the host gives it stands; an
   * element that is no landmark takes none, as ARIA forbids naming a generic one.
   */
  const name = useContainerName(
    t("informationPanelTabs"),
    langOf("informationPanelTabs"),
    Boolean(rest["aria-label"] || rest["aria-labelledby"]) ||
      !(["aside", "section", "nav"].includes(Tag as string) || rest.role),
  );
  // A tab's name, marked where it is not in the page's language (WCAG 3.1.2).
  const tabLabel = (key: string) => {
    const lang = langOf(key);
    return lang ? <span {...languageProps(lang)}>{t(key)}</span> : t(key);
  };
  /*
   * What a section's tab says: its word in Clover's interface language, or the page's (`labels`), read
   * in the language Clover speaks where the page gives it in several (IIIF's rule, as
   * every language map is read) and marked with that language where it is not the page's,
   * as Clover's interface strings are (WCAG 3.1.2). A label in one language is the page's own
   * words on its own page, so it is marked with nothing.
   */
  const sectionLabel = (section: PanelSection, key: string) => {
    const given = labels?.[section];
    if (given === undefined) return tabLabel(key);
    if (typeof given === "string") return given;
    const tags = Object.keys(given);
    const tag = languageToRead(tags, i18n.language);
    if (!tag) return tabLabel(key);
    const lang = langWithin(tag, hostLanguage);
    return lang ? (
      <span {...languageProps(lang)}>{given[tag]}</span>
    ) : (
      given[tag]
    );
  };
  /*
   * The sections this panel may have, in Clover's order: About, and each other one the
   * resource has data for, narrowed to `sections` where the page names its own
   * (`usePanelSections`, which a layout of its own can ask first).
   */
  const offered = usePanelSections(sections);
  const has = (section: PanelSection) => offered.includes(section);
  const given = React.Children.toArray(children).filter(
    (child): child is React.ReactElement<TabProps> =>
      React.isValidElement(child) && child.type === Tab,
  );
  // In the accordion what a section holds is a level below its heading; tabs are not
  // headings.
  const inner = layout === "accordion" ? headingLevel + 1 : headingLevel;
  /*
   * Beside About's heading, shown whichever section is open: its Download button, Clover's
   * interface languages, the page's choice, and the languages to read the resource in, a
   * choice that is the whole Root's (`AboutActions`).
   */
  const aboutActions =
    languages || interfaceLanguages || download ? (
      <AboutActions
        languages={languages}
        interfaceLanguages={interfaceLanguages}
        download={download}
      />
    ) : undefined;
  const tabs: SectionSpec[] = given.length
    ? given.map(({ props }) => ({
        value: props.value,
        label: props.label,
        content: props.children,
        ...(props.value === "about" && { actions: aboutActions }),
      }))
    : [
        ...(has("about")
          ? [
              {
                value: "about",
                label: sectionLabel("about", "informationPanelTabsAbout"),
                content: <About headingLevel={inner} download={download} />,
                actions: aboutActions,
              },
            ]
          : []),
        ...(has("targets")
          ? [
              {
                value: "targets",
                label: sectionLabel("targets", "informationPanelTabsTargets"),
                content: later(<Targets headingLevel={inner} />),
              },
            ]
          : []),
        ...(has("collection")
          ? [
              {
                value: "collection",
                label: sectionLabel(
                  "collection",
                  "informationPanelTabsCollection",
                ),
                content: later(<Collection headingLevel={inner} />),
              },
            ]
          : []),
        ...(has("contents")
          ? [
              {
                value: "contents",
                label: sectionLabel("contents", "informationPanelTabsContents"),
                content: later(<Contents />),
              },
            ]
          : []),
        ...(has("search")
          ? [
              {
                value: "search",
                label: sectionLabel("search", "informationPanelTabsSearch"),
                // Its field small and held as the hits scroll (Mat, 2026-10-26).
                content: later(
                  <Search headingLevel={inner} sticky size="small" />,
                ),
              },
            ]
          : []),
        ...(has("map")
          ? [
              {
                value: "map",
                label: sectionLabel("map", "informationPanelTabsMap"),
                content: later(<RootMap />),
              },
            ]
          : []),
        ...(has("transcript")
          ? [
              {
                value: "transcript",
                label: sectionLabel("transcript", "transcriptLabel"),
                // Its find field small and held as the cues scroll, as Search's.
                content: later(<Transcript sticky size="small" />),
              },
            ]
          : []),
        ...(has("annotations")
          ? [
              {
                value: "annotations",
                label: sectionLabel(
                  "annotations",
                  "informationPanelTabsAnnotations",
                ),
                // Every Canvas's, by Canvas, those in view kept in sight.
                content: later(<Annotations headingLevel={inner} />),
              },
            ]
          : []),
      ];

  /*
   * A search started anywhere but the Search section opens it (Mat, 2026-10-26): a
   * `searchQuery`, given or changed, or a host's own `clover.search()`, so the hits drawn
   * on the Canvas come with their list. Only the open section changes, never focus
   * (WCAG 3.2.2); a Panel that is shut stays shut, opening on Search when it shows; a
   * section the reader folds stays folded until another query; and a `value` the host
   * controls is the host's. A query beats `defaultValue`: it says what the reader came for.
   */
  const query = useCloverSelector((state) => state.search.query);
  const searchable = tabs.some((tab) => tab.value === "search");
  const [own, setOwn] = useState<string | null>(() =>
    query && searchable ? "search" : (defaultValue ?? null),
  );
  const asked = useRef(query && searchable ? query : "");
  useEffect(() => {
    if (!searchable) return;
    if (query && query !== asked.current && value === undefined)
      setOwn("search");
    asked.current = query;
  }, [query, searchable, value]);

  /*
   * A Range's region picked on the Canvas (an article's column, Cookbook 0025) opens
   * Contents (Mat, 2026-10-28), where its entry is current and its step at that part, as
   * a search opens Search: only the open section changes, never focus (WCAG 3.2.2), a
   * Panel that is shut stays shut, and a `value` the host controls is the host's.
   */
  const pickedRegion = useCloverSelector((state) =>
    state.annotationId &&
    state.regions?.entries.some((entry) => entry.id === state.annotationId)
      ? state.annotationId
      : null,
  );
  const hasContentsTab = tabs.some((tab) => tab.value === "contents");
  useEffect(() => {
    if (pickedRegion && hasContentsTab && value === undefined)
      setOwn("contents");
  }, [pickedRegion, hasContentsTab, value]);

  /*
   * A search's hits are drawn on the Canvas only while its section is open (Mat,
   * 2026-10-26: "search results should go away if search tab is closed"): closed, they go,
   * the query and its list kept, and they come back as it opens again.
   */
  const shown = value !== undefined ? value : own;
  const searchOpen =
    (tabs.some((tab) => tab.value === shown) ? shown : tabs[0]?.value) ===
    "search";
  useEffect(() => {
    if (searchable) clover.setSetVisible(SEARCH_SET_ID, searchOpen);
  }, [clover, searchable, searchOpen]);

  if (!tabs.length) return null;

  const close = () => {
    const panel = element.current;
    if (panel?.contains(document.activeElement)) controlOf(panel)?.focus();
    onClose?.();
  };

  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        element.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={join("clover-panel", className)}
      data-layout={layout}
      data-closable={onClose ? "" : undefined}
      data-floating={closeOnEscape ? "" : undefined}
      {...name.props}
      onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
        onKeyDown?.(event);
        if (
          closeOnEscape &&
          onClose &&
          event.key === "Escape" &&
          !event.defaultPrevented
        ) {
          event.preventDefault();
          close();
        }
      }}
      {...rest}
    >
      {name.node}
      {onClose && (
        <button
          type="button"
          className="clover-panel-close"
          aria-label={t("informationPanelClose")}
          {...languageProps(langOf("informationPanelClose"))}
          onClick={close}
        >
          {/* The Canvas controls' cross, at their size, so it reads as one of them. */}
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 512 512"
            fill="none"
            stroke="currentColor"
          >
            <Close />
          </svg>
          <Tip label={t("informationPanelClose")} />
        </button>
      )}
      <InPanelContext.Provider
        value={tabs.some((section) => section.value === "about")}
      >
        <Sections
          items={tabs}
          layout={layout}
          value={value !== undefined ? value : own}
          onValueChange={(next) => {
            if (value === undefined) setOwn(next);
            onValueChange?.(next);
          }}
          label={t("informationPanelTabs")}
          labelLang={langOf("informationPanelTabs")}
          headingLevel={headingLevel}
        />
      </InPanelContext.Provider>
    </Tag>
  );
});

/**
 * The control that opens the panel: one whose `aria-controls` names the panel, or the
 * nearest element around it with an id (a template may hide a wrapper, not the panel).
 */
function controlOf(panel: HTMLElement): HTMLElement | null {
  for (
    let node: HTMLElement | null = panel;
    node && node !== document.body;
    node = node.parentElement
  ) {
    if (!node.id) continue;
    const control = document.querySelector<HTMLElement>(
      `[aria-controls~="${node.id.replace(/["\\]/g, "\\$&")}"]`,
    );
    if (control) return control;
  }
  return null;
}
