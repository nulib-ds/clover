import React, { forwardRef } from "react";

import { selectCanvas } from "../../core/selectors";
import { toPlainText } from "../../core/text";
import { type LanguageMapLike, localize } from "../../core/value";
import { join } from "../../lib/classnames";
import {
  useOptionalClover,
  useOptionalCloverSelector,
} from "../../react/context";
import { useProvider } from "../Primitives/resource";
import { languageProps } from "../../i18n/direction";

export interface LabelProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "lang"> {
  /** Whose label: the Manifest's (the default), or the current Canvas's. */
  of?: "manifest" | "canvas";
  /** A label to show instead of the Root's. Outside a `Root`, the label to show. */
  label?: LanguageMapLike;
  /** The element to render, such as `h1`. Default `span`. */
  as?: React.ElementType;
  /**
   * Keep its place while there is no label (the next Manifest loading): the element
   * stays, holding a non-breaking space and hidden from assistive technology, so what
   * follows it holds still. Default false: nothing is rendered.
   */
  keep?: boolean;
}

/**
 * A label, in the Root's language and marked with the language it is in: the Manifest's,
 * the Canvas's, or inside a `Provider` the provider's name. Renders nothing while there is
 * none, unless asked to `keep` its place (Mat, 2026-11-08: "expect there to be a string here
 * at all times, even if an empty space"), which keeps its line, never an empty heading to
 * assistive technology.
 */
export const Label = forwardRef<HTMLElement, LabelProps>(function Label(
  {
    of = "manifest",
    label,
    as: Tag = "span",
    keep = false,
    className,
    ...rest
  },
  ref,
) {
  const fromRoot = useOptionalCloverSelector(
    (state) =>
      (of === "canvas"
        ? selectCanvas(state.manifest, state.canvasId)?.label
        : state.manifest?.label) as LanguageMapLike,
    undefined,
  );
  const provider = useProvider();
  const language = useOptionalClover()?.language;
  const { text, lang } = localize(
    label ?? (provider ? provider.label : fromRoot),
    language,
  );
  if (!text) {
    if (!keep) return null;
    return (
      <Tag
        ref={ref}
        className={join("clover-label", className)}
        data-empty=""
        {...rest}
        aria-hidden="true"
      >
        {"\u00a0"}
      </Tag>
    );
  }
  return (
    <Tag
      ref={ref}
      className={join("clover-label", className)}
      {...languageProps(lang)}
      {...rest}
    >
      {toPlainText(text)}
    </Tag>
  );
});
