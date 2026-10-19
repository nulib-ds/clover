import type { Status } from "docs/components/CookbookRecipes/cookbookCatalog";

/**
 * Whether Clover 4 (`@nulib/clover`) handles each IIIF Cookbook recipe, for the unlisted
 * progress page (`/docs/viewer/progress`). Not published as a claim: the public demo lists
 * every recipe to open, handled or not, and this is the list to work from.
 *
 * Checked on `CHECKED` by opening each recipe's resource in the Viewer (Chromium; WebKit
 * for playback, since Playwright's Chromium cannot decode H.264), and looking for what the
 * recipe is about: drawn, listed, navigable, played. A note says what is missing.
 */
export const CHECKED = "2026-10-10";

export interface Progress {
  status: Status;
  /** What is missing, for a recipe handled in part or not yet. */
  note?: string;
}

const yes: Progress = { status: "yes" };
const partial = (note: string): Progress => ({ status: "partial", note });
const no = (note: string): Progress => ({ status: "no", note });

export const progress4: Record<string, Progress> = {
  "0001-mvm-image": yes,
  "0002-mvm-audio": yes,
  "0003-mvm-video": yes,
  "0608-mvm-3d": no("3D (glTF) is not drawn; it belongs to a future Scene"),
  "0004-canvas-size": yes,
  "0005-image-service": yes,
  "0006-text-language": yes,
  "0118-multivalue": yes,
  "0007-string-formats": yes,
  "0029-metadata-anywhere": yes,
  "0008-rights": yes,
  "0009-book-1": yes,
  "0011-book-3-behavior": yes,
  "0299-region": yes,
  "0010-book-2-viewing-direction": yes,
  "0283-missing-image": yes,
  "0117-add-image-thumbnail": yes,
  "0232-image-thumbnail-canvas": yes,
  "0013-placeholderCanvas": yes,
  "0014-accompanyingcanvas": yes,
  "0202-start-canvas": yes,
  "0015-start": no(
    "Plays from the beginning; the Manifest's start time is not applied",
  ),
  "0230-navdate": no(
    "Its maps open from the Collection menu; no navigation by date",
  ),
  "0154-geo-extension": yes,
  "0240-navPlace-on-canvases": yes,
  "0234-provider": no("provider is not shown in About"),
  "0032-collection": yes,
  "0464-reuse-manifest": yes,
  // 2026-10-19: its plain-text transcript shows in the panel's Transcript.
  "0017-transcription-av": yes,
  // 2026-10-19: a cue while its stretch plays, under its page's label; the list and the
  // Canvas's own menu go to its time.
  "0103-poetry-reading-annotations": yes,
  "0046-rendering": yes,
  "0231-transcript-meta-recipe": no(
    "General considerations, with no resource to open",
  ),
  "0219-using-caption-file": yes,
  // 2026-10-19: its plain-text transcript shows in the panel's Transcript.
  "0253-using-transcript-file": yes,
  // 2026-10-19: also in the Canvas's caption, on its own as in the Viewer.
  "0266-full-canvas-annotation": yes,
  // 2026-10-19: its HTML (link and image) in the caption too, sanitised.
  "0019-html-in-annotations": yes,
  "0045-css": no("The annotation styled by CSS is neither shown nor styled"),
  "0021-tagging": yes,
  "0261-non-rectangular-commenting": yes,
  "0258-tagging-external-resource": yes,
  // 2026-10-19: the hotspot, and the list's "Open the link", show the close-up.
  "0022-linking-with-a-hotspot": yes,
  "0326-annotating-image-layer": partial(
    "The choice of layers works; the annotation on one layer is not shown",
  ),
  "0135-annotating-point-in-canvas": yes,
  "0139-geolocate-canvas-fragment": yes,
  "0269-embedded-or-referenced-annotations": yes,
  "0306-linking-annotations-to-manifests": yes,
  "0309-annotation-collection": yes,
  // 2026-10-19: the image shows in the hotspot's popover too.
  "0377-image-in-annotation": yes,
  "0346-multilingual-annotation-body": yes,
  "0561-text-on-image": no("Text painted on the Canvas is not drawn"),
  "0024-book-4-toc": yes,
  "0025-newspaper-article-index": yes,
  "0026-toc-opera": yes,
  "0229-behavior-ranges": partial(
    "no-nav is honoured; thumbnail-nav ranges are listed as chapters, not as thumbnails",
  ),
  "0027-alternative-page-order": partial(
    "The other orders are listed in Contents; Previous and Next keep the Manifest's",
  ),
  "0030-multi-volume": yes,
  "0031-bound-multivolume": yes,
  "0033-choice": yes,
  "0035-foldouts": yes,
  "0036-composition-from-multiple-images": yes,
  "0560-resources-on-a-timeline": yes,
  "0489-multimedia-canvas": partial(
    "The image and the video are drawn, but not when they are timed to; its painted text is not shown",
  ),
  "0040-image-rotation-service": no(
    "Rotation by the Image API selector, or by CSS, is not applied",
  ),
  "0047-homepage": yes,
  "0053-seeAlso": yes,
  "0466-link-for-loading-manifest": yes,
  "0485-contentstate-canvas-region": yes,
  "0540-link-for-opening-multiple-canvases": no(
    "A content state opens one Canvas; two or more are not opened together",
  ),
  "0599-drag-and-drop": no(
    "Dropping a IIIF link on the Viewer is not supported",
  ),
  "0057-publishing-v2-and-v3": yes,
  "0434-choice-av": yes,
  "0064-opera-one-canvas": yes,
  "0065-opera-multiple-canvases": yes,
  "0068-newspaper": yes,
  "0074-multiple-language-captions": yes,
  "0318-navPlace-navDate": partial(
    "Its place is on the Map tab; no navigation by date",
  ),
};

/** A recipe not in the list yet has not been checked: not handled, as far as anyone knows. */
export const progressFor = (slug: string): Progress =>
  progress4[slug] ?? { status: "no", note: "Not checked yet" };
