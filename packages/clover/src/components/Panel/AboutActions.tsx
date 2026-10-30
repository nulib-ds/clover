import React, { Suspense, lazy, useCallback, useState } from "react";

import { type Rendering, useDownloads } from "../Download/downloads";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { Tip } from "../../ui/Tip";
import { useUniqueId } from "../../ui/useUniqueId";
import { useReadingLanguages } from "./ReadingLanguages";
import { languageProps } from "../../i18n/direction";

// The language row, loaded only for a resource that has languages to offer.
const LanguageChoice = lazy(() =>
  import("../../ui/LanguageChoice").then((module) => ({
    default: module.LanguageChoice,
  })),
);

// The popover's ways to close, loaded as it first opens: no first view needs them.
const ControlMenu = lazy(() => import("../Canvas/ControlMenu"));
// The links, with the popover that shows them: a press brings both.
const DownloadGroups = lazy(() =>
  import("../Download/Download").then(({ DownloadGroups }) => ({
    default: DownloadGroups,
  })),
);

/**
 * What About's heading holds in a Panel, at the end of its row, shown whichever section
 * is open (`SectionSpec`'s `actions`): a Download button where there is anything to
 * download, then, furthest along, the languages to read the resource in
 * (`ReadingLanguages`; Mat, 2026-10-28).
 * Nothing at all where it has neither, so the heading keeps no room for it.
 */
export function AboutActions({
  languages = true,
  download = true,
}: {
  languages?: boolean;
  download?: boolean;
}) {
  const choice = useReadingLanguages();
  const { page, all } = useDownloads();
  const offered = download && page.length + all.length > 0;
  if (!(languages && choice) && !offered) return null;
  return (
    <div className="clover-about-actions">
      {offered && <DownloadButton page={page} all={all} />}
      {languages && choice && (
        <Suspense fallback={null}>
          <LanguageChoice
            {...choice}
            nameKey="readingLanguage"
            part="clover-about"
          />
        </Suspense>
      )}
    </div>
  );
}

/**
 * About's downloads beside its heading (Mat, 2026-10-28: "add download button to about
 * section slot. show as a Download icon"): a round button, as an annotation set's hide
 * toggle is drawn (`ui/HideToggle`), named Download, that discloses Download's links in a
 * popover under it, drawn as the Canvas's menus are (`ControlMenu`): the `rendering` of
 * the page in view ("This page") and of the Manifest ("All pages"). The links come next
 * in the tab order. Escape, a press outside, another popup, or focus moving on past them
 * closes it, Escape handing focus back to the button; open, it never covers where focus
 * has gone (WCAG 2.4.11).
 */
function DownloadButton({
  page,
  all,
}: {
  page: Rendering[];
  all: Rendering[];
}) {
  const { t, langOf } = useCloverTranslation();
  const [open, setOpen] = useState(false);
  const id = useUniqueId();
  const button = `${id}-download`;
  const close = useCallback(
    (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) document.getElementById(button)?.focus();
    },
    [button],
  );
  return (
    <span
      className="clover-about-download"
      onBlur={(event) => {
        // Focus gone elsewhere, not a press inside it, which takes focus nowhere.
        const next = event.relatedTarget as Node | null;
        if (open && next && !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        type="button"
        id={button}
        className="clover-about-download-button"
        aria-label={t("download")}
        {...languageProps(langOf("download"))}
        aria-expanded={open}
        aria-controls={open ? `${button}-menu` : undefined}
        onClick={() => setOpen((was) => !was)}
      >
        <DownloadGlyph />
        <Tip label={t("download")} />
      </button>
      {open && (
        <Suspense fallback={null}>
          <ControlMenu
            id={`${button}-menu`}
            triggerId={button}
            onClose={close}
            className="clover-about-download-menu"
          >
            <DownloadGroups page={page} all={all} inPopover />
          </ControlMenu>
        </Suspense>
      )}
    </span>
  );
}

/**
 * An arrow down into a tray, in the weight of the panel's chevrons beside it (their
 * 1.5px at the glyph's size, `text-s`; Mat, 2026-10-28: "less hairline").
 */
function DownloadGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="56"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M256 64v272M160 240l96 96 96-96M80 352v48a48 48 0 0 0 48 48h256a48 48 0 0 0 48-48v-48" />
    </svg>
  );
}
