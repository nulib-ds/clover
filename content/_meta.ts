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
  docs: {
    title: "Documentation",
    type: "page",
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
