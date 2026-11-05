"use client";

import dynamic from "next/dynamic";
import React from "react";
import { useMock } from "docs/lib/useMock";

/**
 * Customizing's examples (`content/docs/composing/customizing.mdx`; Mat, 2026-11-04:
 * "render the examples!"), each drawing what its code under it writes, over the `paged`
 * mock, the White catalog. Its code gives the mock's published address; the demo reads it
 * from the site it is on (`useMock`), as the published site sends no CORS headers.
 */

const MOCK = "paged/manifest.json";

/** Waits for the mock's address, then draws `Demo` with it. */
function withMock(Demo: React.ComponentType<{ url: string }>, height: string) {
  return function Mocked() {
    const url = useMock(MOCK);
    return url ? <Demo url={url} /> : <div style={{ minHeight: height }} />;
  };
}

/**
 * The Panel with Tabs of your own, About and the current Canvas's own, under a Body and a
 * row of the Manifest's Label with Previous and Next at its end (Mat, 2026-11-04: "put title
 * on this same line. right align pager. exclude the position"), over
 * the IIIF Cookbook's "Metadata on any resource" (0029; Mat, 2026-11-04: "use the metadata
 * on any resource cookbook recipe for this. put a canvas over it"), whose two Canvases each
 * have a label and metadata of their own.
 */
/**
 * A citation of the page's own, not the resource's (Mat, 2026-11-04: "maybe it can include
 * a Citation guidance. this is oppurtunity to describe a non-iiif value"), written from the
 * recipe's own label and metadata, in Markdown for its italic title.
 */
const CITATION =
  "Cite as: Glindoni, Henry Gillard. *John Dee performing an experiment before Queen Elizabeth I.* Oil on canvas, 1800–1899. Wellcome Collection, Wellcome Library no. 47369i.";

const RECIPE_0029 =
  "https://iiif.io/api/cookbook/recipe/0029-metadata-anywhere/manifest.json";

export const PanelTabsDemo = dynamic(
  () =>
    import("@nulib/clover").then((Clover) => {
      function PanelTabs() {
        return (
          <Clover.Root iiifContent={RECIPE_0029}>
            <Clover.Body style={{ height: "20rem" }} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--clover-space-s)",
                paddingBlock: "var(--clover-space-s)",
              }}
            >
              <Clover.Label as="h3" style={{ flex: 1, margin: 0 }} />
              <Clover.Previous />
              <Clover.Next />
            </div>
            <Clover.Panel>
              <Clover.Tab value="about" label="About">
                <Clover.About label={false} />
              </Clover.Tab>
              <Clover.Tab value="page" label="This page">
                <Clover.Label of="canvas" as="h4" />
                <Clover.Metadata of="canvas" />
              </Clover.Tab>
              <Clover.Tab value="citation" label="Citation">
                <Clover.Value as="p" format="text/markdown" value={CITATION} />
              </Clover.Tab>
            </Clover.Panel>
          </Clover.Root>
        );
      }
      return PanelTabs;
    }),
  { ssr: false, loading: () => <div style={{ minHeight: "30rem" }} /> },
);

/** The Panel and the Body side by side, the Panel first (Mat, 2026-11-04: "left side for metadata"). */
export const SplitDemo = withMock(
  dynamic(
    () =>
      import("@nulib/clover").then((Clover) => {
        function SplitLayout({ url }: { url: string }) {
          return (
            <Clover.Root iiifContent={url}>
              <Clover.Split storageKey="my-layout" style={{ height: "28rem" }}>
                <Clover.SplitPane
                  size="24rem"
                  min="14rem"
                  style={{ overflowY: "auto" }}
                >
                  <Clover.Panel />
                </Clover.SplitPane>
                <Clover.SplitHandle />
                <Clover.SplitPane min="16rem">
                  <Clover.Body style={{ height: "100%" }} />
                </Clover.SplitPane>
              </Clover.Split>
            </Clover.Root>
          );
        }
        return SplitLayout;
      }),
    { ssr: false, loading: () => <div style={{ minHeight: "28rem" }} /> },
  ),
  "28rem",
);

/** The Manifest's Summary cut to three lines, and a note of your own with ReadMore. */
export const ReadMoreDemo = withMock(
  dynamic(
    () =>
      import("@nulib/clover").then((Clover) => {
        function ReadMoreText({ url }: { url: string }) {
          return (
            <Clover.Root iiifContent={url}>
              <div
                style={{
                  ["--clover-summary-lines" as string]: 3,
                  maxWidth: "40rem",
                }}
              >
                <Clover.Summary />
              </div>
              <Clover.ReadMore>
                <p
                  style={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                    overflow: "hidden",
                    maxWidth: "40rem",
                  }}
                >
                  A note of your own, under the catalog's summary, clamped to
                  two lines by your own CSS. ReadMore gives it the same button
                  Summary has, which shows the rest of it, and then cuts it
                  again. Its words are yours, and so is how far it runs before
                  the button.
                </p>
              </Clover.ReadMore>
            </Clover.Root>
          );
        }
        return ReadMoreText;
      }),
    { ssr: false, loading: () => <div style={{ minHeight: "12rem" }} /> },
  ),
  "12rem",
);

/** A layout of your own, given to the Viewer as its template. */
export const TemplateDemo = withMock(
  dynamic(
    () =>
      import("@nulib/clover").then((Clover) => {
        function MyLayout(props: React.ComponentProps<typeof Clover.Root>) {
          return (
            <Clover.Root {...props}>
              <Clover.Body style={{ height: "24rem" }} />
              <Clover.Items layout="pager" />
            </Clover.Root>
          );
        }
        function TemplateLayout({ url }: { url: string }) {
          return <Clover.Viewer iiifContent={url} template={MyLayout} />;
        }
        return TemplateLayout;
      }),
    { ssr: false, loading: () => <div style={{ minHeight: "27rem" }} /> },
  ),
  "27rem",
);

/** A layout whose title takes the heading level it is given, past 6 naming its group. */
export const HeadingsDemo = withMock(
  dynamic(
    () =>
      import("@nulib/clover").then((Clover) => {
        function MyLayout({
          iiifContent,
          headingLevel,
        }: {
          iiifContent: string;
          headingLevel: number;
        }) {
          const title = Clover.titled(headingLevel, "my-title");
          return (
            <Clover.Root iiifContent={iiifContent} {...title.group}>
              <Clover.Label as={title.as} {...title.title} />
              <Clover.Body style={{ height: "20rem" }} />
            </Clover.Root>
          );
        }
        function Headings({ url }: { url: string }) {
          return <MyLayout iiifContent={url} headingLevel={4} />;
        }
        return Headings;
      }),
    { ssr: false, loading: () => <div style={{ minHeight: "22rem" }} /> },
  ),
  "22rem",
);

/** A control of your own, named on hover and focus by Tip, as Clover's controls are. */
export const ControlDemo = withMock(
  dynamic(
    () =>
      import("@nulib/clover").then((Clover) => {
        function Bookmark({ url }: { url: string }) {
          const [saved, setSaved] = React.useState(false);
          return (
            <Clover.Root iiifContent={url}>
              <button
                type="button"
                aria-label="Bookmark"
                aria-pressed={saved}
                onClick={() => setSaved(!saved)}
                style={{ position: "relative" }}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill={saved ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 3h12v18l-6-4-6 4z" strokeLinejoin="round" />
                </svg>
                <Clover.Tip label="Bookmark" />
              </button>
            </Clover.Root>
          );
        }
        return Bookmark;
      }),
    { ssr: false, loading: () => <div style={{ minHeight: "3rem" }} /> },
  ),
  "3rem",
);
