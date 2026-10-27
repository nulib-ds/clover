import React, {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useUniqueId } from "../../ui/useUniqueId";

import type { Steps } from "../Items/Pager";

import { type SearchHit, searchServiceOf } from "../../core/search-service";
import { selectSequence } from "../../core/selectors";
import { localize } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useClover, useCloverSelector } from "../../react/context";
import { bringIntoView, scrollerOf } from "../../ui/bringIntoView";
import { titleTag } from "../../ui/heading";
import { Tip } from "../../ui/Tip";
import { useSectionActions } from "../../ui/Sections";
import { visuallyHidden } from "../../ui/visuallyHidden";

export interface SearchProps extends React.HTMLAttributes<HTMLElement> {
  /** The heading level of each Canvas's group of hits. Default 3. */
  headingLevel?: number;
  /**
   * Where the count, Previous, Next and the current hit's place sit: under the field
   * (`status`, the default), or beside its section's heading in a Panel's accordion
   * (`heading`), held there as the hits scroll under it, as a Transcript's languages
   * are. Where there is no such heading, under the field.
   */
  pager?: "status" | "heading";
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
    pager: pagerAt = "status",
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
  const form = useRef<HTMLFormElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const stepped = useRef(false);
  const actions = useSectionActions();
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
    const field = form.current?.parentElement;
    const part = field?.parentElement;
    if (!sticky || !field || !part || typeof ResizeObserver === "undefined")
      return;
    const observer = new ResizeObserver(() =>
      part.style.setProperty(
        "--clover-content-search-field",
        `${field.offsetHeight}px`,
      ),
    );
    observer.observe(field);
    return () => {
      observer.disconnect();
      part.style.removeProperty("--clover-content-search-field");
    };
  }, [sticky, service]);
  useEffect(() => {
    if (!stepped.current) return;
    stepped.current = false;
    const current = form.current
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
  if (!service) return null;

  // The hits in order, as Items' pager steps through views (`Items/Pager.tsx`).
  const steps: Steps = {
    position,
    total: search.hits.length,
    direction: "left-to-right",
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

  const current = steps.position + 1;
  const pager = count > 1 && (
    <div className="clover-content-search-pager">
      {/*
       * Which hit is current, read as it changes ("Result 3 of 11"): the region is there
       * before its first count, so that one is announced too (WCAG 4.1.3).
       */}
      <span aria-live="polite" className="clover-content-search-position">
        <span className="clover-pager-position">
          {/* The total, always; the hit current before it, a dash until one is. */}
          <span aria-hidden="true">
            {current ? current : "–"} / {count}
          </span>
          {/*
           * The widest count, unseen in the same place: it keeps the room, so nothing
           * beside it moves as it grows (Items' `Pager.css`).
           */}
          <span className="clover-pager-room" aria-hidden="true" hidden>
            {count} / {count}
          </span>
          {current > 0 && (
            <span style={visuallyHidden} lang={langOf("contentSearchPosition")}>
              {t("contentSearchPosition", { index: current, total: count })}
            </span>
          )}
        </span>
      </span>
      <Step steps={steps} step="previous" />
      <Step steps={steps} step="next" />
    </div>
  );
  /*
   * The count and the steps: under the field, or beside the section's heading, asked for
   * and offered (a Panel's accordion), held there as the hits scroll under it.
   */
  const bar = (
    <div
      className="clover-content-search-bar"
      data-status={search.status}
      data-steps={count > 1 || undefined}
    >
      <p
        className="clover-content-search-status"
        role="status"
        lang={statusKey ? langOf(statusKey) : undefined}
      >
        {status}
      </p>
      {pager}
    </div>
  );
  const headed = pagerAt === "heading" && actions;

  return (
    <Tag
      ref={ref}
      className={join("clover-content-search", className)}
      data-status={search.status}
      data-sticky={sticky || undefined}
      data-size={size}
      {...rest}
    >
      <div className="clover-content-search-field">
        <form
          ref={form}
          role="search"
          className="clover-content-search-form"
          onSubmit={(event) => {
            event.preventDefault();
            void clover.search(draft);
          }}
        >
          <label
            htmlFor={`${id}-query`}
            style={visuallyHidden}
            lang={langOf("informationPanelTabsSearch")}
          >
            {t("informationPanelTabsSearch")}
          </label>
          <input
            ref={field}
            id={`${id}-query`}
            type="search"
            className="clover-content-search-query"
            value={draft}
            placeholder={t("contentSearchPlaceholder")}
            lang={langOf("contentSearchPlaceholder")}
            onChange={(event) => {
              setDraft(event.target.value);
              // Emptying the field clears the hits.
              if (!event.target.value && search.query) void clover.search("");
            }}
          />
          {/*
           * Clear, while there is something to clear: the browser's own × can be neither
           * reached by the keyboard nor styled, so it is hidden (Search.css) and this
           * takes its place. Focus goes back to the field, for the next query (2.4.3).
           */}
          {draft && (
            <button
              type="button"
              className="clover-content-search-clear"
              lang={langOf("contentSearchClear")}
              onClick={() => {
                setDraft("");
                if (search.query) void clover.search("");
                field.current?.focus();
              }}
            >
              <svg
                aria-hidden="true"
                focusable="false"
                width="12"
                height="12"
                viewBox="0 0 16 16"
              >
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span style={visuallyHidden}>{t("contentSearchClear")}</span>
              <Tip label={t("contentSearchClear")} />
            </button>
          )}
          {/* Round, in the accent, at the pill's end, its name a `Tip`. */}
          <button
            type="submit"
            className="clover-content-search-submit"
            lang={langOf("commonSearch")}
          >
            <svg
              aria-hidden="true"
              focusable="false"
              width="16"
              height="16"
              viewBox="0 0 16 16"
            >
              <circle
                cx="7"
                cy="7"
                r="4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M10.5 10.5L14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span style={visuallyHidden}>{t("commonSearch")}</span>
            <Tip label={t("commonSearch")} />
          </button>
        </form>
      </div>
      {headed ? createPortal(bar, actions) : bar}
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
              lang={label.text ? label.lang : undefined}
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

/**
 * A step through the hits, small, as Annotations' language codes are (Mat, 2026-10-26:
 * "make smaller"): a pill around a chevron, muted, the accent under the pointer or
 * focused, its name a `Tip`. At the first hit or the last it is `aria-disabled`, not
 * `disabled`, so the press that reaches the end leaves focus on it (WCAG 2.4.3).
 */
function Step({ steps, step }: { steps: Steps; step: "previous" | "next" }) {
  const { t, langOf } = useCloverTranslation();
  const isNext = step === "next";
  const available = isNext
    ? steps.position + 1 < steps.total
    : steps.position > 0;
  const key = isNext ? "commonNext" : "commonPrevious";
  return (
    <button
      type="button"
      className="clover-content-search-step"
      data-step={step}
      lang={langOf(key)}
      aria-disabled={!available || undefined}
      tabIndex={available ? undefined : -1}
      onClick={(event) => {
        if (available) steps.step(isNext ? 1 : -1, event);
      }}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        width="12"
        height="12"
        viewBox="0 0 16 16"
      >
        <path
          d={isNext ? "M6 3l5 5-5 5" : "M10 3L5 8l5 5"}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span style={visuallyHidden}>{t(key)}</span>
      <Tip label={t(key)} />
    </button>
  );
}
