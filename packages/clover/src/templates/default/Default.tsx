import React, { useEffect, useRef } from "react";

import * as Clover from "../../parts";
import type {
  CloverCanvasOptions,
  PanelLayout,
  PanelSection,
  PanelSectionLabels,
  ItemsLayout,
  RootProps,
} from "../../parts";
import { PanelPane, usePanelPane } from "../shared/PanelPane";
import { BESIDE_REM, PAGE_MIN, useWideEnough } from "../shared/useSlide";
import { useFollowFocus } from "../shared/useFollowFocus";

export type DefaultProps = Omit<RootProps, "children"> & {
  /**
   * The header over the Body: the resource's title and provider. `"collection"` keeps
   * only the Collection's line, where the Viewer is opened on a Collection (its title and
   * a pager among its members), or an AnnotationCollection's, with no title and no
   * provider of the Manifest's; elsewhere there is no header, as with `false`. 3.x drew
   * its Collection's browser whatever `showTitle` said. Default `true`.
   */
  header?: boolean | "collection";
  /**
   * The title's heading level, to fit the outline of the page around the layout (under
   * an `h2`, 3). The panel's sections are a level below it, or at it with no title,
   * taking the title's place. Default 2.
   */
  headingLevel?: number;
  /** The information panel beside the Body, with its toggle. Default `true`. */
  panel?: boolean;
  /**
   * Whether the panel starts open beside the Body. Default `true`. Where it has no room
   * there and would slide over the Body, it starts closed.
   */
  defaultPanelOpen?: boolean;
  /**
   * Whether the panel's toggle shows while the panel is open beside the Body. `false`
   * leaves it open there with nothing to close it, as 3.x's `renderToggle: false` did.
   * Wherever the panel is shut, or slides over the Body where there is no room beside
   * it, the toggle still shows: the one way to open it. Default `true`.
   */
  panelToggle?: boolean;
  /**
   * How the information panel lays out its sections: `"accordion"` (the default),
   * stacked boxes each opened by its heading, or `"tabs"`.
   */
  panelLayout?: PanelLayout;
  /**
   * The panel's sections, from Clover's own: with
   * `["contents", "search", "transcript", "annotations"]` it has those four, each still
   * only where the resource has data for it, and no panel at all where it has none of
   * them. Default: every section.
   */
  panelSections?: readonly PanelSection[];
  /**
   * What a panel section's tab or heading says, in place of its word in Clover's interface language:
   * `{ annotations: "Chapters" }`, or a word by language tag to say it in several (the
   * Panel's `labels`).
   */
  panelLabels?: PanelSectionLabels;
  /** The downloads, from a Download button beside the panel's About heading. Default `true`. */
  download?: boolean;
  /**
   * The languages to read the resource in, beside the panel's About heading, where what
   * it says of itself comes in several (the Panel's `languages`). Default `true`.
   */
  languages?: boolean;
  /**
   * Default, Document and Gallery: whether the panel's language toggle, beside its About
   * heading, also offers Clover's interface languages (its control labels, section
   * titles and announcements) that the resource has none of, the visitor's and the
   * site's, where they differ (the Panel's `interfaceLanguages`). Default `true`.
   */
  interfaceLanguages?: boolean;
  /** The thumbnails under the Body: a layout, or `false` for none. Default `slider`. */
  items?: Exclude<ItemsLayout, "pager"> | false;
  /**
   * The thumbnails even where the resource has one view, which has nothing to choose
   * between. Default `false`.
   */
  singleItem?: boolean;
  /**
   * Where the panel's width is remembered once the reader drags its bar
   * (`localStorage`). Default `"clover-template-default"`; `false` forgets it.
   */
  storageKey?: string | false;
  /**
   * Fill the box it sits in: as tall as that box, the Body taking what the header and
   * the strip leave, so nothing runs below it. For a box of a set height, the window
   * under a page's own header say. Default `false`: the Body is
   * `--clover-body-height` tall, and the layout as tall as it needs.
   */
  fill?: boolean;
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
 * The Viewer's own layout, drawn when no `template` is given: Clover 3.x's Viewer, built
 * from 4.x parts. Copy this file to start a layout of your own.
 *
 * The title and its actions over the Body, and under the Body the thumbnail strip,
 * headed by the position and a pair of arrows (for a Manifest read top to bottom or bottom
 * to top, a column at the Body's start, its titles and position under the Body); the
 * information panel to the right of all
 * three, the layout's full height. The panel has its own space, as in 3.x, and a bar
 * between it and the rest shares the width (drag it, or use the arrow keys on it). Where there is no room for both
 * (a phone), the panel slides over the Body instead, and a strip of the page stays
 * uncovered: a click there, Escape or the panel's close button puts it away. Size it with
 * `--clover-body-height`.
 */
export function Default({
  className,
  header = true,
  headingLevel = 2,
  panel = true,
  defaultPanelOpen,
  panelToggle = true,
  panelLayout = "accordion",
  panelSections,
  panelLabels,
  download = true,
  languages = true,
  interfaceLanguages = true,
  items = "slider",
  singleItem = false,
  storageKey = "clover-template-default",
  fill = false,
  collapseControls,
  canvasOptions,
  ...root
}: DefaultProps) {
  const panes = useRef<HTMLElement>(null);
  const baseId = Clover.useUniqueId().replace(/:/g, "");
  const panelId = `${baseId}-panel`;
  // Past h6 the title is no heading, and names the Viewer instead (`Clover.titled`).
  const title = Clover.titled(headingLevel, `${baseId}-title`);
  /*
   * The information panel, every template's (`shared/PanelPane.tsx`): beside the Body
   * where there is room, open as the host asks, then as the reader chooses; over it where
   * there is not, starting closed (Mat, 2026-10-27). Its toggle sits on the spine while it
   * is open beside the Body, at the Body's top, and among the Body's controls otherwise.
   */
  const pane = usePanelPane({
    id: panelId,
    // Beside the Body until measured otherwise, as on the server.
    beside: useWideEnough(panes, BESIDE_REM),
    defaultOpen: defaultPanelOpen ?? true,
    followFocus: useFollowFocus(),
    sections: panelSections,
    body: () =>
      panes.current?.querySelector<HTMLElement>(
        ".clover-template-default-body",
      ),
    panel: Clover.Panel,
  });
  const over = pane.over;
  const docked = panel && pane.docked;
  // The Collection's line alone (`"collection"`), or the whole header with the title.
  const lineOnly = header === "collection";
  const titled = Boolean(header) && !lineOnly;
  return (
    <Clover.Root
      className={["clover-template-default", className]
        .filter(Boolean)
        .join(" ")}
      data-fill={fill || undefined}
      {...(titled ? title.group : null)}
      {...root}
    >
      <Clover.Split
        ref={panes}
        className="clover-template-default-panes clover-template-panes"
        storageKey={storageKey || undefined}
        // Where the panel is, Escape over the Body, and the reach for its toggle.
        {...(panel ? pane.splitProps : { "data-panel": "beside" })}
      >
        <Clover.SplitPane
          ref={pane.main}
          className="clover-template-default-main"
          // A minimum only while the Panel is docked beside it: over it, none.
          min={over ? undefined : PAGE_MIN}
        >
          {lineOnly && <CollectionHeader />}
          {titled && (
            <header className="clover-template-default-header">
              <HeaderTitle title={title} />
              {/*
               * A content state's several targets (Cookbook 0540): where the reader is
               * among them, a list of them all, and the steps between (Mat, 2026-10-29).
               * Nothing for any other content.
               */}
              <Clover.Items
                of="targets"
                layout="pager"
                size="small"
                className="clover-template-default-pager"
              />
              {/*
               * Who provided it: each provider's logo at the line's end, linked to its
               * homepage and named by the provider (Mat, 2026-10-24).
               */}
              <Clover.Provider className="clover-template-default-provider">
                <Clover.Logo />
              </Clover.Provider>
            </header>
          )}
          {/* The Body shows the loading; announced here, nothing moves. */}
          <Clover.Status loading={false} />
          <Views
            items={items}
            singleItem={singleItem}
            body={
              <Clover.Body
                key="body"
                className="clover-template-default-body"
                collapseControls={collapseControls}
                options={canvasOptions}
              >
                {panel && !docked && pane.toggle}
              </Clover.Body>
            }
          />
        </Clover.SplitPane>
        {panel && (
          <PanelPane
            // Open beside the Body, its toggle left off the spine (`panelToggle`).
            pane={panelToggle ? pane : { ...pane, toggle: <></> }}
            className="clover-template-default-panel"
            layout={panelLayout}
            sections={panelSections}
            labels={panelLabels}
            download={download}
            languages={languages}
            interfaceLanguages={interfaceLanguages}
            // With no title over them, the sections take its place in the outline.
            headingLevel={titled ? below(headingLevel) : headingLevel}
          />
        )}
      </Clover.Split>
    </Clover.Root>
  );
}

/**
 * The header's title: the Manifest's label, and under it, where the Root was opened on a
 * Collection, a line of the Collection's own, so it is plain the reader is among its
 * members (Mat, 2026-10-29: "it should be obvious the user is moving between items in the
 * collection"): the Collection's title, smaller and muted, then a pager among them,
 * small (where the reader is, "1 / 2", opening them all, then Previous and Next): "place
 * the collection title under the manifest title", "collection title first. then pager".
 */
function HeaderTitle({ title }: { title: ReturnType<typeof Clover.titled> }) {
  const lines = useCollectionLines();
  return (
    <>
      {/* Its line kept while the next member loads, so the header holds still. */}
      <Clover.Label
        as={title.as}
        className="clover-template-default-title clover-template-title clover-title"
        keep
        {...title.title}
      />
      {lines}
    </>
  );
}

/**
 * The header with no title (`header="collection"`): the Collection's line alone, so the
 * reader still moves among its members (as 3.x's header did, whatever `showTitle` said);
 * no header at all where there is no line to show.
 */
function CollectionHeader() {
  const lines = useCollectionLines();
  return lines ? (
    <header className="clover-template-default-header">{lines}</header>
  ) : null;
}

/**
 * The lines under the header's title of what the reader moves through: the Collection's,
 * where the Root was opened on one, and an AnnotationCollection the Manifest's pages are
 * part of (Cookbook 0309), walked as a Collection's members are: its name, then its
 * annotations stepped, the count opening their list (Mat, 2026-10-29). Nothing where
 * there is neither.
 */
function useCollectionLines() {
  const collection = Clover.useCloverSelector((state) =>
    state.throughCollection ? state.collection?.label : undefined,
  );
  const annotations = Clover.useAnnotationCollection();
  usePickFirst(annotations?.entries[0]);
  return (
    (collection || annotations) && (
      <>
        {collection && (
          <div className="clover-template-default-collection-row">
            <Clover.Label
              as="p"
              label={collection as Clover.LabelProps["label"]}
              className="clover-template-default-collection"
            />
            <Clover.Items
              of="members"
              layout="pager"
              size="small"
              className="clover-template-default-pager"
            />
          </div>
        )}
        {/* Named from the Manifest at once; its steps come as its pages are fetched. */}
        {annotations && (
          <div className="clover-template-default-collection-row">
            {annotations.label && (
              <Clover.Label
                as="p"
                label={annotations.label as Clover.LabelProps["label"]}
                className="clover-template-default-collection"
              />
            )}
            <Clover.Items
              of="annotations"
              layout="pager"
              size="small"
              className="clover-template-default-pager"
            />
          </div>
        )}
      </>
    )
  );
}

/**
 * An AnnotationCollection's first annotation, picked as its Manifest opens (Mat,
 * 2026-10-29: "automatically load in the first annotation"), so its pager starts at
 * "1 / 8": once a Manifest, and only where it opened on that annotation's Canvas with
 * nothing picked, so a link to another place keeps its place.
 */
function usePickFirst(first: Clover.AnnotationEntry | undefined) {
  const { clover } = Clover.useClover();
  const manifestId = Clover.useCloverSelector((state) => state.manifest?.id);
  const started = useRef<string | null>(null);
  useEffect(() => {
    if (!first || !manifestId || started.current === manifestId) return;
    started.current = manifestId;
    const { annotationId, canvasId } = clover.store.get();
    if (!annotationId && canvasId === first.canvasId)
      clover.selectAnnotation(first.id);
  }, [clover, first, manifestId]);
}

/**
 * The Body and the strip: the thumbnails, and the view's titles and position over them.
 * The strip is under the Body, a row. Where the Manifest reads down the page
 * (`viewingDirection` `top-to-bottom` or `bottom-to-top`), the thumbnails stand at the
 * Body's start, first in focus order as they are on screen, a column as tall as the Body
 * running down, and the titles and position go under the Body (`Default.css`). Their box
 * is one element either way, so the Body is moved, never drawn again, as a Manifest of
 * another direction opens.
 */
function Views({
  body,
  items,
  singleItem,
}: Pick<DefaultProps, "items" | "singleItem"> & { body: React.ReactElement }) {
  const { direction } = Clover.useSequence();
  const vertical =
    items === "slider" &&
    (direction === "top-to-bottom" || direction === "bottom-to-top");
  const header = (
    <div key="header" className="clover-template-default-rail-header">
      <ViewTitles />
      <Clover.Position />
    </div>
  );
  const thumbnails = items && (
    <Clover.Items
      layout={items}
      orientation={vertical ? "vertical" : undefined}
      singleItem={singleItem}
    />
  );
  return (
    <div
      className="clover-template-default-views"
      data-orientation={vertical ? "vertical" : undefined}
    >
      {vertical
        ? [
            <div
              key="rail"
              className="clover-template-default-rail"
              data-orientation="vertical"
            >
              {thumbnails}
            </div>,
            body,
            header,
          ]
        : [
            body,
            <div key="rail" className="clover-template-default-rail">
              {header}
              {thumbnails}
            </div>,
          ]}
    </div>
  );
}

/** The heading level under another. Past 6, the parts' titles name what they head. */
const below = (level: number) => level + 1;

/**
 * The titles of the view the reader is on: a page's label, or both of a spread's, a dot
 * between them. The strip's own arrows are Previous and Next, so the header names where
 * the reader is.
 */
function ViewTitles() {
  const canvases = Clover.useVisibleCanvases();
  return (
    <p className="clover-template-default-titles">
      {canvases.map((canvas, index) => (
        <React.Fragment key={canvas.id}>
          {index > 0 && (
            <span
              className="clover-template-default-titles-dot"
              aria-hidden="true"
            >
              ·
            </span>
          )}
          <Clover.Label label={canvas.label} />
        </React.Fragment>
      ))}
    </p>
  );
}
