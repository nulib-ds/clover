import React from "react";

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

export interface AboutProps extends React.HTMLAttributes<HTMLElement> {
  /** Also show the current Canvas's summary, for Manifests that describe each image. */
  canvasSummary?: boolean;
  /** The heading level for each section's title. Default 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
}

/**
 * Everything the Manifest says about itself, in the order 3.x's About tab shows it:
 * summary, metadata, required statement, rights, homepage, see also, downloads, and the
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
  if (!manifest) return null;
  const Heading = `h${headingLevel}` as React.ElementType;
  const section = (titleKey: string, has: unknown, part: React.ReactNode) =>
    has ? (
      <section className="clover-about-section">
        <Heading className="clover-about-heading" lang={langOf(titleKey)}>
          {t(titleKey)}
        </Heading>
        {part}
      </section>
    ) : null;
  const hasAny = (key: string) =>
    Array.isArray(manifest[key])
      ? manifest[key].length > 0
      : Boolean(manifest[key]);

  return (
    <div className={join("clover-about", className)} {...rest}>
      {canvasSummary && (
        <Summary of="canvas" className="clover-about-summary" />
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
          headingLevel={Math.min(headingLevel + 1, 6) as 3}
        />,
      )}
      {section("aboutManifest", manifest.id, <Id />)}
    </div>
  );
}
