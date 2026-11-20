import React from "react";

import { HostLanguageContext } from "../../i18n/hostLanguage";
import { useRootLanguage } from "../../i18n/useRootLanguage";
import {
  highContrastProps,
  useHighContrast,
} from "../../hooks/useHighContrast";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { useContainerName } from "../../i18n/useContainerName";
import { join } from "../../lib/classnames";
import type { Forwarded, ItemsProps } from "./Items";
import { StepButton } from "./Pager";
import { PositionText, type Steps } from "./Position";

export { CountMenu } from "./CountMenu";

export type PagerProps = Omit<
  ItemsProps,
  "onSelect" | "iiifContent" | "items"
> &
  Forwarded & {
    steps: Steps;
    /** In place of the count: one that opens a menu of the items. */
    position?: React.ReactNode;
    /** The string naming its `nav`, where it is not Items'. */
    nameKey?: string;
  };

/**
 * Items' `pager` layout, standalone or in a Root: Items' own props that are not the
 * `nav`'s are left behind, and the page's language is read as the strip reads it.
 */
export default function PagerLayout({
  steps,
  forwardedRef,
  /* eslint-disable @typescript-eslint/no-unused-vars -- Items' own, not the nav's */
  layout,
  orientation,
  thumbnailSize,
  renderItem,
  header,
  headingLevel,
  request,
  language,
  navigation,
  of,
  secondary,
  labels,
  singleItem,
  /* eslint-enable @typescript-eslint/no-unused-vars */
  highContrast,
  ...rest
}: PagerProps) {
  const root = useRootLanguage(forwardedRef, rest.lang);
  const contrast = useHighContrast(highContrast);
  return (
    <HostLanguageContext.Provider value={root.hostLanguage}>
      <ItemsPager
        {...highContrastProps(contrast)}
        {...rest}
        steps={steps}
        forwardedRef={root.ref}
        hostLanguage={root.hostLanguage}
      />
    </HostLanguageContext.Provider>
  );
}

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
