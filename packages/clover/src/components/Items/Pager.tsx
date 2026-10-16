import React, { forwardRef } from "react";

import { itemsOfCollection } from "../../core/items";
import type { ViewingDirection } from "../../core/sequence";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useClover, useCloverSelector } from "../../react/context";
import { useNavigation, useSequence } from "../../react/hooks";
import { Tip } from "../../ui/Tip";
import { useContainerName } from "../../ui/useContainerName";
import { visuallyHidden } from "../../ui/visuallyHidden";

/**
 * Stepping through Items one at a time: `Previous`, `Next` and `Position`, and the three
 * together as Items' `pager` layout (`<Clover.Items layout="pager" />`).
 *
 * They step through what Items lists: the Root's views (a paged book a spread at a time),
 * or with `of="members"` the Collection's Manifests. The arrows follow the Manifest's
 * `viewingDirection`: in a right-to-left book, "previous" points right. Each renders
 * nothing when there is only one item.
 *
 * `Previous` and `Next` are round controls with an arrow, as Items' own arrows are: the
 * name is hidden from sight but not from assistive technology, and shows on hover and
 * focus. Where there is nowhere to go, each shows disabled.
 *
 * This module reads no thumbnails: a layout with a pager and no strip carries none of it.
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

/** What the pieces step through inside a Root: its views, or its Collection's members. */
export type StepsOf = "views" | "members";

/** The Root's views, or its Collection's members, as `Steps`. */
function useRootSteps(of: StepsOf, part: string): Steps {
  const { clover } = useClover(part);
  const navigation = useNavigation();
  const { direction } = useSequence();
  const collection = useCloverSelector((state) => state.collection);
  const shown = useCloverSelector((state) => state.manifest?.id ?? null);
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

type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "children"
>;

/** Degrees to turn a right-pointing chevron, for "next" in each direction. */
const NEXT_ROTATION: Record<ViewingDirection, number> = {
  "left-to-right": 0,
  "right-to-left": 180,
  "top-to-bottom": 90,
  "bottom-to-top": 270,
};

/** A chevron with its own size, so it never fills its button without the stylesheet. */
function Chevron({ rotate }: { rotate: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      className="clover-pager-icon"
    >
      <path
        d="M6 3l5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`rotate(${rotate} 8 8)`}
      />
    </svg>
  );
}

const StepButton = forwardRef<
  HTMLButtonElement,
  ButtonProps & { steps: Steps; step: "previous" | "next" }
>(function StepButton(
  { steps, step, className, disabled, onClick, ...rest },
  ref,
) {
  const { t, langOf } = useCloverTranslation();
  const { position, total, direction } = steps;
  if (total < 2) return null;

  const isNext = step === "next";
  const available = isNext ? position + 1 < total : position > 0;
  const rotate = NEXT_ROTATION[direction] + (isNext ? 0 : 180);
  const labelKey = isNext ? "commonNext" : "commonPrevious";
  const label = t(labelKey);
  /*
   * At the first item or the last, the button is `aria-disabled`, not `disabled`: the
   * press that reaches the end leaves focus on it (WCAG 2.4.3), and another does nothing.
   * It leaves the tab order there, as a disabled button would. `disabled` is yours to set.
   */
  return (
    <button
      ref={ref}
      type="button"
      className={join(`clover-pager-${step}`, className)}
      data-direction={direction}
      lang={langOf(labelKey)}
      disabled={disabled}
      aria-disabled={!available || undefined}
      tabIndex={available ? undefined : -1}
      onClick={(event) => {
        if (!available) return;
        onClick?.(event);
        if (!event.defaultPrevented) steps.step(isNext ? 1 : -1, event);
      }}
      {...rest}
    >
      <Chevron rotate={rotate} />
      <span style={visuallyHidden}>{label}</span>
      <Tip label={label} />
    </button>
  );
});

export interface StepProps extends ButtonProps {
  /** What it steps through: the Root's views (default), or its Collection's members. */
  of?: StepsOf;
}

/** Go to the previous item. `aria-disabled` on the first. */
export const Previous = forwardRef<HTMLButtonElement, StepProps>(
  function Previous({ of = "views", ...props }, ref) {
    const steps = useRootSteps(of, "Previous");
    return <StepButton ref={ref} {...props} steps={steps} step="previous" />;
  },
);

/** Go to the next item. `aria-disabled` on the last. */
export const Next = forwardRef<HTMLButtonElement, StepProps>(function Next(
  { of = "views", ...props },
  ref,
) {
  const steps = useRootSteps(of, "Next");
  return <StepButton ref={ref} {...props} steps={steps} step="next" />;
});

export interface PositionProps extends React.HTMLAttributes<HTMLElement> {
  /** What it counts: the Root's views (default), or its Collection's members. */
  of?: StepsOf;
  as?: React.ElementType;
}

const PositionText = forwardRef<
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
      <span style={visuallyHidden} lang={langOf("canvasPosition")}>
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

/**
 * Items' `pager` layout: `Position`, then `Previous` and `Next`, over the items it is
 * handed, in a `nav` named as Items' list is. Laid out as the book reads: a right-to-left
 * book mirrors it, `Next` first and the count last. It is a flex row, so a page moves its
 * pieces with `order`, or composes the three parts in its own.
 */
export function ItemsPager({
  steps,
  as: Tag = "nav",
  className,
  forwardedRef,
  hostLanguage,
  ...rest
}: React.HTMLAttributes<HTMLElement> & {
  steps: Steps;
  as?: React.ElementType;
  forwardedRef?: React.Ref<HTMLElement>;
  hostLanguage?: string;
}) {
  const { t, langOf } = useCloverTranslation(undefined, hostLanguage);
  const name = useContainerName(
    t("itemsLabel"),
    langOf("itemsLabel"),
    rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
    hostLanguage,
  );
  if (steps.total < 2) return null;
  const rtl = steps.direction === "right-to-left";
  return (
    <Tag
      ref={forwardedRef}
      {...name.props}
      className={join("clover-items clover-pager", className)}
      data-layout="pager"
      data-direction={steps.direction}
      {...rest}
    >
      {name.node}
      {/* A right-to-left book reads leftwards: "next" on the left, the count on the right. */}
      {!rtl && <PositionText steps={steps} />}
      <StepButton steps={steps} step={rtl ? "next" : "previous"} />
      <StepButton steps={steps} step={rtl ? "previous" : "next"} />
      {rtl && <PositionText steps={steps} />}
    </Tag>
  );
}
