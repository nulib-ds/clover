import React from "react";
import { useMDXComponents as getThemeComponents } from "nextra-theme-docs";

import styles from "./ProjectStructure.module.css";

/** A link drawn as the page's Markdown draws one: the accent, underlined (WCAG 1.4.1). */
const Link = getThemeComponents().a as React.ComponentType<
  React.ComponentProps<"a">
>;

/** One entry point of the package: its name under the one above it, and what it holds. */
type Entry = { name: string; note: React.ReactNode; entries?: Entry[] };

const code = (text: string) => <code className="nextra-code">{text}</code>;

/*
 * What `@nulib/clover` exports (its `package.json`'s `exports`), as a file tree: each
 * path under the one it extends, `@nulib/clover/web-components/viewer` under
 * `web-components` under the package.
 */
const PACKAGE: Entry = {
  name: "@nulib/clover",
  note: (
    <>
      The <Link href="/docs/viewer">Viewer</Link> (the default export), and
      every component, hook and helper (named).
    </>
  ),
  entries: [
    {
      name: "templates",
      note: (
        <>
          The <Link href="/docs/viewer#templates">templates</Link>, and the{" "}
          <Link href="/docs/composing/helpers#templates">
            helpers they share
          </Link>
          .
        </>
      ),
    },
    {
      name: "map",
      note: (
        <>
          <Link href="/docs/map">{code("Map")}</Link> and its{" "}
          <Link href="/docs/composing/helpers#maps">helpers</Link>, as{" "}
          {code("@nulib/clover")} exports them ({code("Clover.Map")}).
        </>
      ),
    },
    {
      name: "three",
      note: (
        <>
          {code("registerThreeEngine")}, to draw a{" "}
          <Link href="/docs/scene">Scene</Link> with three.js, which you
          install.
        </>
      ),
    },
    {
      name: "web-components",
      note: (
        <>
          {code("<clover-viewer>")}, and{" "}
          <Link href="#core-components">every component as an element</Link>,
          for a page without React.
        </>
      ),
      entries: [
        {
          name: "viewer",
          note: (
            <>
              {code("<clover-viewer>")} alone, built whole, for a page that
              shows a Viewer and nothing else of Clover&apos;s.
            </>
          ),
        },
        {
          name: "three",
          note: (
            <>
              three.js for the elements&apos;{" "}
              <Link href="/docs/scene">Scene</Link>, bundled.
            </>
          ),
        },
        {
          name: "custom-elements.json",
          note: "Each element's attributes, properties and events, for editors and tools.",
        },
      ],
    },
    {
      name: "styles.css",
      note: (
        <>
          Every component&apos;s styles, and the {code("Default")}{" "}
          template&apos;s.
        </>
      ),
    },
    {
      name: "styles/*.css",
      note: (
        <>
          The same styles a component at a time (
          <Link href="/docs/styling#stylesheets">Styling</Link>).
        </>
      ),
    },
    { name: "templates.css", note: "The other templates' styles." },
    {
      name: "base.css",
      note: (
        <>
          For a look of your own, in place of Clover&apos;s styles: the
          structure of every component and template (
          <Link href="/docs/styling#base-styling">Base styling</Link>
          ).
        </>
      ),
    },
    {
      name: "spacing.css",
      note: "Margins, paddings and gaps, after base.css.",
    },
  ],
};

function Item({ entry }: { entry: Entry }) {
  return (
    <li className={styles.item}>
      <span className={styles.row}>
        <code className={styles.name}>{entry.name}</code>
        <span className={styles.note}>{entry.note}</span>
      </span>
      {entry.entries ? (
        <ul role="list" className={styles.list}>
          {entry.entries.map((each) => (
            <Item key={each.name} entry={each} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * The package's structure, as a file tree (Mat, 2026-11-05: "make this look more like a
 * file tree. let's call it Structure of Project"): a nested list, so its nesting is read
 * as well as seen (WCAG 1.3.1), `role="list"` kept where Safari would drop it for a list
 * drawn without markers, each name in the code's face and its note beside it.
 *
 * ```mdx
 * <ProjectStructure />
 * ```
 */
export function ProjectStructure() {
  return (
    <div className={styles.tree}>
      <ul role="list" className={styles.root}>
        <Item entry={PACKAGE} />
      </ul>
    </div>
  );
}
