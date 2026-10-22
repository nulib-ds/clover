import React from "react";
import { useUniqueId } from "../../ui/useUniqueId";

import { selectVisibleCanvases } from "../../core/selectors";
import { type LanguageMapLike, localize } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useClover, useCloverSelector } from "../../react/context";
import { titleTag } from "../../ui/heading";

export interface DownloadProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  /**
   * The level of its groups' titles ("This page", "All pages"), a level under the
   * heading it sits beneath. Default 3.
   */
  headingLevel?: number;
}

export interface Rendering {
  id: string;
  label: string;
  lang?: string;
  format?: string;
}

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

function renderingsOf(
  resources: Array<Record<string, any> | null | undefined>,
  language: string | undefined,
): Rendering[] {
  const seen = new Set<string>();
  const out: Rendering[] = [];
  for (const resource of resources) {
    for (const item of asArray(resource?.rendering) as Array<
      Record<string, any>
    >) {
      const id = item?.id ?? item?.["@id"];
      if (typeof id !== "string" || seen.has(id)) continue;
      seen.add(id);
      const label = localize(item.label as LanguageMapLike, language);
      out.push({
        id,
        label: label.text || item.format || id,
        // A format or an address in place of a label is in no language.
        lang: label.text ? label.lang : undefined,
        format: item.format,
      });
    }
  }
  return out;
}

/**
 * What there is to download: the `rendering` of the Canvases in view (`page`) and of the
 * Manifest (`all`), each once, labeled in the reader's language.
 */
export function useDownloads() {
  const { language } = useClover("Download");
  const manifest = useCloverSelector((state) => state.manifest);
  const shown = useCloverSelector((state) =>
    selectVisibleCanvases(state.manifest, state.canvasId),
  );
  return {
    page: renderingsOf(shown as never, language),
    all: renderingsOf([manifest as never], language),
  };
}

export interface DownloadGroupsProps {
  page: Rendering[];
  all: Rendering[];
  /** The level of each group's title ("This page", "All pages"). Default 3. */
  headingLevel?: number;
}

/**
 * The downloads as links, grouped "This page" and "All pages", each group only when it
 * has one: what Download's panel lists, and what About shows in its own section.
 */
export function DownloadGroups({
  page,
  all,
  headingLevel = 3,
}: DownloadGroupsProps) {
  const { t, langOf } = useCloverTranslation();
  const id = useUniqueId();
  // Past 6 not a heading (`ui/heading.ts`): each group is named by it either way.
  const Heading = titleTag(headingLevel) as "h3";
  const list = (titleKey: string, items: Rendering[], key: string) =>
    items.length > 0 && (
      <section
        className="clover-download-group"
        aria-labelledby={`${id}-${key}`}
      >
        <Heading
          className="clover-download-title"
          id={`${id}-${key}`}
          lang={langOf(titleKey)}
        >
          {t(titleKey)}
        </Heading>
        <ul className="clover-download-list">
          {items.map((item) => (
            <li key={item.id}>
              <a
                className="clover-download-link"
                href={item.id}
                target="_blank"
                rel="noopener noreferrer"
                lang={item.lang}
              >
                {item.label}
                {item.format && item.format !== item.label && (
                  <span className="clover-download-format">
                    {" "}
                    ({item.format})
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </section>
    );
  return (
    <div className="clover-download-groups">
      {list("downloadPage", page, "page")}
      {list("downloadAll", all, "all")}
    </div>
  );
}

/**
 * Downloads, as 3.x's Viewer offers them: the `rendering` of the Canvases in view ("This
 * page") and of the Manifest ("All pages") — a PDF, a text, a high-resolution file —
 * each a link, as Homepage lists a resource's pages (Mat, 2026-10-21: links, not a
 * button that opens them). Renders nothing when there is nothing to download.
 */
export function Download({
  className,
  headingLevel = 3,
  ...rest
}: DownloadProps) {
  const { page, all } = useDownloads();
  if (!page.length && !all.length) return null;
  return (
    <div {...rest} className={join("clover-download", className)}>
      <DownloadGroups page={page} all={all} headingLevel={headingLevel} />
    </div>
  );
}
