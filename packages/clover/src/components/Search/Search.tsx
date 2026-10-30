import React, {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useUniqueId } from "../../ui/useUniqueId";

import { type SearchHit, searchServiceOf } from "../../core/search-service";
import { selectSequence } from "../../core/selectors";
import { localize } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useClover, useCloverSelector } from "../../react/context";
import { bringIntoView, scrollerOf } from "../../ui/bringIntoView";
import { titleTag } from "../../ui/heading";
import { useSectionOpened } from "../../ui/Sections";
import { FieldPill } from "../../ui/FieldPill";
import type { StepsModel } from "../../ui/Steps";
import { languageProps } from "../../core/direction";

export interface SearchProps extends React.HTMLAttributes<HTMLElement> {
  /** The heading level of each Canvas's group of hits. Default 3. */
  headingLevel?: number;
  /**
   * The field held in view as the hits scroll under it: at the top of the box that
   * scrolls them, or, in a Panel's accordion, under the stuck headings. Default `false`.
   */
  sticky?: boolean;
  /**
   * The field's size: `large` (the default), its submit a round control's; or `small`,
   * a tad smaller, for a narrow column. Default `"large"`.
   */
  size?: "large" | "small";
  /** The element to render. Default `div`. */
  as?: React.ElementType;
}

/**
 * IIIF Content Search of the Root's Manifest: a search field, then the hits grouped by
 * Canvas, each with the words around it. Choosing a hit goes to it and frames it; the
 * hits are drawn on the Canvas meanwhile. Beside the count, Previous and Next step
 * through the hits in order, across Canvases, and say which one is current ("3 / 11"),
 * the first as results arrive.
 * Renders nothing when the Manifest offers no search service (version 1 or 2).
 */
/** Hits drawn at a time, in a long answer. */
const CHUNK = 40;

export const Search = forwardRef<HTMLElement, SearchProps>(function Search(
  {
    headingLevel = 3,
    sticky = false,
    size = "large",
    as: Tag = "div",
    className,
    ...rest
  },
  ref,
) {
  const { t, langOf } = useCloverTranslation();
  const { clover, language } = useClover("Search");
  const service = useCloverSelector(
    (state) => searchServiceOf(state.manifest)?.id ?? null,
  );
  const search = useCloverSelector((state) => state.search);
  const canvases = useCloverSelector(
    (state) => selectSequence(state.manifest).canvases,
  );
  const selected = useCloverSelector((state) => state.annotationId);
  const highlighted = useSyncExternalStore(
    clover.highlight.subscribe,
    clover.highlight.get,
    clover.highlight.get,
  );
  const id = useUniqueId();
  // The field holds what is typed; a search from elsewhere (the Root) fills it.
  const [draft, setDraft] = useState(search.query);
  useEffect(() => setDraft(search.query), [search.query]);
  /*
   * A step brings the hit it reaches into view in the list that scrolls it (a Panel's),
   * never the page; a hit chosen from the list is in view already.
   */
  const field = useRef<HTMLInputElement>(null);
  /*
   * Its field takes focus as the reader opens its section with a press (Mat,
   * 2026-10-26), there to type into; opened by a search from elsewhere, focus stays.
   */
  const opened = useSectionOpened();
  const focused = useRef(0);
  const stepped = useRef(false);
  /*
   * Results that arrive go to their first hit (Mat, 2026-10-26), as find in a page does,
   * so the count reads "1 / 11" from the start and Next goes on to the second. Only the
   * Canvas moves, never focus; once per answer, so a reader's own pick stands.
   */
  const arrived = useRef<unknown>(null);
  useEffect(() => {
    if (search.status !== "ready" || !search.set) return;
    if (arrived.current === search.set) return;
    arrived.current = search.set;
    const first = search.hits[0];
    const chosen = search.hits.some(
      (hit) => selected && hit.entryIds.includes(selected),
    );
    if (first && !chosen) clover.selectAnnotation(first.entryIds[0]);
  }, [clover, search.status, search.set, search.hits, selected]);
  /*
   * Held in view, the field's height is written to the part (`--clover-content-search-
   * field`), so a hit scrolled to or focused lands clear of it (WCAG 2.4.11).
   */
  useEffect(() => {
    const held = field.current?.closest<HTMLElement>(
      ".clover-content-search-field",
    );
    const part = held?.parentElement;
    if (!sticky || !held || !part || typeof ResizeObserver === "undefined")
      return;
    const observer = new ResizeObserver(() =>
      part.style.setProperty(
        "--clover-content-search-field",
        `${held.offsetHeight}px`,
      ),
    );
    observer.observe(held);
    return () => {
      observer.disconnect();
      part.style.removeProperty("--clover-content-search-field");
    };
  }, [sticky, service]);
  useEffect(() => {
    if (!stepped.current) return;
    stepped.current = false;
    const current = field.current
      ?.closest(".clover-content-search")
      ?.querySelector<HTMLElement>(
        '.clover-content-search-hit[aria-current="true"]',
      );
    if (current) bringIntoView(current, "nearest");
  }, [selected]);
  /*
   * A long answer (a common word: hundreds of hits) is drawn a chunk at a time (Mat,
   * 2026-10-26: "lazy load these results"): the first `CHUNK`, then the next as the
   * list's end nears its scrolling box, or as focus reaches its last few, so Tab never
   * runs out before the hits do. The current hit is always among them, so a step can go
   * to any. Where nothing can tell the end is near (no `IntersectionObserver`), all.
   */
  const [more, setMore] = useState<{ set: unknown; count: number }>({
    set: null,
    count: CHUNK,
  });
  const limit = more.set === search.set ? more.count : CHUNK;
  const extend = () => setMore({ set: search.set, count: limit + CHUNK });
  const end = useRef<HTMLDivElement>(null);
  const position = selected
    ? search.hits.findIndex((hit) => hit.entryIds.includes(selected))
    : -1;
  const lazy = typeof IntersectionObserver !== "undefined";
  const shown = lazy
    ? Math.min(search.hits.length, Math.max(limit, position + 1))
    : search.hits.length;
  const extendRef = useRef(extend);
  extendRef.current = extend;
  useEffect(() => {
    const node = end.current;
    if (!node || !lazy || shown >= search.hits.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) extendRef.current();
      },
      { root: scrollerOf(node), rootMargin: "0px 0px 400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [lazy, shown, search.hits.length]);
  useEffect(() => {
    if (!opened || opened === focused.current || !field.current) return;
    focused.current = opened;
    field.current.focus();
  }, [opened, service]);
  if (!service) return null;

  // The hits in order, as Items' pager steps through views (`Items/Pager.tsx`).
  const steps: StepsModel = {
    position,
    total: search.hits.length,
    step: (by) => {
      const to = search.hits[steps.position + by];
      if (!to) return;
      stepped.current = true;
      clover.selectAnnotation(to.entryIds[0]);
    },
  };

  // The hits drawn, by Canvas, each with its place in the answer.
  const groups: Array<{
    canvasId: string;
    hits: Array<{ hit: SearchHit; index: number }>;
  }> = [];
  search.hits.slice(0, shown).forEach((hit, index) => {
    const last = groups[groups.length - 1];
    if (last?.canvasId === hit.canvasId) last.hits.push({ hit, index });
    else groups.push({ canvasId: hit.canvasId, hits: [{ hit, index }] });
  });
  // Past 6 not a heading (`ui/heading.ts`): each group is named by it either way.
  const Heading = titleTag(headingLevel);
  const count = search.hits.length;
  const statusKey =
    search.status === "loading"
      ? "contentSearchLoading"
      : search.status === "error"
        ? "contentSearchError"
        : search.status === "ready"
          ? count === 0
            ? "contentSearchResultsNone"
            : count === 1
              ? "contentSearchResult"
              : "contentSearchResults"
          : null;
  const status = statusKey ? t(statusKey, { count }) : "";

  // What the search found, shown inside the field (`FieldPill`'s `results`).
  const results = search.status === "ready" ? steps : null;
  const bar = (
    <p
      className="clover-content-search-status"
      role="status"
      data-status={search.status}
      {...languageProps(statusKey ? langOf(statusKey) : undefined)}
    >
      {status}
    </p>
  );

  return (
    <Tag
      ref={ref}
      className={join("clover-content-search", className)}
      data-status={search.status}
      data-sticky={sticky || undefined}
      {...rest}
    >
      <div className="clover-content-search-field">
        <FieldPill
          ref={field}
          id={`${id}-query`}
          value={draft}
          onChange={(value) => {
            setDraft(value);
            // Emptying the field clears the hits.
            if (!value && search.query) void clover.search("");
          }}
          onSubmit={() => void clover.search(draft)}
          onClear={() => {
            setDraft("");
            if (search.query) void clover.search("");
            field.current?.focus();
          }}
          results={results}
          size={size}
          classes={{
            form: "clover-content-search-form",
            query: "clover-content-search-query",
            clear: "clover-content-search-clear",
            submit: "clover-content-search-submit",
          }}
        />
      </div>
      {bar}
      {groups.map(({ canvasId, hits }, index) => {
        const canvas = canvases.find((item) => item.id === canvasId);
        const label = localize(canvas?.label as never, language);
        return (
          <section
            key={`${canvasId}-${index}`}
            className="clover-content-search-group"
            aria-labelledby={`${id}-${index}`}
          >
            <Heading
              id={`${id}-${index}`}
              className="clover-content-search-canvas"
              {...languageProps(label.text ? label.lang : undefined)}
            >
              {label.text || canvasId}
            </Heading>
            <ol className="clover-content-search-hits">
              {hits.map(({ hit, index: place }) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className="clover-content-search-hit"
                    aria-current={
                      selected && hit.entryIds.includes(selected)
                        ? "true"
                        : undefined
                    }
                    data-highlighted={hit.entryIds.includes(highlighted ?? "")}
                    onClick={() => clover.selectAnnotation(hit.entryIds[0])}
                    onPointerEnter={() =>
                      clover.highlight.emit(hit.entryIds[0])
                    }
                    onPointerLeave={() => clover.highlight.emit(null)}
                    onFocus={() => {
                      clover.highlight.emit(hit.entryIds[0]);
                      if (shown < count && place >= shown - 5) extend();
                    }}
                    onBlur={() => clover.highlight.emit(null)}
                  >
                    {hit.before}
                    <mark>{hit.match}</mark>
                    {hit.after}
                  </button>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
      {/* Where the next chunk is asked for, as it nears the view. */}
      {shown < count && (
        <div
          ref={end}
          className="clover-content-search-more"
          aria-hidden="true"
        />
      )}
    </Tag>
  );
});
