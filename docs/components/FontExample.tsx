"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";

import { CodeBlock } from "docs/components/CodeBlock";
import { ExampleSwitch } from "docs/components/Clover4/ExampleSwitch";
import frame from "docs/components/Clover4/ViewerDocs.module.css";
import { example } from "docs/lib/example";
import { fontPresets, type FontPreset } from "docs/lib/preview-fonts";
import { useRouter } from "docs/lib/router";
import styles from "./FontExample.module.css";

const unquote = (name: string) => name.trim().replace(/^["']|["']$/g, "");

/** The site's own face (`--font-sans`, `tokens.css`), whatever font the page wears now. */
function siteFont() {
  const root = document.documentElement;
  const worn = root.style.getPropertyValue("--font-sans");
  if (worn) root.style.removeProperty("--font-sans");
  const own = getComputedStyle(root).getPropertyValue("--font-sans").trim();
  if (worn) root.style.setProperty("--font-sans", worn);
  return own;
}

/**
 * The page's `@font-face` rules for a font's families, their files at full addresses, so
 * another document can draw it: `next/font` names its families for this page alone.
 */
function facesOf(fontFamily: string) {
  const families = new Set(fontFamily.split(",").map(unquote));
  const faces: string[] = [];
  const walk = (rules: CSSRuleList, base: string) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule) {
        if (families.has(unquote(rule.style.getPropertyValue("font-family"))))
          faces.push(
            rule.cssText.replace(
              /url\((["']?)([^"')]+)\1\)/g,
              (_, quote, url) => `url("${new URL(url, base).href}")`,
            ),
          );
      } else if ("cssRules" in rule)
        walk((rule as CSSGroupingRule).cssRules, base);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walk(sheet.cssRules, sheet.href ?? document.baseURI);
    } catch {
      // Another origin's sheet, which holds none of the site's faces.
    }
  }
  return faces.join("\n");
}

/**
 * The font as a page would write it: a system stack as it is (it ends on its kind), a web
 * font by its name and kind, as `next/font` names its families for this site alone.
 */
const written = ({ name, value, category }: FontPreset) =>
  /(^|,)\s*(sans-serif|serif)\s*$/.test(value)
    ? value
    : `"${name}", ${category === "Serif" ? "serif" : "sans-serif"}`;

/**
 * The Fonts page's example (Mat, 2026-11-07: "like on colors, add a viewer with homepage
 * font options above it. document in a codeblock html tag change and inheritance"): the
 * Viewer, framed as Colors' is (the stylesheet example's `styles.html`), in each of the
 * homepage's fonts (`fontPresets`, its Seamless story's), chosen on the switch over its
 * card (`ExampleSwitch`), starting on the one the site wears. Its page is given the font
 * on `body` and its headings, with the faces that draw it, and Clover takes it from
 * there; under it, the CSS a page writes for it, on `html`, which Clover inherits.
 */
export function FontExample() {
  const id = useId();
  const { basePath } = useRouter();
  const view = useRef<HTMLIFrameElement>(null);
  const [chosen, setChosen] = useState(0);
  const preset = fontPresets[chosen];
  // The font the site wears, chosen on the homepage, to start on.
  useEffect(() => {
    const worn = document.documentElement.style.getPropertyValue("--font-sans");
    const at = fontPresets.findIndex(({ value }) => value && value === worn);
    if (at > 0) setChosen(at);
  }, []);
  const dress = useCallback(() => {
    const doc = view.current?.contentDocument;
    if (!doc?.head) return;
    const family = preset.value || siteFont();
    let style = doc.getElementById("font-example");
    if (!style) {
      style = doc.createElement("style");
      style.id = "font-example";
      doc.head.append(style);
    }
    style.textContent = `${facesOf(family)}\nbody, h1, h2, h3, h4, h5, h6 { font-family: ${family}; }`;
  }, [preset]);
  useEffect(dress, [dress]);
  const css = [
    "/* Clover sets no font: its text takes your page's. */",
    "html {",
    `  font-family: ${written(preset)};`,
    "}",
  ];
  return (
    <>
      <ExampleSwitch
        id={`${id}-font`}
        label="Font"
        options={fontPresets.map(({ name }) => ({ key: name, label: name }))}
        chosen={chosen}
        onChoose={setChosen}
      />
      <figure className={frame.example}>
        {/* A template, to the card's edges; the frame names it, as an example. */}
        <div className={frame.preview} data-bleed="" {...example()}>
          <iframe
            ref={view}
            className={styles.frame}
            src={`${basePath}/examples/stylesheets/styles.html`}
            title={`Example: the Viewer in ${preset.name}`}
            loading="lazy"
            onLoad={dress}
          />
        </div>
        <div className={frame.code}>
          <CodeBlock lang="css" lines={css.length}>
            <pre data-lang="css">
              <code className="nextra-code">
                {css.map((line, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && "\n"}
                    <span>{line}</span>
                  </React.Fragment>
                ))}
              </code>
            </pre>
          </CodeBlock>
        </div>
      </figure>
    </>
  );
}
