import React, { forwardRef } from "react";

import { itemsOfCollection } from "../../core/items";
import { selectTargetIndex } from "../../core/selectors";
import type { ViewingDirection } from "../../core/sequence";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useClover, useCloverSelector } from "../../react/context";
import { useNavigation, useSequence } from "../../react/hooks";
import { visuallyHidden } from "../../ui/visuallyHidden";
import { languageProps } from "../../i18n/direction";

/*
 * Where the reader is among Items, `Position`, and how the stepping parts read the Root's
 * steps (`useRootSteps`). Apart from `Pager.tsx` (`Previous`, `Next` and the pager
 * layout): the Default template's rail counts its views at once, while its pagers draw
 * only for a content state's targets, a Collection's members or an AnnotationCollection's
 * pages, and load then (`PagerLayout.tsx`; Mat, 2026-10-30). Its styles are `Pager.css`.
 */

/** Where the reader is in a list of items, and the way to step through it. */
export interface Steps {
  /** The current item's index, or -1 where the one shown is not in the list. */
  position: number;
  total: number;
  direction: ViewingDirection;
  /** Go one back (-1) or on (1). */
  step: (by: -1 | 1, event: React.SyntheticEvent) => void;
}

/**
 * What the pieces step through inside a Root: its views, its Collection's members, or a
 * content state's targets (Cookbook 0540).
 */
export type StepsOf = "views" | "members" | "targets";

/** The Root's views, or its Collection's members, as `Steps`. */
export function useRootSteps(of: StepsOf, part: string): Steps {
  const { clover } = useClover(part);
  const navigation = useNavigation();
  const { direction } = useSequence();
  const collection = useCloverSelector((state) => state.collection);
  const shown = useCloverSelector((state) => state.manifest?.id ?? null);
  const targets = useCloverSelector(
    (state) => state.targets?.items.length ?? 0,
  );
  const target = useCloverSelector((state) =>
    selectTargetIndex(
      state.targets,
      state.targetIndex,
      state.manifest,
      state.canvasId,
    ),
  );
  if (of === "targets") {
    return {
      position: target,
      total: targets,
      direction: "left-to-right",
      step: (by) => {
        const to = target + by;
        if (to >= 0 && to < targets) clover.goToTarget(to);
      },
    };
  }
  if (of === "members") {
    const members = itemsOfCollection(collection);
    const position = members.findIndex((item) => item.id === shown);
    return {
      position,
      total: members.length,
      direction: "left-to-right",
      step: (by) => {
        const to = members[position + by];
        if (to) void clover.goToManifest(to.id);
      },
    };
  }
  return {
    position: navigation.position,
    total: navigation.total,
    direction,
    step: (by) => (by < 0 ? navigation.previous() : navigation.next()),
  };
}

export interface PositionProps extends React.HTMLAttributes<HTMLElement> {
  /** What it counts: the Root's views (default), or its Collection's members. */
  of?: StepsOf;
  as?: React.ElementType;
}

export const PositionText = forwardRef<
  HTMLElement,
  Omit<PositionProps, "of"> & { steps: Steps }
>(function PositionText({ steps, as: Tag = "span", className, ...rest }, ref) {
  const { t, langOf } = useCloverTranslation();
  const { position, total } = steps;
  if (total < 2 || position < 0) return null;
  const index = position + 1;
  return (
    <Tag
      ref={ref}
      className={join("clover-pager-position", className)}
      {...rest}
    >
      <span aria-hidden="true">
        {index} / {total}
      </span>
      {/*
       * The widest count, unseen in the same place: it keeps the room, so nothing beside
       * it moves as the count grows (Pager.css). Without the stylesheet, `hidden`.
       */}
      <span className="clover-pager-room" aria-hidden="true" hidden>
        {total} / {total}
      </span>
      <span style={visuallyHidden} {...languageProps(langOf("canvasPosition"))}>
        {t("canvasPosition", { index, total })}
      </span>
    </Tag>
  );
});

/**
 * Where the reader is, counted in items: "2 / 5", the same in every language. Assistive
 * technology reads the sentence instead, "Item 2 of 5" in the reader's language, which a
 * bare slash would leave to guesswork.
 */
export const Position = forwardRef<HTMLElement, PositionProps>(
  function Position({ of = "views", ...props }, ref) {
    const steps = useRootSteps(of, "Position");
    return <PositionText ref={ref} {...props} steps={steps} />;
  },
);
