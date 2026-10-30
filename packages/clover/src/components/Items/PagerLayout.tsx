import React from "react";

import { HostLanguageContext } from "../../i18n/hostLanguage";
import { useRootLanguage } from "../../i18n/useRootLanguage";
import {
  highContrastProps,
  useHighContrast,
} from "../../hooks/useHighContrast";
import type { Forwarded, ItemsProps } from "./Items";
import { ItemsPager, type Steps } from "./Pager";

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
  thumbnailSize,
  renderItem,
  header,
  headingLevel,
  request,
  language,
  navigation,
  of,
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
