import React, { memo, useMemo, useRef } from "react";

import type { ListedAnnotation } from "./Annotations";
import ControlMenu from "./ControlMenu";
import type { Place } from "../Annotations/Places";
import { readBodies } from "../../core/annotation-bodies";
import { parseAnnotationTarget } from "../../core/annotations";
import type { CloverRequest } from "../../core/request";
import { type LanguageMapLike, localize } from "../../core/value";
import { useLoaded } from "../../hooks/useLoaded";
import { useOptionalClover } from "../../react/context";
import { asArray } from "../../lib/asArray";
import { HideToggle } from "../../ui/HideToggle";
import {
  EntryContent,
  EntryWords,
  type EntryOf,
  useRegionSource,
} from "../../ui/AnnotationEntry";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { languageProps } from "../../i18n/direction";

type CanvasLike = { id: string; label?: unknown } & Record<string, any>;

interface AnnotationMenuProps {
  id: string;
  /** The control that opens the menu, which toggles it itself. */
  triggerId: string;
  label: string;
  /** The language of `label`, where it is not the page's. */
  labelLang?: string;
  annotations: ListedAnnotation[];
  /** The Canvases in view, by which the menu groups its entries and cuts their pictures. */
  canvases?: readonly CanvasLike[];
  /** The language to read the annotations and the Canvases' labels in. */
  language?: string;
  /** How the entries' pictures are fetched. */
  request?: CloverRequest;
  /** The pages whose annotations are hidden from the picture (each annotation's `pageId`). */
  hiddenPages?: string[];
  /** Hides the pages' annotations, or shows them: with it, the menu has its toggle. */
  onPageVisibilityChange?: (pageIds: string[], visible: boolean) => void;
  /** The annotation last picked, which is checked. */
  selected: string | null;
  /**
   * Picks one. `play` is false for a key's move through the list, which only goes to
   * where a timed one starts: a press plays from there (WCAG 3.2.2).
   */
  onSelect: (annotation: ListedAnnotation, play?: boolean) => void;
  /** Hovering or focusing an item highlights its hotspot; `null` when it leaves. */
  onActivate: (id: string | null) => void;
  /**
   * Lists the view's georeferenced images too, each pressed to show it on the Root's map,
   * filling the Body, else, outside a Root, the Canvas's own place box (`onPlace`).
   */
  places?: boolean;
  onPlace?: () => void;
  /** Close, returning focus to the control that opened it when `restoreFocus`. */
  onClose: (restoreFocus: boolean) => void;
}

// The georeferenced images, with their reader, only where the view has any.
const loadPlaces = () => import("../Annotations/Places");
const NO_PLACES: Place[] = [];

/**
 * Where an annotation on a recording's time starts: its own start, or its track's. Here,
 * never beside the hotspots, whose code and sheet it would bring with the menu.
 */
const startOf = (annotation: ListedAnnotation): number | undefined =>
  "start" in annotation ? annotation.start : annotation.track?.[0]?.start;

/**
 * The view's annotations, as the Annotations section lists them (nulib-ds/clover#440): by
 * the Canvas each is on, never by the page it was published on (Mat, 2026-11-16), each
 * Canvas named where the view shows several, its georeferenced images first, then its
 * annotations, each entry the section's own (`ui/AnnotationEntry`): its time, the picture
 * of its region, and its words. Titled at its top, as the chapters menu is, in Clover's
 * interface language ("Annotations"), with one toggle at the end of the title's row that
 * hides them all from the picture (`HideToggle`), as the section's does; their entries
 * stay here, and a pick still goes to where one is.
 *
 * Its keyboard model is its own, a menu of radios: picking one zooms to it, as clicking
 * its hotspot does, or, on a recording's time (Cookbook 0103), goes to where it starts.
 * One that follows the recording (`xywh=…&t=…`) is gone to there unless it is on the
 * recording already. The menu stays open to move on to the next. A georeferenced image
 * shows on the map over the Body, filling it, on a press, Enter or Space, never an arrow
 * key's move (WCAG 3.2.2), and the menu closes, focus on its control; so is one whose
 * body is a place picked (Cookbook 0139), as its box, opening over the Canvas, would close
 * the menu with focus in it (2.4.3). One without text is listed by its number.
 */
const AnnotationMenu: React.FC<AnnotationMenuProps> = ({
  id,
  triggerId,
  label,
  labelLang,
  annotations,
  canvases = NO_CANVASES,
  language,
  request,
  hiddenPages = [],
  onPageVisibilityChange,
  selected,
  onSelect,
  onActivate,
  places: mapped = false,
  onPlace,
  onClose,
}) => {
  const { t, langOf } = useCloverTranslation();
  // Whether the change under way came from a pointer's press (else a key's move).
  const pointer = useRef(false);
  /*
   * The handlers by a ref, so each entry is drawn again only as what it shows changes
   * (checked, or not), never as the pointer moves through the menu.
   */
  const root = useOptionalClover();
  const handlers = useRef({ onSelect, onActivate, onPlace, onClose, root });
  handlers.current = { onSelect, onActivate, onPlace, onClose, root };
  const actions = useMemo<EntryActions>(
    () => ({
      pointer,
      // As called: a press's pick plays, so no `play` is passed for it.
      select: (...args) => handlers.current.onSelect(...args),
      activate: (id) => handlers.current.onActivate(id),
      close: () => handlers.current.onClose(true),
      /*
       * The map fills the Body, a popup of its own, which closes this one (`useOneOpen`):
       * closed first, focus back on its control, which stays while the map shows, so
       * focus is never left on what went (WCAG 2.4.3), and the map hands it back there.
       */
      place: (key) => {
        const latest = handlers.current;
        latest.onClose(true);
        if (latest.root) {
          // The one pressed is the one chosen: an annotation picked before is let go,
          // after, so the box that showed its place stays, for this one (`PlaceBox`).
          latest.root.clover.place.emit(key);
          latest.root.clover.selectAnnotation(null);
        } else latest.onPlace?.();
      },
    }),
    [],
  );

  const placesModule = useLoaded(loadPlaces, mapped);
  const listedPlaces = useMemo(
    () =>
      placesModule && mapped
        ? placesModule.placesOfCanvases(canvases, language, (number) => ({
            text: t("mapPlaceUntitled", { number }),
            ...(langOf("mapPlaceUntitled")
              ? { lang: langOf("mapPlaceUntitled") }
              : {}),
          }))
        : NO_PLACES,
    [placesModule, mapped, canvases, language, t, langOf],
  );

  // By the Canvas each is on, in the view's order: the one it targets, else its place.
  const groups = useMemo(() => {
    const byCanvas = new Map<
      string,
      { places: Place[]; items: ListedAnnotation[] }
    >();
    const on = (canvasId: string) => {
      let group = byCanvas.get(canvasId);
      if (!group) byCanvas.set(canvasId, (group = { places: [], items: [] }));
      return group;
    };
    for (const each of canvases) on(each.id);
    for (const listed of listedPlaces) on(listed.canvasId).places.push(listed);
    for (const annotation of annotations)
      on(canvasOf(annotation, canvases)?.id ?? "").items.push(annotation);
    return [...byCanvas.entries()]
      .filter(([, group]) => group.places.length || group.items.length)
      .map(([canvasId, group]) => ({
        canvas: canvases.find((each) => each.id === canvasId),
        ...group,
      }));
  }, [annotations, canvases, listedPlaces]);

  // Every page its annotations are from, hidden and shown together by its one toggle.
  const pageIds = useMemo(
    () => [
      ...new Set(annotations.flatMap((annotation) => annotation.pageId ?? [])),
    ],
    [annotations],
  );
  // Its Canvases named where the view shows several, each a group within its own.
  const grouped = groups.length > 1;
  const titleId = `${id}-title`;
  // What an entry that opens the map says it does, before it is chosen (WCAG 3.2.2).
  const onMapId = `${id}-on-map`;
  let number = 0;
  return (
    <ControlMenu
      // Drawn as the Annotations list draws its entries, the same parts and rules.
      className="clover-canvas-annotation-menu"
      data-testid="clover-canvas-annotation-menu"
      id={id}
      onClose={onClose}
      triggerId={triggerId}
    >
      {/*
       * Titled as the chapters menu is, in Clover's interface language ("Annotations"),
       * its one toggle at the end of the title's row; the title alone names the group of
       * them all, as the toggle names itself.
       */}
      <span
        hidden
        id={onMapId}
        {...languageProps(langOf("annotationsShowPlace"))}
      >
        {t("annotationsShowPlace")}
      </span>
      <fieldset
        className="clover-canvas-menu-group clover-annotations-set"
        aria-labelledby={titleId}
      >
        <legend className="clover-canvas-menu-legend clover-annotations-set-header">
          <span id={titleId} {...languageProps(labelLang)}>
            {label}
          </span>
          {onPageVisibilityChange && pageIds.length > 0 && (
            <HideToggle
              hidden={pageIds.every((page) => hiddenPages.includes(page))}
              mixed={pageIds.some((page) => hiddenPages.includes(page))}
              onChange={(hide) => onPageVisibilityChange(pageIds, !hide)}
            />
          )}
        </legend>
        {groups.map((group, g) => {
          const canvasLabel = localize(
            group.canvas?.label as LanguageMapLike,
            language,
          );
          const labelId = `${id}-canvas-${g}`;
          const entries = (
            <div className="clover-annotations-list">
              {placesModule &&
                group.places.map((listed) => (
                  <PlaceItem
                    key={listed.key}
                    name={id}
                    onMap={onMapId}
                    place={listed}
                    request={request}
                    Content={placesModule.PlaceContent}
                    actions={actions}
                  />
                ))}
              {group.items.map((annotation) => (
                <AnnotationItem
                  key={annotation.id}
                  name={id}
                  onMap={onMapId}
                  annotation={annotation}
                  canvas={group.canvas}
                  number={(number += 1)}
                  checked={selected === annotation.id}
                  language={language}
                  request={request}
                  actions={actions}
                />
              ))}
            </div>
          );
          return grouped && canvasLabel.text ? (
            <fieldset
              key={group.canvas?.id ?? g}
              aria-labelledby={labelId}
              className="clover-canvas-menu-group clover-annotations-canvas"
            >
              <legend
                className="clover-canvas-menu-legend clover-annotations-canvas-label"
                id={labelId}
                {...languageProps(canvasLabel.lang)}
              >
                {canvasLabel.text}
              </legend>
              {entries}
            </fieldset>
          ) : (
            <React.Fragment key={group.canvas?.id ?? g}>
              {entries}
            </React.Fragment>
          );
        })}
      </fieldset>
    </ControlMenu>
  );
};

const NO_CANVASES: readonly CanvasLike[] = [];

/** The Canvas an annotation is on: the one its target names, else its place in the view. */
function canvasOf(
  annotation: ListedAnnotation,
  canvases: readonly CanvasLike[],
): CanvasLike | undefined {
  const source = annotation.source;
  if (!source) return canvases[0];
  const target = parseAnnotationTarget(
    asArray(source.annotation?.target as any)[0] as any,
  );
  return (
    canvases.find((each) => each.id === target?.id) ??
    canvases[source.targetIndex] ??
    canvases[0]
  );
}

interface EntryActions {
  /** Whether the change under way came from a pointer's press (else a key's move). */
  pointer: React.MutableRefObject<boolean>;
  select: (annotation: ListedAnnotation, play?: boolean) => void;
  activate: (id: string | null) => void;
  /** Close the menu, focus back on its control. */
  close: () => void;
  place: (key: string) => void;
}

/** What an entry is drawn from: its words and where it points, read once. */
function useEntry(annotation: ListedAnnotation): EntryOf {
  const source = annotation.source;
  return useMemo(() => {
    const raw = (source?.annotation ?? {}) as Record<string, any>;
    return {
      target: parseAnnotationTarget(asArray(raw.target)[0] as any) ?? {},
      bodies: readBodies(raw),
      ...(source?.layer?.image ? { layer: { image: source.layer.image } } : {}),
    };
  }, [source]);
}

/** One annotation: a radio's label, holding the entry the Annotations section shows. */
const AnnotationItem = memo(function AnnotationItem({
  name,
  onMap,
  annotation,
  canvas,
  number,
  checked,
  language,
  request,
  actions,
}: {
  name: string;
  /** The id of the words saying a choice opens the map, for one whose body is a place. */
  onMap: string;
  annotation: ListedAnnotation;
  canvas?: CanvasLike;
  /** Its place in the menu, which names it where it says nothing. */
  number: number;
  checked: boolean;
  language?: string;
  request?: CloverRequest;
  actions: EntryActions;
}) {
  const entry = useEntry(annotation);
  const picture = useRegionSource(entry, canvas);
  const { pointer, select, activate, close } = actions;
  /*
   * One whose body is a place (Cookbook 0139) opens its box over the Canvas as it is
   * picked, a popup, which closes this menu (`useOneOpen`): picked as a georeferenced
   * image is, on a press, Enter or Space, the menu closed first, focus on its control
   * (WCAG 2.4.3), never on an arrow key's move (3.2.2), which only moves to it.
   */
  const placed = asArray(
    (annotation.source?.annotation as Record<string, any> | undefined)?.body,
  ).some((body: any) => body?.type === "Feature");
  const space = useRef(false);
  // A press's pick, which plays one on a recording's time.
  const pick = () => {
    if (placed) close();
    select(annotation);
  };
  return (
    <label
      className="clover-canvas-menu-item clover-annotations-entry"
      data-selected={checked}
      onMouseEnter={() => activate(annotation.id)}
      onMouseLeave={() => activate(null)}
      onPointerDown={() => {
        pointer.current = true;
      }}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        // One whose body is a place says, before it is chosen, that it opens the map.
        aria-describedby={placed ? onMap : undefined}
        // A key's move only goes to it; a press (below) plays (3.2.2).
        onChange={() => {
          if (!placed) select(annotation, pointer.current);
          else if (pointer.current || space.current) pick();
        }}
        // Re-picking the checked item goes back to it; Space plays.
        onClick={() => {
          if (checked || (!placed && !pointer.current)) pick();
        }}
        onKeyDown={(event) => {
          pointer.current = false;
          space.current = event.key === " ";
          if (event.key === "Enter") {
            event.preventDefault();
            pick();
          }
        }}
        onFocus={() => activate(annotation.id)}
        onBlur={() => activate(null)}
      />
      <EntryContent
        start={startOf(annotation)}
        picture={picture}
        request={request}
      >
        {annotation.source ? (
          <EntryWords
            bodies={entry.bodies}
            language={language}
            fallback={annotation.label ?? String(number)}
          />
        ) : (
          <span
            className="clover-annotations-text"
            {...languageProps(annotation.label ? annotation.lang : undefined)}
          >
            {annotation.label ?? String(number)}
          </span>
        )}
      </EntryContent>
    </label>
  );
});

/** One georeferenced image: a radio's label, showing it on the map over the Body. */
const PlaceItem = memo(function PlaceItem({
  name,
  onMap,
  place,
  request,
  Content,
  actions,
}: {
  name: string;
  /** The id of the words saying a choice opens the map. */
  onMap: string;
  place: Place;
  request?: CloverRequest;
  Content: typeof import("../Annotations/Places").PlaceContent;
  actions: EntryActions;
}) {
  const { pointer, activate, place: show } = actions;
  // Space, which checks a radio as an arrow key does, shows it; an arrow only moves.
  const space = useRef(false);
  const press = () => {
    if (pointer.current || space.current) show(place.key);
  };
  return (
    <label
      className="clover-canvas-menu-item clover-annotations-entry clover-annotations-place"
      onMouseEnter={() => activate(place.overlay)}
      onMouseLeave={() => activate(null)}
      onPointerDown={() => {
        pointer.current = true;
      }}
    >
      <input
        type="radio"
        name={name}
        // Never checked: shown, it fills the Body, and the menu closes, as it says.
        checked={false}
        aria-describedby={onMap}
        onChange={press}
        onKeyDown={(event) => {
          pointer.current = false;
          space.current = event.key === " ";
          if (event.key === "Enter") {
            event.preventDefault();
            show(place.key);
          }
        }}
        onFocus={() => activate(place.overlay)}
        onBlur={() => activate(null)}
      />
      <Content place={place} request={request} />
    </label>
  );
});

export default AnnotationMenu;
