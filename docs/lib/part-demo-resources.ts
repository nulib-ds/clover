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
   * The IIIF Cookbook's recipe 0002 in Presentation 4 (not a mock): one Timeline, its sound
   * an `Audio` body, for `Timeline`.
   */
  audio: "https://iiif.io/api/cookbook/recipe/0002-mvm-audio/v4/manifest.json",
  /**
   * The IIIF Cookbook's recipe 0608 in Presentation 4 (not a mock): one Scene painting a
   * glTF model at its origin, for `Scene`.
   */
  model: "https://iiif.io/api/cookbook/recipe/0608-mvm-3d/v4/manifest.json",
} as const;

export type PartDemoResource = keyof typeof RESOURCES;
