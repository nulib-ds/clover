import React, { forwardRef } from "react";

import type { ViewingDirection } from "../../core/sequence";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { Tip } from "../../ui/Tip";
import { useContainerName } from "../../i18n/useContainerName";
import { visuallyHidden } from "../../ui/visuallyHidden";
import { languageProps } from "../../i18n/direction";
import {
  PositionText,
  type Steps,
  type StepsOf,
  useRootSteps,
} from "./Position";

export {
  Position,
  type PositionProps,
  type Steps,
  type StepsOf,
} from "./Position";
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
 * `Position` and the steps the three read are `Position.tsx`, which a page counting its
 * views loads without the rest.
 */

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
function Chevron({ rotate, size = 16 }: { rotate: number; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
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
  ButtonProps & {
    steps: Steps;
    step: "previous" | "next";
    /** Drawn as Search's and Contents' steps are (`ui/Steps`), not a round control. */
    small?: boolean;
  }
>(function StepButton(
  { steps, step, small = false, className, disabled, onClick, ...rest },
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
      className={join(
        small ? "clover-steps-step" : `clover-pager-${step}`,
        className,
      )}
      data-step={small ? step : undefined}
      data-direction={direction}
      {...languageProps(langOf(labelKey))}
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
      <Chevron rotate={rotate} size={small ? 12 : 16} />
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
  position,
  nameKey = "itemsLabel",
  size = "large",
  ...rest
}: React.HTMLAttributes<HTMLElement> & {
  steps: Steps;
  as?: React.ElementType;
  forwardedRef?: React.Ref<HTMLElement>;
  hostLanguage?: string;
  /** In place of the count: one that opens a menu of the items (a content state's targets). */
  position?: React.ReactNode;
  /** The string naming its `nav`, where it is not Items' ("Views", for the targets). */
  nameKey?: string;
  /**
   * `large` (the default): round controls, as the strip's arrows are. `small`: its steps
   * and count as Search's and Contents' are (`ui/Steps`), for a header's line.
   */
  size?: "large" | "small";
}) {
  const { t, langOf } = useCloverTranslation(undefined, hostLanguage);
  const name = useContainerName(
    t(nameKey),
    langOf(nameKey),
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
      data-size={size === "small" ? "small" : undefined}
      {...rest}
    >
      {name.node}
      {/* A right-to-left book reads leftwards: "next" on the left, the count on the right. */}
      {!rtl && (position ?? <PositionText steps={steps} />)}
      <StepButton
        steps={steps}
        step={rtl ? "next" : "previous"}
        small={size === "small"}
      />
      <StepButton
        steps={steps}
        step={rtl ? "previous" : "next"}
        small={size === "small"}
      />
      {rtl && (position ?? <PositionText steps={steps} />)}
    </Tag>
  );
}
