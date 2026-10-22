import React, {
  forwardRef,
  useEffect,
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
import { titleTag } from "../../ui/heading";
import { visuallyHidden } from "../../ui/visuallyHidden";

export interface SearchProps extends React.HTMLAttributes<HTMLElement> {
  /** The heading level of each Canvas's group of hits. Default 3. */
  headingLevel?: number;
  /** The element to render. Default `div`. */
  as?: React.ElementType;
}

/**
 * IIIF Content Search of the Root's Manifest: a search field, then the hits grouped by
 * Canvas, each with the words around it. Choosing a hit goes to it and frames it; the
 * hits are drawn on the Canvas meanwhile. Renders nothing when the Manifest offers no
 * search service (version 1 or 2).
 */
export const Search = forwardRef<HTMLElement, SearchProps>(function Search(
  { headingLevel = 3, as: Tag = "div", className, ...rest },
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
  if (!service) return null;

  const groups: Array<{ canvasId: string; hits: SearchHit[] }> = [];
  for (const hit of search.hits) {
    const last = groups[groups.length - 1];
    if (last?.canvasId === hit.canvasId) last.hits.push(hit);
    else groups.push({ canvasId: hit.canvasId, hits: [hit] });
  }
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

  return (
    <Tag
      ref={ref}
      className={join("clover-content-search", className)}
      data-status={search.status}
      {...rest}
    >
      <form
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
          id={`${id}-query`}
          type="search"
          className="clover-content-search-query"
          value={draft}
          placeholder={t("contentSearchPlaceholder")}
          lang={langOf("contentSearchPlaceholder")}
          onChange={(event) => {
            setDraft(event.target.value);
            // Emptying the field (its × included) clears the hits.
            if (!event.target.value && search.query) void clover.search("");
          }}
        />
        <button
          type="submit"
          className="clover-content-search-submit"
          lang={langOf("commonSearch")}
        >
          {t("commonSearch")}
        </button>
      </form>
      <p
        className="clover-content-search-status"
        role="status"
        lang={statusKey ? langOf(statusKey) : undefined}
      >
        {status}
      </p>
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
              {hits.map((hit) => (
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
                    onFocus={() => clover.highlight.emit(hit.entryIds[0])}
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
    </Tag>
  );
});
