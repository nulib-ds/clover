"use client";

import dynamic from "next/dynamic";
import { useMapWorker } from "docs/lib/map-worker";
import { useMock } from "docs/lib/useMock";

/**
 * Live demos of @nulib/clover for the 4.x docs. The package is loaded on the client only:
 * its parts draw into WebGL and fetch on mount, so there is nothing to pre-render.
 */

const RECIPES = "https://iiif.io/api/cookbook/recipe";

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

const Composed = dynamic(
  () =>
    import("@nulib/clover").then(
      ({ Root, Label, Body, Previous, Next, Position }) => {
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
              <Body style={{ height: 420 }} />
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
        // Under the Items page's "A Collection" h3.
        headingLevel={4}
        style={{ ["--clover-items-height" as string]: "10rem" }}
      />
    </div>
  );
}
