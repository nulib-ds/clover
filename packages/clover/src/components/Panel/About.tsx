import React, { Suspense, lazy, useContext, useEffect, useRef } from "react";
import { useUniqueId } from "../../ui/useUniqueId";

import { isLoneCanvas } from "../../core/load";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useCloverSelector } from "../../react/context";
import { InPanelContext, ReadingLanguages } from "./ReadingLanguages";
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
import { languageProps } from "../../core/direction";
import { readNavDate } from "../../core/nav-date";
import { NavDate } from "../../ui/NavDate";

export interface AboutProps extends React.HTMLAttributes<HTMLElement> {
  /** Also show the current Canvas's summary, for Manifests that describe each image. */
  canvasSummary?: boolean;
  /**
   * The heading level for each section's title. Default 3. Past 6 a title is not a
   * heading, and names its section instead (`ui/heading.ts`).
   */
  headingLevel?: number;
  /**
   * Alone, outside a Panel: list the downloads, Download's links, in a section of their
   * own. In a Panel, its heading's Download button lists them (the Panel's `download`).
   * Default `true`.
   */
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
  /**
   * Alone, outside a Panel: where what the resource says of itself comes in several
   * languages, offer them over what About says, the whole Root reading in the one chosen.
   * In a Panel, its heading offers them (the Panel's `languages`). Default `true`.
   */
  languages?: boolean;
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
 *
 * Where what it says comes in several languages, the languages to read the resource in
 * (`ReadingLanguages`): over what About says, or, in a Panel's `about` section, beside
 * its heading, where they show whichever section is open.
 */
export function About({ languages = true, ...props }: AboutProps) {
  // Outside a Panel, About holds the languages itself; in one, its section's heading does.
  const inPanel = useContext(InPanelContext);
  // Its downloads too: in a Panel, its heading's Download button lists them.
  return (
    <AboutContent
      {...props}
      download={!inPanel && props.download !== false}
      choice={
        inPanel || !languages ? null : <ReadingLanguages part="clover-about" />
      }
    />
  );
}

/** What About shows; its language row first, where it holds it. */
function AboutContent({
  choice,
  canvasSummary = false,
  headingLevel = 3,
  download = true,
  thumbnail = true,
  label = true,
  className,
  ...rest
}: AboutProps & { choice: React.ReactNode }) {
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
      const height = `${heading?.offsetHeight ?? 0}px`;
      const width = `${image.offsetWidth}px`;
      const style = about.style;
      if (style.getPropertyValue("--clover-about-label-height") !== height)
        style.setProperty("--clover-about-label-height", height);
      if (style.getPropertyValue("--clover-about-thumbnail-width") !== width)
        style.setProperty("--clover-about-thumbnail-width", width);
    };
    /*
     * Measured now, then a frame after each resize: what is written wraps the label
     * again, so writing as the observer reports would resize what it watches in the
     * same frame, and the browser reports "ResizeObserver loop completed with
     * undelivered notifications" to the page's error handlers.
     */
    write();
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(write);
    });
    observer.observe(image);
    if (heading) observer.observe(heading);
    return () => {
      cancelAnimationFrame(frame);
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
          {...languageProps(langOf(titleKey))}
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
      {choice}
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
      {/* Its date for navigation, as its metadata says its others (Cookbook 0318). */}
      {section(
        "aboutDate",
        readNavDate(manifest.navDate),
        <NavDate value={manifest.navDate} className="clover-about-date" />,
      )}
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
