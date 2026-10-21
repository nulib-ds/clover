import React, { Suspense, lazy, useId, useRef } from "react";

import { isLoneCanvas } from "../../core/load";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useCloverSelector } from "../../react/context";
import {
  Homepage,
  Id,
  Metadata,
  RequiredStatement,
  Rights,
  SeeAlso,
  Summary,
} from "../Primitives/Primitives";
import { DownloadGroups, useDownloads } from "../Download/Download";
import { titled } from "../../ui/heading";

export interface AboutProps extends React.HTMLAttributes<HTMLElement> {
  /** Also show the current Canvas's summary, for Manifests that describe each image. */
  canvasSummary?: boolean;
  /**
   * The heading level for each section's title. Default 3. Past 6 a title is not a
   * heading, and names its section instead (`ui/heading.ts`).
   */
  headingLevel?: number;
}

/*
 * What a Canvas shown on its own is part of, and the button that opens it: only for such
 * a Canvas, so loaded only for one.
 */
const PartOfManifest = lazy(() => import("./PartOfManifest"));

/**
 * Everything the Manifest says about itself, in the order 3.x's About tab shows it:
 * what a Canvas shown on its own is part of, then summary, metadata, required statement, rights, homepage, see also, downloads, and the
 * Manifest's own address. Its thumbnail is the layout's to place (`Default` puts it in
 * its header, beside the title). Each part renders only if the Manifest has
 * it. The downloads are Download's: the `rendering` of the page in view ("This page")
 * and of the Manifest ("All pages").
 */
export function About({
  canvasSummary = false,
  headingLevel = 3,
  className,
  ...rest
}: AboutProps) {
  const { t, langOf } = useCloverTranslation();
  const downloads = useDownloads();
  const manifest = useCloverSelector(
    (state) => state.manifest as Record<string, any> | null,
    Object.is,
    "About",
  );
  /*
   * The full Manifest opened from "Part of": the button goes with the Canvas, so focus
   * goes to the section it was in (its heading's button, in an Panel), or to
   * About itself, never lost to the page (WCAG 2.4.3).
   */
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const onOpened = () => {
    const about = root.current;
    const heading = about
      ?.closest(".clover-sections-item")
      ?.querySelector<HTMLElement>(".clover-sections-button");
    (heading ?? about)?.focus({ preventScroll: true });
  };
  if (!manifest) return null;
  const section = (titleKey: string, has: unknown, part: React.ReactNode) => {
    if (!has) return null;
    const {
      as: Title,
      title,
      group,
    } = titled(headingLevel, `${id}-${titleKey}`);
    return (
      <section className="clover-about-section" {...group}>
        <Title
          className="clover-about-heading"
          lang={langOf(titleKey)}
          {...title}
        >
          {t(titleKey)}
        </Title>
        {part}
      </section>
    );
  };
  const hasAny = (key: string) =>
    Array.isArray(manifest[key])
      ? manifest[key].length > 0
      : Boolean(manifest[key]);

  return (
    <div
      ref={root}
      className={join("clover-about", className)}
      tabIndex={-1}
      {...rest}
    >
      {canvasSummary && (
        <Summary of="canvas" className="clover-about-summary" />
      )}
      {isLoneCanvas(manifest) && manifest.partOf && (
        <Suspense fallback={null}>
          <PartOfManifest
            manifest={manifest}
            headingLevel={headingLevel}
            onOpened={onOpened}
          />
        </Suspense>
      )}
      <Summary className="clover-about-summary" />
      <Metadata className="clover-about-metadata" />
      <RequiredStatement className="clover-about-metadata" />
      {section("aboutRights", manifest.rights, <Rights />)}
      {section("aboutHomepage", hasAny("homepage"), <Homepage />)}
      {section("aboutSeeAlso", hasAny("seeAlso"), <SeeAlso />)}
      {section(
        "download",
        downloads.page.length + downloads.all.length > 0,
        <DownloadGroups
          page={downloads.page}
          all={downloads.all}
          headingLevel={headingLevel + 1}
        />,
      )}
      {section(
        isLoneCanvas(manifest) ? "aboutCanvas" : "aboutManifest",
        manifest.id,
        <Id />,
      )}
    </div>
  );
}
