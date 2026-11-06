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
  // After Styling (Mat, 2026-11-05: "move this under styling"), under Technical before.
  // "Internationalization" in the menu, "Internationalization (i18n)" its title (Mat,
  // 2026-11-05); its address stays.
  i18n: "Internationalization",
  // Under i18n (Mat, 2026-11-05: "Move Content State under i18n"), under Technical before.
  "content-state": "Content State",
  // Hidden for now (Mat, 2026-10-26): out of the menu and of search, at its address still.
  agents: { title: "Build with an agent", display: "hidden" },
  // Hidden, and before the Components, which the menu's readers count to the next
  // separator (`counts.ts`, `catalog.test.ts`).
  mocks: { title: "Mocks", display: "hidden" },
  "--components": {
    type: "separator",
    title: "Components",
  },
  root: "Root",
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
  // The Technical group and its Overview went on 2026-11-05 (Mat: "move this to Glossary,
  // at the very bottom"): the package's structure ends the Glossary.
  "--earlier": {
    type: "separator",
    title: "Deprecated versions",
  },
  upgrading: "Upgrading",
  "deprecated-versions": "Clover 3.x",
};

export default meta;
