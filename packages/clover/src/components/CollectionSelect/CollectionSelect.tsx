import React, { forwardRef, useEffect, useRef, useState } from "react";
import { useUniqueId } from "../../ui/useUniqueId";

import { itemsOfCollection } from "../../core/items";
import { localize } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useClover, useCloverSelector } from "../../react/context";

export interface CollectionSelectProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "onChange"> {
  /** Called with the member chosen, before Clover moves there. */
  onChange?: (id: string) => void;
}

/**
 * The keys that step a closed `<select>` through its options, firing `change` at once
 * in Windows and Linux browsers: arrows, Home, End, the page keys, and a typed letter.
 */
const STEPS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

/**
 * A `change` this soon after a step (ms) is that step's. One from the menu's own list
 * comes later: a person needs longer than this to choose in it.
 */
const STEP_TIME = 100;

/**
 * A native `<select>` of the Collection's members, labeled by the Collection: choosing a
 * Manifest shows it, choosing a nested Collection enters it. Renders nothing outside a
 * Collection, or for a Collection of one.
 *
 * Each choice loads a whole Manifest, so a keyboard only moves through the members, and
 * Enter makes the choice (WCAG 3.2.2). Escape, or leaving the menu, takes the step back:
 * loaded once focus had moved on, a Manifest could take away the control focus moved to
 * (WCAG 2.4.3). A choice from the menu's own list (a pointer, a phone's picker, a list
 * opened with Alt+↓ or on macOS) is made at once.
 */
export const CollectionSelect = forwardRef<HTMLElement, CollectionSelectProps>(
  function CollectionSelect({ onChange, className, ...rest }, ref) {
    const { t, langOf } = useCloverTranslation();
    const { clover, language } = useClover("CollectionSelect");
    const collection = useCloverSelector((state) => state.collection);
    const shown = useCloverSelector((state) => state.manifest?.id ?? "");
    const id = useUniqueId();
    // The choice holds while its Manifest loads, rather than snapping back.
    const [pending, setPending] = useState<string | null>(null);
    useEffect(() => setPending(null), [shown, collection]);
    // When a key last stepped the menu.
    const steppedAt = useRef(-Infinity);
    // The member asked for while it loads, so a second Enter does not ask again.
    const asked = useRef<string | null>(null);
    useEffect(() => {
      asked.current = null;
    }, [shown, collection]);

    const choose = (next: string | null) => {
      if (!next || next === shown || next === asked.current) return;
      asked.current = next;
      onChange?.(next);
      void clover.goToManifest(next).finally(() => {
        // Not shown (it failed, or the host kept its own): Enter asks again.
        if (asked.current === next) asked.current = null;
      });
    };
    // Takes back a step not yet chosen.
    const stepBack = () => {
      if (pending === null || pending === shown || pending === asked.current) {
        return false;
      }
      setPending(null);
      return true;
    };

    const items = itemsOfCollection(collection);
    if (items.length < 2) return null;
    const label = localize(collection?.label as never, language);

    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={join("clover-collection-select", className)}
        {...rest}
      >
        {/* Always visible: "Collection", in the reader's language, if it has no label. */}
        <label
          htmlFor={`${id}-select`}
          className="clover-collection-select-label"
          lang={label.text ? label.lang : langOf("collectionLabel")}
        >
          {label.text || t("collectionLabel")}
        </label>
        <select
          id={`${id}-select`}
          className="clover-collection-select-control"
          value={pending ?? shown}
          onKeyDown={(event) => {
            const { key } = event;
            if (key === "Enter") choose(pending);
            else if (key === "Escape") {
              // Only the step is taken back: nothing around it (a dialog, a floating
              // panel) closes as well.
              if (stepBack()) event.preventDefault();
            } else if (
              STEPS.has(key) ||
              (key.length === 1 && !event.ctrlKey && !event.metaKey)
            ) {
              steppedAt.current = performance.now();
            }
          }}
          onBlur={stepBack}
          onChange={(event) => {
            const next = event.target.value;
            setPending(next);
            if (performance.now() - steppedAt.current > STEP_TIME) choose(next);
          }}
        >
          {items.map((item) => {
            const text = localize(item.label, language);
            return (
              <option
                key={item.id}
                value={item.id}
                lang={text.text ? text.lang : undefined}
              >
                {text.text || item.id}
              </option>
            );
          })}
        </select>
      </div>
    );
  },
);
