Clover 4.1.0: content states from every part, a video's player rethought, and more ways to lay out Items and the Gallery.

```shell
npm install @nulib/clover@4.1.0
```

## New

- **A content state from every part that shows a view.** `onContentStateChange` on Body, Canvas, Timeline and Scene, as on Root and the Viewer: where it is, as the annotation and encoded for a link, as the view changes. See [Content State](https://clover.iiif.library.northwestern.edu/docs/content-state).
- **`collapseControls`** on Canvas, Body and the templates: the view's controls behind one button where the row is full (`auto`, the default), or `always`.
- **A video can fill its Body.** A control beside Full screen switches between fitting the video and filling the Body with it, centered either way.
- **Chapters at the top**, beside a recording's Annotations, each with its start and the one playing marked.
- **Items' `masonry` layout** and **`secondary` line** (`summary`, `navDate` or `none`), and **`singleItem`** for a resource with one view.
- **The Gallery** opens annotations given as the content (tags across Manifests), takes `summary`, and is framed by the Collection or Manifest it opens.
- **`<clover-label>`** takes `as="label"` and `as="figcaption"`; **`--clover-template-lightbox-top`** keeps the lightbox under a page's sticky header.

## Changed

- **Video:** black behind it, no scrim at its top, and its controls fade after a pause while a paused Play stays in sight. A picture's controls stay in sight.
- **A recording of sound** plays with its artwork and title centered and the Canvas's own transport and captions along its foot; its annotations show along the top.
- **A Canvas's controls stay on one row.** The collapse button's code loads only when the row needs it.
- **Renamed:** `--clover-canvas-wash` is `--clover-canvas-background`. A Canvas's `data-media` is now its painting body's `type`, lowercased (`image`, `video`, `sound`…), with `data-recording` marking one that plays. The player's chapter list (`.clover-canvas-player-chapters`) is gone, its chapters in the Chapters menu.
- **Titles take the page's heading styles.** Every template's title, Items' and the Collection's, and About's label carry `clover-title`, regular weight, their size the page's for their level.
- **The Gallery's lightbox** is a layer within the Gallery's bounds, no longer a `<dialog>` over the window (`.clover-template-lightbox-content` is its panel). Its grid now shows a resource with one view too.
- **The Panel's tab arrows** are small steps, as Search's are (`.clover-steps-step`).
- Smaller screens get narrower insets, heights from the window use `svh`, and a Root in full screen keeps clear of the screen's safe areas.

## Fixed

Content states name a Timeline or a Scene by its type, annotations stay clear of the controls, and a run of layout fixes across the Panel, Document and the Gallery. The [changelog](https://github.com/nulib-ds/clover/blob/main/packages/clover/CHANGELOG.md) lists them all.

The Viewer in its Default template loads 98 kB gzip to its first view, React not counted.

Documentation: https://clover.iiif.library.northwestern.edu
