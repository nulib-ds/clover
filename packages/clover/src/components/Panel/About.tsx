import React, { Suspense, lazy, useEffect, useRef } from "react";
import { useUniqueId } from "../../ui/useUniqueId";

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
  Thumbnail,
} from "../Primitives/Primitives";
import { DownloadGroups, useDownloads } from "../Download/Download";
import { Provider } from "../Provider/Provider";
import { titleTag, titled } from "../../ui/heading";
import { Label } from "../Label/Label";

export interface AboutProps extends React.HTMLAttributes<HTMLElement> {
  /** Also show the current Canvas's summary, for Manifests that describe each image. */
  canvasSummary?: boolean;
  /**
   * The heading level for each section's title. Default 3. Past 6 a title is not a
   * heading, and names its section instead (`ui/heading.ts`).
   */
  headingLevel?: number;
  /** List the downloads, Download's links, in a section of their own. Default `true`. */
  download?: boolean;
  /**
   * The Manifest's thumbnail first, small, at its own shape, floated at the end of the
   * label's lines, over the summary (Mat, 2026-10-26: "float it right to the side of the
   * label. and above summary"). Named by the label where there is none beside it, and
   * decorative where there is. Default `true`.
   */
  thumbnail?: boolean;
  /**
   * The resource's label again, as a heading at `headingLevel`, over what About says of
   * it (Mat, 2026-10-26: "repeat label as a heading"). Default `true`.
   */
  label?: boolean;
}

/*
 * What a Canvas shown on its own is part of, and the button that opens it: only for such
 * a Canvas, so loaded only for one.
 */
const PartOfManifest = lazy(() => import("./PartOfManifest"));

/**
 * Everything the Manifest says about itself, in the order 3.x's About tab shows it:
 * what a Canvas shown on its own is part of, then summary, metadata, required statement,
 * provider (its logo and name, linked to its homepage), rights, homepage, see also,
 * downloads, and the Manifest's own address, its thumbnail over them all (`thumbnail`).
 * Each part renders only if the Manifest has
 * it. The downloads are Download's: the `rendering` of the page in view ("This page")
 * and of the Manifest ("All pages").
 */
export function About({
  canvasSummary = false,
  headingLevel = 3,
  download = true,
  thumbnail = true,
  label = true,
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
  /*
   * The label's height and the thumbnail's width, written to About, so the words after
   * the label make room for the thumbnail where it hangs past it (`Panel.css`).
   */
  useEffect(() => {
    const about = root.current;
    const image = about?.querySelector<HTMLElement>(".clover-about-thumbnail");
    if (!about || !image || typeof ResizeObserver === "undefined") return;
    const heading = about.querySelector<HTMLElement>(".clover-about-label");
    const write = () => {
      about.style.setProperty(
        "--clover-about-label-height",
        `${heading?.offsetHeight ?? 0}px`,
      );
      about.style.setProperty(
        "--clover-about-thumbnail-width",
        `${image.offsetWidth}px`,
      );
    };
    const observer = new ResizeObserver(write);
    observer.observe(image);
    if (heading) observer.observe(heading);
    return () => {
      observer.disconnect();
      about.style.removeProperty("--clover-about-label-height");
      about.style.removeProperty("--clover-about-thumbnail-width");
    };
  }, [label, thumbnail, manifest]);
  const id = useUniqueId();
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
      {(thumbnail || label) && (
        <div className="clover-about-head">
          {thumbnail && (
            <Thumbnail
              className="clover-about-thumbnail"
              size={256}
              alt={label ? "" : undefined}
            />
          )}
          {label && (
            <Label as={titleTag(headingLevel)} className="clover-about-label" />
          )}
        </div>
      )}
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
      {section("aboutProvider", hasAny("provider"), <Provider />)}
      {section("aboutRights", manifest.rights, <Rights />)}
      {section("aboutHomepage", hasAny("homepage"), <Homepage />)}
      {section("aboutSeeAlso", hasAny("seeAlso"), <SeeAlso />)}
      {section(
        "download",
        download && downloads.page.length + downloads.all.length > 0,
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
