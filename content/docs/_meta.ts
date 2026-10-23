import type { MetaRecord } from "nextra";

/*
 * Mocks is for those writing Clover, and never in the menu (Mat, 2026-10-20): its page
 * stays at /docs/mocks, linked from the Components pages whose examples use a mock, as
 * the Cookbook's recipes are from the Viewer's, and every mock is still documented on it
 * (AGENTS.md).
 */
/*
 * The Components pages read as Radix Themes' component pages do (Mat, 2026-10-21): no
 * table of contents, so their examples have the page's width, and no breadcrumb over
 * their title (Mat, 2026-10-22), whose look keys on its absence (`layout.css`).
 */
const reference = (title: string) => ({
  title,
  theme: { toc: false, breadcrumb: false },
});

const meta: MetaRecord = {
  "--viewer": {
    type: "separator",
    title: "Use Clover",
  },
  index: "Get started",
  // No table of contents: its examples need the width, as Radix Themes' pages give theirs.
  viewer: {
    title: "Viewer",
    theme: {
      toc: false,
    },
  },
  composing: "Composing layouts",
  cookbook: {
    title: "Cookbook recipes",
    theme: {
      toc: false,
    },
  },
  "--components": {
    type: "separator",
    title: "Components",
  },
  body: reference("Body"),
  canvas: reference("Canvas"),
  items: reference("Items"),
  panel: reference("Panel"),
  annotations: reference("Annotations"),
  collection: reference("Collection"),
  contents: reference("Contents"),
  search: reference("Search"),
  transcript: reference("Transcript"),
  download: reference("Download"),
  map: reference("Map"),
  // The folder's pages too: a folder's theme carries to them.
  primitives: reference("Primitives"),
  "--contribute": {
    type: "separator",
    title: "Contribute",
  },
  i18n: "i18n",
  mocks: { title: "Mocks", display: "hidden" },
  "--earlier": {
    type: "separator",
    title: "Earlier versions",
  },
  "3.x": "Clover 3.x",
};

export default meta;
