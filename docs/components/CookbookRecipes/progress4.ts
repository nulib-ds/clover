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
export const CHECKED = "2026-10-28";

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
  // 2026-10-23: drawn by Scene, its glTF model lit and framed by default.
  "0608-mvm-3d": yes,
  "0004-canvas-size": yes,
  "0005-image-service": yes,
  "0006-text-language": yes,
  // 2026-10-28: its painted image (a Wikimedia thumbnail) answers 400 at its source; the
  // values the recipe is about show.
  "0118-multivalue": yes,
  "0007-string-formats": yes,
  "0029-metadata-anywhere": yes,
  "0008-rights": yes,
  "0009-book-1": yes,
  "0011-book-3-behavior": yes,
  "0299-region": yes,
  "0010-book-2-viewing-direction": yes,
  // 2026-10-29: the missing page is held still, its label in the middle of its Body.
  "0283-missing-image": yes,
  "0117-add-image-thumbnail": yes,
  "0232-image-thumbnail-canvas": yes,
  "0013-placeholderCanvas": yes,
  "0014-accompanyingcanvas": yes,
  "0202-start-canvas": yes,
  // 2026-10-29: its start's PointSelector time is read, so it opens 120.5 seconds in.
  "0015-start": yes,
  // 2026-10-29: each map's date shows under its label in the Collection, and in About;
  // the second map opens fitted, though both Canvases are `…/canvas/p1`.
  "0230-navdate": partial(
    "Its maps open from the Collection, each with its date; no ordering or filtering by date",
  ),
  "0154-geo-extension": yes,
  "0240-navPlace-on-canvases": yes,
  // 2026-10-28: its logo and name over the Viewer, and under Provider in About.
  "0234-provider": yes,
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
  // 2026-10-29: walked, in both versions: on from the start, and listed as a transcript;
  // Presentation 4's `provides` read (closedCaptions, subtitles, transcript).
  "0219-using-caption-file": yes,
  // 2026-10-19: its plain-text transcript shows in the panel's Transcript.
  "0253-using-transcript-file": yes,
  // 2026-10-19: also in the Canvas's caption, on its own as in the Viewer.
  "0266-full-canvas-annotation": yes,
  // 2026-10-19: its HTML (link and image) in the caption too, sanitized.
  "0019-html-in-annotations": yes,
  // 2026-10-29: not supported, on purpose (Mat): a resource's stylesheet could override
  // Clover's interface, and with it the accessibility the whole interface keeps. Its
  // comments are still read (through their SpecificResource bodies), listed and drawn.
  "0045-css": no(
    "Not supported, on purpose: a resource's CSS could override the interface and its accessibility; its comments show, unstyled",
  ),
  "0021-tagging": yes,
  "0261-non-rectangular-commenting": yes,
  "0258-tagging-external-resource": yes,
  // 2026-10-19: the hotspot, and the list's "Open the link", show the close-up.
  "0022-linking-with-a-hotspot": yes,
  // 2026-10-28: the X-ray's own tag is listed under it, drawn while it is chosen.
  "0326-annotating-image-layer": yes,
  "0135-annotating-point-in-canvas": yes,
  "0139-geolocate-canvas-fragment": yes,
  "0269-embedded-or-referenced-annotations": yes,
  "0306-linking-annotations-to-manifests": yes,
  // 2026-10-29: its pages are one layer named by their AnnotationCollection, walked in
  // the Default header as a Collection's members are.
  "0309-annotation-collection": yes,
  // 2026-10-19: the image shows in the hotspot's popover too.
  "0377-image-in-annotation": yes,
  "0346-multilingual-annotation-body": yes,
  "0561-text-on-image": no("Text painted on the Canvas is not drawn"),
  "0024-book-4-toc": yes,
  // 2026-10-28: Contents steps through an article's regions in its Range's order, each
  // drawn and selected on the Canvas.
  "0025-newspaper-article-index": yes,
  "0026-toc-opera": yes,
  // 2026-10-28: no-nav is honored, and each thumbnail-nav Range shows its thumbnail in
  // Contents, the chapters' menu and the seek bar's popover.
  "0229-behavior-ranges": yes,
  // 2026-10-28: Contents steps through each sequence in its own order, the first the
  // default, the one chosen current.
  "0027-alternative-page-order": yes,
  "0030-multi-volume": yes,
  "0031-bound-multivolume": yes,
  "0033-choice": yes,
  "0035-foldouts": yes,
  "0036-composition-from-multiple-images": yes,
  "0560-resources-on-a-timeline": yes,
  // 2026-10-29: played over its duration, the video in its region and the texts drawn.
  "0489-multimedia-canvas": yes,
  // 2026-10-29: turned by its Image API selector, by Clover from unturned tiles; the CSS
  // way is left on purpose (Mat: no CSS from IIIF resources, as 0045).
  "0040-image-rotation-service": partial(
    "Turns an image by its Image API selector's rotation, itself, from the tiles as served; a stylesheet's rotation is not applied, on purpose, as 0045's CSS is not",
  ),
  "0047-homepage": yes,
  "0053-seeAlso": yes,
  "0466-link-for-loading-manifest": yes,
  "0485-contentstate-canvas-region": yes,
  // 2026-10-29: both targets, in turn: counted and stepped in the header, listed in Views.
  "0540-link-for-opening-multiple-canvases": partial(
    "Opens each Canvas in turn, counted and stepped in the header and listed in a Views section; not side by side",
  ),
  // 2026-10-29: left on purpose (Mat): opening by dragging alone fails WCAG 2.5.7, and a
  // link (0466) already opens a resource in Clover for everyone.
  "0599-drag-and-drop": no(
    "Not supported, on purpose: dragging alone is not accessible, and a link with iiif-content (0466) opens a resource instead",
  ),
  "0057-publishing-v2-and-v3": yes,
  // 2026-10-29: starts on the first format the browser can play (MP3 where ALAC will not).
  "0434-choice-av": yes,
  // 2026-10-28: its two files play as one, in the Canvas's time (`media/sequence.ts`).
  "0064-opera-one-canvas": yes,
  // 2026-10-28: a chapter on the other Canvas now arrives at its moment, playing.
  "0065-opera-multiple-canvases": yes,
  "0068-newspaper": yes,
  "0074-multiple-language-captions": yes,
  // 2026-10-29: every member's place on one Map, each opening its Manifest; their dates
  // under their labels in the Collection, and the Manifest's in About.
  "0318-navPlace-navDate": partial(
    "Its members' places are on one Map, each opening its Manifest, and their dates show; no ordering or filtering by date",
  ),
};

/** A recipe not in the list yet has not been checked: not handled, as far as anyone knows. */
export const progressFor = (slug: string): Progress =>
  progress4[slug] ?? { status: "no", note: "Not checked yet" };
