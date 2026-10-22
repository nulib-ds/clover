import React, { useId } from "react";
import styles from "docs/components/Home/Home.module.css";
import { accentPresets } from "docs/components/Playground/playground-config";
import { fontPresets } from "docs/lib/preview-fonts";
import { setPageTheme, usePageTheme } from "docs/lib/page-theme";

/** The site's accent (`--accent-9` in `tokens.css`), for the code to name. */
const SITE_ACCENT = "#0F62FE";

/** A family as a page would write it: its name, then a generic family. */
const familyOf = (font: string) => {
  const preset = fontPresets.find((item) => item.value === font);
  if (!preset) return font;
  if (preset.name === "System UI") return "system-ui, sans-serif";
  return `"${preset.name}", ${preset.category === "Serif" ? "serif" : "sans-serif"}`;
};

/** The chosen accent, by its preset's name where it has one, and as the code writes it. */
const useAccent = () => {
  const { accent, font } = usePageTheme();
  const named = accentPresets.find(
    (preset) => preset.value.toLowerCase() === accent.toLowerCase(),
  );
  return { font, named, hex: (accent || SITE_ACCENT).toUpperCase() };
};

/*
 * "Why Clover"'s Seamless story, live, in two pieces it lays out apart (`Home.module.css`):
 * the site's Font family and Color, in the column a figure takes in the other stories,
 * setting the whole site and remembered across its pages (`page-theme.ts`; the site has
 * no other control for them, Mat, 2026-10-20), and under its words the CSS a page would
 * write for its brand, which follows them, a value they change lit a moment.
 */
export function BrandControls() {
  const id = useId();
  const { font, named, hex } = useAccent();
  return (
    <div className={styles.brandControls}>
      <div className={styles.brandControl}>
        <label className={styles.brandLabel} htmlFor={`${id}-font`}>
          Font family
        </label>
        <select
          id={`${id}-font`}
          className={styles.brandSelect}
          value={font}
          onChange={(event) => setPageTheme({ font: event.target.value })}
        >
          {(["Sans serif", "Serif"] as const).map((category) => (
            <optgroup key={category} label={category}>
              {fontPresets
                .filter((preset) => preset.category === category)
                .map((preset) => (
                  <option key={preset.name} value={preset.value}>
                    {preset.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className={styles.brandControl}>
        <span className={styles.brandLabel} id={`${id}-color`}>
          Color <span className={styles.brandName}>{named?.name ?? hex}</span>
        </span>
        <div
          role="group"
          aria-labelledby={`${id}-color`}
          className={styles.brandSwatches}
        >
          {accentPresets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className={styles.brandSwatch}
              aria-label={preset.name}
              aria-pressed={preset === named}
              title={preset.name}
              style={{ background: preset.value || SITE_ACCENT }}
              onClick={() => setPageTheme({ accent: preset.value })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** The CSS a page would write, always four lines, so it never changes height. */
export function BrandCode() {
  const { font, hex } = useAccent();
  const family = familyOf(font);
  return (
    <pre className={`${styles.storyCode} ${styles.brandCode}`}>
      <code>
        <span className={styles.codeSelector}>main</span>{" "}
        <span className={styles.codePunctuation}>{"{"}</span>
        {"\n  "}
        <span className={styles.codeRun}>
          <span className={styles.codeProperty}>font-family</span>
          <span className={styles.codePunctuation}>:</span>{" "}
          <span
            key={family}
            className={`${styles.codeValue} ${styles.brandFresh}`}
          >
            {family}
          </span>
          <span className={styles.codePunctuation}>;</span>
        </span>
        {"\n  "}
        <span className={styles.codeRun}>
          <span className={styles.codeProperty}>--clover-color-accent</span>
          <span className={styles.codePunctuation}>:</span>{" "}
          <span
            key={hex}
            className={`${styles.codeValue} ${styles.brandFresh}`}
          >
            {hex}
          </span>
          <span className={styles.codePunctuation}>;</span>
        </span>
        {"\n"}
        <span className={styles.codePunctuation}>{"}"}</span>
      </code>
    </pre>
  );
}
