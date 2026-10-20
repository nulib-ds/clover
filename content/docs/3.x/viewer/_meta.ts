import type { MetaRecord } from "nextra";

const meta: MetaRecord = {
  demo: {
    title: "Demo",
    theme: {
      toc: false,
    },
  },
  contentsearch: {
    display: "hidden",
    title: "Content Search",
    theme: {
      sidebar: false,
      layout: "full",
    },
  },
  "content-state": {
    theme: {
      layout: "full",
      sidebar: false,
    },
    title: "Content State",
  },
  prefetched: {
    display: "hidden",
    theme: {
      layout: "full",
      sidebar: false,
    },
    title: "Prefetched Content",
  },
};

export default meta;
