import React, { forwardRef, useId } from "react";

import {
  type AnnotationBodyEntry,
  type AnnotationEntry,
  type AnnotationSet,
  selectAnnotationSets,
} from "../../core/annotation-sets";
import { selectVisibleCanvases } from "../../core/selectors";
import { markdownToPlainText, toPlainText } from "../../core/text";
import { type LocalizedValue, localize } from "../../core/value";
import { langWithin } from "../../i18n/config";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useClover, useCloverSelector } from "../../react/context";
import { Markup } from "../../ui/Markup";
import { visuallyHidden } from "../../ui/visuallyHidden";

export interface AnnotationsProps extends React.HTMLAttributes<HTMLElement> {
  /** The view's annotations (default), or every annotation in the Manifest. */
  scope?: "view" | "all";
  /** Your own rendering of an annotation's content. */
  renderEntry?: (entry: AnnotationEntry) => React.ReactNode;
  /**
   * The heading level for each set's title. Headings in an annotation's Markdown sit a
   * level below it, or at it in a set with no title. Default 3.
   */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  as?: React.ElementType;
}

/**
 * The annotations of the Root's resource — comments, tags, transcriptions — grouped by
 * set, as a list to read and to point with.
 *
 * - Each entry shows its content (IIIF's limited HTML, sanitised; an image body as an
 *   image). Pressing it frames the annotation on the Canvas, going to its Canvas first if
 *   need be. For the keyboard, a button inside it does the same, out of sight, its focus
 *   drawn round the entry.
 * - Hovering or focusing an entry highlights its hotspot, and hovering a hotspot
 *   highlights its entry: one highlight, shared through the Root, with no timers.
 * - Each set is headed by its AnnotationPage's own label, when it has one, and has a
 *   checkbox to hide its annotations from the Canvas, "Hide Annotations".
 */
export const Annotations = forwardRef<HTMLElement, AnnotationsProps>(
  function Annotations(
    {
      scope = "view",
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

    const visible = (set: AnnotationSet) =>
      scope === "all"
        ? set.entries
        : set.entries.filter((entry) =>
            shown.some((canvas) => canvas.id === entry.canvasId),
          );
    const groups = sets
      .map((set) => ({ set, entries: visible(set) }))
      .filter(({ entries }) => entries.length);
    if (!groups.length) return null;

    const Heading = `h${headingLevel}` as React.ElementType;
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
            Heading={Heading}
            headingLevel={headingLevel}
            language={language}
            // The AnnotationPage's own label, or none: the panel's section names them.
            title={localize(set.label, language)}
            hideLabel={{
              text: t("annotationsHide"),
              lang: langOf("annotationsHide"),
            }}
            showLabel={{
              text: t("annotationsShow"),
              lang: langOf("annotationsShow"),
            }}
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
  Heading,
  headingLevel: setLevel,
  title,
  language,
  hideLabel,
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
  Heading: React.ElementType;
  /** The level of the set's heading. */
  headingLevel: number;
  /** The AnnotationPage's label, and its language; empty when none, and then no heading. */
  title: LocalizedValue;
  language?: string;
  /** Clover's strings, each with its language where it is not the page's. */
  hideLabel: LocalizedValue;
  showLabel: LocalizedValue;
  hidden: boolean;
  selected: string | null;
  highlighted: string | null;
  renderEntry?: (entry: AnnotationEntry) => React.ReactNode;
  onSelect: (id: string) => void;
  onHighlight: (id: string | null) => void;
  onVisible: (visible: boolean) => void;
}) {
  const id = useId();
  const { hostLanguage } = useCloverTranslation();
  // Headings in an entry's Markdown sit under the set's own, or at its level without one.
  const headingLevel = title.text ? Math.min(setLevel + 1, 6) : setLevel;
  return (
    <section
      className="clover-annotations-set"
      aria-labelledby={title.text ? `${id}-title` : undefined}
      data-set={set.id}
    >
      {/* The checkbox first, over the AnnotationPage's label when it has one. */}
      <div className="clover-annotations-set-header">
        <label className="clover-annotations-markers" lang={hideLabel.lang}>
          <input
            type="checkbox"
            checked={hidden}
            onChange={(event) => onVisible(!event.target.checked)}
          />
          {hideLabel.text}
        </label>
        {title.text && (
          <Heading
            className="clover-annotations-title"
            id={`${id}-title`}
            lang={title.lang}
          >
            {title.text}
          </Heading>
        )}
      </div>
      <ol className="clover-annotations-list">
        {entries.map((entry, index) => {
          const isSelected = entry.id === selected;
          // With no text, named by its number, as its hotspot and the Canvas's menu
          // name it, so no two read alike.
          const own = entryText(entry, language);
          const text = own.text ? own : { text: String(index + 1) };
          // Clover's words and the annotation's: both in the page's language, or each
          // in its own.
          const oneLanguage =
            !showLabel.lang && !langWithin(text.lang, hostLanguage);
          const name = text.text
            ? `${showLabel.text}: ${text.text}`
            : showLabel.text;
          return (
            <li
              key={entry.id}
              className="clover-annotations-entry"
              data-selected={isSelected}
              data-highlighted={entry.id === highlighted}
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
              <div className="clover-annotations-body">
                {renderEntry ? (
                  renderEntry(entry)
                ) : (
                  <EntryBodies
                    entry={entry}
                    language={language}
                    headingLevel={headingLevel}
                  />
                )}
              </div>
              {/*
                In two languages, named by its content rather than `aria-label`, so
                each part carries its own (WCAG 3.1.2).
              */}
              <button
                type="button"
                className="clover-annotations-show"
                aria-pressed={isSelected}
                aria-label={oneLanguage ? name : undefined}
                style={visuallyHidden}
                onClick={() => onSelect(entry.id)}
              >
                {!oneLanguage && (
                  <>
                    <span lang={showLabel.lang}>
                      {showLabel.text}
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
        })}
      </ol>
    </section>
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
        body.format === "text/markdown"
          ? markdownToPlainText(body.value!)
          : toPlainText(body.value!),
      ],
    }));
  const image = entry.bodies.find((body) => body.image && body.label);
  const found: LocalizedValue = values.length
    ? localize(Object.assign({}, ...values), language)
    : localize(image?.label, language);
  const text = values.length ? found.text : toPlainText(found.text);
  return { ...found, text: text.trim().slice(0, 120) };
}

/** Whether an entry has text, which describes any image beside it (Cookbook 0377). */
const hasText = (entry: AnnotationEntry) =>
  entry.bodies.some((body) => body.value?.trim());

function EntryBodies({
  entry,
  language,
  headingLevel,
}: {
  entry: AnnotationEntry;
  language?: string;
  /** The level of a Markdown body's first heading. */
  headingLevel: number;
}) {
  const { t, langOf } = useCloverTranslation();
  /*
   * An image's text alternative (WCAG 1.1.1): none beside text that describes it, which
   * would say it twice; else its label, or its annotation's; else that it is an image.
   */
  const altOf = (body: AnnotationBodyEntry): LocalizedValue => {
    if (hasText(entry)) return { text: "" };
    const label = localize(body.label, language);
    return label.text
      ? label
      : { text: t("annotationsImage"), lang: langOf("annotationsImage") };
  };
  return (
    <>
      {entry.bodies.map((body, index) => {
        if (!body.image)
          return (
            <Markup
              key={index}
              as="div"
              markup={{ [body.language ?? "none"]: [body.value ?? ""] }}
              format={body.format}
              headingLevel={headingLevel}
              language={language}
              className="clover-annotations-text"
            />
          );
        const alt = altOf(body);
        return (
          <img
            key={index}
            src={body.image}
            alt={alt.text}
            lang={alt.text ? alt.lang : undefined}
            width={200}
            loading="lazy"
            className="clover-annotations-image"
          />
        );
      })}
    </>
  );
}
