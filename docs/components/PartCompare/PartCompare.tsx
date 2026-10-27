"use client";

import React from "react";

import { PartDemo } from "docs/components/Clover4/PartDemo";
import { Live } from "docs/components/Clover4/ViewerDocs";
import { EXAMPLE, example } from "docs/lib/example";
import type { PartDemoResource } from "docs/lib/part-demo-resources";

import styles from "./PartCompare.module.css";

/** A test page of comparisons, each a part two ways, stacked (`PartCompare`). */
export function ComparePage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      {children}
    </div>
  );
}

/**
 * A part two ways, side by side, to talk it through (Mat, 2026-10-26): on its own under a
 * Body, as its docs page shows it, and in the Viewer's Default template, where it is a
 * section of the Panel. Both over the same mock; for the test pages under `/test/`.
 */
export function PartCompare({
  part,
  resource,
  viewer = resource,
  props,
  rootProps,
}: {
  /** The part, as `@nulib/clover` exports it. */
  part: string;
  /** The mock the part reads (`part-demo-resources.ts`). */
  resource: PartDemoResource;
  /** The same mock, as the Viewer's examples name it (the playground's keys). */
  viewer?: string;
  /** The part's own props: Search's `headingLevel`, say. */
  props?: Record<string, string | number | boolean>;
  /** The Root's and the Viewer's own props: a `searchQuery`, say. */
  rootProps?: Record<string, string | number | boolean>;
}) {
  const id = `compare-${part.toLowerCase()}`;
  return (
    <section className={styles.pair} aria-labelledby={id}>
      <h2 id={id} className={styles.subtitle}>
        {part}, two ways
      </h2>
      <div className={styles.row}>
        <section className={styles.column} aria-labelledby={`${id}-part`}>
          <h3 id={`${id}-part`} className={styles.heading}>
            <code>{`<Clover.${part} />`}</code> under a Body
          </h3>
          <div className={styles.frame} {...example(EXAMPLE)}>
            <PartDemo
              part={part as never}
              resource={resource}
              props={props}
              body
              height={480}
              rootProps={rootProps}
            />
          </div>
        </section>
        <section className={styles.column} aria-labelledby={`${id}-viewer`}>
          <h3 id={`${id}-viewer`} className={styles.heading}>
            <code>{"<Viewer />"}</code>, Default template, its Panel&rsquo;s{" "}
            {part}
          </h3>
          <div className={styles.frame} {...example(EXAMPLE)}>
            <Live resource={viewer} props={rootProps} headingLevel={4} />
          </div>
        </section>
      </div>
    </section>
  );
}
