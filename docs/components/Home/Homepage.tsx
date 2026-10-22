"use client";

import Playground, {
  type PlaygroundHandle,
} from "docs/components/Playground/Playground";
import React, { useRef, useState } from "react";
import Hero from "docs/components/Home/Hero";
import Link from "next/link";
import Parts from "docs/components/Home/Parts";
import styles from "docs/components/Home/Home.module.css";
import { cookbookSections } from "docs/components/CookbookRecipes/cookbookSections";
import { resourceFor } from "docs/components/CookbookRecipes/cookbookCatalog";
import { cookbook, loads, partCount, partLoads } from "docs/lib/figures";
import { FULL_WIDTH } from "docs/lib/full-width";
import { BrandCode, BrandControls } from "docs/components/Home/BrandPicker";
import { InstallCommand } from "docs/components/Home/InstallCommand";
import { SectionIntro } from "docs/components/Home/SectionIntro";

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
  title: string;
  body: React.ReactNode;
  /** A figure, and its unit (`kB`), which is set smaller than it. */
  figures: { value: string; unit?: string; caption: string }[];
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
}

const stories: Story[] = [
  {
    label: "Accessible",
    // The viewer turned over: what assistive technology is given, and the tab order.
    point: "viewer",
    turn: true,
    title: "Made for everyone.",
    body: "Clover is designed with every person in mind. It aims for a high level of accessibility, with WAI-ARIA patterns that screen readers understand, colors that meet contrast rules, and controls that work from the keyboard alone.",
    figures: [
      // Mat's call, 2026-10-21, knowing ACCESSIBILITY.md's open items: close them to keep it true.
      { value: "2.2 AA", caption: "WCAG level compliant" },
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
    body: "No font of its own. No base size. Clover takes yours. Its colors are CSS custom properties, so your brand is one line away.",
    figures: [
      { value: "1rem", caption: "yours, the size every space steps from" },
      { value: "CSS", caption: "variables for simple styling" },
    ],
  },
  {
    label: "Composable",
    // A layout of parts: the whole viewer, every part of it outlined.
    point: "viewer",
    title: "Compose your own.",
    body: "Every template is built from the same components you see here, so yours can be too.",
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
        caption: "Viewer (Default template)",
      },
    ],
  },
  {
    label: "Coverage",
    /*
     * Cookbook 0032, a Collection, read by the same Label, Content, Metadata and
     * Collection (Mat, 2026-10-21), the line drawn to the Collection.
     */
    point: "collection",
    recipe: {
      slug: "0032-collection",
      resource:
        "https://iiif.io/api/cookbook/recipe/0032-collection/collection.json",
    },
    title: "Reads the Cookbook.",
    body: (
      <>
        Clover 4 is checked against every recipe in the IIIF Cookbook, from a
        single image to annotations on film. Last checked {cookbook.checked}.{" "}
        <Link href="/docs/cookbook">Open each one in the Viewer</Link>.
      </>
    ),
    // What Clover handles, with no total and no count in part (Mat, 2026-10-21).
    figures: [
      {
        value: String(cookbook.handled),
        caption: "IIIF Cookbook recipes handled",
      },
    ],
  },
];

/*
 * Nextra's chrome, as the homepage needs it, in rules drawn with the page and gone with it
 * (a `<style>` it renders, no `:has()` on the page's ancestors, `full-width.ts`).
 *
 * The page spans the window (`FULL_WIDTH`, `docs/lib/full-width.ts`). And the navbar's
 * content, the line under it and the footer line up with the sections' 1300px (and the shell's
 * padding, `Home.module.css`) at every width, rather than with the docs' wider layout.
 * Unlayered, these outweigh Nextra's utilities, which are in cascade layers.
 */
const HOMEPAGE_CHROME = `${FULL_WIDTH}
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
  return (
    <div className={styles.page}>
      <style>{HOMEPAGE_CHROME}</style>
      <Hero />

      {/* A `div`: Nextra's layout already holds the page in its one `main`. */}
      <div className={styles.shell}>
        <Playground
          ref={playground}
          onResourceChange={(next) => setResource(next)}
        />

        {/*
         * "Why Clover" shares the parts' grid, beside the example viewer, which stays held
         * while its stories pass and is drawn to from each (`Parts.tsx`).
         */}
        <Parts
          index={partsIndex}
          resource={resource}
          onTry={(key) => playground.current?.pickResource(key)}
        >
          <SectionIntro
            title="Why Clover."
            // The five stories in brief, a sentence each, in their order (Mat, 2026-10-21).
            note="Accessible to everyone. Seamless with your brand. Composable from parts. Quick to load. Checked against the Cookbook."
            cta={{ href: "/docs", label: "Read the docs" }}
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
                    <p className={styles.figure} key={figure.caption}>
                      <span className={styles.figureValue}>
                        {/* The stroke under it, set as every mark's is (`.mark`). */}
                        <span className={styles.figureMark}>
                          {figure.value}
                          {figure.unit && (
                            <span className={styles.figureUnit}>
                              {" "}
                              {figure.unit}
                            </span>
                          )}
                        </span>
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
                  data-side={index % 2 ? "start" : "end"}
                  // Black first, so Accessible rides in it (Mat, 2026-10-20).
                  data-tone={index % 2 ? "page" : "code"}
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
                        {`What each part adds to a page with a Root, gzipped: ${Object.entries(
                          partLoads,
                        )
                          .map(([part, size]) => `${part} ${size} kB`)
                          .join(", ")}.`}
                      </p>
                    )}
                    {story.brand && figures}
                  </div>
                  {story.composer && (
                    <div className={styles.storyComposer} data-composer="" />
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
                  ) : (
                    figures
                  )}
                </article>
              );
            })}
          </div>

          {/*
           * Install, last in the stories' column, beside the held viewer: the room the
           * viewer needs to stay held while Coverage reads its recipe, put to use.
           */}
          <SectionIntro
            title="Install is easy."
            note="One package holds it all: the React parts and the web components."
            cta={{ href: "/docs", label: "Get started", primary: true }}
          />
          <InstallCommand />
        </Parts>
      </div>
    </div>
  );
};

export default Homepage;
