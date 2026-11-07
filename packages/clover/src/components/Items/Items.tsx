import React, {
  Suspense,
  forwardRef,
  lazy,
  useEffect,
  useRef,
  useState,
} from "react";
import { useUniqueId } from "../../ui/useUniqueId";

import { ItemFigure, type ItemSecondary } from "./Item";
import type { Steps } from "./Position";
import type { PagerProps } from "./PagerLayout";
import { Tip } from "../../ui/Tip";
import {
  type ItemModel,
  itemsOfCollection,
  itemsOfManifest,
} from "../../core/items";
import { selectAnnotationCollection } from "../../core/annotation-sets";
import type { IIIFContent } from "../../core/load";
import type { CloverRequest } from "../../core/request";
import {
  selectPosition,
  selectSequence,
  selectShownId,
} from "../../core/selectors";
import { type ViewingDirection, resolveDirection } from "../../core/sequence";
import { type LanguageMapLike, localize } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useCloverSelector, useOptionalClover } from "../../react/context";
import { HostLanguageContext } from "../../i18n/hostLanguage";
import { useRootLanguage } from "../../i18n/useRootLanguage";
import { useContainerName } from "../../i18n/useContainerName";
import { titleTag } from "../../ui/heading";
import { useRovingFocus } from "../../ui/useRovingFocus";
import { useScrollTrack } from "../../ui/useScrollTrack";
import { visuallyHidden } from "../../ui/visuallyHidden";
import { languageProps } from "../../i18n/direction";
import {
  highContrastProps,
  useHighContrast,
} from "../../hooks/useHighContrast";

/**
 * A scrolling row of thumbnails (`slider`), a column, a wrapping grid, a grid whose
 * pictures keep their proportions (`masonry`), or one item at a time (`pager`: Previous,
 * Position and Next).
 */
export type ItemsLayout = "slider" | "list" | "grid" | "masonry" | "pager";

export interface ItemsProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "onSelect" | "children"> {
  /**
   * A scrolling row (the default), a column, a wrapping grid, `masonry`, or `pager`:
   * Previous, Position and Next, stepping one item at a time, with no thumbnails.
   * `masonry` is a grid whose pictures keep their own proportions, each item packed up
   * under the one above it, still in reading order, left to right.
   */
  layout?: ItemsLayout;
  /**
   * The slider's direction: a row (`horizontal`), or a column (`vertical`) that fills
   * the height of what holds it, as a filmstrip beside the Body, its pictures as wide as
   * the column. Default `"horizontal"`.
   */
  orientation?: "horizontal" | "vertical";
  /**
   * The line under an item's label, where it has one (a Collection's members do): its
   * `summary` (the default), its `navDate`, or `none`. Default `"summary"`.
   */
  secondary?: ItemSecondary;
  /**
   * Show each item's label, and the line under it, beside its picture (`true`, the
   * default). `false` shows the pictures alone: the labels are hidden from sight but kept
   * as each item's name for assistive technology (WCAG 4.1.2). Default `true`.
   */
  labels?: boolean;
  /**
   * The pager's size: `large` (the default), round controls; or `small`, its steps and
   * count as Search's are, for a header's line. Default `"large"`.
   */
  size?: "large" | "small";
  /**
   * Inside a `Root`: the Manifest's views (default), the members of the Collection it
   * belongs to, choosing one to show, a content state's targets, where it names two or
   * more (Cookbook 0540), each opening its Manifest at its place, or annotations walked as
   * one whole: the AnnotationPage or AnnotationCollection given as the content, else the
   * AnnotationCollection its annotation pages are part of (Cookbook 0309), each picked
   * and framed on its Canvas.
   */
  of?: "views" | "members" | "targets" | "annotations";
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
   * An item was chosen, with the click's or the key's own event. For a link, call
   * `event.preventDefault()` to stay on the page and handle it yourself.
   */
  onSelect?: (item: ItemModel, event: React.SyntheticEvent) => void;
  /** Standalone: show the resource's label, summary and homepage link. Default true. */
  header?: boolean;
  /**
   * Standalone: the level of the header's title, to fit the outline of the page around
   * it (a slider under an `h2` takes 3). Default 2.
   */
  headingLevel?: number;
  /** Pixels requested for each thumbnail's longer side. Default 200. */
  thumbnailSize?: number;
  /**
   * Inside a `Root`: list the views even where there is only one, as a gallery's grid
   * does. The pager, with nothing to step to, still draws nothing. Default `false`: one
   * view has nothing to choose between.
   */
  singleItem?: boolean;
  /** Standalone: credentials, headers and `fetch`. In a `Root`, the Root's are used. */
  request?: CloverRequest;
  /** Standalone: the language to read IIIF text in. */
  language?: string;
  /**
   * Clover's higher-contrast mode: the accent kept to rings, outlines and marks, and never
   * under words or a glyph, where the controls' dark fill takes its place, edged in the
   * accent. Inside a `Root`, the Root's too; on wherever the reader's system asks for more
   * contrast. Default `false`.
   */
  highContrast?: boolean;
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
 * - **Standalone**, a list of links to each item's `homepage` — a Collection slider.
 *
 * The slider is the browser's own scrolling with CSS snap points: wheel, trackpad,
 * touch and keyboard all work, and a mouse can drag it.
 */
export const Items = forwardRef<HTMLElement, ItemsProps>(
  function Items(props, ref) {
    const root = useOptionalClover();
    const standalone =
      !root || props.iiifContent !== undefined || props.items !== undefined;
    return standalone ? (
      <Suspense fallback={null}>
        <StandaloneItems {...props} forwardedRef={ref} />
      </Suspense>
    ) : (
      <ConnectedItems {...props} forwardedRef={ref} />
    );
  },
);

export type Forwarded = { forwardedRef: React.ForwardedRef<HTMLElement> };

/*
 * Items of a resource it loads itself, or of a list it is handed, outside a Root: its own
 * chunk, so the templates, whose Items are always in one, never carry it.
 */
const StandaloneItems = lazy(() => import("./StandaloneItems"));

/**
 * Inside a Root: its views, its Collection's members, a content state's targets, or an
 * AnnotationCollection's annotations.
 */
function ConnectedItems({ of = "views", ...props }: ItemsProps & Forwarded) {
  return of === "targets" ? (
    <SomeTargets {...props} />
  ) : of === "annotations" ? (
    <SomeAnnotations {...props} />
  ) : of === "members" ? (
    <MemberItems {...props} />
  ) : (
    <ViewItems {...props} />
  );
}

/*
 * A content state's targets: their own chunk, loaded only where one names two or more,
 * as its reader is, so a Root opened on anything else carries none of it.
 */
const TargetItems = lazy(() => import("./TargetItems"));

function SomeTargets(props: ItemsProps & Forwarded) {
  const several = useCloverSelector(
    (state) => (state.targets?.items.length ?? 0) > 1,
  );
  return several ? (
    <Suspense fallback={null}>
      <TargetItems {...props} />
    </Suspense>
  ) : null;
}

/*
 * An AnnotationCollection's annotations: their own chunk, loaded only for a Manifest whose
 * pages name one, so a Root opened on anything else carries none of it.
 */
const AnnotationItems = lazy(() => import("./AnnotationItems"));

function SomeAnnotations(props: ItemsProps & Forwarded) {
  const named = useCloverSelector((state) =>
    Boolean(selectAnnotationCollection(state.manifest, state.addedSets)),
  );
  return named ? (
    <Suspense fallback={null}>
      <AnnotationItems {...props} />
    </Suspense>
  ) : null;
}

/** The Collection's members, as a listbox choosing the Manifest shown. */
function MemberItems({
  onSelect,
  forwardedRef,
  ...rest
}: ItemsProps & Forwarded) {
  const { clover, language } = useOptionalClover()!;
  const collection = useCloverSelector((state) => state.collection);
  const manifestId = useCloverSelector(selectShownId);
  const items = itemsOfCollection(collection);
  // The Collection's own `viewingDirection` orders its members, as a Manifest's its views.
  const direction = resolveDirection(
    (collection as { viewingDirection?: unknown } | null)?.viewingDirection,
  );
  if (!items.length) return null;
  const choose = (item: ItemModel, event: React.SyntheticEvent) => {
    onSelect?.(item, event);
    void clover.goToManifest(item.id);
  };
  if (rest.layout === "pager") {
    const position = items.findIndex((item) => item.id === manifestId);
    // Its count opens a menu of the members, as a content state's targets' does.
    return (
      <Pager
        {...rest}
        forwardedRef={forwardedRef}
        steps={stepsOf(items, position, direction, choose)}
        nameKey="informationPanelTabsCollection"
        position={
          <CountMenu
            position={position}
            total={items.length}
            list={(chosen) => (
              <MemberItems
                layout="list"
                forwardedRef={null}
                onSelect={chosen}
              />
            )}
          />
        }
      />
    );
  }
  return (
    <ItemsView
      {...rest}
      forwardedRef={forwardedRef}
      items={items}
      selected={items.findIndex((item) => item.id === manifestId)}
      navigation="id"
      rtl={direction === "right-to-left"}
      upward={direction === "bottom-to-top"}
      language={language}
      request={clover.request}
      showSummary
      onActivate={choose}
    />
  );
}

/** The Root's views, as a listbox. */
function ViewItems({
  onSelect,
  forwardedRef,
  singleItem = false,
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
  // One view has nothing to choose between, unless it is asked for.
  if (items.length < (singleItem ? 1 : 2)) return null;
  // A step is a selection, as the slider's arrows' are: the Root goes there.
  const select = (item: ItemModel) => clover.goTo(item.id);
  if (rest.layout === "pager") {
    return (
      <Pager
        {...rest}
        forwardedRef={forwardedRef}
        steps={stepsOf(items, position, direction, select)}
      />
    );
  }
  return (
    <ItemsView
      {...rest}
      forwardedRef={forwardedRef}
      items={items}
      selected={position}
      navigation="id"
      rtl={direction === "right-to-left"}
      upward={direction === "bottom-to-top"}
      language={language}
      request={clover.request}
      onActivate={(item, event) => {
        onSelect?.(item, event);
        clover.goTo(item.id);
      }}
      // As in a radio group: the page in focus is the page shown.
      followFocus={select}
    />
  );
}

/** A list's items, and the one selected, as the pager's steps. */
export function stepsOf(
  items: ItemModel[],
  selected: number,
  direction: ViewingDirection,
  go: (item: ItemModel, event: React.SyntheticEvent) => void,
): Steps {
  return {
    position: selected,
    total: items.length,
    direction,
    step: (by, event) => {
      const item = items[selected + by];
      if (item) go(item, event);
    },
  };
}

/*
 * The `pager` layout, with its count's menu: their own chunk, loaded where a pager draws
 * (a content state's targets, a Collection's members, an AnnotationCollection's pages, a
 * lightbox), so a page whose Items draw a strip never carries them (Mat, 2026-10-30: the
 * Default template's first view under 95 kB; they were 2 kB of it).
 */
const PagerLayout = lazy(() => import("./PagerLayout"));
const CountMenu = lazy(() =>
  import("./PagerLayout").then(({ CountMenu }) => ({ default: CountMenu })),
);

/** Items' `pager` layout, standalone or in a Root, as it arrives (`PagerLayout`). */
export function Pager(props: PagerProps) {
  return (
    <Suspense fallback={null}>
      <PagerLayout {...props} />
    </Suspense>
  );
}

interface ItemsViewProps extends Omit<ItemsProps, "navigation" | "items"> {
  forwardedRef: React.ForwardedRef<HTMLElement>;
  items: ItemModel[];
  selected: number;
  navigation: "id" | "homepage";
  rtl?: boolean;
  /** Bottom-to-top: a vertical slider runs up from its foot. */
  upward?: boolean;
  showSummary?: boolean;
  heading?: {
    label?: LanguageMapLike;
    summary?: LanguageMapLike;
    homepage?: string;
    /** That homepage's own language, where its `language` gives one. */
    homepageLang?: string;
  };
  onActivate: (item: ItemModel, event: React.SyntheticEvent) => void;
  /**
   * Selects the option focus moves to by an arrow, Home or End, as a radio group does.
   * `onActivate` (Enter, a click) still says the reader chose it: a Gallery opens it. Not
   * for a Collection's members, where each selection loads a Manifest.
   */
  followFocus?: (item: ItemModel) => void;
}

/**
 * A vertical slider's styles, apart from Items' own (`vertical/ItemsVertical.css`): few
 * Manifests run down the page, so only a slider that does loads them. `true` once they
 * are in, `false` where they could not load.
 */
let verticalIn: boolean | undefined;
let verticalLoad: Promise<boolean> | undefined;
const loadVertical = () =>
  (verticalLoad ??= import("./vertical/ItemsVertical").then(
    () => (verticalIn = true),
    () => (verticalIn = false),
  ));

/**
 * Items, drawn once a vertical slider's styles are in: until then it draws nothing, so it
 * never shows as a row first, and where they cannot load it is a row. Never under
 * Suspense, whose fallback would hide what was drawn, and whose reveal React holds back.
 */
export function ItemsView(props: ItemsViewProps) {
  const waits =
    (props.layout ?? "slider") === "slider" &&
    props.orientation === "vertical" &&
    verticalIn === undefined;
  const [, settle] = useState<boolean>();
  useEffect(() => {
    if (!waits) return;
    let live = true;
    void loadVertical().then((state) => live && settle(state));
    return () => {
      live = false;
    };
  }, [waits]);
  if (waits) {
    // Asked for as it is drawn, not after: on its way a frame sooner.
    if (typeof document !== "undefined") void loadVertical();
    return null;
  }
  return (
    <DrawnItems
      {...props}
      orientation={verticalIn === false ? "horizontal" : props.orientation}
    />
  );
}

function DrawnItems({
  forwardedRef,
  items,
  selected,
  navigation,
  rtl = false,
  upward: bottomToTop = false,
  layout = "slider",
  orientation = "horizontal",
  thumbnailSize = 200,
  request,
  language,
  showSummary = false,
  secondary = "summary",
  labels = true,
  heading,
  headingLevel = 2,
  renderItem,
  onActivate,
  followFocus,
  as: Tag = "section",
  className,
  "aria-label": ariaLabel,
  // The pager's, not a list's, and the views' alone (`ViewItems`).
  /* eslint-disable @typescript-eslint/no-unused-vars */
  size,
  singleItem,
  /* eslint-enable @typescript-eslint/no-unused-vars */
  highContrast,
  ...rest
}: ItemsViewProps) {
  const { t } = useCloverTranslation();
  const id = useUniqueId();
  // Outside a Root, Items reads the page's language itself, for its strings to mark.
  const root = useRootLanguage(forwardedRef, rest.lang);
  const { langOf } = root;
  // Standalone, the higher-contrast mode is Items' own: the page's, or the reader's.
  const contrast = useHighContrast(highContrast);

  const slider = layout === "slider";
  const vertical = slider && orientation === "vertical";
  // A column read from its foot up: item 1 at the bottom, Up stepping forward.
  const upward = vertical && bottomToTop;
  const listbox = navigation === "id";
  /*
   * Masonry is a grid whose items span the rows their heights need (`masonry.ts`): its
   * code loads only where the layout is masonry, so no other layout carries it.
   */
  const viewport = useRef<HTMLDivElement>(null);
  const masonry = layout === "masonry";
  useEffect(() => {
    const box = viewport.current;
    if (!masonry || !box) return;
    let release: (() => void) | undefined;
    let live = true;
    void import("./masonry").then(({ attachMasonry }) => {
      if (live) release = attachMasonry(box);
    });
    return () => {
      live = false;
      release?.();
    };
  }, [masonry]);
  const track = useScrollTrack({
    align: listbox ? "center" : "start",
    itemCount: items.length,
    axis: vertical ? "y" : "x",
    upward,
  });
  const held = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(held.current), []);
  const roving = useRovingFocus(items.length, selected, {
    orientation: vertical
      ? "vertical"
      : layout === "slider"
        ? "horizontal"
        : layout === "list"
          ? "vertical"
          : "both",
    rtl,
    upward,
    onActivate: (index, event) => onActivate(items[index], event),
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

  const listRef = useRef<HTMLDivElement>(null);

  /*
   * New items replace the options, and the one in focus goes with them: entering a nested
   * Collection lists its members. Whether focus is among the options is read as each
   * render begins, while the old ones are still there. If it was, and focus has fallen to
   * the page, it goes to the new tab stop: the selected option, else the first
   * (WCAG 2.4.3).
   */
  const hadFocus = useRef(false);
  hadFocus.current = Boolean(
    listRef.current?.contains(listRef.current.ownerDocument.activeElement),
  );
  useEffect(() => {
    const list = listRef.current;
    if (!list || !hadFocus.current) return;
    const { activeElement, body } = list.ownerDocument;
    if (activeElement && activeElement !== body) return;
    list
      .querySelector<HTMLElement>(
        `[data-track-index="${Math.max(0, selected)}"]`,
      )
      ?.focus();
    // Only new items: a new selection among the same ones keeps focus where it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  /*
   * Keep the selection in view: at once on arrival, smoothly after. A slider's scrolling
   * box reaches the track a render after it mounts, so a strip that mounts with its
   * selection (a lightbox's) tries again as it arrives, and has arrived only once it
   * could scroll.
   */
  const arrived = useRef(false);
  useEffect(() => {
    if (selected < 0) return;
    const instant = !arrived.current;
    if (slider) {
      if (track.scrollToIndex(selected, { instant })) arrived.current = true;
      return;
    }
    arrived.current = true;
    const option = listRef.current?.querySelector<HTMLElement>(
      `[data-track-index="${selected}"]`,
    );
    if (option) keepInView(option, instant);
    // `track` is a new object each render; its `scrollToIndex` follows the box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slider, selected, track.scrollToIndex]);

  // Past 6 not a heading (`ui/heading.ts`): the list is named by it either way.
  const Title = titleTag(headingLevel) as "h2";
  const headingLabel = heading ? localize(heading.label, language) : null;
  const headingSummary = heading ? localize(heading.summary, language) : null;
  /*
   * The list is named by your `aria-label`, else by the heading over it, which carries the
   * label's language (an `aria-label` could not), else by "Items".
   */
  const titled = ariaLabel === undefined && Boolean(headingLabel?.text);
  const fallbackName = useContainerName(
    t("itemsLabel"),
    langOf("itemsLabel"),
    ariaLabel !== undefined || titled,
    root.hostLanguage,
  );
  const listName = titled
    ? { "aria-labelledby": `${id}-title` }
    : ariaLabel !== undefined
      ? { "aria-label": ariaLabel }
      : fallbackName.props;

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
        secondary={secondary}
        labels={labels}
      />
    );

  // An item with no text of its own is named by its place, as Position names it. Your own
  // figure (`renderItem`) names itself.
  const positioned = (item: ItemModel) =>
    !(
      renderItem ||
      localize(item.label, language).text ||
      (showSummary &&
        secondary === "summary" &&
        localize(item.summary, language).text)
    );
  const positionName = (item: ItemModel, index: number) =>
    positioned(item)
      ? t("canvasPosition", { index: index + 1, total: items.length })
      : undefined;
  const positionLang = (item: ItemModel) =>
    positioned(item) ? langOf("canvasPosition") : undefined;

  const trackStyle: React.CSSProperties | undefined = slider
    ? {
        display: "flex",
        flexDirection: upward
          ? "column-reverse"
          : vertical
            ? "column"
            : undefined,
        margin: 0,
        padding: 0,
        listStyle: "none",
      }
    : undefined;
  const slideStyle: React.CSSProperties | undefined = slider
    ? { flex: "0 0 auto", scrollSnapAlign: listbox ? "center" : "start" }
    : undefined;

  /*
   * The slider's arrows. Choosing between views (a listbox), they are Previous and Next:
   * they step the selection, which the strip follows into view. A list of links has no
   * selection, so there they scroll the strip.
   *
   * At an end an arrow is `aria-disabled`, not `disabled`: the press that reaches the end
   * leaves focus on it (WCAG 2.4.3), and another does nothing. It leaves the tab order
   * there, as a disabled button would.
   */
  const stepping = listbox && selected >= 0;
  const scrollButton = (step: "prev" | "next") => {
    const to = selected + (step === "prev" ? -1 : 1);
    const can = stepping
      ? to >= 0 && to < items.length
      : step === "prev"
        ? track.canScrollPrev
        : track.canScrollNext;
    const labelKey = stepping
      ? step === "prev"
        ? "commonPrevious"
        : "commonNext"
      : step === "prev"
        ? "itemsScrollBack"
        : "itemsScrollForward";
    const label = t(labelKey);
    const onClick = (event: React.MouseEvent) => {
      if (!can) return;
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
        {...languageProps(langOf(labelKey))}
        aria-disabled={!can || undefined}
        tabIndex={can ? undefined : -1}
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
            d={
              vertical
                ? (step === "next") !== upward
                  ? "M3 6l5 5 5-5"
                  : "M3 10l5-5 5 5"
                : (step === "next") !== rtl
                  ? "M6 3l5 5-5 5"
                  : "M10 3L5 8l5 5"
            }
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
    <HostLanguageContext.Provider value={root.hostLanguage}>
      <Tag
        ref={root.ref}
        className={join("clover-items", className)}
        data-layout={layout}
        data-orientation={vertical ? "vertical" : undefined}
        data-upward={upward || undefined}
        data-navigation={navigation}
        {...highContrastProps(contrast)}
        {...rest}
      >
        {heading && (headingLabel?.text || headingSummary?.text) && (
          <header className="clover-items-header">
            {headingLabel?.text && (
              <Title
                className="clover-items-title clover-title"
                id={`${id}-title`}
                {...languageProps(headingLabel.lang)}
              >
                {headingLabel.text}
              </Title>
            )}
            {headingSummary?.text && (
              <p
                className="clover-items-description"
                {...languageProps(headingSummary.lang)}
              >
                {headingSummary.text.replace(/<[^>]*>/g, "")}
              </p>
            )}
            {heading.homepage && (
              <a
                className="clover-items-homepage"
                href={heading.homepage}
                hrefLang={heading.homepageLang}
                {...languageProps(langOf("commonViewAll"))}
              >
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
          {slider && scrollButton("prev")}
          <div
            id={`${id}-viewport`}
            className="clover-items-viewport"
            ref={slider ? track.ref : viewport}
          >
            {listbox ? (
              <div
                ref={listRef}
                role="listbox"
                {...listName}
                // A grid's arrows move both ways: no orientation is claimed for it.
                aria-orientation={
                  vertical
                    ? "vertical"
                    : slider
                      ? "horizontal"
                      : layout === "list"
                        ? "vertical"
                        : undefined
                }
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
                      aria-label={positionName(item, index)}
                      {...languageProps(positionLang(item))}
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
                {...listName}
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
                      hrefLang={item.hrefLang}
                      aria-label={positionName(item, index)}
                      {...languageProps(positionLang(item))}
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
          {slider && scrollButton("next")}
        </div>
        {fallbackName.node}
      </Tag>
    </HostLanguageContext.Provider>
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
    const still = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    box.scrollBy?.({
      top: delta,
      behavior: instant || still ? "auto" : "smooth",
    });
  }
}
