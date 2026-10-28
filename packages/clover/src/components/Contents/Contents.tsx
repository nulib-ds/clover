import React, {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  type ContentsNode,
  type ContentsPart,
  currentContents,
  tableOfContents,
} from "../../core/ranges";
import { regionEntryId } from "../../core/annotation-sets";
import { imageSource } from "../../core/thumbnail";
import { localize } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { playFrom } from "../../lib/time";
import { Chevron } from "../../ui/Chevron";
import { EntryThumbnail } from "../../ui/EntryThumbnail";
import { Steps } from "../../ui/Steps";
import { CueTime } from "../../ui/Cue";
import { useClover, useCloverSelector } from "../../react/context";
import { useContainerName } from "../../ui/useContainerName";
import { useUniqueId } from "../../ui/useUniqueId";
import { visuallyHidden } from "../../ui/visuallyHidden";

export interface ContentsProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
}

/**
 * The Manifest's table of contents, from its Ranges: chapters of a book, acts of an opera,
 * nested as they nest. The entry the reader is in is marked, following playback through a
 * time-based Canvas. An entry with entries under it opens and closes them by a button at
 * the end of its row (a disclosure, `aria-expanded`), named for it ("Sections in Act 1").
 * They start closed, but for those holding the current entry: open from the root down
 * to it, and set in the text's weight, so the trail to it shows (Mat, 2026-10-28). The
 * reader's own choices hold, until the current entry comes into a branch it was not in,
 * which opens. An article in parts (its columns, on pages out of order) has, while it is
 * the current entry, a step through them in its row ("2 / 4", `ui/Steps`); its
 * regions are drawn on the Canvas as annotations are (`range-regions.ts`). The current
 * entry shows its Range's `thumbnail` (Cookbook 0229) under its words, large, as the seek
 * bar's popover does, and the others none (`ui/EntryThumbnail`). Choosing an entry goes
 * to its Canvas, and to its region or its moment.
 * Hovering or focusing one marks its chapter on the Canvas's seek bar, and the chapter
 * under the pointer there marks its entry here: one highlight, through the Root
 * (`clover.chapter`), as the annotations share theirs.
 */
export const Contents = forwardRef<HTMLElement, ContentsProps>(
  function Contents({ as: Tag = "nav", className, ...rest }, ref) {
    const { t, langOf } = useCloverTranslation();
    const { clover, language } = useClover("Contents");
    const name = useContainerName(
      t("informationPanelTabsContents"),
      langOf("informationPanelTabsContents"),
      rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
    );
    const nodes = useCloverSelector((state) => tableOfContents(state.manifest));
    const canvasId = useCloverSelector((state) => state.canvasId);
    const selected = useCloverSelector((state) => state.annotationId);
    const element = useSyncExternalStore(
      clover.media.subscribe,
      clover.media.get,
      clover.media.get,
    );
    // The entry the reader chose, current while it covers what is shown (one sequence of
    // two that cover every page, Cookbook 0027).
    const [chosen, setChosen] = useState<string | null>(null);
    const current = useCurrent(nodes, canvasId, element, chosen);
    const highlighted = useSyncExternalStore(
      clover.chapter.subscribe,
      clover.chapter.get,
      clover.chapter.get,
    );
    const id = useUniqueId();
    // The entries holding the current one, from the root down: open, and marked.
    const trail = useMemo(() => trailTo(nodes, current), [nodes, current]);
    // What the reader opened or closed, by entry; the trail opens again as it moves.
    const [toggled, setToggled] = useState<Map<string, boolean>>(
      () => new Map(),
    );
    // Only the branches it has just come into: a scene to the next in one act keeps the
    // reader's choice for that act.
    const lastTrail = useRef<Set<string>>(new Set());
    useEffect(() => {
      const entered = [...trail].filter(
        (entry) => !lastTrail.current.has(entry),
      );
      lastTrail.current = trail;
      setToggled((before) => {
        if (!entered.some((entry) => before.has(entry))) return before;
        const after = new Map(before);
        entered.forEach((entry) => after.delete(entry));
        return after;
      });
    }, [trail]);
    // The part of an article the reader stepped to, where two share a page.
    const [stepAt, setStepAt] = useState<{ node: string; index: number }>();
    if (!nodes.length) return null;
    const isOpen = (node: ContentsNode) =>
      toggled.get(node.id) ?? trail.has(node.id);

    /*
     * A part: its region's annotation selected, which frames it and marks it on the Canvas
     * as a search's hit is; a whole page, gone to.
     */
    const goToPart = (node: ContentsNode, index: number) => {
      const part = node.parts?.[index];
      if (!part) return;
      setStepAt({ node: node.id, index });
      setChosen(node.id);
      const id = regionEntryId(node.id, index);
      // Its region selected once the Root has read the regions; until then, gone to.
      if (
        part.region &&
        clover.store.get().regions?.entries.some((entry) => entry.id === id)
      )
        clover.selectAnnotation(id);
      else
        clover.goTo(part.canvasId, part.region ? { region: part.region } : {});
    };

    const choose = (node: ContentsNode) => {
      if (!node.canvasId) return;
      setChosen(node.id);
      if (node.parts) {
        goToPart(node, 0);
        return;
      }
      // On the Canvas playing: play from there (`playFrom`). Elsewhere: go, arriving at
      // the moment or region.
      if (node.canvasId === canvasId && node.time && element) {
        playFrom(element, node.time.start);
        return;
      }
      clover.goTo(node.canvasId, {
        ...(node.time ? { time: node.time.start } : {}),
        ...(node.region ? { region: node.region } : {}),
      });
    };

    /*
     * Through an article's parts in the order its Range reads them (Cookbook 0025): where
     * the reader is among them, the region selected (stepped to, or picked on the
     * Canvas), else the part stepped to, else the first on the Canvas in view.
     */
    const partSteps = (node: ContentsNode, parts: ContentsPart[]) => {
      const picked = parts.findIndex(
        (part, index) =>
          Boolean(part.region) && regionEntryId(node.id, index) === selected,
      );
      const stepped =
        stepAt?.node === node.id && parts[stepAt.index]?.canvasId === canvasId
          ? stepAt.index
          : -1;
      const position =
        picked >= 0
          ? picked
          : stepped >= 0
            ? stepped
            : parts.findIndex((part) => part.canvasId === canvasId);
      return {
        position,
        total: parts.length,
        step: (by: -1 | 1) => goToPart(node, position + by),
      };
    };

    const render = (list: ContentsNode[], listId?: string, hidden = false) => (
      <ol className="clover-contents-list" id={listId} hidden={hidden}>
        {list.map((node, index) => {
          const label = localize(node.label, language);
          const key = listId ? `${listId}-${index}` : `${id}-${index}`;
          const nested = node.children.length > 0;
          const open = nested && isOpen(node);
          const picture =
            node.id === current
              ? imageSource(node.thumbnail as Record<string, any> | undefined)
              : null;
          return (
            <li key={node.id} className="clover-contents-item">
              <div
                className="clover-contents-row"
                data-current={node.id === current ? "true" : undefined}
              >
                <button
                  type="button"
                  id={`${key}-entry`}
                  className="clover-contents-button"
                  data-trail={trail.has(node.id) ? "true" : undefined}
                  aria-current={node.id === current ? "true" : undefined}
                  data-highlighted={
                    node.id === highlighted ? "true" : undefined
                  }
                  disabled={!node.canvasId}
                  onMouseEnter={() => clover.chapter.emit(node.id)}
                  onMouseLeave={() => clover.chapter.emit(null)}
                  onFocus={() => clover.chapter.emit(node.id)}
                  onBlur={() => clover.chapter.emit(null)}
                  // A Range on a recording's time leads with it, as a cue does (`CueTime`);
                  // the current one's picture goes under them.
                  data-timed={node.time ? "true" : undefined}
                  data-pictured={picture ? "true" : undefined}
                  lang={
                    label.text && !node.time && !picture
                      ? label.lang
                      : undefined
                  }
                  onClick={() => choose(node)}
                >
                  {node.time || picture ? (
                    <>
                      {node.time && (
                        <CueTime
                          start={node.time.start}
                          className="clover-contents-time"
                        />
                      )}
                      <span
                        className="clover-cue-text"
                        lang={label.text ? label.lang : undefined}
                      >
                        {label.text || node.id}
                      </span>
                      <EntryThumbnail
                        source={picture}
                        request={clover.request}
                        large
                      />
                    </>
                  ) : (
                    label.text || node.id
                  )}
                </button>
                {node.id === current && node.parts && node.parts.length > 1 && (
                  <Steps
                    className="clover-contents-steps"
                    steps={partSteps(node, node.parts)}
                  />
                )}
                {nested && (
                  <button
                    type="button"
                    className="clover-contents-toggle"
                    aria-expanded={open}
                    aria-controls={`${key}-list`}
                    // "Sections in", then the entry's own label, each in its language.
                    aria-labelledby={`${key}-toggle ${key}-entry`}
                    onClick={() =>
                      setToggled((before) =>
                        new Map(before).set(node.id, !open),
                      )
                    }
                  >
                    <span
                      id={`${key}-toggle`}
                      style={visuallyHidden}
                      lang={langOf("contentsSectionsIn")}
                    >
                      {t("contentsSectionsIn")}
                    </span>
                    <Chevron open={open} className="clover-contents-chevron" />
                  </button>
                )}
              </div>
              {nested && render(node.children, `${key}-list`, !open)}
            </li>
          );
        })}
      </ol>
    );

    return (
      <Tag
        ref={ref}
        {...name.props}
        className={join("clover-contents", className)}
        {...rest}
      >
        {name.node}
        {render(nodes)}
      </Tag>
    );
  },
);

/** The entries holding `current`, from the root down to its parent: none for a top one. */
function trailTo(nodes: ContentsNode[], current: string | null): Set<string> {
  const found = new Set<string>();
  if (!current) return found;
  const walk = (list: ContentsNode[], above: string[]): boolean =>
    list.some((node) =>
      node.id === current
        ? (above.forEach((entry) => found.add(entry)), true)
        : walk(node.children, [...above, node.id]),
    );
  walk(nodes, []);
  return found;
}

/** The current entry, recomputed as media plays; a re-render only when it changes. */
function useCurrent(
  nodes: ContentsNode[],
  canvasId: string | null,
  element: HTMLVideoElement | null,
  chosen: string | null,
) {
  const [current, setCurrent] = useState<string | null>(() =>
    currentContents(nodes, canvasId, undefined, chosen),
  );
  useEffect(() => {
    const update = () =>
      setCurrent(
        currentContents(nodes, canvasId, element?.currentTime, chosen),
      );
    update();
    if (!element) return;
    element.addEventListener("timeupdate", update);
    element.addEventListener("seeked", update);
    return () => {
      element.removeEventListener("timeupdate", update);
      element.removeEventListener("seeked", update);
    };
  }, [nodes, canvasId, element, chosen]);
  return current;
}
