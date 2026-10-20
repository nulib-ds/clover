"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useState } from "react";

import { useMock } from "docs/lib/useMock";

/**
 * One part of `@nulib/clover`, live, in a `Root` over one of Clover's mocks (see
 * /docs/mocks): the Components pages' examples. A page is drawn on the server, which can
 * hand a component only plain data, so the part is named, not passed, and its props are
 * plain values.
 *
 * ```mdx
 * <PartDemo part="Summary" resource="paged" />
 * <PartDemo part="Label" props={{ of: "canvas", as: "p" }} content />
 * ```
 */

/** The mocks a part can be shown on, and what each has (`/docs/mocks`). */
const RESOURCES = {
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
  /**
   * Northwestern's "Commedia dell'Arte: The Masks of Antonio Fava", nine Manifests, from
   * the DC API (not a mock): a Collection, for the parts that need one, as Items' page
   * shows it.
   */
  collection:
    "https://api.dc.library.northwestern.edu/api/v2/collections/c373ecd2-2c45-45f2-9f9e-52dc244870bd?as=iiif",
} as const;

export type PartDemoResource = keyof typeof RESOURCES;

/** The parts a page may show, by the name it is written with (`<Clover.Label />`). */
const PARTS = [
  "About",
  "Annotations",
  "Collection",
  "CollectionSelect",
  "Content",
  "Contents",
  "Download",
  "Homepage",
  "Id",
  "Items",
  "Label",
  "Metadata",
  "Next",
  "PartOf",
  "Position",
  "Previous",
  "Rendering",
  "RequiredStatement",
  "Rights",
  "Search",
  "SeeAlso",
  "Status",
  "Summary",
  "Thumbnail",
  "Transcript",
  "Value",
] as const;

export type PartName = (typeof PARTS)[number];

interface PartDemoProps {
  /** The part, as `@nulib/clover` exports it. */
  part: PartName;
  /** Its props: plain values only. */
  props?: Record<string, unknown>;
  /** The mock it reads. Default `paged`. */
  resource?: PartDemoResource;
  /** A `Content` above it, for a part that follows the view (`of="canvas"`, a pager). */
  content?: boolean;
  /** The Content's height, in px. Default 320. */
  height?: number;
}

const Live = dynamic(
  () =>
    import("@nulib/clover").then((clover) => {
      function Live({
        part,
        props,
        iiifContent,
        request,
        content,
        height,
      }: {
        part: PartName;
        props: Record<string, unknown>;
        iiifContent: string;
        request?: { fetch: typeof fetch };
        content: boolean;
        height: number;
      }) {
        const Part = clover[part] as React.ComponentType<
          Record<string, unknown>
        >;
        return (
          <clover.Root
            iiifContent={iiifContent}
            request={request}
            style={{ display: "grid", gap: "1rem" }}
          >
            {content && <clover.Content style={{ height }} />}
            <Part {...props} />
          </clover.Root>
        );
      }
      return Live;
    }),
  { ssr: false },
);

export function PartDemo({
  part,
  props = {},
  resource = "paged",
  content = false,
  height = 320,
}: PartDemoProps) {
  const address = RESOURCES[resource];
  const remote = address.startsWith("https://");
  const mock = useMock(remote ? "" : address);
  const url = remote ? address : mock;
  // The newspaper's search service is answered here, as the static site cannot read `?q=`.
  const [request, setRequest] = useState<{ fetch: typeof fetch } | null>(null);
  const searching = resource === "search";
  useEffect(() => {
    if (!searching) return;
    let live = true;
    import("docs/mocks/content-search/index.mjs").then(({ mockFetch }) => {
      if (live) setRequest({ fetch: mockFetch() as typeof fetch });
    });
    return () => {
      live = false;
    };
  }, [searching]);
  const ready = url && (!searching || request);
  return (
    <div
      style={{
        margin: "1.5rem 0 2rem",
        padding: "1rem",
        border: "1px solid var(--gray-6)",
        borderRadius: "var(--radius-3)",
      }}
    >
      {ready && (
        <Live
          part={part}
          props={props}
          iiifContent={url}
          request={request ?? undefined}
          content={content}
          height={height}
        />
      )}
    </div>
  );
}
