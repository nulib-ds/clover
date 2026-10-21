import React, { useId } from "react";

import { isLoneCanvas } from "../../core/load";
import { localize } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { useClover } from "../../react/context";
import { titled } from "../../ui/heading";

/**
 * A Canvas shown on its own (given as the content) says what it is part of, and opens
 * that Manifest in its place, at this Canvas where it holds it.
 */
export default function PartOfManifest({
  manifest,
  headingLevel,
  onOpened,
}: {
  manifest: Record<string, any>;
  /** About's, for its title. */
  headingLevel: number;
  /** Once the Manifest is in place, and this, with its button, is gone. */
  onOpened: () => void;
}) {
  const { t, langOf } = useCloverTranslation();
  const { clover, language } = useClover("About");
  const id = useId();
  const parts = ([] as Array<Record<string, any>>)
    .concat(manifest.partOf ?? [])
    .filter((part) => part?.id && (!part.type || part.type === "Manifest"));
  if (!isLoneCanvas(manifest) || !parts.length) return null;
  const canvasId = manifest.items[0].id;
  const { as: Title, title, group } = titled(headingLevel, `${id}-title`);
  return (
    <section className="clover-about-section" {...group}>
      <Title
        className="clover-about-heading"
        lang={langOf("aboutPartOf")}
        {...title}
      >
        {t("aboutPartOf")}
      </Title>
      <ul className="clover-about-part-of">
        {parts.map((part, index) => {
          const label = localize(part.label, language);
          return (
            <li key={part.id}>
              {label.text && (
                <span id={`${id}-${index}`} lang={label.lang}>
                  {label.text}
                </span>
              )}
              <button
                type="button"
                className="clover-about-open"
                lang={langOf("aboutOpenManifest")}
                // Which Manifest it opens, where there could be several.
                aria-describedby={label.text ? `${id}-${index}` : undefined}
                onClick={() =>
                  void clover.goToManifest(part.id, canvasId).then(onOpened)
                }
              >
                {t("aboutOpenManifest")}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
