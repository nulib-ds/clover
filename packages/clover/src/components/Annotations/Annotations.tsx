import React, { forwardRef, useId } from "react";

import {
  type AnnotationEntry,
  type AnnotationSet,
  selectAnnotationSets,
} from "../../core/annotation-sets";
import { selectVisibleCanvases } from "../../core/selectors";
import { toPlainText } from "../../core/text";
import { localize } from "../../core/value";
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
  /** The heading level for each set's title. Default 3. */
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
    const { t } = useCloverTranslation();
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
            language={language}
            // The AnnotationPage's own label, or none: the panel's section names them.
            title={localize(set.label, language).text}
            hideLabel={t("annotationsHide")}
            showLabel={t("annotationsShow")}
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
  /** The AnnotationPage's label; empty when it has none, and then no heading. */
  title: string;
  language?: string;
  hideLabel: string;
  showLabel: string;
  hidden: boolean;
  selected: string | null;
  highlighted: string | null;
  renderEntry?: (entry: AnnotationEntry) => React.ReactNode;
  onSelect: (id: string) => void;
  onHighlight: (id: string | null) => void;
  onVisible: (visible: boolean) => void;
}) {
  const id = useId();
  return (
    <section
      className="clover-annotations-set"
      aria-labelledby={title ? `${id}-title` : undefined}
      data-set={set.id}
    >
      {/* The checkbox first, over the AnnotationPage's label when it has one. */}
      <div className="clover-annotations-set-header">
        <label className="clover-annotations-markers">
          <input
            type="checkbox"
            checked={hidden}
            onChange={(event) => onVisible(!event.target.checked)}
          />
          {hideLabel}
        </label>
        {title && (
          <Heading className="clover-annotations-title" id={`${id}-title`}>
            {title}
          </Heading>
        )}
      </div>
      <ol className="clover-annotations-list">
        {entries.map((entry) => {
          const isSelected = entry.id === selected;
          const text = entryText(entry, language);
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
                  <EntryBodies entry={entry} language={language} />
                )}
              </div>
              <button
                type="button"
                className="clover-annotations-show"
                aria-pressed={isSelected}
                aria-label={text ? `${showLabel}: ${text}` : showLabel}
                style={visuallyHidden}
                onClick={() => onSelect(entry.id)}
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** An entry's text, plain, for its button's name. */
function entryText(entry: AnnotationEntry, language?: string) {
  const values = entry.bodies
    .filter((body) => body.value)
    .map((body) => ({ [body.language ?? "none"]: [body.value!] }));
  const text = values.length
    ? localize(Object.assign({}, ...values), language).text
    : "";
  return toPlainText(text).trim().slice(0, 120);
}

function EntryBodies({
  entry,
  language,
}: {
  entry: AnnotationEntry;
  language?: string;
}) {
  return (
    <>
      {entry.bodies.map((body, index) =>
        body.image ? (
          <img
            key={index}
            src={body.image}
            alt=""
            width={200}
            loading="lazy"
            className="clover-annotations-image"
          />
        ) : (
          <Markup
            key={index}
            as="div"
            markup={{ [body.language ?? "none"]: [body.value ?? ""] }}
            format={body.format}
            language={language}
            className="clover-annotations-text"
          />
        ),
      )}
    </>
  );
}
