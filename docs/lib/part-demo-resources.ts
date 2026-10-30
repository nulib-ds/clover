/**
 * The mocks a part demo can be shown on, and what each has (`/docs/mocks`): read by the
 * demos (`PartDemo.tsx`, `LiveCode.tsx`), by the live examples' code on the server
 * (`LiveExample.tsx`), and by the examples' HTML (`example-urls.mjs`, which reads this
 * declaration as it is written). A path is under the site's `/mocks/`.
 */
export const RESOURCES = {
  /** The White catalog: every descriptive property, Ranges, tagged plates, a Collection. */
  paged: "paged/manifest.json",
  /** The Curtis photogravure: words on the plate tagged, a Canvas summary. */
  tagging: "tagging/manifest.json",
  /** The Sullivan slide: navPlace. */
  navplace: "navplace/manifest.json",
  /** _Lunchroom Manners_: captions and a plain-text transcript (the Canvas's `rendering`). */
  transcripts: "transcripts/manifest.json",
  /** The Nuremberg reel: chapters, captions, tracked annotations. */
  footage: "rudolf-hess-nuremberg/manifest.json",
  /** A two-page newspaper with a Content Search service, answered in the browser. */
  search: "content-search/manifest.json",
  /** The newspaper with each page's OCR as a plain-text `rendering`. */
  "page-transcript": "page-transcript/manifest.json",
  /** The one Canvas of Borghi's map of the British Isles, published on its own: for `Canvas`. */
  "standalone-canvas": "standalone-canvas/canvas.json",
  /**
   * Northwestern's "Commedia dell'Arte: The Masks of Antonio Fava", nine Manifests, from
   * the DC API (not a mock): a Collection, for the parts that need one, as Items' page
   * shows it.
   */
  collection:
    "https://api.dc.library.northwestern.edu/api/v2/collections/c373ecd2-2c45-45f2-9f9e-52dc244870bd?as=iiif",
  /**
   * An Arabic manuscript of about 1800, as Northwestern's Maktaba publishes it (not a
   * mock): each page's Arabic text and its English translation, one annotation each, for
   * Annotations' languages (Mat, 2026-10-25), as the homepage's Text is.
   */
  manuscript:
    "https://iiif-maktaba.dc.library.northwestern.edu/dc8ff749-adad-42a7-81e0-0eb473ef88a5.json",
  /**
   * Northwestern's Hindenburg broadcast, its reel's box accompanying the sound, for
   * `Timeline`, as the homepage's Recording is (Mat, 2026-10-24). A Presentation 3 Canvas
   * of sound, which Clover upgrades to a Timeline.
   */
  audio: "hindenburg/manifest.json",
  /**
   * The IIIF Cookbook's recipe 0608 in Presentation 4 (not a mock): one Scene painting a
   * glTF model at its origin, for `Scene`.
   */
  model: "https://iiif.io/api/cookbook/recipe/0608-mvm-3d/v4/manifest.json",
  /**
   * The IIIF Cookbook's recipe 0006 (not a mock): a Manifest saying everything of itself
   * in English and French, for the languages About's heading offers.
   */
  languages:
    "https://iiif.io/api/cookbook/recipe/0006-text-language/manifest.json",
  /**
   * The IIIF Cookbook's recipe 0025 (not a mock): a newspaper whose Ranges are its
   * articles, each in columns, one on page 2 and then page 5, for Contents' parts.
   */
  articles:
    "https://iiif.io/api/cookbook/recipe/0025-newspaper-article-index/manifest.json",
  /**
   * The IIIF Cookbook's recipe 0309 (not a mock): a newspaper's layout markup, its pages
   * of tags on two Canvases part of one AnnotationCollection, for `Items of="annotations"`.
   */
  layers:
    "https://iiif.io/api/cookbook/recipe/0309-annotation-collection/manifest.json",
} as const;

export type PartDemoResource = keyof typeof RESOURCES;
