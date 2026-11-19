import type { AnnotationBodyEntry } from "../core/annotation-bodies";
import { hasText } from "../core/shown-bodies";
import { type LocalizedValue, localize } from "../core/value";
import { useCloverTranslation } from "../i18n/useCloverTranslation";

/*
 * Its own module, apart from `ui/AnnotationEntry.tsx`: the Canvas's caption reads it
 * (`EntryBodies`), and never loads an entry's picture with it.
 */
/**
 * An image an annotation carries (Cookbook 0377): its text alternative none beside text
 * that describes it, which would say it twice (WCAG 1.1.1); else its label, or its
 * annotation's; else that it is an image.
 */
export function useBodyAlt(bodies: AnnotationBodyEntry[], language?: string) {
  const { t, langOf } = useCloverTranslation();
  const described = hasText(bodies);
  return (body: AnnotationBodyEntry): LocalizedValue => {
    if (described) return { text: "" };
    const label = localize(body.label, language);
    return label.text
      ? label
      : { text: t("annotationsImage"), lang: langOf("annotationsImage") };
  };
}
