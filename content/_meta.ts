import type { MetaRecord } from "nextra";

const meta: MetaRecord = {
  index: {
    type: "page",
    title: "Clover IIIF",
    display: "hidden",
    theme: {
      layout: "full",
      sidebar: false,
      toc: false,
      breadcrumb: false,
      pagination: false,
      timestamp: false,
      copyPage: false,
    },
  },
  /*
   * Every docs page reads as the Components pages do, as Radix Themes' component pages
   * do (Mat, 2026-10-21 and 2026-10-23: "remove breadcrumbs EVERYWHERE", "remove
   * sidebars everywhere"): no table of contents, so the page has its width, and no
   * breadcrumb over its title. The folder's theme carries to every page in it.
   */
  docs: {
    title: "Documentation",
    type: "page",
    theme: { toc: false, breadcrumb: false },
  },
  test: {
    type: "page",
    title: "Test pages",
    display: "hidden",
    theme: {
      layout: "full",
      sidebar: false,
      toc: false,
      breadcrumb: false,
      pagination: false,
      timestamp: false,
      copyPage: false,
    },
  },
};

export default meta;
