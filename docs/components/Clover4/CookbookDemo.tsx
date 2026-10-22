"use client";

import React from "react";
import dynamic from "next/dynamic";

import CookbookCoverageTable, {
  StatusIcon,
} from "docs/components/CookbookRecipes/CookbookCoverageTable";
import ViewerDemo from "docs/components/CookbookRecipes/ViewerDemo";
import {
  recipeBase,
  resourceFor,
  statusFor as status3x,
  type Status,
} from "docs/components/CookbookRecipes/cookbookCatalog";
import { cookbookSections } from "docs/components/CookbookRecipes/cookbookSections";
import {
  CHECKED,
  progressFor,
} from "docs/components/CookbookRecipes/progress4";
import table from "docs/components/CookbookRecipes/CookbookCoverageTable.module.css";
import styles from "docs/components/Clover4/CookbookDemo.module.css";

/** Clover 4's Viewer, in its Default template, on the client. */
const Viewer = dynamic(
  () => import("@nulib/clover").then((clover) => clover.default),
  { ssr: false },
);

/** Loads Clover 4 and its Default template ahead of a click. */
const preload = () => {
  import("@nulib/clover").catch(() => undefined);
  import("@nulib/clover/templates").catch(() => undefined);
};

/**
 * A resource in the panel: the Viewer filling what the panel's header leaves (`fill`),
 * so its thumbnail strip is never below the fold.
 */
const renderViewer = (resource: string) => (
  <div className={styles.viewer}>
    <Viewer key={resource} iiifContent={resource} fill />
  </div>
);

/**
 * The Cookbook recipes page: every IIIF Cookbook recipe to open in the Viewer, which
 * slides in over the page. Each recipe is listed whether Clover 4 handles it yet or not;
 * how far it does is on the unlisted progress page. The homepage is the demo, with its
 * own field for any resource, so this page has none.
 */
export function Cookbook4Demo({ children }: { children?: React.ReactNode }) {
  return (
    <ViewerDemo
      field={false}
      featured={false}
      renderViewer={renderViewer}
      preload={preload}
      renderRecipes={(onView, onPreload) => (
        <CookbookCoverageTable
          onView={onView}
          onPreload={onPreload}
          showStatus={false}
          // Under the page's own title, an h1.
          headingLevel={2}
        />
      )}
    >
      {children}
    </ViewerDemo>
  );
}

const statusName: Record<Status, string> = {
  yes: "handled",
  partial: "in part",
  no: "not yet",
};

const recipes = cookbookSections.flatMap((section) => section.recipes);
const counts = (["yes", "partial", "no"] as Status[]).map(
  (status) =>
    [
      status,
      recipes.filter((recipe) => progressFor(recipe.slug).status === status)
        .length,
    ] as const,
);
/** Handled by 3.x and not by 4: the first to look at. */
const regressions = recipes.filter(
  (recipe) =>
    status3x(recipe.slug) === "yes" &&
    progressFor(recipe.slug).status !== "yes",
);

const ProgressTable = React.memo(function ProgressTable({
  onView,
  onPreload,
}: {
  onView: (resource: string) => void;
  onPreload: () => void;
}) {
  return (
    <div className={styles.progress}>
      <p className={table.summary}>
        Clover 4, checked {CHECKED}:{" "}
        {counts.map(([status, count], n) => (
          <React.Fragment key={status}>
            {n > 0 && ", "}
            <strong>{count}</strong> {statusName[status]}
          </React.Fragment>
        ))}{" "}
        of {recipes.length}.
        {regressions.length > 0 && (
          <>
            {" "}
            {regressions.length} that 3.x handles are not fully handled yet:{" "}
            {regressions.map((recipe) => recipe.slug.slice(0, 4)).join(", ")}.
          </>
        )}
      </p>
      {cookbookSections.map((section) => (
        <section key={section.title}>
          <h4 className={table.sectionTitle}>{section.title}</h4>
          <table>
            <thead>
              <tr>
                <th scope="col">4.x</th>
                <th scope="col">3.x</th>
                <th scope="col">Recipe</th>
                <th scope="col">What is missing</th>
                <th scope="col">Demo</th>
              </tr>
            </thead>
            <tbody>
              {section.recipes.map((recipe) => {
                const { status, note } = progressFor(recipe.slug);
                const resource = resourceFor(recipe.slug);
                return (
                  <tr key={recipe.slug} data-status={status}>
                    <td>
                      <StatusIcon status={status} />
                    </td>
                    <td>
                      <StatusIcon status={status3x(recipe.slug)} />
                    </td>
                    <td>
                      {recipe.title}
                      <span className={table.slug}>{recipe.slug}</span>
                    </td>
                    <td className={styles.note}>{note}</td>
                    <td>
                      <div className={table.actions}>
                        <button
                          type="button"
                          className={table.view}
                          aria-label={`View ${recipe.title}`}
                          disabled={!resource}
                          onClick={() => resource && onView(resource)}
                          onPointerEnter={onPreload}
                          onFocus={onPreload}
                        >
                          View
                        </button>
                        <a
                          className={table.view}
                          href={`${recipeBase}${recipe.slug}/`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${recipe.title} recipe on iiif.io (opens in a new tab)`}
                        >
                          Recipe
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
});

/**
 * The unlisted progress page: each recipe's status in Clover 4 beside 3.x's, what is
 * missing, and the recipe to open and check.
 */
export function Cookbook4Progress({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <ViewerDemo
      renderViewer={renderViewer}
      preload={preload}
      featured={false}
      renderRecipes={(onView, onPreload) => (
        <ProgressTable onView={onView} onPreload={onPreload} />
      )}
    >
      {children}
    </ViewerDemo>
  );
}
