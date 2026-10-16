import React, { useEffect, useRef, useState } from "react";

import { accentPresets } from "docs/components/Playground/playground-config";
import styles from "docs/components/PageSettings/PageSettings.module.css";
import { fontPresets } from "docs/lib/preview-fonts";
import { normalizeHex, setPageTheme, usePageTheme } from "docs/lib/page-theme";
import { useTheme } from "nextra-theme-docs";

/**
 * The site's accent, its blue (`--accent-9` in tokens.css). Shown when no
 * override is set: on the default preset's swatch, and in the colour input, which has no
 * empty state.
 */
const DEFAULT_ACCENT = "#0f62fe";

/**
 * Page settings — font, appearance and colour — behind a gear in the site header.
 *
 * They are not playground controls. Clover reads its colours and type from CSS custom
 * properties on whatever contains it, so these set the page, and every component on it
 * follows; that is the demonstration. Living in the header puts them on every page.
 *
 * A disclosure rather than a modal: no backdrop, nothing inert, because the point is to
 * change a value and watch the page respond. It closes on Escape (returning focus to
 * the gear), on a press outside, and when focus leaves it.
 */
const PageSettings: React.FC = () => {
  const { accent, font } = usePageTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /*
   * Appearance shares Nextra's next-themes state rather than keeping its own, so this
   * control and the one in Nextra's footer always agree. `theme` is undefined until the
   * client mounts, so the pressed state is withheld until then rather than guessed.
   */
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /*
   * The hex field keeps its own draft so it can be typed into. Bound straight to the
   * accent, the first keystroke of "#0f766e" ("#") is not a colour and would be thrown
   * away before the second arrived.
   */
  const [hexDraft, setHexDraft] = useState("");
  useEffect(() => setHexDraft(accent), [accent]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    // Tabbing out closes it, so it never covers the control that takes focus.
    const onFocusIn = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  const effectiveAccent = accent || DEFAULT_ACCENT;
  const isCustomAccent =
    Boolean(accent) &&
    !accentPresets.some(
      (preset) => preset.value.toLowerCase() === accent.toLowerCase(),
    );

  const commitHex = (raw: string) => {
    const value = raw.trim();
    const hex = value.startsWith("#") ? value : `#${value}`;
    if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return false;
    setPageTheme({ accent: normalizeHex(hex) });
    return true;
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        aria-controls="page-settings"
        aria-expanded={open}
        aria-label="Page settings"
        className={styles.trigger}
        onClick={() => setOpen((value) => !value)}
        ref={triggerRef}
        title="Page settings"
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="currentColor"
          height="20"
          viewBox="0 0 24 24"
          width="20"
        >
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      </button>

      {open && (
        <div
          aria-label="Page settings"
          className={styles.panel}
          id="page-settings"
          role="group"
        >
          <div className={styles.control}>
            <label className={styles.label} htmlFor="page-settings-font">
              Font family
            </label>
            {/* Grouped so the sans/serif split is visible while staying one control. */}
            <select
              className={styles.select}
              id="page-settings-font"
              onChange={(e) => setPageTheme({ font: e.target.value })}
              value={font}
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

          <div className={styles.control}>
            <span className={styles.label}>Appearance</span>
            <div
              aria-label="Appearance"
              className={styles.segmented}
              role="group"
            >
              {(["light", "dark"] as const).map((option) => (
                <button
                  aria-pressed={mounted ? theme === option : false}
                  className={styles.segment}
                  key={option}
                  onClick={() => setTheme(option)}
                  type="button"
                >
                  {option === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.control}>
            <span className={styles.label} id="page-settings-color">
              Color
            </span>
            <div
              aria-labelledby="page-settings-color"
              className={styles.colors}
              role="group"
            >
              {accentPresets.map((preset) => (
                <button
                  aria-current={
                    (preset.value || "") === accent ? "true" : undefined
                  }
                  className={styles.colorOption}
                  key={preset.name}
                  onClick={() => setPageTheme({ accent: preset.value })}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={styles.dot}
                    style={{ background: preset.value || DEFAULT_ACCENT }}
                  />
                  <span className={styles.colorName}>{preset.name}</span>
                </button>
              ))}

              {/*
               * Custom: the wheel opens the platform picker and tracks live as it is
               * dragged; the field beside it takes a hex directly.
               */}
              <div className={styles.custom} data-active={isCustomAccent}>
                <label className={styles.wheel} title="Color wheel">
                  <span className={styles.visuallyHidden}>Color wheel</span>
                  <input
                    className={styles.wheelInput}
                    onChange={(e) => setPageTheme({ accent: e.target.value })}
                    type="color"
                    value={effectiveAccent}
                  />
                </label>
                <input
                  aria-label="Custom hex color"
                  className={styles.hexInput}
                  maxLength={7}
                  onBlur={() => {
                    if (!commitHex(hexDraft)) setHexDraft(accent);
                  }}
                  onChange={(e) => {
                    setHexDraft(e.target.value);
                    commitHex(e.target.value);
                  }}
                  placeholder={DEFAULT_ACCENT.toUpperCase()}
                  spellCheck={false}
                  value={hexDraft}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PageSettings;
