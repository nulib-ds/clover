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
  index: "Get started",
  viewer: "Viewer",
  composing: "Composing",
  styling: "Styling",
  technical: "Technical overview",
  // Hidden for now (Mat, 2026-10-26): out of the menu and of search, at its address still.
  agents: { title: "Build with an agent", display: "hidden" },
  "--components": {
    type: "separator",
    title: "Components",
  },
  body: "Body",
  canvas: "Canvas",
  timeline: "Timeline",
  scene: "Scene",
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
