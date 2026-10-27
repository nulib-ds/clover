"use client";

import React from "react";

import { PartDemo } from "docs/components/Clover4/PartDemo";
import { Live } from "docs/components/Clover4/ViewerDocs";
import { EXAMPLE, example } from "docs/lib/example";

import styles from "./SearchCompare.module.css";

/**
 * Search two ways, side by side, to talk them through (Mat, 2026-10-26): the part on its
 * own under a Body, as its docs page shows it, and the Viewer's Default template, where
 * it is a section of the Panel. Both over the newspaper mock, searched for "Moskau".
 */
export function SearchCompare() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Search, two ways</h1>
      <div className={styles.row}>
        <section className={styles.column} aria-labelledby="search-part">
          <h2 id="search-part" className={styles.heading}>
            <code>{"<Clover.Search />"}</code> under a Body
          </h2>
          <div className={styles.frame} {...example(EXAMPLE)}>
            <PartDemo
              part="Search"
              resource="search"
              props={{ headingLevel: 3 }}
              body
              height={480}
              rootProps={{ searchQuery: "Moskau" }}
            />
          </div>
        </section>
        <section className={styles.column} aria-labelledby="search-viewer">
          <h2 id="search-viewer" className={styles.heading}>
            <code>{"<Viewer />"}</code>, Default template, its Panel&rsquo;s
            Search
          </h2>
          <div className={styles.frame} {...example(EXAMPLE)}>
            <Live
              resource="search"
              props={{ searchQuery: "Moskau" }}
              headingLevel={3}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
