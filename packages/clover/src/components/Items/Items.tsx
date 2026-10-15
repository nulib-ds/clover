import React, {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { ItemFigure } from "./Item";
import { Tip } from "../../ui/Tip";
import {
  type ItemModel,
  itemsOf,
  itemsOfCollection,
  itemsOfManifest,
} from "../../core/items";
import { type IIIFContent, fetchResource } from "../../core/load";
import type { Collection, Manifest } from "../../core/presentation";
import type { CloverRequest } from "../../core/request";
import { selectPosition, selectSequence } from "../../core/selectors";
import { type LanguageMapLike, localize } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useCloverSelector, useOptionalClover } from "../../react/context";
import { useRovingFocus } from "../../ui/useRovingFocus";
import { useScrollTrack } from "../../ui/useScrollTrack";
import { visuallyHidden } from "../../ui/visuallyHidden";

export type ItemsLayout = "carousel" | "list" | "grid";

export interface ItemsProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "onSelect" | "children"> {
  /** A scrolling row (the default), a column, or a wrapping grid. */
  layout?: ItemsLayout;
  /**
   * Inside a `Root`: the Manifest's views (default), or the members of the Collection it
   * belongs to, choosing one to show.
   */
  of?: "views" | "members";
  /**
   * Standalone: a Collection (its members), a Manifest (its views) or a URL to one. Inside
   * a `Root`, leave it out to list the Root's views.
   */
  iiifContent?: IIIFContent;
  /** Standalone: a list of IIIF resources (Manifests, Collections, Canvases) as they are. */
  items?: unknown[];
  /**
   * `id` selects: a listbox whose options go to a view (in a `Root`). `homepage` leaves: a
   * list of links to each item's `homepage`. Defaults to `id` for views and `homepage`
   * for a Collection's members or a list.
   */
  navigation?: "id" | "homepage";
  /**
   * An item was chosen. For a link, call `event.preventDefault()` to stay on the page and
   * handle it yourself.
   */
  onSelect?: (item: ItemModel, event: React.SyntheticEvent) => void;
  /** Standalone: show the resource's label, summary and homepage link. Default true. */
  header?: boolean;
  /** Pixels requested for each thumbnail's longer side. Default 200. */
  thumbnailSize?: number;
  /** Standalone: credentials, headers and `fetch`. In a `Root`, the Root's are used. */
  request?: CloverRequest;
  /** Standalone: the language to read IIIF text in. */
  language?: string;
  /** Replace an item's figure with your own. */
  renderItem?: (
    item: ItemModel,
    state: { selected: boolean },
  ) => React.ReactNode;
  as?: React.ElementType;
}

/**
 * Thumbnails of a sequence: the views of a Manifest, or the members of a Collection.
 * The successor to 3.x's `Slider` and the Viewer's thumbnail rail.
 *
 * - **Inside a `Root`**, a single-select listbox of the Root's views (a spread is one
 *   item). One tab stop; arrows move, Enter or Space selects; the selection follows the
 *   pager and stays in view.
 * - **Standalone**, a list of links to each item's `homepage` — a Collection carousel.
 *
 * The carousel is the browser's own scrolling with CSS snap points: wheel, trackpad,
 * touch and keyboard all work, and a mouse can drag it.
 */
export const Items = forwardRef<HTMLElement, ItemsProps>(
  function Items(props, ref) {
    const root = useOptionalClover();
    const standalone =
      !root || props.iiifContent !== undefined || props.items !== undefined;
    return standalone ? (
      <StandaloneItems {...props} forwardedRef={ref} />
    ) : (
      <ConnectedItems {...props} forwardedRef={ref} />
    );
  },
);

type Forwarded = { forwardedRef: React.ForwardedRef<HTMLElement> };

/** Inside a Root: its views, or its Collection's members. */
function ConnectedItems({ of = "views", ...props }: ItemsProps & Forwarded) {
  return of === "members" ? (
    <MemberItems {...props} />
  ) : (
    <ViewItems {...props} />
  );
}

/** The Collection's members, as a listbox choosing the Manifest shown. */
function MemberItems({
  onSelect,
  forwardedRef,
  ...rest
}: ItemsProps & Forwarded) {
  const { clover, language } = useOptionalClover()!;
  const collection = useCloverSelector((state) => state.collection);
  const manifestId = useCloverSelector((state) => state.manifest?.id ?? null);
  const items = itemsOfCollection(collection);
  if (!items.length) return null;
  return (
    <ItemsView
      {...rest}
      forwardedRef={forwardedRef}
      items={items}
      selected={items.findIndex((item) => item.id === manifestId)}
      navigation="id"
      language={language}
      request={clover.request}
      showSummary
      onActivate={(item, event) => {
        onSelect?.(item, event);
        void clover.goToManifest(item.id);
      }}
    />
  );
}

/** The Root's views, as a listbox. */
function ViewItems({
  onSelect,
  forwardedRef,
  ...rest
}: ItemsProps & Forwarded) {
  const { clover, language } = useOptionalClover()!;
  const manifest = useCloverSelector((state) => state.manifest);
  const position = useCloverSelector((state) =>
    selectPosition(state.manifest, state.canvasId),
  );
  const direction = useCloverSelector(
    (state) => selectSequence(state.manifest).direction,
  );
  const items = itemsOfManifest(manifest);
  // One view has nothing to choose between, as the pager agrees.
  if (items.length < 2) return null;
  return (
    <ItemsView
      {...rest}
      forwardedRef={forwardedRef}
      items={items}
      selected={position}
      navigation="id"
      rtl={direction === "right-to-left"}
      language={language}
      request={clover.request}
      onActivate={(item, event) => {
        onSelect?.(item, event);
        clover.goTo(item.id);
      }}
      // As in a radio group: the page in focus is the page shown.
      followFocus={(item) => clover.goTo(item.id)}
    />
  );
}

/** Items of a resource the component loads itself, or of a list it is handed. */
function StandaloneItems({
  iiifContent,
  items: provided,
  navigation,
  onSelect,
  request,
  header = true,
  forwardedRef,
  ...rest
}: ItemsProps & Forwarded) {
  const [resource, setResource] = useState<Manifest | Collection | null>(null);
  const [selected, setSelected] = useState(0);
  const key =
    typeof iiifContent === "string"
      ? iiifContent
      : (iiifContent as { id?: string })?.id;
  const latest = useRef({ iiifContent, request });
  latest.current = { iiifContent, request };

  useEffect(() => {
    if (provided || latest.current.iiifContent === undefined) return;
    const controller = new AbortController();
    fetchResource(latest.current.iiifContent, {
      request: latest.current.request,
      signal: controller.signal,
    })
      .then((loaded) => {
        if (!controller.signal.aborted) setResource(loaded);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [key, provided]);

  const items = useMemo(
    () => itemsOf(provided ? (provided as never) : resource),
    [provided, resource],
  );
  if (!items.length) return null;

  const isViews = !provided && resource?.type === "Manifest";
  const mode = navigation ?? (isViews ? "id" : "homepage");
  const homepage = (resource as { homepage?: Array<{ id?: string }> } | null)
    ?.homepage?.[0]?.id;

  return (
    <ItemsView
      {...rest}
      forwardedRef={forwardedRef}
      items={items}
      selected={mode === "id" ? selected : -1}
      navigation={mode}
      request={request}
      showSummary={!isViews}
      heading={
        header && resource
          ? {
              label: resource.label as LanguageMapLike,
              summary: (resource as { summary?: LanguageMapLike }).summary,
              homepage,
            }
          : undefined
      }
      onActivate={(item, event) => {
        onSelect?.(item, event);
        setSelected(items.indexOf(item));
      }}
      followFocus={(item) => setSelected(items.indexOf(item))}
    />
  );
}

interface ItemsViewProps extends Omit<ItemsProps, "navigation" | "items"> {
  forwardedRef: React.ForwardedRef<HTMLElement>;
  items: ItemModel[];
  selected: number;
  navigation: "id" | "homepage";
  rtl?: boolean;
  showSummary?: boolean;
  heading?: {
    label?: LanguageMapLike;
    summary?: LanguageMapLike;
    homepage?: string;
  };
  onActivate: (item: ItemModel, event: React.SyntheticEvent) => void;
  /**
   * Selects the option focus moves to by an arrow, Home or End, as a radio group does.
   * `onActivate` (Enter, a click) still says the reader chose it: a Gallery opens it. Not
   * for a Collection's members, where each selection loads a Manifest.
   */
  followFocus?: (item: ItemModel) => void;
}

function ItemsView({
  forwardedRef,
  items,
  selected,
  navigation,
  rtl = false,
  layout = "carousel",
  thumbnailSize = 200,
  request,
  language,
  showSummary = false,
  heading,
  renderItem,
  onActivate,
  followFocus,
  as: Tag = "section",
  className,
  "aria-label": ariaLabel,
  ...rest
}: ItemsViewProps) {
  const { t } = useCloverTranslation();
  const id = useId();

  const carousel = layout === "carousel";
  const listbox = navigation === "id";
  const track = useScrollTrack({
    align: listbox ? "center" : "start",
    itemCount: items.length,
  });
  const held = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(held.current), []);
  const roving = useRovingFocus(items.length, selected, {
    orientation:
      layout === "carousel"
        ? "horizontal"
        : layout === "list"
          ? "vertical"
          : "both",
    rtl,
    onActivate: (index) =>
      onActivate(items[index], {
        type: "keydown",
      } as React.SyntheticEvent),
    onMove: followFocus
      ? (index, event) => {
          window.clearTimeout(held.current);
          const select = () => followFocus(items[index]);
          // A held arrow sweeps the list: select where it stops, not each item passed.
          if (event.repeat) held.current = window.setTimeout(select, 150);
          else select();
        }
      : undefined,
  });

  // Keep the selection in view: at once on arrival, smoothly after.
  const arrived = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected < 0) return;
    const instant = !arrived.current;
    arrived.current = true;
    if (carousel) {
      track.scrollToIndex(selected, { instant });
      return;
    }
    const option = listRef.current?.querySelector<HTMLElement>(
      `[data-track-index="${selected}"]`,
    );
    if (option) keepInView(option, instant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carousel, selected]);

  const name =
    ariaLabel ??
    (heading?.label ? localize(heading.label, language).text : t("itemsLabel"));
  const headingLabel = heading ? localize(heading.label, language) : null;
  const headingSummary = heading ? localize(heading.summary, language) : null;

  const figure = (item: ItemModel, isSelected: boolean) =>
    renderItem ? (
      renderItem(item, { selected: isSelected })
    ) : (
      <ItemFigure
        item={item}
        size={thumbnailSize}
        language={language}
        request={request}
        showSummary={showSummary}
      />
    );

  const trackStyle: React.CSSProperties | undefined = carousel
    ? { display: "flex", margin: 0, padding: 0, listStyle: "none" }
    : undefined;
  const slideStyle: React.CSSProperties | undefined = carousel
    ? { flex: "0 0 auto", scrollSnapAlign: listbox ? "center" : "start" }
    : undefined;

  /*
   * The carousel's arrows. Choosing between views (a listbox), they are Previous and Next:
   * they step the selection, which the strip follows into view. A list of links has no
   * selection, so there they scroll the strip.
   */
  const stepping = listbox && selected >= 0;
  const scrollButton = (step: "prev" | "next") => {
    const to = selected + (step === "prev" ? -1 : 1);
    const can = stepping
      ? to >= 0 && to < items.length
      : step === "prev"
        ? track.canScrollPrev
        : track.canScrollNext;
    const label = stepping
      ? t(step === "prev" ? "commonPrevious" : "commonNext")
      : t(step === "prev" ? "itemsScrollBack" : "itemsScrollForward");
    const onClick = (event: React.MouseEvent) => {
      if (!stepping)
        return (step === "prev" ? track.scrollPrev : track.scrollNext)();
      const item = items[to];
      if (followFocus) followFocus(item);
      else onActivate(item, event);
    };
    return (
      <button
        type="button"
        className={`clover-items-scroll-${step}`}
        aria-controls={stepping ? undefined : `${id}-viewport`}
        disabled={!can}
        onClick={onClick}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          width="16"
          height="16"
          viewBox="0 0 16 16"
        >
          <path
            d={(step === "next") !== rtl ? "M6 3l5 5-5 5" : "M10 3L5 8l5 5"}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={visuallyHidden}>{label}</span>
        <Tip label={label} />
      </button>
    );
  };

  return (
    <Tag
      ref={forwardedRef}
      className={join("clover-items", className)}
      data-layout={layout}
      data-navigation={navigation}
      {...rest}
    >
      {heading && (headingLabel?.text || headingSummary?.text) && (
        <header className="clover-items-header">
          {headingLabel?.text && (
            <h2
              className="clover-items-title"
              id={`${id}-title`}
              lang={headingLabel.lang}
            >
              {headingLabel.text}
            </h2>
          )}
          {headingSummary?.text && (
            <p className="clover-items-description" lang={headingSummary.lang}>
              {headingSummary.text.replace(/<[^>]*>/g, "")}
            </p>
          )}
          {heading.homepage && (
            <a className="clover-items-homepage" href={heading.homepage}>
              {t("commonViewAll")}
            </a>
          )}
        </header>
      )}
      <div
        className="clover-items-frame"
        style={{ position: "relative" }}
        // A right-to-left book runs leftward: its first item, and "back", on the right.
        dir={rtl ? "rtl" : undefined}
      >
        {carousel && scrollButton("prev")}
        <div
          id={`${id}-viewport`}
          className="clover-items-viewport"
          ref={carousel ? track.ref : undefined}
        >
          {listbox ? (
            <div
              ref={listRef}
              role="listbox"
              aria-label={name}
              aria-orientation={carousel ? "horizontal" : "vertical"}
              className="clover-items-track"
              style={trackStyle}
            >
              {items.map((item, index) => {
                const isSelected = index === selected;
                return (
                  <div
                    key={item.id}
                    id={`${id}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    className="clover-items-item"
                    data-track-index={index}
                    style={slideStyle}
                    {...roving.itemProps(index)}
                    onClick={(event) => onActivate(item, event)}
                  >
                    {figure(item, isSelected)}
                  </div>
                );
              })}
            </div>
          ) : (
            <ul
              aria-label={name}
              className="clover-items-track"
              style={trackStyle}
            >
              {items.map((item, index) => (
                <li
                  key={item.id}
                  className="clover-items-item"
                  data-track-index={index}
                  style={slideStyle}
                >
                  <a
                    className="clover-items-link"
                    href={item.href}
                    draggable={false}
                    onClick={(event) => onActivate(item, event)}
                  >
                    {figure(item, false)}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {carousel && scrollButton("next")}
      </div>
    </Tag>
  );
}

/**
 * Scroll the nearest scrolling ancestor, and only it, so `element` is within it. Never the
 * page: a list in a sidebar must not move the document as the reader moves.
 */
function keepInView(element: HTMLElement, instant: boolean) {
  let box = element.parentElement;
  while (box && box !== document.body) {
    const { overflowY } = getComputedStyle(box);
    if (
      /(auto|scroll)/.test(overflowY) &&
      box.scrollHeight > box.clientHeight
    ) {
      break;
    }
    box = box.parentElement;
  }
  if (!box || box === document.body) return;
  const outer = box.getBoundingClientRect();
  const inner = element.getBoundingClientRect();
  const delta =
    inner.top < outer.top
      ? inner.top - outer.top
      : inner.bottom > outer.bottom
        ? inner.bottom - outer.bottom
        : 0;
  if (delta) {
    box.scrollBy?.({ top: delta, behavior: instant ? "auto" : "smooth" });
  }
}
