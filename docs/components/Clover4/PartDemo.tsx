"use client";

import dynamic from "next/dynamic";
import React from "react";

import { type PartDemoResource, RESOURCES } from "docs/lib/part-demo-resources";
import { MOCK_SEARCH } from "docs/lib/mock-search";
import { useMock } from "docs/lib/useMock";

/**
 * One part of `@nulib/clover`, live, in a `Root` over one of Clover's mocks (see
 * /docs/mocks): the Components pages' examples. A page is drawn on the server, which can
 * hand a component only plain data, so the part is named, not passed, and its props are
 * plain values.
 *
 * ```mdx
 * <PartDemo part="Summary" resource="paged" />
 * <PartDemo part="Label" props={{ of: "canvas", as: "p" }} body />
 * <PartDemo parts={[{ part: "Thumbnail" }, { part: "Label" }]} row />
 * <PartDemo part="Provider" holds={[{ part: "Logo" }]} />
 * ```
 */

export type { PartDemoResource };

/** The parts a page may show, by the name it is written with (`<Clover.Label />`). */
const PARTS = [
  "About",
  "Annotations",
  "Collection",
  "CollectionSelect",
  "Body",
  "Contents",
  "Download",
  "Homepage",
  "Id",
  "Items",
  "Label",
  "Logo",
  "Metadata",
  "Next",
  "Panel",
  "PartOf",
  "Position",
  "Previous",
  "Provider",
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

/** A part to show and its props, plain values only, and the parts it holds. */
interface Shown {
  part: PartName;
  props?: Record<string, unknown>;
  /** The parts a compound part holds, drawn inside it (`Provider`'s `Logo`). */
  holds?: Shown[];
}

interface PartDemoProps {
  /** The part, as `@nulib/clover` exports it. */
  part?: PartName;
  /** Its props: plain values only. */
  props?: Record<string, unknown>;
  /** The parts it holds, for a compound part (`Provider` holding a `Logo`). */
  holds?: Shown[];
  /** Several parts in the one Root, in order, as a layout places them: for `part`. */
  parts?: Shown[];
  /** The parts on one line, centered across it, rather than stacked. */
  row?: boolean;
  /**
   * A box of this height around the parts, which scrolls: as a layout scrolls a tall part
   * (a Panel), and as its code shows it.
   */
  box?: string;
  /** The mock it reads. Default `paged`. */
  resource?: PartDemoResource;
  /** A `Body` above it, for a part that follows the view (`of="canvas"`, a pager). */
  body?: boolean;
  /** The Body's height, in px. Default 320. */
  height?: number;
  /** The Root's own props, plain values: a `searchQuery` to run as it opens. */
  rootProps?: Record<string, unknown>;
}

const Live = dynamic(
  () =>
    import("@nulib/clover").then((clover) => {
      function Live({
        shown,
        row,
        box,
        iiifContent,
        request,
        body,
        height,
        rootProps,
      }: {
        shown: Shown[];
        row: boolean;
        box?: string;
        iiifContent: string;
        request?: { fetch: typeof fetch };
        body: boolean;
        height: number;
        rootProps?: Record<string, unknown>;
      }) {
        const draw = ({ part, props, holds }: Shown, index: number) => {
          const Part = clover[part] as React.ComponentType<
            Record<string, unknown>
          >;
          return (
            <Part key={`${part}-${index}`} {...props}>
              {holds?.map(draw)}
            </Part>
          );
        };
        const parts = shown.map(draw);
        return (
          <clover.Root
            {...rootProps}
            iiifContent={iiifContent}
            request={request}
            style={
              row
                ? {
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "1rem",
                  }
                : { display: "grid", gap: "1rem" }
            }
          >
            {body && <clover.Body style={{ height }} />}
            {box ? (
              <div style={{ height: box, overflowY: "auto" }}>{parts}</div>
            ) : (
              parts
            )}
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
  holds,
  parts,
  row = false,
  box,
  resource = "paged",
  body = false,
  height = 320,
  rootProps,
}: PartDemoProps) {
  const address = RESOURCES[resource];
  const remote = address.startsWith("https://");
  const mock = useMock(remote ? "" : address);
  const url = remote ? address : mock;
  // The mocks' searches are answered here, as the static site cannot read `?q=`.
  const request = MOCK_SEARCH;
  const ready = url;
  return (
    // Its own box (`layout.css`), given up inside an example's frame.
    <div className="docs-part-demo">
      {ready && (
        <Live
          shown={parts ?? (part ? [{ part, props, holds }] : [])}
          row={row}
          box={box}
          iiifContent={url}
          request={request ?? undefined}
          body={body}
          height={height}
          rootProps={rootProps}
        />
      )}
    </div>
  );
}
