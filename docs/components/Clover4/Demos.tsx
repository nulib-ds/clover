import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { useMapWorker } from "docs/lib/map-worker";
import { useMock } from "docs/lib/useMock";

/**
 * Live demos of @nulib/clover for the 4.x docs. The package is loaded on the client only:
 * its parts draw into WebGL and fetch on mount, so there is nothing to pre-render.
 */

const RECIPES = "https://iiif.io/api/cookbook/recipe";

/** The Cookbook recipes the 4.x Viewer is checked against (milestone M1). */
export const VIEWER_RECIPES: Array<[string, string]> = [
  ["0009 Book (paged)", `${RECIPES}/0009-book-1/manifest.json`],
  [
    "0010 Right to left",
    `${RECIPES}/0010-book-2-viewing-direction/manifest-rtl.json`,
  ],
  [
    "0010 Top to bottom",
    `${RECIPES}/0010-book-2-viewing-direction/manifest-ttb.json`,
  ],
  [
    "0011 Continuous",
    `${RECIPES}/0011-book-3-behavior/manifest-continuous.json`,
  ],
  [
    "0011 Individuals",
    `${RECIPES}/0011-book-3-behavior/manifest-individuals.json`,
  ],
  ["0005 Image service", `${RECIPES}/0005-image-service/manifest.json`],
  ["0029 Metadata anywhere", `${RECIPES}/0029-metadata-anywhere/manifest.json`],
  ["0033 Choice", `${RECIPES}/0033-choice/manifest.json`],
  ["0003 Video", `${RECIPES}/0003-mvm-video/manifest.json`],
  ["0002 Audio", `${RECIPES}/0002-mvm-audio/manifest.json`],
  ["0013 Placeholder", `${RECIPES}/0013-placeholderCanvas/manifest.json`],
  ["0219 Captions", `${RECIPES}/0219-using-caption-file/manifest.json`],
  ["0026 Opera chapters", `${RECIPES}/0026-toc-opera/manifest.json`],
  ["0019 HTML annotation", `${RECIPES}/0019-html-in-annotations/manifest.json`],
  [
    "0377 Image annotation",
    `${RECIPES}/0377-image-in-annotation/manifest.json`,
  ],
  ["0046 Rendering (PDF)", `${RECIPES}/0046-rendering/manifest.json`],
  [
    "0261 Shape annotation",
    `${RECIPES}/0261-non-rectangular-commenting/manifest.json`,
  ],
  [
    "0135 Point annotation",
    `${RECIPES}/0135-annotating-point-in-canvas/manifest.json`,
  ],
  // A Cookbook-style animation (two frames, a stereo "wiggle"), as the 3.x docs publish it.
  [
    "0688 Animation",
    "https://nulib-ds.github.io/clover/manifest/cookbook/0688-stereogram-timeline.json",
  ],
  // Northwestern's Muybridge plates: 16 frames, each its own image, looping.
  [
    "Muybridge plate 626",
    "https://nulib-ds.github.io/muybridge/iiif/plate-number-626-annie-g-galloping.json",
  ],
  // Not a Cookbook recipe: a book with a Content Search (version 1) service.
  [
    "Content Search (Wellcome)",
    "https://iiif.wellcomecollection.org/presentation/v3/b18035723",
  ],
];

const Viewer = dynamic(
  () => import("@nulib/clover").then((clover) => clover.default),
  { ssr: false },
);

const pill: React.CSSProperties = {
  padding: "0.25rem 0.75rem",
  borderRadius: "999px",
  border: "1px solid currentColor",
  background: "transparent",
  font: "inherit",
  fontSize: "0.8125rem",
  cursor: "pointer",
};

/* Pressed is a solid fill: white on the accent keeps 4.5:1, and shows by more than hue. */
const pillPressed: React.CSSProperties = {
  background: "var(--accent-9)",
  border: "1px solid var(--accent-9)",
  color: "var(--accent-contrast)",
};

/** `<Clover.Viewer>`, with a picker of Cookbook recipes. */
export function ViewerDemo({ initial = 0 }: { initial?: number }) {
  const [index, setIndex] = useState(initial);
  /*
   * A content-state link (`?iiif-content=…`) opens here, at the
   * place it records, until a recipe is picked.
   */
  const [shared, setShared] = useState<string | null>(null);
  useEffect(() => {
    setShared(new URLSearchParams(location.search).get("iiif-content"));
  }, []);
  return (
    <div style={{ margin: "1.5rem 0 2rem" }}>
      <div
        role="group"
        aria-label="Recipe"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.375rem",
          marginBottom: "1rem",
        }}
      >
        {VIEWER_RECIPES.map(([label], n) => (
          <button
            key={label}
            type="button"
            aria-pressed={!shared && n === index}
            onClick={() => {
              setShared(null);
              setIndex(n);
            }}
            style={{
              ...pill,
              ...(!shared && n === index ? pillPressed : undefined),
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <Viewer
        iiifContent={shared ?? VIEWER_RECIPES[index][1]}
        // Under the page's "The Viewer" h2.
        headingLevel={3}
        style={{ ["--clover-content-height" as string]: "480px" }}
      />
    </div>
  );
}

const MOCK_MANIFEST =
  "https://nulib-ds.github.io/clover/mocks/content-search/manifest.json";

/**
 * `<Clover.Viewer>` over the Content Search 2.0 mock (see /docs/mocks). Its search service
 * is answered here, in the browser, by the mock's own `mockFetch`: the docs are a static
 * site, which cannot read `?q=`. Everything else is fetched as usual.
 */
export function ContentSearchDemo({ query = "Moskau" }: { query?: string }) {
  const [request, setRequest] = useState<{ fetch: typeof fetch } | null>(null);
  useEffect(() => {
    let live = true;
    import("docs/mocks/content-search/index.mjs").then(({ mockFetch }) => {
      if (live) setRequest({ fetch: mockFetch() as typeof fetch });
    });
    return () => {
      live = false;
    };
  }, []);
  return (
    <div style={{ margin: "1.5rem 0 2rem" }}>
      {request && (
        <Viewer
          iiifContent={MOCK_MANIFEST}
          request={request}
          searchQuery={query}
          // Under the page's "Content Search" h3.
          headingLevel={4}
          style={{ ["--clover-content-height" as string]: "520px" }}
        />
      )}
    </div>
  );
}

const StandaloneMap = dynamic(
  () => import("@nulib/clover/map").then(({ Map }) => Map),
  { ssr: false },
);

/** `Map` on its own: a IIIF resource's places, and its georeferenced images. */
export function MapDemo({
  iiifContent,
  mock,
}: {
  iiifContent?: string;
  mock?: string;
}) {
  const mockUrl = useMock(mock ?? "");
  const content = mock ? mockUrl : iiifContent;
  const ready = useMapWorker();
  return (
    <div style={{ margin: "1.5rem 0 2rem" }}>
      {content && ready && (
        <StandaloneMap
          iiifContent={content}
          style={{ ["--clover-map-height" as string]: "420px" }}
        />
      )}
    </div>
  );
}

/** `<Clover.Viewer>` over the georeferenced Evanston map: its Map tab appears by itself. */
export function MapViewerDemo() {
  const url = useMock("georeference/manifest.json");
  const ready = useMapWorker();
  return (
    <div style={{ margin: "1.5rem 0 2rem" }}>
      {url && ready && (
        <Viewer
          iiifContent={url}
          items={false}
          // Under the page's "In a Viewer" h2.
          headingLevel={3}
          style={{ ["--clover-content-height" as string]: "480px" }}
        />
      )}
    </div>
  );
}

const Composed = dynamic(
  () =>
    import("@nulib/clover").then(
      ({ Root, Label, Content, Previous, Next, Position }) => {
        function ComposedLayout({ iiifContent }: { iiifContent: string }) {
          return (
            <Root
              iiifContent={iiifContent}
              style={{
                display: "grid",
                /* The side column is capped, so the Canvas keeps room at 320px. */
                gridTemplateColumns: "minmax(0, 1fr) min(12rem, 40%)",
                gap: "1rem",
                alignItems: "start",
              }}
            >
              <Content style={{ height: 420 }} />
              <aside style={{ display: "grid", gap: "0.75rem" }}>
                <Label as="h3" style={{ margin: 0 }} />
                <Label of="canvas" style={{ color: "var(--gray-11)" }} />
                <Position />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <Previous />
                  <Next />
                </div>
              </aside>
            </Root>
          );
        }
        return ComposedLayout;
      },
    ),
  { ssr: false },
);

/** Parts placed in a layout of your own. */
export function ComposedDemo() {
  return (
    <div style={{ margin: "1.5rem 0 2rem" }}>
      <Composed iiifContent={`${RECIPES}/0009-book-1/manifest.json`} />
    </div>
  );
}

/** A content state as the spec encodes it for a link: base64url of the URI-encoded JSON. */
export function encodeContentState(json: unknown): string {
  return btoa(encodeURIComponent(JSON.stringify(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** The title on 0009's title page, as a content state. */
export const TITLE_PAGE_STATE = encodeContentState({
  "@context": "http://iiif.io/api/presentation/3/context.json",
  type: "Annotation",
  motivation: ["contentState"],
  target: {
    type: "SpecificResource",
    source: {
      id: `${RECIPES}/0009-book-1/canvas/p3`,
      type: "Canvas",
      partOf: [
        { id: `${RECIPES}/0009-book-1/manifest.json`, type: "Manifest" },
      ],
    },
    selector: { type: "FragmentSelector", value: "xywh=450,650,2300,1100" },
  },
});

/** `<Clover.Viewer>` opened by a content state: the book, at its title. */
export function ContentStateDemo() {
  return (
    <div style={{ margin: "1.5rem 0 2rem" }}>
      <Viewer
        iiifContent={TITLE_PAGE_STATE}
        // Under the page's "Opening at a place" h3.
        headingLevel={4}
        style={{ ["--clover-content-height" as string]: "420px" }}
      />
    </div>
  );
}

const ItemsInRoot = dynamic(
  () =>
    import("@nulib/clover").then(({ Root, Content, Items }) => {
      function ItemsLayoutDemo({
        iiifContent,
        layout,
      }: {
        iiifContent: string;
        layout: "carousel" | "list" | "grid" | "pager";
      }) {
        return (
          <Root
            iiifContent={iiifContent}
            style={
              layout === "carousel" || layout === "pager"
                ? undefined
                : {
                    display: "grid",
                    /* Items' column is capped, so the Canvas keeps room at 320px. */
                    gridTemplateColumns:
                      layout === "list"
                        ? "min(16rem, 40%) minmax(0, 1fr)"
                        : "minmax(0, 1fr) min(18rem, 40%)",
                    gap: "1rem",
                    alignItems: "start",
                  }
            }
          >
            {layout === "list" && (
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                <Items layout="list" />
              </div>
            )}
            <Content style={{ height: 420 }} />
            {layout === "carousel" && <Items />}
            {layout === "pager" && <Items layout="pager" />}
            {layout === "grid" && (
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                <Items
                  layout="grid"
                  style={{ ["--clover-items-size" as string]: "7rem" }}
                />
              </div>
            )}
          </Root>
        );
      }
      return ItemsLayoutDemo;
    }),
  { ssr: false },
);

/** `Items` beside a Canvas in each layout, over one Manifest. */
export function ItemsLayoutsDemo() {
  const [layout, setLayout] = useState<"carousel" | "list" | "grid" | "pager">(
    "carousel",
  );
  return (
    <div style={{ margin: "1.5rem 0 2rem" }}>
      <div
        role="group"
        aria-label="Layout"
        style={{ display: "flex", gap: "0.375rem", marginBottom: "1rem" }}
      >
        {(["carousel", "list", "grid", "pager"] as const).map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={name === layout}
            onClick={() => setLayout(name)}
            style={{
              ...pill,
              ...(name === layout ? pillPressed : undefined),
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <ItemsInRoot
        key={layout}
        layout={layout}
        iiifContent={`${RECIPES}/0009-book-1/manifest.json`}
      />
    </div>
  );
}

const StandaloneItems = dynamic(
  () => import("@nulib/clover").then((clover) => clover.Items),
  { ssr: false },
);

/** `Items` on its own: a Collection's members, as links. */
export function CollectionItemsDemo() {
  return (
    <div style={{ margin: "1.5rem 0 2rem" }}>
      <StandaloneItems
        iiifContent="https://api.dc.library.northwestern.edu/api/v2/collections/c373ecd2-2c45-45f2-9f9e-52dc244870bd?as=iiif"
        // Under the page's "A Collection" h2.
        headingLevel={3}
        style={{ ["--clover-items-height" as string]: "10rem" }}
      />
    </div>
  );
}

type TemplateName = "Default" | "Document" | "Gallery";

/** The Viewer in one of `@nulib/clover/templates`, as a page would write it. */
const TemplateViewer = dynamic(
  () =>
    Promise.all([
      import("@nulib/clover"),
      import("@nulib/clover/templates"),
    ]).then(([{ default: Viewer }, templates]) => {
      function TemplateViewer({
        name,
        iiifContent,
      }: {
        name: TemplateName;
        iiifContent: string;
      }) {
        return <Viewer iiifContent={iiifContent} template={templates[name]} />;
      }
      return TemplateViewer;
    }),
  { ssr: false },
);

/** One of `@nulib/clover/templates`, live. */
export function TemplateDemo({
  name,
  iiifContent,
}: {
  name: TemplateName;
  iiifContent: string;
}) {
  return (
    <div style={{ margin: "1.5rem 0 2rem" }}>
      <TemplateViewer name={name} iiifContent={iiifContent} />
    </div>
  );
}
