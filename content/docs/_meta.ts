import type { MetaRecord } from "nextra";

/*
 * Mocks is for those writing Clover, and never in the menu (Mat, 2026-10-20): its page
 * stays at /docs/mocks, linked from the Components pages whose examples use a mock, as
 * the Cookbook's recipes are from the Viewer's, and every mock is still documented on it
 * (AGENTS.md).
 */
const meta: MetaRecord = {
  "--viewer": {
    type: "separator",
    title: "Use Clover",
  },
  index: "Get Started",
  viewer: "Viewer",
  composing: "Composing Layouts",
  cookbook: {
    title: "Cookbook Recipes",
    theme: {
      toc: false,
    },
  },
  "--components": {
    type: "separator",
    title: "Components",
  },
  content: "Content",
  canvas: "Canvas",
  items: "Items",
  panel: "Panel",
  annotations: "Annotations",
  collection: "Collection",
  contents: "Contents",
  search: "Search",
  transcript: "Transcript",
  download: "Download",
  map: "Map",
  primitives: "Primitives",
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
