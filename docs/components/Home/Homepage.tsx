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
import {
  CHECKED,
  progressFor,
} from "docs/components/CookbookRecipes/progress4";
import { partCount } from "docs/components/Home/counts";
import { BrandPicker } from "docs/components/Home/BrandPicker";
import sizes from "../../../packages/clover/build/sizes.json";

/*
 * Every figure here is the code's own, never a claim. The sizes are measured: what a
 * consumer ships, gzipped, as the package's build records it
 * (`packages/clover/build/sizes.json`, from `build/sizes.mjs`). `npm run build:docs`
 * builds the package first, so the published page shows the sizes of the commit it was
 * built from; `npm run dev` shows the last recorded. The components are the docs'
 * Components menu (`counts.ts`), and the Cookbook's
 * count the progress record (`progress4.ts`).
 */
/* A size in kB, to the tenth (Mat, 2026-10-20), as `npm run test:build` reports it. */
const kB = (bytes: number) => (bytes / 1000).toFixed(1);
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

const recipes = cookbookSections.flatMap((section) => section.recipes);
const handled = recipes.filter(
  (recipe) => progressFor(recipe.slug).status === "yes",
).length;
const inPart = recipes.filter(
  (recipe) => progressFor(recipe.slug).status === "partial",
).length;
const checked = new Date(`${CHECKED}T12:00:00Z`).toLocaleDateString("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

interface Story {
  label: string;
  /**
   * The one part of the example viewer beside it that it is about (its `data-part`), or
   * `viewer` for the whole of it, which it outlines and draws its line to while it is in
   * the middle of the window (`StoryLines.tsx`).
   */
  point: string;
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
   * Whether the site's Font family and Color are drawn under its words, setting
   * the whole site, with the CSS a page would write (`BrandPicker.tsx`); as the story
   * passes, the site shows another brand a while (`data-brand`, `PartsLive.tsx`).
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
    body: "Built on WAI-ARIA's patterns, part by part. Every control works from the keyboard, with a name for screen readers. Text reflows and resizes. Focus stays in sight. Motion only when the reader wants it.",
    figures: [
      { value: "2.2 AA", caption: "the WCAG level every part is held to" },
    ],
  },
  {
    label: "Yours",
    // The whole viewer, its right edge: all of it takes the page's brand.
    point: "viewer",
    brand: true,
    title: "Inherits your brand.",
    body: "No font of its own. No base size. Clover takes yours. Its colors are CSS custom properties, so your brand is one line away.",
    figures: [
      { value: "1rem", caption: "yours, the size every space steps from" },
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
        caption: "IIIF-focused components to compose with",
      },
    ],
    composer: true,
  },
  {
    label: "Light",
    // The Canvas, whose renderer is Clover's own.
    point: "content",
    title: "Ships only what you draw.",
    body: "A page carries its template and the parts it uses. Nothing more. Maps, video streaming, and the sanitizer load the first time they're needed. And a renderer of its own replaces OpenSeadragon.",
    figures: [
      {
        value: kB(sizes.viewerShellGzip),
        unit: "kB",
        caption: "the Viewer, before its template",
      },
      {
        value: kB(sizes.canvasInitialGzip),
        unit: "kB",
        caption: "a Canvas: images, video, and sound",
      },
      {
        value: kB(sizes.defaultTemplateGzip),
        unit: "kB",
        caption: "the Viewer with its Default template",
      },
    ],
  },
  {
    label: "Coverage",
    // Cookbook 0261, a polygon annotation, read by the same Content and Annotations.
    point: "annotations",
    recipe: { slug: "0261-non-rectangular-commenting" },
    title: "Reads the Cookbook.",
    body: (
      <>
        Clover 4 is checked against every recipe in the IIIF Cookbook, from a
        single image to annotations on film. Last checked {checked}.{" "}
        <Link href="/docs/cookbook">Open each one in the Viewer</Link>.
      </>
    ),
    figures: [
      {
        value: String(handled),
        caption: `of ${recipes.length} IIIF Cookbook recipes, handled`,
      },
      { value: String(inPart), caption: "more, in part" },
    ],
  },
];

/**
 * The homepage, for Clover 4.
 *
 * Rendered from a thin `content/index.mdx` shell, so it sits in Nextra's layout, with its
 * navbar, search, theme toggle and banner. Its `_meta.ts` entry turns the sidebar and the
 * rest off (`layout: "full"`), and `Home.module.css` lets it span the window.
 *
 * Two halves: the templates, live, as the hero (`<Playground/>`), and below them the same
 * resource taken apart into the parts they are made of (`<Parts/>`), following it.
 */
const Homepage: React.FC = () => {
  const playground = useRef<PlaygroundHandle>(null);
  const [resource, setResource] = useState<string | null>(null);
  return (
    <div className={styles.page}>
      <Hero />

      <main className={styles.shell}>
        <Playground
          ref={playground}
          onResourceChange={(next) => setResource(next)}
        />

        {/*
         * "Why Clover" shares the parts' grid, beside the example viewer, which stays held
         * while its stories pass and is drawn to from each (`Parts.tsx`).
         */}
        <Parts
          resource={resource}
          onTry={(key) => playground.current?.pickResource(key)}
        >
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>Why Clover</h2>
              <p className={styles.sectionNote}>
                Reads IIIF Presentation 2, 3, and 4. From the parts up.
              </p>
            </div>
            <Link href="/docs" className={styles.sectionLink}>
              Read the docs →
            </Link>
          </div>

          {/*
           * One story at a time, the figure on alternate sides. The words come first in
           * the page's order, the figure after them; only how they are laid out turns.
           */}
          <div className={styles.stories}>
            {stories.map((story, index) => (
              <article
                className={styles.story}
                key={story.label}
                data-point={story.point}
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
                  {story.brand && <BrandPicker />}
                </div>
                {story.composer && (
                  <div className={styles.storyComposer} data-composer="" />
                )}
                <div className={styles.storyFigures}>
                  {story.figures.map((figure) => (
                    <p className={styles.figure} key={figure.caption}>
                      <span className={styles.figureValue}>
                        {figure.value}
                        {figure.unit && (
                          <span className={styles.figureUnit}>
                            {" "}
                            {figure.unit}
                          </span>
                        )}
                      </span>{" "}
                      <span className={styles.figureCaption}>
                        {figure.caption}
                      </span>
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </Parts>

        <div className={styles.contained}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>Install</h2>
              <p className={styles.sectionNote}>
                Clover 4 is in development and not on npm yet. The released
                Clover is <Link href="/docs/3.x">3.x</Link>,{" "}
                <code>@samvera/clover-iiif</code>.
              </p>
            </div>
          </div>

          <div className={styles.install}>
            <code className={styles.installCode}>
              npm install @nulib/clover
            </code>
            <Link href="/docs" className="cta-solid">
              Get started
              <span className="cta-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Homepage;
