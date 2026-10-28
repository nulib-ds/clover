"use client";

import Playground, {
  type PlaygroundHandle,
} from "docs/components/Playground/Playground";
import React, { useRef, useState } from "react";
import Hero from "docs/components/Home/Hero";
import Parts from "docs/components/Home/Parts";
import styles from "docs/components/Home/Home.module.css";
import { cookbookSections } from "docs/components/CookbookRecipes/cookbookSections";
import { resourceFor } from "docs/components/CookbookRecipes/cookbookCatalog";
import { Flavored, elementTag } from "docs/components/Flavored";
import type { CodeFlavor } from "docs/lib/code-flavor";
import {
  cookbook,
  elementLoads,
  loads,
  partCount,
  partLoads,
  viewerParts,
} from "docs/lib/figures";
import { FULL_WIDTH } from "docs/lib/full-width";
import { BrandCode, BrandControls } from "docs/components/Home/BrandPicker";
import { FormatPicker } from "docs/components/Home/FormatPicker";
import { IIIFLogo } from "docs/components/Home/IIIFLogo";
import { InstallCommand } from "docs/components/Home/InstallCommand";
import { RecipeSelect } from "docs/components/Home/RecipeSelect";
import { SectionIntro } from "docs/components/Home/SectionIntro";
import { Swoosh } from "docs/components/Home/Swoosh";

/*
 * Every figure here is the code's own, never a claim, from `docs/lib/figures.ts`, which
 * what agents read states too (`llms.txt`, the structured data).
 */
/** A recipe's Manifest and its name, by number and title, for the viewer to read it. */
const recipeData = ({
  slug,
  resource,
}: {
  slug: string;
  resource?: string;
}) => {
  const recipe = cookbookSections
    .flatMap((section) => section.recipes)
    .find((item) => item.slug === slug);
  return {
    "data-recipe": resource ?? resourceFor(slug),
    "data-recipe-name": `IIIF Cookbook ${slug.slice(0, 4)}: ${recipe?.title ?? slug}`,
  };
};

interface Story {
  label: string;
  /**
   * The one part of the example viewer beside it that it is about (its `data-part`), or
   * `viewer` for the whole of it, which it outlines and draws its line to while it is in
   * the middle of the window (`StoryLines.tsx`).
   */
  point: string;
  /**
   * Whether every part the viewer shows is lit meanwhile, its tag giving what the part
   * adds to a page after its name (`data-weigh`, `StoryLines.tsx`).
   */
  weigh?: boolean;
  /** Whether the viewer turns over to its accessibility tree for it (`data-turn`). */
  turn?: boolean;
  /**
   * A Cookbook recipe, by slug (and the resource, where not its first), that the viewer
   * turns over to read while it is at the
   * middle of the window (`data-recipe`, `StoryLines.tsx`).
   */
  recipe?: { slug: string; resource?: string };
  title: React.ReactNode;
  body: React.ReactNode;
  /** A figure, and its unit (`kB`), which is set smaller than it. */
  /**
   * Its figures: each for both of the docs' flavors, or for one (`flavor`), shown when the
   * reader chose it (the header's switch), as a story's sizes are each technology's own.
   */
  figures: {
    value: string;
    unit?: string;
    caption: string;
    flavor?: CodeFlavor;
  }[];
  /**
   * Whether the example viewer's code is shown across the story's foot, the composer
   * itself, moved here where the viewer is held (`PartsLive.tsx`), which makes a change
   * of its own as the story passes (`data-compose`).
   */
  composer?: boolean;
  /**
   * Whether the site's Font family and Color take the column its figures would, setting
   * the whole site, its figures under its words instead, then the CSS a page would write
   * (`BrandPicker.tsx`; Mat, 2026-10-21); as the story passes, the site shows another
   * brand a while (`data-brand`, `PartsLive.tsx`).
   */
  brand?: boolean;
  /**
   * Whether a thumbnail of each format takes the column its figures would, each opening
   * its resource in the playground and so in the example viewer (`FormatPicker.tsx`).
   */
  formats?: boolean;
  /**
   * Whether the Cookbook's recipes are listed across the story's foot, under its words, as
   * Composable's code is, in the playground's own select, the one chosen opened in the
   * playground (`RecipeSelect.tsx`; Mat, 2026-10-25). The example viewer reads its own
   * `recipe` still, always (Mat, 2026-10-25: "it should remain as the 0032 collection
   * always").
   */
  recipes?: boolean;
}

const stories: Story[] = [
  {
    // Adaptable, with "multimodal" in its title (Mat, 2026-10-25).
    label: "Adaptable",
    // Body, which draws each format, switching between Canvas, Timeline and Scene.
    point: "body",
    formats: true,
    title: "Multimodal first.",
    body: "Images, audio/video, 3D models and the printed page all open in the same viewer, each with the controls it needs. Choose one and the example viewer takes it in.",
    figures: [],
  },
  {
    label: "Accessible",
    // The viewer turned over: what assistive technology is given, and the tab order.
    point: "viewer",
    turn: true,
    title: "Made for everyone.",
    body: "With all people in mind, Clover sets a high bar for accessibility. Screen readers understand its WAI-ARIA patterns, its colors meet contrast rules, and its controls work from the keyboard alone.",
    figures: [
      // Mat's call, 2026-10-21, knowing ACCESSIBILITY.md's open items: close them to keep it true.
      { value: "2.2 AA", caption: "Built to WCAG compliance" },
    ],
  },
  {
    label: "Seamless",
    /*
     * The thumbnails, their Next as under the pointer, its name showing: the brand's color
     * on a control, where it shows plainest (Mat, 2026-10-21; `PartsLive.tsx`).
     */
    point: "items",
    brand: true,
    title: "Inherits your brand.",
    body: "Clover doesn’t bring a font or a base size of its own. It takes on yours, and its colors are CSS custom properties, so your brand is a few lines away.",
    figures: [
      { value: "1rem", caption: "Inherited sizing" },
      { value: "CSS", caption: "Variables for styling" },
    ],
  },
  {
    label: "Composable",
    // A layout of parts: the whole viewer, every part of it outlined.
    point: "viewer",
    title: "Compose your own.",
    // Composing first, the templates after it, made the same way (Mat, 2026-10-22).
    body: "Arrange the components you see here into a layout that shapes your vision. Clover’s ready-to-go templates are built the same way.",
    figures: [
      {
        value: String(partCount),
        caption: "IIIF-focused components",
      },
    ],
    composer: true,
  },
  {
    label: "Lightweight",
    // One line, to the viewer's middle, and every part's tag with what it adds (Mat, 2026-10-22).
    point: "viewer",
    weigh: true,
    // What a reader's browser loads, never "ships" (Mat, 2026-10-21: jargon).
    title: "Minimal load for users.",
    // Their weight and screen kept for the collection, not code (Mat, 2026-10-21; "your projects", 2026-10-22).
    body: "Every part of Clover is built with intention and shared across its templates, so your projects can reserve their weight and the screen for rich cultural heritage material, not bloated code.",
    /*
     * Only what draws something: a Viewer before its template draws nothing (Mat,
     * 2026-10-21). The parts have their own figures, on their tags (Mat, 2026-10-22).
     */
    figures: [
      {
        value: loads.defaultTemplate,
        unit: "kB",
        caption: "All the Viewer needs",
        flavor: "react",
      },
      // A page with a Viewer alone, from the Viewer's own entry (`web-components/viewer`).
      {
        value: loads.viewerEntry,
        unit: "kB",
        caption: "All the Viewer needs",
        flavor: "web-components",
      },
    ],
  },
  {
    // Natural, not "Native", which can read as about people (Mat, 2026-10-25).
    label: "Natural",
    /*
     * Cookbook 0032, a Collection, read by the same Label, Body, Metadata and
     * Collection (Mat, 2026-10-21), the line drawn to the Collection.
     */
    point: "collection",
    recipe: {
      slug: "0032-collection",
      resource:
        "https://iiif.io/api/cookbook/recipe/0032-collection/collection.json",
    },
    /*
     * IIIF's logo for the word (Mat, 2026-10-25), which is read in its place, so the
     * title is "Reads the IIIF cookbook." to assistive technology, search and a copy.
     * "cookbook" lowercase here, in the title and the words (Mat, 2026-10-25).
     */
    title: (
      <>
        Reads the <IIIFLogo className={styles.titleLogo} />
        <span className={styles.visuallyHidden}>IIIF</span> cookbook.
      </>
    ),
    body: (
      <>
        {/*
         * Clover as itself, never "we", and active ("gains", never "comes from"): its
         * IIIF fluency first, from building blocks native to open specifications, then
         * its code and components, named, never "it’s" or "its", and "IIIF" said once
         * (Mat, 2026-10-25). No date, no range of recipes; the link one word.
         */}
        {/*
         * What Clover handles in its sentence, not a column of its own (Mat,
         * 2026-10-25: "put the 62 in line in the sentence … bold the number and
         * underline it"), bold, with the figures' stroke under it, drawn once, and no
         * total or count in part (Mat, 2026-10-21). "cookbook" goes to the IIIF
         * Cookbook itself (Mat, 2026-10-25).
         */}
        Clover gains IIIF fluency from building blocks designed natively to open
        specifications. Code and components are crafted toward recipes, with{" "}
        <strong className={styles.inlineFigure}>
          <Swoosh className={styles.figureMark}>{cookbook.handled}</Swoosh>
        </strong>{" "}
        handled in the <a href="https://iiif.io/api/cookbook/">cookbook</a>.
      </>
    ),
    figures: [],
    recipes: true,
  },
];

/*
 * Nextra's frame, as the homepage needs it, in rules drawn with the page and gone with it
 * (a `<style>` it renders, no `:has()` on the page's ancestors, `full-width.ts`).
 *
 * The page spans the window (`FULL_WIDTH`, `docs/lib/full-width.ts`). And the navbar's
 * content, the line under it and the footer line up with the sections' 1300px (and the shell's
 * padding, `Home.module.css`) at every width, rather than with the docs' wider layout.
 * Unlayered, these outweigh Nextra's utilities, which are in cascade layers.
 */
const HOMEPAGE_LAYOUT = `${FULL_WIDTH}
.nextra-navbar > nav, .site-subheader > p, footer.site-footer {
  max-width: calc(1300px + 4rem);
  padding-left: max(env(safe-area-inset-left), 2rem);
  padding-right: max(env(safe-area-inset-right), 2rem);
}
@media (max-width: 640px) {
  .nextra-navbar > nav, .site-subheader > p, footer.site-footer {
    max-width: calc(1300px + 2rem);
    padding-left: max(env(safe-area-inset-left), 1rem);
    padding-right: max(env(safe-area-inset-right), 1rem);
  }
}
`;

/**
 * The homepage, for Clover 4.
 *
 * Rendered from a thin `content/index.mdx` shell, so it sits in Nextra's layout, with its
 * navbar and search. Its `_meta.ts` entry turns the sidebar and the rest off
 * (`layout: "full"`), and `Home.module.css` lets it span the window.
 *
 * Two halves: the templates, live, as the hero (`<Playground/>`), and below them the same
 * resource taken apart into the parts they are made of (`<Parts/>`), following it.
 */
const Homepage: React.FC<{
  /** The parts, listed, drawn on the server (`PartsIndex.tsx`), for `Parts`. */
  partsIndex?: React.ReactNode;
}> = ({ partsIndex }) => {
  const playground = useRef<PlaygroundHandle>(null);
  const [resource, setResource] = useState<string | null>(null);
  // The playground's resource by key, for the Adaptable story's formats.
  const [resourceKey, setResourceKey] = useState<string | null>(null);
  return (
    <div className={styles.page}>
      <style>{HOMEPAGE_LAYOUT}</style>
      <Hero />

      {/* A `div`: Nextra's layout already holds the page in its one `main`. */}
      <div className={styles.shell}>
        <Playground
          ref={playground}
          onResourceChange={(next, key) => {
            setResource(next);
            setResourceKey(key);
          }}
        />

        {/*
         * "Why Clover" shares the parts' grid, beside the example viewer, which stays held
         * while its stories pass and is drawn to from each (`Parts.tsx`).
         */}
        <Parts
          index={partsIndex}
          resource={resource}
          onTry={(key) => playground.current?.pickResource(key)}
          onOpen={(content) => playground.current?.openContent(content)}
        >
          <SectionIntro
            title="Thoughtful and flexible."
            // One sentence of why, never the title's words or the stories' again (Mat, 2026-10-22).
            note="Clover is designed with the full spectrum of user experience in mind, for every visitor, every layout and every IIIF resource."
            // In the accent, the solid call to action (Mat, 2026-10-25).
            cta={{ href: "/docs", label: "Read the docs", primary: true }}
          />

          {/*
           * One story at a time, the figure on alternate sides. The words come first in
           * the page's order, the figure after them; only how they are laid out turns.
           */}
          <div className={styles.stories}>
            {stories.map((story, index) => {
              const figures = (
                <div className={styles.storyFigures}>
                  {story.figures.map((figure) => (
                    <p
                      className={styles.figure}
                      key={`${figure.flavor ?? "both"} ${figure.caption}`}
                      data-code-flavor={figure.flavor}
                    >
                      <span className={styles.figureValue}>
                        {/* The stroke under it, set as every mark's is (`.mark`), drawn once. */}
                        <Swoosh className={styles.figureMark}>
                          {figure.value}
                          {figure.unit && (
                            <span className={styles.figureUnit}>
                              {" "}
                              {figure.unit}
                            </span>
                          )}
                        </Swoosh>
                      </span>{" "}
                      <span className={styles.figureCaption}>
                        {figure.caption}
                      </span>
                    </p>
                  ))}
                </div>
              );
              return (
                <article
                  className={styles.story}
                  key={story.label}
                  data-point={story.point}
                  data-weigh={story.weigh || undefined}
                  data-turn={story.turn || undefined}
                  data-compose={story.composer || undefined}
                  data-brand={story.brand || undefined}
                  {...(story.recipe && recipeData(story.recipe))}
                  /*
                   * Adaptable on the page's ground, leading, so Accessible keeps the black
                   * it rides in (Mat, 2026-10-20 and 2026-10-25).
                   */
                  // The playground's bar is held as far as the first (Mat, 2026-10-25).
                  data-bar-until={index === 0 || undefined}
                  data-side={index % 2 ? "end" : "start"}
                  data-tone={index % 2 ? "code" : "page"}
                  // One column where it has no figures beside its words (Natural's is in them).
                  data-single={
                    (!story.figures.length && !story.formats && !story.brand) ||
                    undefined
                  }
                >
                  <div className={styles.storyText}>
                    <p className={styles.storyLabel}>{story.label}</p>
                    <h3 className={styles.storyTitle}>{story.title}</h3>
                    <p className={styles.storyBody}>{story.body}</p>
                    {/*
                     * The parts' figures, which their tags show beside the viewer (hidden
                     * from assistive technology there, as the tags are), in words.
                     */}
                    {story.weigh && (
                      <p className={styles.visuallyHidden}>
                        <Flavored
                          react={`What each part adds to a page with a Root, gzipped: ${viewerParts
                            .map((part) => `${part} ${partLoads[part]} kB`)
                            .join(", ")}.`}
                          webComponents={`What each element adds to a page with a <clover-root>, its styles with it, gzipped: ${viewerParts
                            .map(
                              (part) =>
                                `<${elementTag(part)}> ${elementLoads[part]} kB`,
                            )
                            .join(", ")}.`}
                        />
                      </p>
                    )}
                    {story.brand && figures}
                  </div>
                  {story.composer && (
                    <div className={styles.storyComposer} data-composer="" />
                  )}
                  {story.recipes && (
                    <RecipeSelect
                      current={resourceKey}
                      resource={resource}
                      onOpen={(content) => {
                        playground.current?.openContent(content);
                        /*
                         * Up to the Viewer it opens in (Mat, 2026-10-25: "make this
                         * change/submit navigate the user top"), smoothly where motion
                         * is allowed, and focus with the reader, to the playground's
                         * field, which shows it now (WCAG 2.4.3, 2.4.11).
                         */
                        const still = matchMedia(
                          "(prefers-reduced-motion: reduce)",
                        ).matches;
                        scrollTo({
                          top: 0,
                          behavior: still ? "auto" : "smooth",
                        });
                        document
                          .querySelector<HTMLInputElement>(
                            '#playground input[role="combobox"]',
                          )
                          ?.focus({ preventScroll: true });
                      }}
                      // Staged as the example viewer shows it, never opened unasked.
                      staged={story.recipe?.resource}
                    />
                  )}
                  {/*
                   * Seamless's controls where the others' figures are, its code under its
                   * words, after them in the page's order, as what they write.
                   */}
                  {story.brand ? (
                    <>
                      <BrandControls />
                      <BrandCode />
                    </>
                  ) : story.formats ? (
                    <FormatPicker
                      chosen={resourceKey}
                      onPick={(key) => playground.current?.pickResource(key)}
                    />
                  ) : story.figures.length ? (
                    figures
                  ) : null}
                </article>
              );
            })}
          </div>

          {/*
           * Install, last in the stories' column, beside the held viewer: the room the
           * viewer needs to stay held while Natural reads its recipe, put to use.
           */}
          <SectionIntro
            title="Install is easy."
            note="Use it in React or as web components, and you’re up and running in seconds."
            cta={{ href: "/docs", label: "Get started", primary: true }}
            beside={<InstallCommand />}
          />
        </Parts>
      </div>
    </div>
  );
};

export default Homepage;
