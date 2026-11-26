import React, { Suspense, lazy, useCallback, useState } from "react";
import { DownloadGlyph as Download } from "../../ui/glyphs/Download";

import { useHasDownloads } from "../Download/hasDownloads";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { Tip } from "../../ui/Tip";
import { useUniqueId } from "../../ui/useUniqueId";
import { LanguageToggle, useLanguageToggle } from "./LanguageToggle";
import { languageProps } from "../../i18n/direction";

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
 * download, then, furthest along, the languages to read in, the resource's and Clover's
 * interface languages as one toggle after A and 文 (`LanguageToggle`; Mat, 2026-10-28 and
 * 2026-11-05). Nothing at all where it has neither, so the heading keeps no room for it.
 */
export function AboutActions({
  languages = true,
  interfaceLanguages = true,
  download = true,
}: {
  languages?: boolean;
  interfaceLanguages?: boolean;
  download?: boolean;
}) {
  const choice = useLanguageToggle({ values: languages, interfaceLanguages });
  const offered = useHasDownloads() && download;
  if (!choice && !offered) return null;
  return (
    <div className="clover-about-actions">
      {offered && <DownloadButton />}
      {choice && (
        <LanguageToggle
          values={languages}
          interfaceLanguages={interfaceLanguages}
        />
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
function DownloadButton() {
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
            // All of it in sight in a narrow panel, as the language menu beside it.
            inside
          >
            <DownloadGroups inPopover />
          </ControlMenu>
        </Suspense>
      )}
    </span>
  );
}

/** About's Download glyph (`ui/glyphs/Download.tsx`), sized by the stylesheet. */
function DownloadGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
    >
      <Download />
    </svg>
  );
}
