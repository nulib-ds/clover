import React from "react";
import { useUniqueId } from "../../ui/useUniqueId";

import type { CloverRequest } from "../../core/request";
import { selectVisibleCanvases } from "../../core/selectors";
import { type LanguageMapLike, localize } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useClover, useCloverSelector } from "../../react/context";
import { titleTag } from "../../ui/heading";
import { asArray } from "../../lib/asArray";

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

// Origins whose files could not be fetched (no CORS): their links then open as links do.
const unfetchable = new Set<string>();

const originOf = (url: string) => {
  try {
    return new URL(url, globalThis.location?.href).origin;
  } catch {
    return url;
  }
};

/**
 * Saves a file pressed rather than opening it (`core/save-file.ts`, loaded on the first
 * press), else opens it in a new tab, its origin remembered.
 */
function save(url: string, request: CloverRequest | undefined) {
  void import("../../core/save-file")
    .then(({ saveFile }) => saveFile(url, request))
    .then((saved) => {
      if (saved) return;
      unfetchable.add(originOf(url));
      window.open(url, "_blank", "noopener,noreferrer");
    });
}

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
  /**
   * In a popover (About's Download button, `Panel/AboutActions.tsx`): each group a named
   * group, its title no heading, as a menu's groups are, rather than a section of the
   * page's outline.
   */
  inPopover?: boolean;
}

/**
 * The downloads as links, grouped "This page" and "All pages", each group only when it
 * has one: what Download's panel lists, and what About shows in its own section.
 */
export function DownloadGroups({
  page,
  all,
  headingLevel = 3,
  inPopover = false,
}: DownloadGroupsProps) {
  const { t, langOf } = useCloverTranslation();
  const { clover } = useClover("Download");
  const id = useUniqueId();
  // Past 6 not a heading (`ui/heading.ts`): each group is named by it either way.
  const Heading = (inPopover ? "span" : titleTag(headingLevel)) as "h3";
  const Group = inPopover ? "div" : "section";
  const list = (titleKey: string, items: Rendering[], key: string) =>
    items.length > 0 && (
      <Group
        className="clover-download-group"
        role={inPopover ? "group" : undefined}
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
                download=""
                lang={item.lang}
                onClick={(event) => {
                  // A press with a key (a new tab, a window) is the browser's, and so is
                  // a file whose origin would not let it be fetched.
                  if (
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey ||
                    unfetchable.has(originOf(item.id))
                  )
                    return;
                  event.preventDefault();
                  save(item.id, clover.request);
                }}
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
      </Group>
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
 * button that opens them). Pressed, a link saves its file rather than opening it, where
 * its server lets the file be fetched (`saveFile`), and opens it in a new tab where not.
 * Renders nothing when there is nothing to download.
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
