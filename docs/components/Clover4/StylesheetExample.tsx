"use client";

import React, { useId, useState } from "react";
import { ExampleSwitch } from "docs/components/Clover4/ExampleSwitch";
import frame from "docs/components/Clover4/ViewerDocs.module.css";
import { example } from "docs/lib/example";
import { useRouter } from "docs/lib/router";
import styles from "./StylesheetExample.module.css";

/**
 * Each stylesheet the switch offers, by its page (`app/examples/stylesheets/[page]`), and
 * what the frame's name says of it, stepping up from base.css to Clover's whole look (Mat,
 * 2026-11-07: "base is first, and it steps up to base/spacing and then styles.css").
 */
const SHOWN = [
  { key: "base", label: "base.css", name: "with base.css alone" },
  {
    key: "spacing",
    label: "base.css + spacing.css",
    name: "with base.css and spacing.css",
  },
  {
    key: "styles",
    label: "styles.css (fully styled)",
    name: "in Clover's look",
  },
] as const;

/**
 * Styling's Base page's example, near its top (`content/docs/styling/base.mdx`; Mat,
 * 2026-11-07: "show me this in a rendered example"): the Viewer on the catalog on base.css
 * alone, on base.css then spacing.css, or in Clover's look, chosen on the switch over its
 * card as every example's is (`ExampleSwitch`). Each is a page of its own in a frame
 * (`app/examples/stylesheets/`), as the docs' pages carry Clover's whole stylesheet and
 * Nextra's reset, so only a page of its own shows base.css as a site meets it: its Viewer
 * drawn by the elements from the package's build, which find base.css on the page. A
 * frame made afresh for each, so a choice adds nothing to the page's history. Not a
 * preview host: an agent's preview would draw with the docs' stylesheet, not the page's
 * own (the scale calculator's frame on the same page is none either). Under it, the chosen
 * stylesheet's code, which the page gives as children marked `data-option` by `SHOWN`'s
 * keys, as `ContentStateExample` takes them. `layout="compose"` shows a layout composed of
 * parts in a Root in its place (`compose-…` pages; Mat, 2026-11-08: "show how base.css can
 * affect sub components if used alone in composing"). `sheets` names the stylesheets
 * offered, all three by default; given one, no switch shows, as on Styling's landing page,
 * which keeps styles.css's example alone (Mat, 2026-11-08: "keep examples for importing of
 * styles.css on main page").
 */
export function StylesheetExample({
  children,
  layout = "viewer",
  sheets,
}: {
  children?: React.ReactNode;
  layout?: "viewer" | "compose";
  sheets?: (typeof SHOWN)[number]["key"][];
}) {
  const id = useId();
  const { basePath } = useRouter();
  const offered = sheets
    ? SHOWN.filter(({ key }) => sheets.includes(key))
    : SHOWN;
  const [chosen, setChosen] = useState(0);
  const shown = offered[chosen] ?? offered[0];
  const compose = layout === "compose";
  return (
    <>
      {offered.length > 1 && (
        <ExampleSwitch
          id={`${id}-sheet`}
          label="Stylesheet"
          options={offered.map(({ key, label }) => ({ key, label }))}
          chosen={chosen}
          onChoose={setChosen}
        />
      )}
      <figure className={frame.example}>
        {/* A template, to the card's edges; the frame names it, as an example. */}
        <div className={frame.preview} data-bleed="" {...example()}>
          <iframe
            key={shown.key}
            className={styles.frame}
            src={`${basePath}/examples/stylesheets/${compose ? "compose-" : ""}${shown.key}.html`}
            title={`Example: ${compose ? "a composed layout" : "the Viewer"} ${shown.name}`}
          />
        </div>
        <div className={frame.code}>
          {/*
           * The chosen stylesheet's code shows; the others' are hidden by CSS, not
           * `hidden`, so the page's Markdown keeps all three (`data-shown`).
           */}
          {React.Children.map(children, (child) =>
            React.isValidElement<{
              "data-option"?: string;
              "data-shown"?: string;
            }>(child) && child.props["data-option"] !== undefined
              ? React.cloneElement(child, {
                  "data-shown":
                    child.props["data-option"] === shown.key ? "" : undefined,
                })
              : child,
          )}
        </div>
      </figure>
    </>
  );
}
