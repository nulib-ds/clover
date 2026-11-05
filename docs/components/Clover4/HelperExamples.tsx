"use client";

import type { RootProps } from "@nulib/clover";
import dynamic from "next/dynamic";
import React from "react";
import hooks from "docs/components/Clover4/HelperExamples.module.css";
import { useNear } from "docs/components/Clover4/ViewerDocs";
import { useMapWorker } from "docs/lib/map-worker";
import { useMock } from "docs/lib/useMock";

/**
 * The Helpers page's examples (`content/docs/composing/helpers.mdx`). Each builds what its code
 * under it builds, with the package's own helpers, so the two never disagree.
 */

/** Cookbook 0219's film, _Lunchroom Manners_ (Mat, 2026-11-04: "the lunchroom manners one"). */
const LUNCHROOM_MANNERS = {
  manifestId:
    "https://iiif.io/api/cookbook/recipe/0219-using-caption-file/manifest.json",
  canvasId:
    "https://iiif.io/api/cookbook/recipe/0219-using-caption-file/canvas",
};

/**
 * A content state annotation that starts the film 42 seconds in, opened by a Root and
 * shown in its Body: `buildContentState`'s `encoded`, given as the Root's `iiifContent`.
 */
export const FilmAt42 = dynamic(
  () =>
    import("@nulib/clover").then((Clover) => {
      const { encoded } = Clover.buildContentState({
        ...LUNCHROOM_MANNERS,
        time: 42,
      });
      function FilmAt42() {
        return (
          <Clover.Root iiifContent={encoded}>
            <Clover.Body style={{ height: "24rem" }} />
          </Clover.Root>
        );
      }
      return FilmAt42;
    }),
  // The Body's box meanwhile, so nothing under it moves as it arrives.
  { ssr: false, loading: () => <div style={{ height: "24rem" }} /> },
);

type MyViewerProps = Omit<RootProps, "children"> & { headingLevel?: number };

/**
 * The Panel section's template (Mat, 2026-11-04: "make this a map example … info pane on
 * the left … above the map add a small image canvas"): the Panel on the start side
 * (`usePanelPane`'s `side`), then a small Body over a large Map, given to the Viewer as
 * its `template` over the `navplace` mock (Northwestern's Sullivan slide of a Chicago
 * bus, with its navPlace point). The page's code is this, but for the mock's address
 * (`useMock`, as the published site sends no CORS headers), and `templates.test.tsx`
 * holds the same layout.
 */
const MapTemplate = dynamic(
  () =>
    Promise.all([
      import("@nulib/clover"),
      import("@nulib/clover/templates"),
    ]).then(([Clover, Templates]) => {
      const {
        BESIDE_REM,
        PAGE_MIN,
        PanelPane,
        useFollowFocus,
        usePanelPane,
        useWideEnough,
      } = Templates;
      function MyCustomViewer({ headingLevel = 2, ...props }: MyViewerProps) {
        const split = React.useRef<HTMLDivElement>(null);
        const pane = usePanelPane({
          id: "my-panel",
          side: "start",
          beside: useWideEnough(split, BESIDE_REM),
          defaultOpen: true,
          followFocus: useFollowFocus(),
          sections: ["about"],
        });
        return (
          <Clover.Root {...props}>
            <Clover.Label
              as={`h${headingLevel}` as keyof React.JSX.IntrinsicElements}
              style={{ padding: "var(--clover-inset)" }}
            />
            <Clover.Split
              ref={split}
              className="clover-template-panes"
              style={{ height: "40rem" }}
              {...pane.splitProps}
            >
              <PanelPane
                pane={pane}
                layout="accordion"
                headingLevel={headingLevel + 1}
              >
                <Clover.Tab value="about" label="About">
                  <Clover.About
                    label={false}
                    thumbnail={false}
                    headingLevel={headingLevel + 2}
                  />
                </Clover.Tab>
              </PanelPane>
              <Clover.SplitPane
                min={pane.over ? undefined : PAGE_MIN}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--clover-space-s)",
                }}
              >
                <Clover.Body controls={{ map: false }} style={{ flex: 1 }}>
                  {!pane.docked && pane.toggle}
                </Clover.Body>
                <Clover.Map
                  zoom={15}
                  style={{ ["--clover-map-height" as string]: "18rem" }}
                />
              </Clover.SplitPane>
            </Clover.Split>
          </Clover.Root>
        );
      }
      function MapTemplate({ iiifContent }: { iiifContent: string }) {
        return (
          <Clover.Viewer
            iiifContent={iiifContent}
            template={MyCustomViewer}
            headingLevel={4}
          />
        );
      }
      return MapTemplate;
    }),
  { ssr: false, loading: () => <div style={{ height: "40rem" }} /> },
);

export function MyViewerDemo() {
  const iiifContent = useMock("navplace/manifest.json");
  const ready = useMapWorker();
  return iiifContent && ready ? (
    <MapTemplate iiifContent={iiifContent} />
  ) : (
    <div style={{ height: "40rem" }} />
  );
}

/**
 * The `useDrawer()` example (Mat, 2026-11-04: "like with panel example, show using a
 * manifest and rendered component"): the Manifest's Items in a SplitPane at the Body's
 * start, a button showing and hiding them, given to the Viewer over the `paged` mock, the
 * White catalog. The page's code is this, but for the mock's address.
 */
const ItemsTemplate = dynamic(
  () =>
    Promise.all([
      import("@nulib/clover"),
      import("@nulib/clover/templates"),
    ]).then(([Clover, Templates]) => {
      const { preloadDrag, useDrawer, useFollowFocus, useWideEnough } =
        Templates;
      function MyItemsViewer(props: Omit<RootProps, "children">) {
        const split = React.useRef<HTMLDivElement>(null);
        const drawer = useDrawer({
          id: "my-items",
          beside: useWideEnough(split, 30),
          defaultOpen: true,
          side: "start",
          followFocus: useFollowFocus(),
        });
        return (
          <Clover.Root {...props}>
            <button
              type="button"
              aria-controls="my-items"
              onPointerOver={preloadDrag}
              onFocus={preloadDrag}
              onClick={() => drawer.setOpen(!drawer.open)}
              style={{
                marginBlockEnd: "var(--clover-space-s)",
                color: "var(--clover-color-accent-text)",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              {drawer.open ? "Collapse drawer" : "Expand drawer"}
            </button>
            <Clover.Split
              ref={split}
              className="clover-template-panes"
              data-panel={drawer.over ? "over" : "beside"}
              onKeyDown={drawer.onKeyDown}
              style={{ height: "24rem" }}
            >
              <Clover.SplitPane
                ref={drawer.pane as React.RefObject<HTMLElement>}
                id="my-items"
                className="clover-template-drawer"
                data-side="start"
                data-open={drawer.opened}
                hidden={!drawer.shown}
                size="12rem"
                style={{ overflowY: "auto" }}
              >
                <Clover.Items layout="list" />
              </Clover.SplitPane>
              <Clover.SplitPane>
                <Clover.Body style={{ height: "100%" }} />
              </Clover.SplitPane>
              {drawer.scrim && (
                <div className="clover-template-scrim" {...drawer.scrim} />
              )}
            </Clover.Split>
          </Clover.Root>
        );
      }
      function ItemsTemplate({ iiifContent }: { iiifContent: string }) {
        return (
          <Clover.Viewer iiifContent={iiifContent} template={MyItemsViewer} />
        );
      }
      return ItemsTemplate;
    }),
  { ssr: false, loading: () => <div style={{ height: "26rem" }} /> },
);

export function ItemsDemo() {
  const iiifContent = useMock("paged/manifest.json");
  return iiifContent ? (
    <ItemsTemplate iiifContent={iiifContent} />
  ) : (
    <div style={{ height: "26rem" }} />
  );
}

/**
 * The `Lightbox` example (Mat, 2026-11-04: "make it a figure (thumbnail/label/summary)
 * written like a narrative news story would. then make it so it opens a lightbox with a
 * full width/height body"): the Manifest as a story's figure, its Thumbnail a button, its
 * Label and Summary the caption, opening the Lightbox with no Panel, the Body its whole
 * width, over the `navplace` mock. The page's code is this, but for the mock's address.
 */
const StoryRoot = dynamic(
  () =>
    Promise.all([
      import("@nulib/clover"),
      import("@nulib/clover/templates"),
    ]).then(([Clover, Templates]) => {
      const { Lightbox, preloadLightbox } = Templates;
      function StoryFigure() {
        const [open, setOpen] = React.useState(false);
        return (
          <>
            <figure style={{ width: "min(24rem, 100%)", margin: 0 }}>
              <button
                type="button"
                aria-label="Open in the Lightbox"
                onPointerOver={preloadLightbox}
                onFocus={preloadLightbox}
                onClick={() => setOpen(true)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: 0,
                  border: 0,
                  cursor: "zoom-in",
                }}
              >
                <Clover.Thumbnail
                  alt=""
                  style={{
                    display: "block",
                    width: "100%",
                    height: "auto",
                    borderRadius: "var(--clover-radius, 3px)",
                  }}
                />
              </button>
              <figcaption style={{ marginBlockStart: "var(--clover-space-s)" }}>
                <Clover.Label as="strong" style={{ display: "block" }} />
                <Clover.Summary
                  style={{
                    margin: 0,
                    fontSize: "var(--clover-text-s)",
                    color: "var(--clover-color-primary-muted)",
                  }}
                />
              </figcaption>
            </figure>
            <Lightbox
              open={open}
              onClose={() => setOpen(false)}
              panel={false}
              caption={false}
              placeholder={false}
              headingLevel={5}
            />
          </>
        );
      }
      function StoryRoot({ iiifContent }: { iiifContent: string }) {
        return (
          <Clover.Root
            iiifContent={iiifContent}
            style={{
              position: "relative",
              isolation: "isolate",
              display: "grid",
              placeItems: "center",
              minHeight: "30rem",
            }}
          >
            <StoryFigure />
          </Clover.Root>
        );
      }
      return StoryRoot;
    }),
  { ssr: false, loading: () => <div style={{ minHeight: "30rem" }} /> },
);

export function LightboxDemo() {
  const iiifContent = useMock("navplace/manifest.json");
  return iiifContent ? (
    <StoryRoot iiifContent={iiifContent} />
  ) : (
    <div style={{ minHeight: "30rem" }} />
  );
}

/** The IIIF Cookbook's "Simple Manifest - Book" (0009): five Canvases in three views. */
const BOOK = "https://iiif.io/api/cookbook/recipe/0009-book-1/manifest.json";

type CloverModule = typeof import("@nulib/clover");

/**
 * The Hooks section's examples (Mat, 2026-11-04: "break out each of these in there own
 * respective example"): each hook in a component of its own, in a Root over the book,
 * drawing what it reads under a short Body (Mat: "show a body for each one too. can be a
 * smaller in height one"). Those that follow the view have Previous and Next beside them.
 * Each mounts only near the window (`useNear`), as fifteen Canvases at once would pass the
 * WebGL contexts a browser keeps, and holds its height meanwhile. The page's code is each
 * one's.
 */
function hookDemo(
  view: (Clover: CloverModule) => React.ComponentType,
  steps = false,
  iiifContent = BOOK,
) {
  return dynamic(
    () =>
      import("@nulib/clover").then((Clover) => {
        const View = view(Clover);
        function HookDemo() {
          const holder = React.useRef<HTMLDivElement>(null);
          const near = useNear(holder);
          return (
            <div ref={holder} className={hooks.holder}>
              {near && (
                <Clover.Root iiifContent={iiifContent} className={hooks.hook}>
                  <Clover.Body style={{ height: "12rem" }} />
                  {steps ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--clover-space-s)",
                      }}
                    >
                      <Clover.Previous />
                      <Clover.Next />
                      <View />
                    </div>
                  ) : (
                    <View />
                  )}
                </Clover.Root>
              )}
            </div>
          );
        }
        return HookDemo;
      }),
    {
      ssr: false,
      loading: () => <div className={hooks.holder} />,
    },
  );
}

export const StatusDemo = hookDemo(
  (Clover) =>
    function Status() {
      const { status, error } = Clover.useStatus();
      return <p>{error ? error.message : status}</p>;
    },
);

export const ManifestDemo = hookDemo(
  (Clover) =>
    function CanvasCount() {
      const manifest = Clover.useManifest();
      return <p>{manifest?.items.length} Canvases</p>;
    },
);

export const SequenceDemo = hookDemo(
  (Clover) =>
    function Views() {
      const { canvases, views, direction } = Clover.useSequence();
      return (
        <p>
          {canvases.length} Canvases in {views.length} views, {direction}
        </p>
      );
    },
);

export const VisibleCanvasesDemo = hookDemo(
  (Clover) =>
    function InView() {
      const canvases = Clover.useVisibleCanvases();
      return <p>{canvases.length} in view</p>;
    },
  true,
);

export const ActiveCanvasDemo = hookDemo(
  (Clover) =>
    function CanvasSize() {
      // A Canvas, a Timeline or a Scene: a Canvas has a width and a height.
      const canvas = Clover.useActiveCanvas() as
        | { width?: number; height?: number }
        | undefined;
      return (
        <p>
          {canvas?.width} × {canvas?.height}
        </p>
      );
    },
  true,
);

export const NavigationDemo = hookDemo(
  (Clover) =>
    function Position() {
      const { position, total } = Clover.useNavigation();
      return (
        <p>
          {position + 1} / {total}
        </p>
      );
    },
  true,
);

/** The IIIF Cookbook's Berliner Tageblatt (0309): its pages' annotations in one collection. */
const ANNOTATION_COLLECTION =
  "https://iiif.io/api/cookbook/recipe/0309-annotation-collection/manifest.json";

export const AnnotationCollectionDemo = hookDemo(
  (Clover) =>
    function Collection() {
      const collection = Clover.useAnnotationCollection();
      return (
        <p>
          {collection
            ? `${collection.total} annotations in ${collection.pages.length} AnnotationPages`
            : "None"}
        </p>
      );
    },
  false,
  ANNOTATION_COLLECTION,
);

/** The IIIF Cookbook's Whistler's Mother (0006): its label in English and French. */
const WHISTLERS_MOTHER =
  "https://iiif.io/api/cookbook/recipe/0006-text-language/manifest.json";

export const LocalizedDemo = hookDemo(
  (Clover) =>
    function Title() {
      const manifest = Clover.useManifest();
      const { text, lang } = Clover.useLocalized(manifest?.label);
      return <p lang={lang}>{text}</p>;
    },
  false,
  WHISTLERS_MOTHER,
);

export const TDemo = hookDemo(
  (Clover) =>
    function ZoomInName() {
      const t = Clover.useT();
      return <p>{t("imageZoomIn")}</p>;
    },
);

export const LangOfDemo = hookDemo(
  (Clover) =>
    function ZoomInLang() {
      const langOf = Clover.useLangOf();
      return <p>{langOf("imageZoomIn") ?? "The page's language"}</p>;
    },
);

/** The IIIF Cookbook's book with a table of contents (0024), Ethiopic Ms 10. */
const TABLE_OF_CONTENTS =
  "https://iiif.io/api/cookbook/recipe/0024-book-4-toc/manifest.json";

export const PanelSectionsDemo = hookDemo(
  (Clover) =>
    function ContentsPanel() {
      const sections = Clover.usePanelSections(["contents", "search"]);
      return sections.length ? <Clover.Panel sections={sections} /> : null;
    },
  false,
  TABLE_OF_CONTENTS,
);

/** The IIIF Cookbook's tagging recipe (0021): a photograph of Göttingen with one tag. */
const TAGGING =
  "https://iiif.io/api/cookbook/recipe/0021-tagging/manifest.json";

export const AnnotationPagesDemo = hookDemo(
  (Clover) =>
    function AnnotationPages() {
      const pages = Clover.useAnnotationPages();
      const annotations = pages.reduce(
        (sum, page) => sum + page.entries.length,
        0,
      );
      return (
        <p>
          AnnotationPages: {pages.length}. Annotations: {annotations}.
        </p>
      );
    },
  false,
  TAGGING,
);

export const CloverSelectorDemo = hookDemo(
  (Clover) =>
    function CanvasId() {
      const canvasId = Clover.useCloverSelector((state) => state.canvasId);
      return <p>{canvasId}</p>;
    },
  true,
);

export const UniqueIdDemo = hookDemo(
  (Clover) =>
    function UniqueId() {
      const id = Clover.useUniqueId();
      return <p id={id}>{id}</p>;
    },
);

export const CloverDemo = hookDemo(
  (Clover) =>
    function ResetButton() {
      const { clover } = Clover.useClover();
      return (
        <p>
          <button
            type="button"
            onClick={() => clover.first()}
            style={{
              color: "var(--clover-color-accent-text)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </p>
      );
    },
  true,
);
