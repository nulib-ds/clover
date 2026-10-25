import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useUniqueId } from "../../ui/useUniqueId";

import { EntryBodies } from "./EntryBodies";
import {
  type AnnotationEntry,
  type AnnotationSet,
  selectAnnotationSets,
} from "../../core/annotation-sets";
import { manifestOfAnnotation } from "../../core/annotation-collection";
import { readLink } from "../../core/link";
import { showLink } from "../../core/show-link";
import type { Clover } from "../../core/clover";
import { loadManifest } from "../../core/load";
import type { Manifest } from "../../core/presentation";
import { selectSequence, selectVisibleCanvases } from "../../core/selectors";
import { parseTime } from "../../core/ranges";
import { regionSource } from "../../core/region";
import { resolveThumbnail } from "../../core/thumbnail";
import { markdownToPlainText, readAs, toPlainText } from "../../core/text";
import {
  type LanguageMapLike,
  type LocalizedValue,
  localize,
} from "../../core/value";
import { langWithin } from "../../i18n/config";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { formatTime } from "../Canvas/media/useMediaController";
import { useClover, useCloverSelector } from "../../react/context";
import { bringIntoView, scrollerOf } from "../../ui/bringIntoView";
import { titleTag } from "../../ui/heading";
import { HideToggle } from "../../ui/HideToggle";
import { languageCode } from "../../ui/languageCode";
import { Tip } from "../../ui/Tip";
import { useContainerName } from "../../ui/useContainerName";
import { visuallyHidden } from "../../ui/visuallyHidden";
import {
  autonym,
  inLanguage,
  languagesOf,
  startingLanguage,
} from "./languages";

export interface AnnotationsProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Every annotation in the Manifest (default), as the Viewer's panel lists them: by
   * layer (AnnotationPages that share a label, or have none), then by Canvas, under each
   * Canvas's label, the ones in view marked current and kept in sight as the reader
   * moves. Or `"view"`: the view's alone, by set.
   */
  scope?: "view" | "all";
  /** Your own rendering of an annotation's content. */
  renderEntry?: (entry: AnnotationEntry) => React.ReactNode;
  /**
   * The heading level for each set's title. Headings in an annotation's Markdown sit a
   * level below it, or at it in a set with no title. Default 3.
   */
  headingLevel?: number;
  as?: React.ElementType;
}

/**
 * The annotations of the Root's resource — comments, tags, transcriptions — grouped by
 * set, as a list to read and to point with.
 *
 * - Each entry shows its content (IIIF's limited HTML, sanitized; an image body as an
 *   image). Pressing it frames the annotation on the Canvas, going to its Canvas first if
 *   need be. For the keyboard, a button inside it does the same, out of sight, its focus
 *   drawn around the entry.
 * - Hovering or focusing an entry highlights its hotspot, and hovering a hotspot
 *   highlights its entry: one highlight, shared through the Root, with no timers.
 * - Each set is headed by its AnnotationPage's own label, when it has one, after a toggle
 *   that hides its annotations from the Canvas (`HideToggle`: an eye, "Hide" and the
 *   page's label, or "Hide annotations" for a page without one).
 * - Where the same words come as separate annotations, one per language (a transcription
 *   and its translation), the set's header offers their languages by code ("AR", "EN"),
 *   and lists one at a time: the Root's `language` to start, else the reader's
 *   (`LanguageChoice`). Annotations in no language show whichever is chosen.
 */
export const Annotations = forwardRef<HTMLElement, AnnotationsProps>(
  function Annotations(
    {
      scope = "all",
      renderEntry,
      headingLevel = 3,
      as: Tag = "div",
      className,
      ...rest
    },
    ref,
  ) {
    const { t, langOf } = useCloverTranslation();
    const { clover, language } = useClover("Annotations");
    const sets = useCloverSelector((state) =>
      selectAnnotationSets(state.manifest, state.addedSets),
    );
    const shown = useCloverSelector((state) =>
      selectVisibleCanvases(state.manifest, state.canvasId),
    );
    const hiddenSets = useCloverSelector((state) => state.hiddenSets);
    const selected = useCloverSelector((state) => state.annotationId);
    const highlighted = React.useSyncExternalStore(
      clover.highlight.subscribe,
      clover.highlight.get,
      clover.highlight.get,
    );

    // Every annotation needs every Canvas's pages: held while the listing shows.
    useEffect(() => {
      if (scope === "all") return clover.holdAllAnnotationPages();
    }, [clover, scope]);

    const visible = (set: AnnotationSet) =>
      set.entries.filter((entry) =>
        shown.some((canvas) => canvas.id === entry.canvasId),
      );
    const groups = sets
      .map((set) => ({ set, entries: visible(set) }))
      .filter(({ entries }) => entries.length);
    // Past 6 not a heading (`ui/heading.ts`): each set is named by its title either way.
    const Heading = titleTag(headingLevel);
    const showLabel = {
      text: t("annotationsShow"),
      lang: langOf("annotationsShow"),
    };

    if (scope === "all")
      return (
        <AnnotationLayers
          ref={ref}
          as={Tag}
          className={className}
          rest={rest}
          sets={sets}
          shown={shown.map((canvas) => canvas.id)}
          headingLevel={headingLevel}
          language={language}
          showLabel={showLabel}
          hiddenSets={hiddenSets}
          selected={selected}
          highlighted={highlighted}
          renderEntry={renderEntry}
          onSelect={(id) => clover.selectAnnotation(id)}
          onHighlight={(id) => clover.highlight.emit(id)}
          onVisible={(ids, on) =>
            ids.forEach((id) => clover.setSetVisible(id, on))
          }
        />
      );
    if (!groups.length) return null;
    return (
      <Tag
        ref={ref}
        className={join("clover-annotations", className)}
        {...rest}
      >
        {groups.map(({ set, entries }) => (
          <AnnotationGroup
            key={set.id}
            set={set}
            entries={entries}
            canvases={shown as Array<Record<string, any>>}
            Heading={Heading}
            headingLevel={headingLevel}
            language={language}
            // The AnnotationPage's own label, or none: the panel's section names them.
            title={localize(set.label, language)}
            showLabel={showLabel}
            hidden={hiddenSets.includes(set.id)}
            selected={selected}
            highlighted={highlighted}
            renderEntry={renderEntry}
            onSelect={(id) => clover.selectAnnotation(id)}
            onHighlight={(id) => clover.highlight.emit(id)}
            onVisible={(on) => clover.setSetVisible(set.id, on)}
          />
        ))}
      </Tag>
    );
  },
);

function AnnotationGroup({
  set,
  entries,
  canvases,
  Heading,
  headingLevel: setLevel,
  title,
  language,
  showLabel,
  hidden,
  selected,
  highlighted,
  renderEntry,
  onSelect,
  onHighlight,
  onVisible,
}: {
  set: AnnotationSet;
  entries: AnnotationEntry[];
  /** The Canvases in view, for pictures of the regions marked. */
  canvases: Array<Record<string, any>>;
  Heading: React.ElementType;
  /** The level of the set's heading. */
  headingLevel: number;
  /** The AnnotationPage's label, and its language; empty when none, and then no heading. */
  title: LocalizedValue;
  language?: string;
  /** Clover's words for finding one, with their language where it is not the page's. */
  showLabel: LocalizedValue;
  hidden: boolean;
  selected: string | null;
  highlighted: string | null;
  renderEntry?: (entry: AnnotationEntry) => React.ReactNode;
  onSelect: (id: string) => void;
  onHighlight: (id: string | null) => void;
  onVisible: (visible: boolean) => void;
}) {
  const id = useUniqueId();
  // Headings in an entry's Markdown sit under the set's own, or at its level without one.
  const headingLevel = title.text ? setLevel + 1 : setLevel;
  const languages = useMemo(() => languagesOf(entries), [entries]);
  const [picked, setPicked] = useState<string>();
  const chosen = languages.includes(picked ?? "")
    ? picked
    : startingLanguage(languages, language);
  const listed = entries.filter((entry) => inLanguage(entry, chosen));
  return (
    <section
      className="clover-annotations-set"
      aria-labelledby={title.text ? `${id}-title` : undefined}
      data-set={set.id}
    >
      {/* Its hide toggle first, beside the AnnotationPage's label when it has one. */}
      <div className="clover-annotations-set-header">
        <HideToggle
          hidden={hidden}
          onChange={(hide) => onVisible(!hide)}
          of={title.text ? `${id}-title` : undefined}
        />
        {title.text && (
          <Heading
            className="clover-annotations-title"
            id={`${id}-title`}
            lang={title.lang}
          >
            {title.text}
          </Heading>
        )}
        {chosen && (
          <LanguageChoice
            languages={languages}
            chosen={chosen}
            onChange={setPicked}
          />
        )}
      </div>
      <ol className="clover-annotations-list">
        {listed.map((entry, index) => (
          <AnnotationItem
            key={entry.id}
            entry={entry}
            canvas={canvases.find((canvas) => canvas.id === entry.canvasId)}
            index={index}
            headingLevel={headingLevel}
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
}

/** A layer of annotations: the sets that share a label (or have none), by Canvas. */
interface Layer {
  key: string;
  title: LocalizedValue;
  setIds: string[];
  canvases: Array<{
    canvasId: string;
    label: LocalizedValue;
    entries: AnnotationEntry[];
  }>;
}

/**
 * The Manifest's annotations as layers, each by Canvas in reading order: one checkbox
 * for a layer, however many pages it was published in (a page per Canvas, as most are).
 */
function layersOf(
  sets: AnnotationSet[],
  canvases: Array<{ id: string; label?: unknown }>,
  language?: string,
): Layer[] {
  const order = new Map(canvases.map((canvas, index) => [canvas.id, index]));
  const layers = new Map<
    string,
    {
      title: LocalizedValue;
      setIds: string[];
      byCanvas: Map<string, AnnotationEntry[]>;
    }
  >();
  for (const set of sets) {
    const title = localize(set.label, language);
    const key = title.text;
    let layer = layers.get(key);
    if (!layer) {
      layer = { title, setIds: [], byCanvas: new Map() };
      layers.set(key, layer);
    }
    layer.setIds.push(set.id);
    for (const entry of set.entries) {
      const list = layer.byCanvas.get(entry.canvasId) ?? [];
      list.push(entry);
      layer.byCanvas.set(entry.canvasId, list);
    }
  }
  return [...layers.entries()].map(([key, layer]) => ({
    key,
    title: layer.title,
    setIds: layer.setIds,
    canvases: inOrder([...layer.byCanvas.entries()], order).map(
      ([canvasId, entries]) => ({
        canvasId,
        label: localize(
          canvases.find((canvas) => canvas.id === canvasId)
            ?.label as LanguageMapLike,
          language,
        ),
        entries,
      }),
    ),
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

/** Manifests the annotations name, fetched once a Root, as the listing first needs them. */
const fetched = new WeakMap<Clover, Map<string, Promise<Manifest | null>>>();
function fetchManifest(clover: Clover, id: string) {
  let byId = fetched.get(clover);
  if (!byId) fetched.set(clover, (byId = new Map()));
  let manifest = byId.get(id);
  if (!manifest) {
    manifest = loadManifest(
      { id, type: "Manifest" },
      { request: clover.request },
    ).catch(() => null);
    byId.set(id, manifest);
  }
  return manifest;
}

/**
 * The Canvases of other Manifests the listing's annotations are on (`partOf`), as
 * annotations given as the content name them: each Manifest fetched once, when the listing
 * shows, never before, for each Canvas's name (its Manifest's label, and its own where
 * there are several) and picture. Until it arrives a group has no name.
 */
function useElsewhere(
  layers: Layer[],
  here: Map<string, unknown>,
): {
  named: boolean;
  of: Map<string, { canvas: Record<string, any>; label: LocalizedValue[] }>;
} {
  const { clover, language } = useClover("Annotations");
  const wanted = useMemo(() => {
    const ids = new Set<string>();
    for (const layer of layers)
      for (const group of layer.canvases) {
        if (here.has(group.canvasId)) continue;
        const manifest = manifestOfAnnotation(group.entries[0].annotation);
        if (manifest) ids.add(manifest);
      }
    return [...ids];
  }, [layers, here]);
  const [manifests, setManifests] = useState<Manifest[]>([]);
  useEffect(() => {
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
 * Every annotation, by layer and by Canvas (`scope="all"`; a Manifest of one Canvas, by
 * layer alone). The Canvases in view are marked current (`aria-current`), and as the
 * reader moves to another, its annotations come to the top of the list's scrolling box;
 * one chosen elsewhere (its hotspot, the Canvas's menu) is brought into view. Neither while the pointer or focus is in the list,
 * so nothing moves under the reader, and never the page itself.
 */
const AnnotationLayers = forwardRef<
  HTMLElement,
  {
    as: React.ElementType;
    className?: string;
    rest: React.HTMLAttributes<HTMLElement>;
    sets: AnnotationSet[];
    /** The Canvases in view. */
    shown: string[];
    headingLevel: number;
    language?: string;
    showLabel: LocalizedValue;
    hiddenSets: string[];
    selected: string | null;
    highlighted: string | null;
    renderEntry?: (entry: AnnotationEntry) => React.ReactNode;
    onSelect: (id: string) => void;
    onHighlight: (id: string | null) => void;
    onVisible: (setIds: string[], visible: boolean) => void;
  }
>(function AnnotationLayers(
  {
    as: Tag,
    className,
    rest,
    sets,
    shown,
    headingLevel,
    language,
    showLabel,
    hiddenSets,
    selected,
    highlighted,
    renderEntry,
    onSelect,
    onHighlight,
    onVisible,
  },
  ref,
) {
  const id = useUniqueId();
  const canvases = useCloverSelector(
    (state) => selectSequence(state.manifest).canvases,
  ) as Array<{ id: string; label?: unknown }>;
  const layers = useMemo(
    () => layersOf(sets, canvases, language),
    [sets, canvases, language],
  );
  const canvasById = useMemo(
    () => new Map(canvases.map((canvas) => [canvas.id, canvas])),
    [canvases],
  );
  const elsewhere = useElsewhere(layers, canvasById);
  // Each layer's language, where it offers a choice: the reader's, by layer, once picked.
  const [picked, setPicked] = useState<Record<string, string>>({});
  const manifestLabel = useCloverSelector((state) => state.manifest?.label);
  const title = useMemo(
    () => localize(manifestLabel as LanguageMapLike, language),
    [manifestLabel, language],
  );
  // By Canvas only where there are Canvases to tell apart: several, or some elsewhere.
  const grouped = canvases.length > 1 || elsewhere.named;
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
   * The Canvases in view come to the top as the reader moves to them: only where the
   * list is by Canvas, since with one there is no group to bring up, only the layer's
   * title and eye to hide.
   */
  const shownKey = shown.join("\n");
  useEffect(() => {
    const node = root.current;
    if (!node || !grouped || still()) return;
    const group = shown
      .map((canvasId) =>
        node.querySelector<HTMLElement>(
          `[data-canvas="${CSS.escape(canvasId)}"]`,
        ),
      )
      .find(Boolean);
    if (!group) return;
    /*
     * The first Canvas of its layer brings the layer's header too, its eye and its
     * languages (`LanguageChoice`), rather than scrolling them out of sight.
     */
    const layer = group.closest<HTMLElement>(".clover-annotations-set");
    const first = layer?.querySelector("[data-canvas]") === group;
    bringIntoView(first && layer ? layer : group, "start");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey]);
  // One chosen on the Canvas is brought into view.
  useEffect(() => {
    const node = root.current;
    if (!node || !selected || still()) return;
    const entry = node.querySelector<HTMLElement>(
      `[data-entry="${CSS.escape(selected)}"]`,
    );
    if (entry) bringIntoView(entry, "nearest");
  }, [selected]);

  if (!layers.length) return null;
  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        root.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={join("clover-annotations", className)}
      data-scope="all"
      {...rest}
    >
      {layers.map((layer, layerIndex) => {
        // Past 6 not headings (`ui/heading.ts`): each names its section either way.
        const Title = titleTag(headingLevel);
        // A layer's Canvases sit a level under its title, or at its level without one.
        const level = layer.title.text ? headingLevel + 1 : headingLevel;
        const Label = titleTag(level);
        const hidden = layer.setIds.every((setId) =>
          hiddenSets.includes(setId),
        );
        const languages = languagesOf(
          layer.canvases.flatMap((group) => group.entries),
        );
        const chosen = languages.includes(picked[layer.key] ?? "")
          ? picked[layer.key]
          : startingLanguage(languages, language);
        return (
          <section
            key={layer.key}
            className="clover-annotations-set"
            aria-labelledby={
              layer.title.text ? `${id}-${layerIndex}` : undefined
            }
          >
            <div className="clover-annotations-set-header">
              <HideToggle
                hidden={hidden}
                onChange={(hide) => onVisible(layer.setIds, !hide)}
                of={layer.title.text ? `${id}-${layerIndex}` : undefined}
              />
              {layer.title.text && (
                <Title
                  className="clover-annotations-title"
                  id={`${id}-${layerIndex}`}
                  lang={layer.title.lang}
                >
                  {layer.title.text}
                </Title>
              )}
              {chosen && (
                <LanguageChoice
                  languages={languages}
                  chosen={chosen}
                  onChange={(tag) =>
                    setPicked((current) => ({ ...current, [layer.key]: tag }))
                  }
                />
              )}
            </div>
            {layer.canvases.map((group, groupIndex) => {
              const entries = group.entries.filter((entry) =>
                inLanguage(entry, chosen),
              );
              if (!entries.length) return null;
              // A Manifest of one Canvas has nothing to tell apart: no label, no mark.
              /*
               * On a Canvas of another Manifest the annotations name: named by that
               * Manifest's label, and its Canvas's where it has several.
               */
              const there = elsewhere.of.get(group.canvasId);
              // Beside other Manifests', this one's are named by its Manifest's label too.
              const label = there
                ? there.label
                : elsewhere.named && title.text
                  ? canvases.length > 1 && group.label.text
                    ? [title, group.label]
                    : [title]
                  : [group.label];
              const labeled = grouped && Boolean(label[0]?.text);
              const current = grouped && shown.includes(group.canvasId);
              const labelId = `${id}-${layerIndex}-${groupIndex}`;
              return (
                <section
                  key={group.canvasId}
                  className="clover-annotations-canvas"
                  data-canvas={group.canvasId}
                  aria-labelledby={labeled ? labelId : undefined}
                  aria-current={current ? "true" : undefined}
                >
                  {labeled && (
                    <Label
                      className="clover-annotations-canvas-label"
                      id={labelId}
                      lang={label.length === 1 ? label[0].lang : undefined}
                    >
                      {label.length === 1
                        ? label[0].text
                        : label.map((part, index) => (
                            <React.Fragment key={index}>
                              {index > 0 && ", "}
                              <span lang={part.lang}>{part.text}</span>
                            </React.Fragment>
                          ))}
                    </Label>
                  )}
                  <ol className="clover-annotations-list">
                    {entries.map((entry, index) => (
                      <AnnotationItem
                        key={entry.id}
                        entry={entry}
                        canvas={canvasById.get(group.canvasId) ?? there?.canvas}
                        index={index}
                        headingLevel={labeled ? level + 1 : level}
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
          </section>
        );
      })}
    </Tag>
  );
});

/**
 * A set's languages, where its annotations come one per language: a row of their codes
 * ("AR", "EN"), drawn as the Transcript's are, one chosen. Native radios, one stop in the
 * tab order, the arrow keys moving between them; the row named "Language", each radio by
 * its code and then its language's own name in that language (WCAG 2.5.3, 3.1.2), which
 * its popover shows.
 */
function LanguageChoice({
  languages,
  chosen,
  onChange,
}: {
  languages: string[];
  chosen: string;
  onChange: (tag: string) => void;
}) {
  const { t, langOf } = useCloverTranslation();
  const id = useUniqueId();
  const name = useContainerName(
    t("annotationsLanguage"),
    langOf("annotationsLanguage"),
  );
  return (
    <>
      {name.node}
      <fieldset {...name.props} className="clover-annotations-languages">
        {languages.map((tag) => {
          const own = autonym(tag);
          return (
            <label key={tag} className="clover-annotations-language">
              <input
                type="radio"
                name={`${id}-language`}
                checked={tag === chosen}
                onChange={() => onChange(tag)}
              />
              <span className="clover-annotations-language-code">
                {languageCode(tag)}
              </span>{" "}
              <span style={visuallyHidden} lang={tag}>
                {own}
              </span>
              <Tip label={own} lang={tag} />
            </label>
          );
        })}
      </fieldset>
    </>
  );
}

/** A region's picture: an `l` square (about a line), fetched at twice that for dense screens. */
const THUMBNAIL_SIZE = 52;

/**
 * The picture of what an entry marks: its region of the Canvas, cut small by the image
 * server once its `info.json` is read (`regionSource`, `resolveThumbnail`). None for an
 * entry that shows an image of its own (0377), one with no rectangle, or an image the
 * server cannot cut.
 */
function useRegionThumbnail(
  entry: AnnotationEntry,
  canvas?: Record<string, any>,
): string | undefined {
  const { clover } = useClover("Annotations");
  const source = useMemo(() => {
    const rect = entry.target.rect;
    if (!rect || !canvas || entry.bodies.some((body) => body.image))
      return null;
    return regionSource(canvas, rect);
  }, [entry, canvas]);
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    setSrc(undefined);
    if (!source) return;
    let live = true;
    void resolveThumbnail(source, THUMBNAIL_SIZE, clover.request).then(
      (url) => live && setSrc(url),
    );
    return () => {
      live = false;
    };
  }, [source, clover]);
  return src;
}

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
  // Clover's words and the annotation's: both in the page's language, or each in its own.
  const oneLanguage = !show.lang && !langWithin(text.lang, hostLanguage);
  const name = text.text ? `${show.text}: ${text.text}` : show.text;
  const thumbnail = useRegionThumbnail(entry, canvas);
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
      {/* What it marks, beside what it says: decorative, as its text names it. */}
      {time && (
        <span className="clover-annotations-time">
          {formatTime(time.start)}
        </span>
      )}
      {thumbnail && (
        <img
          className="clover-annotations-thumbnail"
          src={thumbnail}
          alt=""
          width={THUMBNAIL_SIZE / 2}
          height={THUMBNAIL_SIZE / 2}
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="clover-annotations-body">
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
      </div>
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
            <span lang={show.lang}>
              {show.text}
              {text.text && ":"}
            </span>
            {text.text && (
              <>
                {" "}
                <span lang={text.lang}>{text.text}</span>
              </>
            )}
          </>
        )}
      </button>
    </li>
  );
}

/**
 * Where a linking annotation leads (Cookbook 0022): a page on the web, as a link; a
 * Canvas or a Manifest, a button that shows it, focus going to the Canvas with it, since
 * the list may change under the button.
 */
function FollowLink({ annotation }: { annotation: Record<string, any> }) {
  const { clover } = useClover("Annotations");
  const { t, langOf } = useCloverTranslation();
  const link = useMemo(() => readLink(annotation), [annotation]);
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
        lang={lang}
      >
        {text}
      </a>
    );
  return (
    <button
      type="button"
      className="clover-annotations-link"
      lang={lang}
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
 * An entry's text, plain, for its button's name, and the language it is in: HTML's tags
 * and Markdown's syntax taken off, so neither is read out. With no text of its own, an
 * image's label names it.
 */
function entryText(entry: AnnotationEntry, language?: string): LocalizedValue {
  const values = entry.bodies
    .filter((body) => body.value)
    .map((body) => ({
      [body.language ?? "none"]: [
        {
          markdown: markdownToPlainText,
          html: toPlainText,
          plain: (value: string) => value,
        }[readAs(body.format, body.value)](body.value!),
      ],
    }));
  const image = entry.bodies.find((body) => body.image && body.label);
  const found: LocalizedValue = values.length
    ? localize(Object.assign({}, ...values), language)
    : localize(image?.label, language);
  const text = values.length ? found.text : toPlainText(found.text);
  return { ...found, text: text.trim().slice(0, 120) };
}
