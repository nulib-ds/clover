import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import * as Clover from "../../parts";
import type { PanelLayout, ItemsLayout, RootProps } from "../../parts";
import { useDragToClose } from "../shared/useDragToClose";
import { useFocusOnOpen, useSlide, useWideEnough } from "../shared/useSlide";
import { useFollowFocus } from "../shared/useFollowFocus";
import { useSpine } from "../shared/useSpine";

/** The narrowest the stage and the panel may be dragged, side by side. */
const STAGE_MIN = "16rem";
const PANEL_MIN = "14rem";
/**
 * The room both need beside each other: their minimums and the bar between them. Any
 * narrower (a phone) and the panel slides over the stage instead.
 */
const BESIDE_REM = 16 + 14 + 1;

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export type DefaultProps = Omit<RootProps, "children"> & {
  /** The header over the stage: the resource's thumbnail and title. Default `true`. */
  header?: boolean;
  /**
   * The title's heading level, to fit the outline of the page around the layout (under
   * an `h2`, 3). The panel's sections are a level below it, or at it with no header,
   * taking the title's place. Default 2.
   */
  headingLevel?: number;
  /** The information panel beside the stage, with its toggle. Default `true`. */
  panel?: boolean;
  /** Whether the panel starts open. Default: open when it has room beside the stage. */
  defaultPanelOpen?: boolean;
  /**
   * How the information panel lays out its sections: `"accordion"` (the default),
   * stacked boxes each opened by its heading, or `"tabs"`.
   */
  panelLayout?: PanelLayout;
  /** The thumbnails under the stage: a layout, or `false` for none. Default `carousel`. */
  items?: Exclude<ItemsLayout, "pager"> | false;
  /**
   * Where the panel's width is remembered once the reader drags its bar
   * (`localStorage`). Default `"clover-template-default"`; `false` forgets it.
   */
  storageKey?: string | false;
  /**
   * Fill the box it sits in: as tall as that box, the stage taking what the header and
   * the strip leave, so nothing runs below it. For a box of a set height, the window
   * under a page's own header say. Default `false`: the stage is
   * `--clover-content-height` tall, and the layout as tall as it needs.
   */
  fill?: boolean;
};

/**
 * The Viewer's own layout, drawn when no `template` is given: Clover 3.x's Viewer, built
 * from 4.x parts. Copy this file to start a layout of your own.
 *
 * The title and its actions over the stage, and under the stage the thumbnail strip,
 * headed by the position and a pair of arrows; the information panel to the right of all
 * three, the layout's full height. The panel has its own space, as in 3.x, and a bar
 * between it and the rest shares the width (drag it, or use the arrow keys on it). Where there is no room for both
 * (a phone), the panel slides over the stage instead, and a strip of the page stays
 * uncovered: a click there, Escape or the panel's close button puts it away. Size it with
 * `--clover-content-height`.
 */
export function Default({
  className,
  header = true,
  headingLevel = 2,
  panel = true,
  defaultPanelOpen,
  panelLayout = "accordion",
  items = "carousel",
  storageKey = "clover-template-default",
  fill = false,
  ...root
}: DefaultProps) {
  const body = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const beside = useWideEnough(body, BESIDE_REM);
  /*
   * The reader's choice (or the host's, to start with); until one is made the panel is
   * open when it has room beside the stage, and closed when it would cover it.
   */
  const [choice, setChoice] = useState<boolean | undefined>(defaultPanelOpen);
  const open = choice ?? beside;
  const setOpen = (value: boolean) => setChoice(value);
  const baseId = useId().replace(/:/g, "");
  const panelId = `${baseId}-panel`;
  // Past h6 the title is no heading, and names the Viewer instead (`Clover.titled`).
  const title = Clover.titled(headingLevel, `${baseId}-title`);
  const pane = useRef<HTMLElement>(null);
  /*
   * The panel's toggle sits on the spine, the bar between stage and panel, while the
   * panel is open beside the stage, and among the stage's controls otherwise. So a press
   * moves it, and focus on it, or in the panel as the panel goes (never left on what is
   * hidden), follows it to its new place once drawn.
   */
  const followFocus = useFollowFocus();
  const follow = () =>
    followFocus(() =>
      document.querySelector<HTMLElement>(
        `[data-button="panel"][aria-controls~="${panelId}"]`,
      ),
    );
  const handBack = () => {
    if (pane.current?.contains(document.activeElement)) follow();
  };
  /*
   * Narrowing under an open panel closes it, rather than suddenly covering the page. Before
   * paint, while focus is still in the pane just hidden.
   */
  const wasBeside = useRef(beside);
  useIsomorphicLayoutEffect(() => {
    if (wasBeside.current && !beside) {
      handBack();
      setChoice(undefined);
    }
    wasBeside.current = beside;
  }, [beside]);
  const over = !beside;
  const docked = panel && !over && open;
  const spine = useRef<HTMLDivElement>(null);
  useSpine(
    spine,
    () =>
      spine.current?.parentElement?.querySelector<HTMLElement>(
        ".clover-template-default-stage",
      ),
    docked,
  );
  const toggle = (
    <Clover.PanelToggle
      open={open}
      onOpenChange={(next) => {
        // Beside the stage it moves; over it, the panel takes focus as it opens.
        if (!over) follow();
        setOpen(next);
      }}
      controls={panelId}
    />
  );
  // Only over the stage does it slide: beside it, it simply shows and hides.
  const slide = useSlide(over && open);
  useFocusOnOpen(panelRef, over && slide.mounted);
  // Over the stage, it can be dragged back off the way it came, as an app's drawer can.
  const scrim = useRef<HTMLDivElement>(null);
  useDragToClose(pane, {
    enabled: over && slide.open,
    side: "end",
    onClose: () => {
      handBack();
      setOpen(false);
    },
    scrim,
  });
  const shown = over ? slide.mounted : open;
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
        ref={body}
        className="clover-template-default-body"
        data-panel={over ? "over" : "beside"}
        data-panel-open={panel && open}
        storageKey={storageKey || undefined}
        onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
          // Escape anywhere puts the floating panel away, uncovering a control focus
          // reached under it, and leaves focus there (the panel's own Escape, handled
          // first, hands focus to its toggle).
          if (
            over &&
            open &&
            event.key === "Escape" &&
            !event.defaultPrevented
          ) {
            event.preventDefault();
            setOpen(false);
          }
        }}
      >
        <Clover.SplitPane
          className="clover-template-default-main"
          // A minimum only while the Panel is docked beside it: over it, none.
          min={over ? undefined : STAGE_MIN}
        >
          {header && (
            <header className="clover-template-default-header">
              {/* Decorative: the title beside it names what it pictures. */}
              <Clover.Thumbnail
                alt=""
                className="clover-template-default-thumbnail"
                size={128}
              />
              <Clover.Label
                as={title.as}
                className="clover-template-default-title"
                {...title.title}
              />
            </header>
          )}
          {/* Its stage shows the loading; announced here, nothing moves. */}
          <Clover.Status loading={false} />
          <Clover.Content className="clover-template-default-stage">
            {panel && !docked && toggle}
          </Clover.Content>
          <div className="clover-template-default-rail">
            <div className="clover-template-default-rail-header">
              <ViewTitles />
              <Clover.Position />
            </div>
            {items && <Clover.Items layout={items} />}
          </div>
        </Clover.SplitPane>
        {docked && <Clover.SplitHandle aria-controls={panelId} />}
        {/* Open beside the stage, its toggle on the spine, right after the bar. */}
        {docked && (
          <div ref={spine} className="clover-template-default-spine">
            {toggle}
          </div>
        )}
        {panel && (
          <Clover.SplitPane
            ref={pane}
            id={panelId}
            data-spine={over || undefined}
            name="panel"
            className="clover-template-default-panel"
            size="24rem"
            min={over ? undefined : PANEL_MIN}
            data-open={over ? slide.open : open}
            hidden={!shown}
          >
            <Clover.Panel
              ref={panelRef}
              layout={panelLayout}
              // With no title over them, the sections take its place in the outline.
              headingLevel={header ? below(headingLevel) : headingLevel}
              // Docked, the toggle closes it; over the stage, it carries its own close.
              onClose={over ? () => setOpen(false) : undefined}
              closeOnEscape={over}
            />
          </Clover.SplitPane>
        )}
        {panel && over && slide.mounted && (
          // The uncovered strip, and the stage under the panel: a click puts it away.
          // A press on it takes no focus, so focus in the panel is still there to hand
          // back to the toggle, never left to fall to the page (WCAG 2.4.3).
          <div
            ref={scrim}
            className="clover-template-default-scrim"
            data-open={slide.open}
            aria-hidden="true"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              handBack();
              setOpen(false);
            }}
          />
        )}
      </Clover.Split>
    </Clover.Root>
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
