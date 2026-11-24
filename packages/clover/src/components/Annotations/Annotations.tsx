import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useUniqueId } from "../../ui/useUniqueId";

import { EntryBodies } from "./EntryBodies";
import type { Place } from "./Places";
import {
  type AnnotationEntry,
  type AnnotationPageRef,
  type AnnotationSet,
  findEntry,
  manifestOfAnnotation,
  selectListedSets,
  selectHiddenSets,
} from "../../core/annotation-sets";
import { selectAnnotationPages } from "../../core/annotation-pages";
import { usePagesReached } from "../../react/usePagesReached";
import { ListEnd } from "../../ui/ListEnd";
import { annotationName } from "../../core/annotation-name";
import { hasGeoreferences } from "../../core/geo-detect";
import { readLink, readTagSource } from "../../core/link";
import { ExternalGlyph } from "../../ui/glyphs/External";
import { showLink } from "../../core/show-link";
import type { Manifest } from "../../core/presentation";
import { selectSequence, selectVisibleCanvases } from "../../core/selectors";
import { parseTime } from "../../core/ranges";
import {
  type LanguageMapLike,
  type LocalizedValue,
  localize,
} from "../../core/value";
import { langWithin } from "../../i18n/config";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { playFrom } from "../../lib/time";
import { useClover, useCloverSelector } from "../../react/context";
import { fetchManifest } from "../../react/fetchManifest";
import { bringIntoView, scrollerOf } from "../../ui/bringIntoView";
import { titleTag } from "../../ui/heading";
import { EntryContent, useRegionSource } from "../../ui/AnnotationEntry";
import { useLoaded } from "../../hooks/useLoaded";
import { HideToggle } from "../../ui/HideToggle";
import { visuallyHidden } from "../../ui/visuallyHidden";
import { startingLanguage } from "../../core/language-choice";
import { covers, useReadingLanguages } from "../../react/readingLanguages";
import { LanguageChoice } from "../../ui/LanguageChoice";
import { inLanguage, languagesOf } from "./languages";
import { languageProps } from "../../i18n/direction";

export interface AnnotationsProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Every annotation in the Manifest (default), as the Viewer's panel lists them: by
   * Canvas, under each Canvas's label, whatever page each was published on, the ones in
   * view marked current and kept in sight as the reader moves. Or `"view"`: the view's
   * alone, by Canvas where it shows several.
   */
  scope?: "view" | "all";
  /** Your own rendering of an annotation's content. */
  renderEntry?: (entry: AnnotationEntry) => React.ReactNode;
  /**
   * The heading level for each Canvas's label. Headings in an annotation's Markdown sit a
   * level below it, or at it where no Canvas is named. Default 3.
   */
  headingLevel?: number;
  /**
   * The resource's georeferenced images, listed with its annotations under their Canvas,
   * each its picture with the map's pin over its corner, pressed to show it on the map
   * over the Body, which the Body opens filling it. Default `true`; `false` where the page
   * shows a map of its own (Document's aside). Its places (`navPlace`) are About's.
   */
  places?: boolean;
  as?: React.ElementType;
}

// The georeferenced images, with their reader, only where the Root has any.
const loadPlaces = () => import("./Places");
const NO_PLACES: Place[] = [];

/**
 * The annotations of the Root's resource — comments, tags, transcriptions, georeferenced
 * images — by the Canvas each is on, as a list to read and to point with.
 *
 * - Each entry shows its content (IIIF's limited HTML, sanitized; an image body as an
 *   image). Pressing it frames the annotation on the Canvas, going to its Canvas first if
 *   need be. For the keyboard, a button inside it does the same, out of sight, its focus
 *   drawn around the entry.
 * - Hovering or focusing an entry highlights its hotspot, and hovering a hotspot
 *   highlights its entry: one highlight, shared through the Root, with no timers.
 * - Never grouped by the page each was published on, nor by what it is for (Mat,
 *   2026-11-16: "don't organize by motivation. always just organize by sheet"; to be done
 *   better by motivation one day). At the list's head, a toggle that hides them all from
 *   the Canvas (`HideToggle`: an eye, "Hide annotations"), the Canvas's annotations menu
 *   hiding one page at a time. Pointed at or focused, it lights every entry it hides.
 * - Where the same words come as separate annotations, one per language (a transcription
 *   and its translation), the list's head offers their languages by code ("AR", "EN"),
 *   and lists one at a time: the Root's `language` to start, else the reader's
 *   (`LanguageChoice`). Annotations in no language show whichever is chosen.
 */
const NO_PAGES: AnnotationPageRef[] = [];

export const Annotations = forwardRef<HTMLElement, AnnotationsProps>(
  function Annotations(
    {
      scope = "all",
      renderEntry,
      headingLevel = 3,
      places = true,
      as: Tag = "div",
      className,
      ...rest
    },
    ref,
  ) {
    const { t, langOf, hostLanguage } = useCloverTranslation();
    const { clover, language } = useClover("Annotations");
    const sets = useCloverSelector((state) =>
      selectListedSets(state.manifest, state.addedSets),
    );
    const shown = useCloverSelector((state) =>
      selectVisibleCanvases(state.manifest, state.canvasId),
    );
    const hiddenSets = useCloverSelector((state) =>
      selectHiddenSets(
        state.manifest,
        state.addedSets,
        state.hiddenSets,
        state.shownSets,
        !state.annotationsShown,
      ),
    );
    const selected = useCloverSelector((state) => state.annotationId);
    const highlighted = React.useSyncExternalStore(
      clover.highlight.subscribe,
      clover.highlight.get,
      clover.highlight.get,
    );

    /*
     * A press on one: picked, and one on a recording played from its time, as a
     * Transcript's cue is (Mat, 2026-11-10: "make annotations automatically play the
     * target media on click"): the one playing at once (`playFrom`), in the press; one on
     * another Canvas, or not yet opened, gone to, opening at its time and playing from it.
     */
    const choose = (id: string) => {
      const entry = findEntry(sets, id);
      const time = entry && parseTime(entry.target.t);
      const element = clover.media.get();
      const here = shown.some((canvas) => canvas.id === entry?.canvasId);
      if (time && element && here) playFrom(element, time.start);
      clover.selectAnnotation(id);
      if (time && entry && !(element && here))
        clover.goTo(entry.canvasId, { time: time.start, autoplay: true });
    };

    /*
     * Every annotation, as far as the reader has reached: the Canvases' pages load in
     * order up to the one in view (or the one picked), and the next as the list's end
     * comes into view, never all at once (Mat, 2026-10-29). The view's own load anyway.
     */
    const pages = useCloverSelector((state) =>
      scope === "all" ? selectAnnotationPages(state.manifest) : NO_PAGES,
    );
    const reach = usePagesReached(pages);
    const shownIds = shown.map((canvas) => canvas.id);
    const showLabel = {
      text: t("annotationsShow"),
      lang: langOf("annotationsShow"),
    };

    /*
     * Its georeferenced images (`Places`), each listed under its Canvas as every
     * annotation is: only a look until there is one, then their reader, loaded.
     */
    const mapped = useCloverSelector(
      (state) => places && hasGeoreferences(state.manifest),
    );
    const placesModule = useLoaded(loadPlaces, mapped);
    const manifest = useCloverSelector((state) =>
      placesModule && mapped ? state.manifest : null,
    );
    const listed = useMemo(
      () =>
        placesModule && manifest
          ? placesModule.placesOf(manifest, language, (number) => ({
              text: t("mapPlaceUntitled", { number }),
              ...(langOf("mapPlaceUntitled")
                ? { lang: langOf("mapPlaceUntitled") }
                : {}),
            }))
          : NO_PLACES,
      [placesModule, manifest, language, t, langOf],
    );
    const asked = React.useSyncExternalStore(
      clover.place.subscribe,
      clover.place.get,
      clover.place.get,
    );
    const showPlace = {
      text: t("annotationsShowPlace"),
      lang: langOf("annotationsShowPlace"),
    };
    const ask = (place: Place) => {
      // On another Canvas: there first, so the map follows the view to it.
      if (!shownIds.includes(place.canvasId)) clover.goTo(place.canvasId);
      clover.place.emit(place.key);
    };
    const renderPlace = (place: Place) =>
      placesModule && (
        <placesModule.PlaceEntry
          key={place.key}
          place={place}
          asked={asked === place.key}
          pointed={place.overlay === highlighted}
          show={showPlace}
          hostLanguage={hostLanguage}
          request={clover.request}
          onAsk={ask}
          onHighlight={(id) => clover.highlight.emit(id)}
        />
      );

    return (
      <AnnotationSheets
        ref={ref}
        as={Tag}
        className={className}
        rest={rest}
        scope={scope}
        sets={sets}
        places={listed}
        shown={shownIds}
        headingLevel={headingLevel}
        language={language}
        showLabel={showLabel}
        hiddenSets={hiddenSets}
        selected={selected}
        highlighted={highlighted}
        renderEntry={renderEntry}
        renderPlace={renderPlace}
        onSelect={choose}
        onHighlight={(id) => clover.highlight.emit(id)}
        onVisible={(ids, on) =>
          ids.forEach((id) => clover.setSetVisible(id, on))
        }
        end={reach.more && <ListEnd onReached={reach.reachNext} />}
      />
    );
  },
);

/** A Canvas's annotations, as the list shows them under its label. */
interface Sheet {
  canvasId: string;
  label: LocalizedValue;
  entries: AnnotationEntry[];
  /** The georeferenced images on it, before its annotations. */
  places: Place[];
}

/**
 * Every annotation by the Canvas it is on, in reading order, whatever page it was
 * published on and whatever it is for (Mat, 2026-11-16: "don't organize by motivation.
 * always just organize by sheet"; by layer, the pages sharing a label, from 2026-10-19):
 * a Canvas's georeferenced images first, then its annotations, in their pages' order.
 */
function sheetsOf(
  sets: AnnotationSet[],
  places: Place[],
  canvases: Array<{ id: string; label?: unknown }>,
  language?: string,
): Sheet[] {
  const order = new Map(canvases.map((canvas, index) => [canvas.id, index]));
  const byCanvas = new Map<
    string,
    { entries: AnnotationEntry[]; places: Place[] }
  >();
  const on = (canvasId: string) => {
    let sheet = byCanvas.get(canvasId);
    if (!sheet) {
      sheet = { entries: [], places: [] };
      byCanvas.set(canvasId, sheet);
    }
    return sheet;
  };
  for (const set of sets)
    for (const entry of set.entries) on(entry.canvasId).entries.push(entry);
  for (const place of places) on(place.canvasId).places.push(place);
  return inOrder([...byCanvas.entries()], order).map(([canvasId, sheet]) => ({
    canvasId,
    label: localize(
      canvases.find((canvas) => canvas.id === canvasId)
        ?.label as LanguageMapLike,
      language,
    ),
    ...sheet,
  }));
}

/**
 * Groups in the Manifest's order, its Canvases' sequence; where some are on other
 * Manifests' Canvases (annotations given as the content), in the annotations' own order,
 * which holds whichever Manifest is open, so nothing moves as the reader goes between.
 */
function inOrder<T>(groups: Array<[string, T]>, order: Map<string, number>) {
  return groups.every(([id]) => order.has(id))
    ? groups.sort(([a], [b]) => order.get(a)! - order.get(b)!)
    : groups;
}

const NO_MANIFESTS: Manifest[] = [];

/**
 * The Canvases of other Manifests the listing's annotations are on (`partOf`), as
 * annotations given as the content name them: each Manifest fetched once, when the listing
 * shows, never before, for each Canvas's name (its Manifest's label, and its own where
 * there are several) and picture. Until it arrives a group has no name.
 */
function useElsewhere(
  sheets: Sheet[],
  here: Map<string, unknown>,
): {
  named: boolean;
  of: Map<string, { canvas: Record<string, any>; label: LocalizedValue[] }>;
} {
  const { clover, language } = useClover("Annotations");
  // The Manifests' ids as one key: the same ones again are no new fetch, and no new render.
  const wantedKey = useMemo(() => {
    const ids = new Set<string>();
    for (const sheet of sheets) {
      // A georeferenced image is always on one of the open Manifest's Canvases.
      if (here.has(sheet.canvasId) || !sheet.entries.length) continue;
      const manifest = manifestOfAnnotation(sheet.entries[0].annotation);
      if (manifest) ids.add(manifest);
    }
    return [...ids].join("\n");
  }, [sheets, here]);
  const wanted = useMemo(
    () => (wantedKey ? wantedKey.split("\n") : []),
    [wantedKey],
  );
  const [manifests, setManifests] = useState<Manifest[]>(NO_MANIFESTS);
  useEffect(() => {
    if (!wanted.length) {
      setManifests(NO_MANIFESTS);
      return;
    }
    let live = true;
    Promise.all(wanted.map((id) => fetchManifest(clover, id))).then(
      (found) =>
        live &&
        setManifests(found.filter((each): each is Manifest => Boolean(each))),
    );
    return () => {
      live = false;
    };
  }, [clover, wanted]);
  return useMemo(() => {
    const of = new Map<
      string,
      { canvas: Record<string, any>; label: LocalizedValue[] }
    >();
    for (const manifest of manifests) {
      const { canvases } = selectSequence(manifest);
      const title = localize(manifest.label as LanguageMapLike, language);
      for (const canvas of canvases as Array<Record<string, any>>) {
        const own = localize(canvas.label as LanguageMapLike, language);
        of.set(canvas.id, {
          canvas,
          label: canvases.length > 1 && own.text ? [title, own] : [title],
        });
      }
    }
    return { named: wanted.length > 0, of };
  }, [manifests, wanted, language]);
}

/**
 * The annotations by sheet, the Canvas each is on (`sheetsOf`): every Canvas's
 * (`scope="all"`; a Manifest of one Canvas, with no Canvas to name), or the view's. One
 * header over them all: their languages, where they come one per language, and one toggle
 * that hides them all from the Canvas (the Canvas's annotations menu hides one page at a
 * time). Every Canvas's: the Canvases in view are marked current (`aria-current`), and as
 * the reader moves to another, its annotations come to the top of the list's scrolling
 * box; one chosen elsewhere (its hotspot, the Canvas's menu) is brought into view.
 * Neither while the pointer or focus is in the list, so nothing moves under the reader,
 * and never the page itself.
 */
const AnnotationSheets = forwardRef<
  HTMLElement,
  {
    as: React.ElementType;
    className?: string;
    rest: React.HTMLAttributes<HTMLElement>;
    scope: "view" | "all";
    sets: AnnotationSet[];
    /** Its georeferenced images (`Places`), each listed under its Canvas. */
    places: Place[];
    /** The Canvases in view. */
    shown: string[];
    headingLevel: number;
    language?: string;
    showLabel: LocalizedValue;
    hiddenSets: string[];
    selected: string | null;
    highlighted: string | null;
    renderEntry?: (entry: AnnotationEntry) => React.ReactNode;
    renderPlace: (place: Place) => React.ReactNode;
    onSelect: (id: string) => void;
    onHighlight: (id: string | null) => void;
    onVisible: (setIds: string[], visible: boolean) => void;
    /** After the sheets: where more of them load as the reader reaches it. */
    end?: React.ReactNode;
  }
>(function AnnotationSheets(
  {
    as: Tag,
    className,
    rest,
    scope,
    sets,
    places,
    shown,
    headingLevel,
    language,
    showLabel,
    hiddenSets,
    selected,
    highlighted,
    renderEntry,
    renderPlace,
    onSelect,
    onHighlight,
    onVisible,
    end,
  },
  ref,
) {
  const id = useUniqueId();
  const all = scope === "all";
  const canvases = useCloverSelector(
    (state) => selectSequence(state.manifest).canvases,
  ) as Array<{ id: string; label?: unknown }>;
  const shownKey = shown.join("\n");
  const sheets = useMemo(() => {
    const every = sheetsOf(sets, places, canvases, language);
    return all
      ? every
      : every.filter((sheet) => shown.includes(sheet.canvasId));
    // `shown` by its ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, places, canvases, language, all, shownKey]);
  const canvasById = useMemo(
    () => new Map(canvases.map((canvas) => [canvas.id, canvas])),
    [canvases],
  );
  const elsewhere = useElsewhere(sheets, canvasById);
  const manifestLabel = useCloverSelector((state) => state.manifest?.label);
  const title = useMemo(
    () => localize(manifestLabel as LanguageMapLike, language),
    [manifestLabel, language],
  );
  /*
   * By Canvas only where there are Canvases to tell apart: every Canvas's, where the
   * Manifest has several or some are another's; the view's, where it shows several.
   */
  const grouped = all
    ? canvases.length > 1 || elsewhere.named
    : sheets.length > 1;
  /*
   * The sets its one toggle hides from the Canvas: none where it lists georeferenced
   * images alone, which the Canvas never draws (the map lays them).
   */
  const setIds = useMemo(
    () => [
      ...new Set(
        sheets.flatMap((sheet) => sheet.entries.map((entry) => entry.setId)),
      ),
    ],
    [sheets],
  );
  const hideable = setIds.length > 0;
  const hidden =
    hideable && setIds.every((setId) => hiddenSets.includes(setId));
  // Their languages, where the same words come one per language: About's choice where it holds them, else the list's own.
  const languages = useMemo(
    () => languagesOf(sheets.flatMap((sheet) => sheet.entries)),
    [sheets],
  );
  const [picked, setPicked] = useState<string>();
  const offered = useReadingLanguages();
  const follows = covers(offered, languages);
  const chosen = follows
    ? startingLanguage(languages, offered!.chosen)
    : startingLanguage(languages, offered?.chosen ?? language, picked);
  const choice = Boolean(chosen && !follows);
  const root = useRef<HTMLElement | null>(null);
  /*
   * Whether to leave the list where it is: it is not shown (a closed section's measures
   * as nothing, and scrolling to it would throw its pane about), or the reader is in the
   * box it scrolls in, the pointer over it or focus anywhere in it: on the list, or on
   * what shares its scroll (a panel's tabs), which a move would push out of sight (WCAG
   * 2.4.11). Nothing moves under the reader.
   */
  const still = () => {
    const node = root.current;
    if (!node || !node.getClientRects().length) return true;
    const box = scrollerOf(node) ?? node;
    return box.matches(":hover") || box.contains(document.activeElement);
  };
  /*
   * Every Canvas's: the Canvases in view come to the top as the reader moves to them, only
   * where the list is by Canvas, since with one there is no Canvas to bring up.
   */
  useEffect(() => {
    const node = root.current;
    if (!all || !node || !grouped || still()) return;
    const sheet = shown
      .map((canvasId) =>
        node.querySelector<HTMLElement>(
          `[data-canvas="${CSS.escape(canvasId)}"]`,
        ),
      )
      .find(Boolean);
    if (!sheet) return;
    /*
     * The first Canvas brings the list's header too, its languages
     * (`LanguageChoice`) and its eye, rather than scrolling them out of sight.
     */
    const list = sheet.closest<HTMLElement>(".clover-annotations-set");
    const first = list?.querySelector("[data-canvas]") === sheet;
    bringIntoView(first && list ? list : sheet, "start");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey]);
  // One chosen on the Canvas is brought into view.
  useEffect(() => {
    const node = root.current;
    if (!all || !node || !selected || still()) return;
    const entry = node.querySelector<HTMLElement>(
      `[data-entry="${CSS.escape(selected)}"]`,
    );
    if (entry) bringIntoView(entry, "nearest");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  if (!sheets.length) return null;
  // Past 6 not headings (`ui/heading.ts`): each names its Canvas either way.
  const Label = titleTag(headingLevel);
  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        root.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={join("clover-annotations", className)}
      data-scope={all ? "all" : undefined}
      {...rest}
    >
      <div className="clover-annotations-set">
        {/* Its languages, then its hide toggle, at the end of the line. */}
        {(choice || hideable) && (
          <div className="clover-annotations-set-header">
            {choice && (
              <LanguageChoice
                languages={languages}
                chosen={chosen!}
                onChange={setPicked}
                nameKey="annotationsLanguage"
                part="clover-annotations"
              />
            )}
            {hideable && (
              <HideToggle
                hidden={hidden}
                onChange={(hide) => onVisible(setIds, !hide)}
              />
            )}
          </div>
        )}
        {sheets.map((sheet, index) => {
          const entries = sheet.entries.filter((entry) =>
            inLanguage(entry, chosen),
          );
          if (!entries.length && !sheet.places.length) return null;
          /*
           * On a Canvas of another Manifest the annotations name: named by that
           * Manifest's label, and its Canvas's where it has several.
           */
          const there = elsewhere.of.get(sheet.canvasId);
          // Beside other Manifests', this one's are named by its Manifest's label too.
          const label = there
            ? there.label
            : elsewhere.named && title.text
              ? canvases.length > 1 && sheet.label.text
                ? [title, sheet.label]
                : [title]
              : [sheet.label];
          const labeled = grouped && Boolean(label[0]?.text);
          const current = all && grouped && shown.includes(sheet.canvasId);
          const labelId = `${id}-${index}`;
          return (
            <section
              key={sheet.canvasId}
              className="clover-annotations-canvas"
              data-canvas={sheet.canvasId}
              aria-labelledby={labeled ? labelId : undefined}
              aria-current={current ? "true" : undefined}
            >
              {labeled && (
                <Label
                  className="clover-annotations-canvas-label"
                  id={labelId}
                  {...languageProps(
                    label.length === 1 ? label[0].lang : undefined,
                  )}
                >
                  {label.length === 1
                    ? label[0].text
                    : label.map((part, at) => (
                        <React.Fragment key={at}>
                          {at > 0 && ", "}
                          <span {...languageProps(part.lang)}>{part.text}</span>
                        </React.Fragment>
                      ))}
                </Label>
              )}
              <ol className="clover-annotations-list">
                {sheet.places.map(renderPlace)}
                {entries.map((entry, at) => (
                  <AnnotationItem
                    key={entry.id}
                    entry={entry}
                    canvas={canvasById.get(sheet.canvasId) ?? there?.canvas}
                    index={at}
                    // Headings in an entry's Markdown sit under its Canvas's label.
                    headingLevel={labeled ? headingLevel + 1 : headingLevel}
                    language={language}
                    showLabel={showLabel}
                    selected={entry.id === selected}
                    highlighted={entry.id === highlighted}
                    renderEntry={renderEntry}
                    onSelect={onSelect}
                    onHighlight={onHighlight}
                  />
                ))}
              </ol>
            </section>
          );
        })}
      </div>
      {end}
    </Tag>
  );
});

/**
 * One annotation in the list: its content, pressed anywhere to frame it, and, for the
 * keyboard, a button out of sight that does the same, its focus drawn around the entry.
 */
function AnnotationItem({
  entry,
  canvas,
  index,
  headingLevel,
  language,
  showLabel,
  selected,
  highlighted,
  renderEntry,
  onSelect,
  onHighlight,
}: {
  entry: AnnotationEntry;
  /** The Canvas it marks, for a picture of its region. */
  canvas?: Record<string, any>;
  /** Its place in its list, which names it where it has no text. */
  index: number;
  /** The level of a Markdown body's first heading. */
  headingLevel: number;
  language?: string;
  showLabel: LocalizedValue;
  selected: boolean;
  highlighted: boolean;
  renderEntry?: (entry: AnnotationEntry) => React.ReactNode;
  onSelect: (id: string) => void;
  onHighlight: (id: string | null) => void;
}) {
  const { hostLanguage, t, langOf } = useCloverTranslation();
  // With no text, named by its number, as its hotspot and the Canvas's menu name it, so
  // no two read alike.
  const own = entryText(entry, language);
  const text = own.text ? own : { text: String(index + 1) };
  // One on a recording's time (Cookbook 0103), or following it there (`xywh=…&t=…`), is
  // found there, from where it starts.
  const time = parseTime(entry.target.t);
  const show = time
    ? { text: t("annotationsShowTime"), lang: langOf("annotationsShowTime") }
    : showLabel;
  // Clover's interface words and the annotation's: both in the page's language, or each in its own.
  const oneLanguage = !show.lang && !langWithin(text.lang, hostLanguage);
  const name = text.text ? `${show.text}: ${text.text}` : show.text;
  const { clover } = useClover("Annotations");
  const picture = useRegionSource(entry, canvas);
  return (
    <li
      className="clover-annotations-entry"
      data-entry={entry.id}
      data-selected={selected}
      data-highlighted={highlighted}
      onMouseEnter={() => onHighlight(entry.id)}
      onMouseLeave={() => onHighlight(null)}
      onFocus={() => onHighlight(entry.id)}
      onBlur={() => onHighlight(null)}
      // A press anywhere on it; the button below is the keyboard's way in.
      onClick={(event) => {
        if ((event.target as Element).closest("a, button")) return;
        onSelect(entry.id);
      }}
    >
      {/* What it marks, beside what it says, as the Canvas's menu shows it. */}
      <EntryContent
        start={time?.start}
        picture={picture}
        request={clover.request}
      >
        {renderEntry ? (
          renderEntry(entry)
        ) : (
          <EntryBodies
            bodies={entry.bodies}
            language={language}
            headingLevel={headingLevel}
          />
        )}
        <FollowLink annotation={entry.annotation} />
      </EntryContent>
      {/*
        In two languages, named by its content rather than `aria-label`, so each part
        carries its own (WCAG 3.1.2).
      */}
      <button
        type="button"
        className="clover-annotations-show"
        aria-pressed={selected}
        aria-label={oneLanguage ? name : undefined}
        style={visuallyHidden}
        onClick={() => onSelect(entry.id)}
      >
        {!oneLanguage && (
          <>
            <span {...languageProps(show.lang)}>
              {show.text}
              {text.text && ":"}
            </span>
            {text.text && (
              <>
                {" "}
                <span {...languageProps(text.lang)}>{text.text}</span>
              </>
            )}
          </>
        )}
      </button>
    </li>
  );
}

/**
 * Where a linking annotation leads (Cookbook 0022): a page on the web, as a link that
 * opens it in a tab of its own, its glyph saying so (`ExternalGlyph`); a Canvas or a
 * Manifest, a button that shows it, focus going to the Canvas with it, since the list may
 * change under the button.
 */
function FollowLink({ annotation }: { annotation: Record<string, any> }) {
  const { clover } = useClover("Annotations");
  const { t, langOf } = useCloverTranslation();
  // Where it leads (a linking annotation), or what a tag names on the web (0258).
  const link = useMemo(
    () => readLink(annotation) ?? readTagSource(annotation),
    [annotation],
  );
  if (!link) return null;
  const text = t("annotationsOpenLink");
  const lang = langOf("annotationsOpenLink");
  if (!link.canvasId && !link.manifestId)
    return (
      <a
        className="clover-annotations-link"
        href={link.id}
        target="_blank"
        rel="noopener noreferrer"
        {...languageProps(lang)}
      >
        {text}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          aria-hidden="true"
          focusable="false"
        >
          <ExternalGlyph />
        </svg>
      </a>
    );
  return (
    <button
      type="button"
      className="clover-annotations-link"
      {...languageProps(lang)}
      onClick={(event) => {
        const root = event.currentTarget.closest(".clover-root");
        if (!showLink(clover, link)) return;
        root
          ?.querySelector<HTMLElement>(".clover-canvas-viewport")
          ?.focus({ preventScroll: true });
      }}
    >
      {text}
    </button>
  );
}

/**
 * An entry's name, for its button, as its hotspot and the Canvas's menu name it
 * (`annotationName`), cut to 120 characters: what it says is beside the button, in full.
 */
function entryText(entry: AnnotationEntry, language?: string): LocalizedValue {
  const { text = "", lang } = annotationName(entry.bodies, language);
  return { text: text.slice(0, 120), ...(lang ? { lang } : {}) };
}
