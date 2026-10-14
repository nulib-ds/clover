// Recipe list and grouping mirror https://iiif.io/api/cookbook/ (checked 2026-10-08).
// Whether Clover covers a recipe comes from `supported` in docs/fixtures/iiif-cookbook/recipes.json;
// `partial` and `notes` below only qualify that.

export interface CookbookSection {
  title: string;
  recipes: { slug: string; title: string; versions: number[] }[];
}

export const cookbookSections: CookbookSection[] = [
  {
    title:
      "Building a manifest in stages, adding more complexity at each stage",
    recipes: [
      {
        slug: "0001-mvm-image",
        title: "Simplest Manifest - Image",
        versions: [3, 4],
      },
      {
        slug: "0002-mvm-audio",
        title: "Simplest Manifest - Audio",
        versions: [3, 4],
      },
      {
        slug: "0003-mvm-video",
        title: "Simplest Manifest - Video",
        versions: [3, 4],
      },
      { slug: "0608-mvm-3d", title: "Simplest Manifest - 3D", versions: [4] },
      {
        slug: "0004-canvas-size",
        title: "Image and Canvas with Differing Dimensions",
        versions: [3],
      },
      {
        slug: "0005-image-service",
        title: "Support Deep Viewing with Basic Use of a IIIF Image Service",
        versions: [3],
      },
      {
        slug: "0006-text-language",
        title: "Internationalization and Multi-language Values",
        versions: [3],
      },
      {
        slug: "0118-multivalue",
        title: "Displaying Multiple Values with Language Maps",
        versions: [3],
      },
      {
        slug: "0007-string-formats",
        title: "Embedding HTML in descriptive properties",
        versions: [3],
      },
      {
        slug: "0029-metadata-anywhere",
        title: "Metadata on any Resource",
        versions: [3],
      },
      { slug: "0008-rights", title: "Rights statement(s)", versions: [3] },
      { slug: "0009-book-1", title: "Simple Manifest - Book", versions: [3] },
      {
        slug: "0011-book-3-behavior",
        title: "Book behavior (paging) variations",
        versions: [3],
      },
      {
        slug: "0299-region",
        title: "Addressing a spatial region",
        versions: [3],
      },
      {
        slug: "0010-book-2-viewing-direction",
        title: "Viewing direction and its effect on navigation",
        versions: [3],
      },
      {
        slug: "0283-missing-image",
        title: "Missing Images in a Sequence",
        versions: [3],
      },
      {
        slug: "0117-add-image-thumbnail",
        title: "Image Thumbnail for Manifest",
        versions: [3],
      },
      {
        slug: "0232-image-thumbnail-canvas",
        title: "Implementation discussion: Thumbnails on Canvases",
        versions: [3],
      },
      {
        slug: "0013-placeholderCanvas",
        title: "Load a Preview Image Before the Main Content",
        versions: [3],
      },
      {
        slug: "0014-accompanyingcanvas",
        title: "Audio Presentation with Accompanying Image",
        versions: [3],
      },
      {
        slug: "0202-start-canvas",
        title: "Load Manifest Beginning with a Specific Canvas",
        versions: [3],
      },
      {
        slug: "0015-start",
        title: "Begin playback at a specific point - Time-based media",
        versions: [3],
      },
      {
        slug: "0230-navdate",
        title: "Navigation by Chronology",
        versions: [3],
      },
      {
        slug: "0154-geo-extension",
        title: "Locate a Manifest on a Web Map",
        versions: [3],
      },
      {
        slug: "0240-navPlace-on-canvases",
        title: "Locate Multiple Canvases on a Web Map",
        versions: [3],
      },
      {
        slug: "0234-provider",
        title: "Acknowledge Content Contributors",
        versions: [3],
      },
      { slug: "0032-collection", title: "Simple Collection", versions: [3] },
      {
        slug: "0464-reuse-manifest",
        title: "Reuse parts of a Manifest",
        versions: [3],
      },
    ],
  },
  {
    title: "Textual and other supplementary content",
    recipes: [
      {
        slug: "0017-transcription-av",
        title: "Using Transcripts with A/V Content",
        versions: [3],
      },
      {
        slug: "0103-poetry-reading-annotations",
        title: "Scholarly Annotation of a Poetry Reading",
        versions: [3],
      },
      {
        slug: "0046-rendering",
        title: "Providing Alternative Representations",
        versions: [3],
      },
      {
        slug: "0231-transcript-meta-recipe",
        title: "Transcripts, Captions, and Subtitles - General Considerations",
        versions: [3],
      },
      {
        slug: "0219-using-caption-file",
        title: "Using Caption Files with Video Content",
        versions: [3, 4],
      },
      {
        slug: "0253-using-transcript-file",
        title: "Video with Accompanying Transcript",
        versions: [4],
      },
    ],
  },
  {
    title: "Other kinds of annotations",
    recipes: [
      {
        slug: "0266-full-canvas-annotation",
        title: "Simplest Annotation",
        versions: [3],
      },
      {
        slug: "0019-html-in-annotations",
        title: "HTML in Annotations",
        versions: [3],
      },
      { slug: "0045-css", title: "CSS in an Annotation", versions: [3] },
      {
        slug: "0021-tagging",
        title: "Simple Annotation - Tagging",
        versions: [3],
      },
      {
        slug: "0261-non-rectangular-commenting",
        title: "Annotation with a Non-Rectangular Polygon",
        versions: [3],
      },
      {
        slug: "0258-tagging-external-resource",
        title: "Tagging with an External Resource",
        versions: [3],
      },
      {
        slug: "0022-linking-with-a-hotspot",
        title:
          "Redirecting from one Canvas to another resource (Hotspot linking)",
        versions: [3],
      },
      {
        slug: "0326-annotating-image-layer",
        title: "Annotate a specific images or layers",
        versions: [3],
      },
      {
        slug: "0135-annotating-point-in-canvas",
        title: "Annotating a specific point of an image",
        versions: [3],
      },
      {
        slug: "0139-geolocate-canvas-fragment",
        title: "Geographic coordinates",
        versions: [3],
      },
      {
        slug: "0269-embedded-or-referenced-annotations",
        title: "Embedded or Referenced Annotations",
        versions: [3],
      },
      {
        slug: "0306-linking-annotations-to-manifests",
        title: "Linking external Annotations targeting a Canvas to a Manifest",
        versions: [3],
      },
      {
        slug: "0309-annotation-collection",
        title: "Using Annotation collections",
        versions: [3],
      },
      {
        slug: "0377-image-in-annotation",
        title: "Image in annotations",
        versions: [3],
      },
      {
        slug: "0346-multilingual-annotation-body",
        title: "Annotating in Multiple Languages",
        versions: [3],
      },
      {
        slug: "0561-text-on-image",
        title: "Visible Text Resource on a Canvas",
        versions: [3],
      },
    ],
  },
  {
    title: "Internal structure",
    recipes: [
      {
        slug: "0024-book-4-toc",
        title: "Table of Contents for Book Chapters",
        versions: [3],
      },
      {
        slug: "0025-newspaper-article-index",
        title: "Navigation by Newspaper Article",
        versions: [3],
      },
      {
        slug: "0026-toc-opera",
        title: "Table of contents for A/V content",
        versions: [3],
      },
      {
        slug: "0229-behavior-ranges",
        title: "Adding Thumbnail Navigation and no-nav to a Video Resource",
        versions: [3],
      },
      {
        slug: "0027-alternative-page-order",
        title: "Alternative Page Sequences",
        versions: [3],
      },
    ],
  },
  {
    title: "Higher-level structure",
    recipes: [
      {
        slug: "0030-multi-volume",
        title: "Multi-volume Work with Individually-bound Volumes",
        versions: [3],
      },
      {
        slug: "0031-bound-multivolume",
        title: "Multiple Volumes in a Single Bound Volume",
        versions: [3],
      },
    ],
  },
  {
    title: "Segmentation and complex resources",
    recipes: [
      {
        slug: "0033-choice",
        title: "Multiple choice of images in a single view",
        versions: [3],
      },
      {
        slug: "0035-foldouts",
        title: "Foldouts, Flaps, and Maps",
        versions: [3],
      },
      {
        slug: "0036-composition-from-multiple-images",
        title: "Composition from Multiple Images",
        versions: [3],
      },
      {
        slug: "0560-resources-on-a-timeline",
        title: "Rendering Resources Sequentially on a Timeline",
        versions: [3],
      },
      {
        slug: "0489-multimedia-canvas",
        title: "Rendering Multiple Media Types on a Time-Based Canvas",
        versions: [3],
      },
      {
        slug: "0040-image-rotation-service",
        title: "Image Rotation Two Ways",
        versions: [3],
      },
    ],
  },
  {
    title: "Linking",
    recipes: [
      {
        slug: "0047-homepage",
        title: "Linking to Web Page of an Object (homepage)",
        versions: [3],
      },
      {
        slug: "0053-seeAlso",
        title: "Linking to Structured Metadata",
        versions: [3],
      },
    ],
  },
  {
    title: "Sharing IIIF content",
    recipes: [
      {
        slug: "0466-link-for-loading-manifest",
        title: "Loading a manifest with a viewer using a link",
        versions: [3],
      },
      {
        slug: "0485-contentstate-canvas-region",
        title: "Open a specific region of a canvas in a viewer",
        versions: [3],
      },
      {
        slug: "0540-link-for-opening-multiple-canvases",
        title: "Sharing a link for opening two or more Canvases",
        versions: [3],
      },
      { slug: "0599-drag-and-drop", title: "Drag and drop", versions: [3] },
    ],
  },
  {
    title: "Technical",
    recipes: [
      {
        slug: "0057-publishing-v2-and-v3",
        title:
          "Making IIIF Presentation API v2 and v3 manifests available at the same URL",
        versions: [3],
      },
    ],
  },
  {
    title: "Real-world complex objects (ideally taken from actual collections)",
    recipes: [
      {
        slug: "0434-choice-av",
        title: "Multiple Choice of Audio Formats in a Single View (Canvas)",
        versions: [3],
      },
      {
        slug: "0064-opera-one-canvas",
        title: "Table of Contents for Multiple A/V files on a Single Canvas",
        versions: [3],
      },
      {
        slug: "0065-opera-multiple-canvases",
        title: "Table of Contents for Multiple A/V files on Multiple Canvases",
        versions: [3],
      },
      { slug: "0068-newspaper", title: "Basic Newspaper", versions: [3] },
      {
        slug: "0074-multiple-language-captions",
        title:
          "Using Caption and Subtitle Files in Multiple Languages with Video Content",
        versions: [3],
      },
      {
        slug: "0318-navPlace-navDate",
        title: "Locating an Item in Place and Time",
        versions: [3],
      },
    ],
  },
];
