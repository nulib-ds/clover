import React, { useEffect, useRef } from "react";

import * as Clover from "../../parts";
import type { PanelLayout, ItemsLayout, RootProps } from "../../parts";
import { PanelPane, usePanelPane } from "../shared/PanelPane";
import { BESIDE_REM, PAGE_MIN, useWideEnough } from "../shared/useSlide";
import { useFollowFocus } from "../shared/useFollowFocus";

export type DefaultProps = Omit<RootProps, "children"> & {
  /** The header over the Body: the resource's title and provider. Default `true`. */
  header?: boolean;
  /**
   * The title's heading level, to fit the outline of the page around the layout (under
   * an `h2`, 3). The panel's sections are a level below it, or at it with no header,
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
   * How the information panel lays out its sections: `"accordion"` (the default),
   * stacked boxes each opened by its heading, or `"tabs"`.
   */
  panelLayout?: PanelLayout;
  /** The downloads, from a Download button beside the panel's About heading. Default `true`. */
  download?: boolean;
  /**
   * The languages to read the resource in, beside the panel's About heading, where what
   * it says of itself comes in several (the Panel's `languages`). Default `true`.
   */
  languages?: boolean;
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
};

/**
 * The Viewer's own layout, drawn when no `template` is given: Clover 3.x's Viewer, built
 * from 4.x parts. Copy this file to start a layout of your own.
 *
 * The title and its actions over the Body, and under the Body the thumbnail strip,
 * headed by the position and a pair of arrows; the information panel to the right of all
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
  panelLayout = "accordion",
  download = true,
  languages = true,
  items = "slider",
  singleItem = false,
  storageKey = "clover-template-default",
  fill = false,
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
    body: () =>
      panes.current?.querySelector<HTMLElement>(
        ".clover-template-default-body",
      ),
    panel: Clover.Panel,
  });
  const over = pane.over;
  const docked = panel && pane.docked;
  return (
    <Clover.Root
      className={["clover-template-default", className]
        .filter(Boolean)
        .join(" ")}
      data-fill={fill || undefined}
      {...(header ? title.group : null)}
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
          className="clover-template-default-main"
          // A minimum only while the Panel is docked beside it: over it, none.
          min={over ? undefined : PAGE_MIN}
        >
          {header && (
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
          <Clover.Body className="clover-template-default-body">
            {panel && !docked && pane.toggle}
          </Clover.Body>
          <div className="clover-template-default-rail">
            <div className="clover-template-default-rail-header">
              <ViewTitles />
              <Clover.Position />
            </div>
            {items && <Clover.Items layout={items} singleItem={singleItem} />}
          </div>
        </Clover.SplitPane>
        {panel && (
          <PanelPane
            pane={pane}
            className="clover-template-default-panel"
            layout={panelLayout}
            download={download}
            languages={languages}
            // With no title over them, the sections take its place in the outline.
            headingLevel={header ? below(headingLevel) : headingLevel}
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
  const collection = Clover.useCloverSelector((state) =>
    state.throughCollection ? state.collection?.label : undefined,
  );
  /*
   * An AnnotationCollection the Manifest's pages are part of (Cookbook 0309), walked as a
   * Collection's members are: its name, then its annotations stepped, the count opening
   * their list (Mat, 2026-10-29).
   */
  const annotations = Clover.useAnnotationCollection();
  usePickFirst(annotations?.entries[0]);
  return (
    <>
      <Clover.Label
        as={title.as}
        className="clover-template-default-title clover-template-title clover-title"
        {...title.title}
      />
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
