"use client";

import dynamic from "next/dynamic";
import type React from "react";
import { useMapWorker } from "docs/lib/map-worker";
import { useMock } from "docs/lib/useMock";

/**
 * Live demos of @nulib/clover for the 4.x docs. The package is loaded on the client only:
 * its parts draw into WebGL and fetch on mount, so there is nothing to pre-render.
 */

const StandaloneMap = dynamic(
  () => import("@nulib/clover/map").then(({ Map }) => Map),
  { ssr: false },
);

/** `Map` on its own: a IIIF resource's places, and its georeferenced images. */
export function MapDemo({
  iiifContent,
  mock,
  props,
}: {
  iiifContent?: string;
  mock?: string;
  /** The Map's props, plain values; a style is laid over its height. */
  props?: Record<string, unknown> & { style?: React.CSSProperties };
}) {
  const mockUrl = useMock(mock ?? "");
  const content = mock ? mockUrl : iiifContent;
  const ready = useMapWorker();
  return (
    <div style={{ margin: "1.5rem 0 2rem" }}>
      {content && ready && (
        <StandaloneMap
          {...props}
          iiifContent={content}
          style={{
            ["--clover-map-height" as string]: "420px",
            ...props?.style,
          }}
        />
      )}
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
