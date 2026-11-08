"use client";

import React, { useEffect, useRef, useState } from "react";
import { Table } from "nextra/components";

import { Scrub } from "docs/components/CodeValues";
import { ScrollTable } from "docs/components/ScrollTable";
import { example } from "docs/lib/example";

/**
 * Everything of Clover's that `1rem` sizes, by group, in rem of the page's root size, as
 * Clover's stylesheets set them (`scale.css`, the parts' own): what the reader's size
 * changes.
 */
const GROUPS = [
  {
    name: "Your page",
    rows: [["HTML page", 1, "Your page’s root `font-size`"]],
  },
  {
    name: "Spaces",
    rows: [
      ["--clover-space-3xs", 0.146, "φ⁻⁴"],
      ["--clover-space-2xs", 0.236, "φ⁻³"],
      ["--clover-space-xs", 0.382, "φ⁻²: a thumbnail over its label"],
      ["--clover-space-s", 0.618, "φ⁻¹: within a component"],
      ["--clover-space-m", 1, "Your `1rem`: between components in a region"],
      ["--clover-space-l", 1.618, "φ: a region’s inset"],
      ["--clover-space-xl", 2.618, "φ²"],
      ["--clover-space-2xl", 4.236, "φ³"],
    ],
  },
  {
    name: "Text",
    rows: [
      ["--clover-text-xs", 0.764, "A badge: a duration on a thumbnail"],
      ["--clover-text-s", 0.854, "Secondary text: times, formats, legends"],
      ["Automatically inherited", 1, "Baseline text content"],
      ["--clover-text-m", 1.146, "A section’s heading"],
      [
        "--clover-text-l",
        1.236,
        "An error’s headline, a sound Canvas’s label beside others, captions in a wide Body",
      ],
    ],
  },
  {
    name: "Controls and components",
    rows: [
      ["--clover-control", 2.236, "Every round control, wide and high"],
      [
        "--clover-inset",
        1.618,
        "A region’s inset, from its edge to its components",
      ],
      [
        "--clover-radius-pill",
        2,
        "Fully rounded corners, as on the round controls and Search’s field",
      ],
      ["--clover-items-height", 8, "The pictures in Items’ slider"],
      ["--clover-items-size", 10, "A cell of Items’ grid"],
      ["--clover-map-height", 24, "The Map"],
    ],
  },
] as const;

/** A browser's own root size, where the table starts. */
const BROWSER = 16;

/** The Viewer alone (`/test/viewer`, `ViewerScreen.tsx`), on the catalog. */
const VIEWER = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/test/viewer?r=catalog`;

/**
 * The scale's table at the root size the reader types (Mat, 2026-10-23: "a calculator
 * that live updates the table if someone adjusts the font size"): each space in rem, and
 * in pixels at that size, which the reader changes where the table gives it, on the rows
 * at `1rem` (Mat, 2026-10-23: "move the control here … nice and obvious"): a number to
 * type, step or drag, as live code's values are (`Scrub`, `CodeValues.tsx`). Over it
 * (Mat, 2026-10-23: "put this example above table"), a Viewer takes the size as its
 * `1rem` (Mat, 2026-10-23: "gate rem change to that one viewer"): framed, so its root is its own and the page's stays as it is, and told each
 * new size by a message, so it never reloads.
 */
export function ScaleCalculator({
  groups,
}: {
  /**
   * The groups shown, by name, beside "Your page", whose `1rem` they follow: Fonts shows
   * the Text, Spacing the Spaces and the Controls and components (Mat, 2026-11-07: "consider
   * how the calculator of rem can work on both pages"). Every group where none is named.
   */
  groups?: string[];
} = {}) {
  const [base, setBase] = useState(BROWSER);
  const px = (rem: number) => `${+(rem * base).toFixed(1)}px`;
  const frame = useRef<HTMLIFrameElement>(null);
  const tell = () =>
    frame.current?.contentWindow?.postMessage(
      { type: "clover-rem", px: base },
      location.origin,
    );
  useEffect(tell, [base]);
  return (
    <div className="docs-scale">
      {/* An example (`example()`): the iframe's title names it. */}
      <div {...example()}>
        <iframe
          ref={frame}
          className="docs-scale-viewer"
          src={VIEWER}
          title="Clover's Viewer, its 1rem the size set below"
          loading="lazy"
          onLoad={tell}
        />
      </div>
      <ScrollTable>
        <thead>
          <Table.Tr>
            <Table.Th>Variable</Table.Th>
            <Table.Th>Size</Table.Th>
            <Table.Th>At {+base.toFixed(2)}px</Table.Th>
            <Table.Th>What it sizes</Table.Th>
          </Table.Tr>
        </thead>
        {GROUPS.filter(
          (group) =>
            group.name === "Your page" ||
            !groups ||
            groups.includes(group.name),
        ).map((group) => (
          <tbody key={group.name}>
            <Table.Tr>
              <th colSpan={4} scope="rowgroup">
                {group.name}
              </th>
            </Table.Tr>
            {group.rows.map(([variable, rem, what]) => (
              <Table.Tr
                key={variable}
                data-base={group.name === "Your page" || undefined}
              >
                <Table.Td>
                  {variable.startsWith("--") ? (
                    <code className="nextra-code">{variable}</code>
                  ) : (
                    variable
                  )}
                </Table.Td>
                <Table.Td>{rem}rem</Table.Td>
                <Table.Td>
                  {group.name === "Your page" ? (
                    <>
                      <Scrub
                        label="Your page’s 1rem, in pixels"
                        min={8}
                        max={32}
                        rate={0.12}
                        value={base}
                        onChange={setBase}
                        className="docs-scale-value"
                        style={{
                          width: `calc(${String(base).length}ch + 0.472rem)`,
                        }}
                      />
                      px
                    </>
                  ) : (
                    px(rem)
                  )}
                </Table.Td>
                <Table.Td>
                  {what.split("`").map((part, at) =>
                    at % 2 ? (
                      <code key={at} className="nextra-code">
                        {part}
                      </code>
                    ) : (
                      part
                    ),
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </tbody>
        ))}
      </ScrollTable>
    </div>
  );
}
