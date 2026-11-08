"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Table } from "nextra/components";

import { CodeBlock } from "docs/components/CodeBlock";
import { ExampleSwitch } from "docs/components/Clover4/ExampleSwitch";
import frame from "docs/components/Clover4/ViewerDocs.module.css";
import { ScrollTable } from "docs/components/ScrollTable";
import { example } from "docs/lib/example";
import { useRouter } from "docs/lib/router";
import { accentPresets } from "docs/components/Playground/playground-config";
import {
  BLACK,
  WHITE,
  mix,
  ratio,
  rgb,
  type Rgb,
} from "docs/lib/accent-contrast";
import styles from "./ContrastGuide.module.css";

/** A name in code, drawn as the docs' inline code is. */
const C = ({ children }: { children: React.ReactNode }) => (
  <code className="nextra-code">{children}</code>
);

/** Clover's colors, by the name each goes by once `--clover-color-` is dropped. */
type Token =
  | "primary"
  | "primary-muted"
  | "secondary"
  | "secondary-muted"
  | "secondary-alt"
  | "accent"
  | "accent-text"
  | "control"
  | "control-glyph";

type Palette = Record<Token, string>;

/** Each color, and in a word or two what it paints (Variables' "Colors" table). */
const TOKENS: { token: Token; paints: string }[] = [
  { token: "primary", paints: "Text" },
  { token: "primary-muted", paints: "Quieter text" },
  { token: "secondary", paints: "Ground" },
  { token: "secondary-muted", paints: "Hairlines, hover fills" },
  { token: "secondary-alt", paints: "Popover words, closed headings" },
  { token: "accent", paints: "Rings, selection" },
  { token: "accent-text", paints: "Links" },
  { token: "control", paints: "Control fill" },
  { token: "control-glyph", paints: "Control glyph" },
];

/** Clover's own colors, as its stylesheet falls back to them. */
const CLOVER: Palette = {
  primary: "#1a1d1e",
  "primary-muted": "#26292b",
  secondary: "#ffffff",
  "secondary-muted": "#e6e8eb",
  "secondary-alt": "#c1c8cd",
  accent: "#0065c3",
  "accent-text": "#0065c3",
  control: "#1a1d1e",
  "control-glyph": "#ffffff",
};

const hexOf = (color: Rgb) =>
  `#${color
    .map((c) =>
      Math.round(c * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

/** The site's own blue (`--accent-9`, `docs/styles/tokens.css`), the homepage's Clover blue. */
const SITE_BLUE = "#0f62fe";

/**
 * A homepage color as the site wears it (`accentPresets`, the Seamless story's Color):
 * Clover's colors, that accent, and its text step on a light page (`--accent-11`,
 * `tokens.css`: 82% of the accent mixed toward black in oklab).
 */
const worn = (accent: string): Palette => ({
  ...CLOVER,
  accent: accent.toLowerCase(),
  "accent-text": hexOf(mix(rgb(accent), 0.82, BLACK)),
});

/**
 * Palettes to start from (Mat, 2026-11-07: "add homepage color options here. spell them
 * out"): Clover's own; a dark one, this site's (its grays in a dark mode, `tokens.css`,
 * and its text step for the accent, 62% of it mixed toward white), the round controls
 * keeping their dark fill; then each of the homepage's colors, by its name.
 */
const PALETTES: { key: string; label: string; palette: Palette }[] = [
  { key: "clover", label: "Clover defaults", palette: CLOVER },
  {
    key: "dark",
    label: "Dark",
    palette: {
      ...CLOVER,
      primary: "#edeef0",
      "primary-muted": "#b0b4ba",
      secondary: "#111113",
      "secondary-muted": "#212225",
      "secondary-alt": "#363a3f",
      "accent-text": hexOf(mix(rgb(CLOVER.accent), 0.62, WHITE)),
    },
  },
  ...accentPresets.map(({ name, value }) => ({
    key: name.toLowerCase().replace(/[^a-z]+/g, "-"),
    label: name,
    palette: worn(value || SITE_BLUE),
  })),
];

/** `color-mix(in srgb, a p, b)`, as Clover mixes a placeholder or a half-strength line. */
const srgbMix = (a: Rgb, p: number, b: Rgb): Rgb =>
  a.map((c, i) => c * p + b[i] * (1 - p));

/**
 * How a pair is drawn in its sample: words, a ring, a glyph, a line, two tones, or a glyph
 * on its fill ringed in a third color (a control in the higher-contrast mode).
 */
type Sample = "text" | "ring" | "glyph" | "line" | "duo" | "ringed";

/**
 * Every pair Clover draws, as the Colors page's checklist names them: its colors, where
 * Clover draws it, and the ratio it needs (none where it marks nothing on its own).
 */
const PAIRS: {
  name: string;
  tokens: React.ReactNode;
  where: string;
  sample: Sample;
  colors: (palette: Palette) => { fg: Rgb; bg: Rgb };
  needs: number | null;
  /**
   * What `highContrast` puts in a failing pair's place (Mat, 2026-11-07: "add a high
   * contrast exception here as a sub row below. make it clear that it would pass if
   * `highContrast` is set"): the pair it takes instead, ringed in the accent, which then
   * needs 3:1 against `secondary` (`styles/contrast.css`). Shown under the pair's row
   * while the pair fails.
   */
  unless?: {
    tokens: React.ReactNode;
    where: string;
    colors: (palette: Palette) => { fg: Rgb; bg: Rgb };
    needs: number;
    /** Words, which ask no ring of the accent; else a glyph ringed in it. */
    sample?: "text";
    /** Only while `accent-text` follows the accent, as it does until a page sets it. */
    following?: boolean;
  };
}[] = [
  {
    name: "Text",
    tokens: (
      <>
        <C>primary</C> on <C>secondary</C>
      </>
    ),
    where: "The Panel, menus, popups, fields",
    sample: "text",
    colors: (p) => ({ fg: rgb(p.primary), bg: rgb(p.secondary) }),
    needs: 4.5,
  },
  {
    name: "Quieter text",
    tokens: (
      <>
        <C>primary-muted</C> on <C>secondary</C>
      </>
    ),
    where: "Descriptions, status, field edges",
    sample: "text",
    colors: (p) => ({ fg: rgb(p["primary-muted"]), bg: rgb(p.secondary) }),
    needs: 4.5,
  },
  {
    name: "Text under the pointer",
    tokens: (
      <>
        <C>primary</C> or <C>primary-muted</C> on <C>secondary-muted</C>
      </>
    ),
    where: "Rows and menu options",
    sample: "text",
    colors: (p) => {
      const bg = rgb(p["secondary-muted"]);
      const [fg] = [rgb(p.primary), rgb(p["primary-muted"])].sort(
        (a, b) => ratio(a, bg) - ratio(b, bg),
      );
      return { fg, bg };
    },
    needs: 4.5,
  },
  {
    name: "Quieter text in a popover",
    tokens: (
      <>
        <C>secondary-alt</C> on <C>primary</C>
      </>
    ),
    where: "A chapter's title on the seek bar, a place's date on the Map",
    sample: "text",
    colors: (p) => ({ fg: rgb(p["secondary-alt"]), bg: rgb(p.primary) }),
    needs: 4.5,
  },
  {
    name: "Placeholder",
    tokens: (
      <>
        <C>primary</C> 65% into <C>secondary</C>
      </>
    ),
    where: "Search's field",
    sample: "text",
    colors: (p) => ({
      fg: srgbMix(rgb(p.primary), 0.65, rgb(p.secondary)),
      bg: rgb(p.secondary),
    }),
    needs: 4.5,
  },
  {
    name: "Accent text",
    tokens: (
      <>
        <C>accent-text</C> on <C>secondary</C>
      </>
    ),
    where: "Links, Read more, the selected item's label",
    sample: "text",
    colors: (p) => ({ fg: rgb(p["accent-text"]), bg: rgb(p.secondary) }),
    needs: 4.5,
    unless: {
      tokens: (
        <>
          <C>primary</C> on <C>secondary</C>
        </>
      ),
      where:
        "With no accent-text set, text in the accent takes the text's color",
      colors: (p) => ({ fg: rgb(p.primary), bg: rgb(p.secondary) }),
      needs: 4.5,
      sample: "text",
      following: true,
    },
  },
  {
    name: "Accent text under the pointer",
    tokens: (
      <>
        <C>accent-text</C> on <C>secondary-muted</C>
      </>
    ),
    where: "A link in a row or a menu",
    sample: "text",
    colors: (p) => ({
      fg: rgb(p["accent-text"]),
      bg: rgb(p["secondary-muted"]),
    }),
    needs: 4.5,
    unless: {
      tokens: (
        <>
          <C>primary</C> on <C>secondary-muted</C>
        </>
      ),
      where:
        "With no accent-text set, text in the accent takes the text's color",
      colors: (p) => ({ fg: rgb(p.primary), bg: rgb(p["secondary-muted"]) }),
      needs: 4.5,
      sample: "text",
      following: true,
    },
  },
  {
    name: "Rings",
    tokens: (
      <>
        <C>accent</C> against <C>secondary</C>
      </>
    ),
    where: "Focus, the selected item, the current tab",
    sample: "ring",
    colors: (p) => ({ fg: rgb(p.accent), bg: rgb(p.secondary) }),
    needs: 3,
  },
  {
    name: "Ring under the pointer",
    tokens: (
      <>
        <C>accent</C> at half strength against <C>secondary</C>
      </>
    ),
    where: "A preview: pressing decides",
    sample: "ring",
    colors: (p) => ({
      fg: srgbMix(rgb(p.accent), 0.5, rgb(p.secondary)),
      bg: rgb(p.secondary),
    }),
    needs: null,
  },
  {
    name: "Control glyphs",
    tokens: (
      <>
        <C>control-glyph</C> on <C>control</C>
      </>
    ),
    where: "The round controls, Exit full screen",
    sample: "glyph",
    colors: (p) => ({ fg: rgb(p["control-glyph"]), bg: rgb(p.control) }),
    needs: 4.5,
  },
  {
    name: "Glyphs on the accent",
    tokens: (
      <>
        <C>control-glyph</C> on <C>accent</C>
      </>
    ),
    where: "A control under the pointer or focused",
    sample: "glyph",
    colors: (p) => ({ fg: rgb(p["control-glyph"]), bg: rgb(p.accent) }),
    needs: 4.5,
    unless: {
      tokens: (
        <>
          <C>control-glyph</C> on <C>control</C>, ringed in <C>accent</C>
        </>
      ),
      where: "The accent rings the control instead of filling it",
      colors: (p) => ({ fg: rgb(p["control-glyph"]), bg: rgb(p.control) }),
      needs: 4.5,
    },
  },
  {
    name: "Hairlines",
    tokens: (
      <>
        <C>secondary-muted</C> against <C>secondary</C>
      </>
    ),
    where: "Between regions: they mark nothing",
    sample: "line",
    colors: (p) => ({ fg: rgb(p["secondary-muted"]), bg: rgb(p.secondary) }),
    needs: null,
  },
  {
    name: "Closed heading's line",
    tokens: (
      <>
        <C>secondary-alt</C> at half strength against <C>secondary</C>
      </>
    ),
    where: "Under a closed heading in the Panel: its chevron marks it",
    sample: "line",
    colors: (p) => ({
      fg: srgbMix(rgb(p["secondary-alt"]), 0.5, rgb(p.secondary)),
      bg: rgb(p.secondary),
    }),
    needs: null,
  },
  {
    name: "Over a picture",
    tokens: (
      <>
        <C>primary</C> beside <C>secondary</C>
      </>
    ),
    where: "Hotspots, focus over images: one tone keeps 3:1 on any picture",
    sample: "duo",
    colors: (p) => ({ fg: rgb(p.primary), bg: rgb(p.secondary) }),
    needs: 9,
  },
];

/** What the accent needs against `secondary` where it rings a control (WCAG 1.4.11). */
const RING = 3;

/** How close to what it requires a ratio may come before it only just passes. */
const CLOSE = 0.1;

/**
 * A result, by its ratio's headroom over what it requires: failing; passing only just,
 * within `CLOSE` of it (the warning band); or passing, its green the stronger the more
 * room it has, from a light green at `CLOSE` to a full one at twice what it requires.
 */
function judge(value: number, requires: number | null) {
  if (requires === null) return null;
  const headroom = Math.floor(value * 100) / 100 / requires - 1;
  if (headroom < 0) return { result: "fail" as const, fill: 22 };
  if (headroom < CLOSE) return { result: "close" as const, fill: 30 };
  const share = Math.min(1, (headroom - CLOSE) / (1 - CLOSE));
  return { result: "pass" as const, fill: Math.round(12 + 20 * share) };
}

/** Each result's words, and the mark beside them, so color is never the only sign. */
const RESULTS = {
  pass: { mark: "✓", words: "Passes" },
  close: { mark: "!", words: "Just passes" },
  fail: { mark: "✕", words: "Fails" },
};

/**
 * A pair's `highContrast` exception, judged: its glyph on its new fill, failing too where
 * the accent cannot ring the control at 3:1 against `secondary`.
 */
function exception(
  unless: NonNullable<(typeof PAIRS)[number]["unless"]>,
  palette: Palette,
) {
  const { fg, bg } = unless.colors(palette);
  const value = ratio(fg, bg);
  const ring = ratio(rgb(palette.accent), rgb(palette.secondary));
  const judged = judge(value, unless.needs)!;
  return {
    ...unless,
    fg: hexOf(fg),
    bg: hexOf(bg),
    value,
    ring,
    judged:
      !unless.sample && judge(ring, RING)?.result === "fail"
        ? { result: "fail" as const, fill: 22 }
        : judged,
  };
}

/** A result's pill: its mark and words in its tone. */
function Result({ judged }: { judged: NonNullable<ReturnType<typeof judge>> }) {
  return (
    <span
      className={styles.result}
      data-result={judged.result}
      style={{ "--fill": `${judged.fill}%` } as React.CSSProperties}
    >
      <span aria-hidden="true">{RESULTS[judged.result].mark}</span>
      {RESULTS[judged.result].words}
    </span>
  );
}

/** A ratio as WCAG reads it, never rounded up: 4.49:1 fails. */
const shown = (value: number) =>
  `${(Math.floor(value * 100) / 100).toFixed(2)}:1`;

/** `#rgb` or `#rrggbb`, as `#rrggbb` in lowercase; null for anything else. */
const parseHex = (text: string) => {
  const value = text.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  if (/^#[0-9a-f]{3}$/.test(value))
    return `#${[...value.slice(1)].map((c) => c + c).join("")}`;
  return null;
};

/** One color of the palette: its swatch, a picker, and its hex to type. */
function Swatch({
  token,
  paints,
  value,
  onChange,
}: {
  token: Token;
  paints: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && parseHex(draft) === null;
  return (
    <div className={styles.swatch}>
      <input
        id={`${id}-pick`}
        className={styles.pick}
        type="color"
        value={value}
        aria-describedby={`${id}-paints`}
        onChange={(event) => onChange(event.target.value)}
      />
      <label htmlFor={`${id}-pick`} className={styles.token}>
        <C>{token}</C>
      </label>
      <span id={`${id}-paints`} className={styles.paints}>
        {paints}
      </span>
      <input
        className={styles.hex}
        type="text"
        value={draft ?? value}
        aria-label={`${token}, hex`}
        aria-invalid={invalid || undefined}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => {
          setDraft(event.target.value);
          const hex = parseHex(event.target.value);
          if (hex) onChange(hex);
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}

/** The plus a round control's sample shows. */
const Glyph = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" focusable="false">
    <path d="M8 3v10M3 8h10" />
  </svg>
);

/**
 * A pair drawn small, in its own two colors: words, a ring, a glyph, a line, two tones; or,
 * `ringed`, a glyph on its fill (`fg` on `bg`) ringed in `ring` on the `ground`.
 */
function PairSample({
  sample,
  fg,
  bg,
  ring,
  ground,
}: {
  sample: Sample;
  fg: string;
  bg: string;
  ring?: string;
  ground?: string;
}) {
  if (sample === "ringed")
    return (
      <span
        className={styles.sample}
        data-sample={sample}
        style={
          {
            "--fg": fg,
            "--bg": ground,
            "--disc": bg,
            "--ring": ring,
          } as React.CSSProperties
        }
        aria-hidden="true"
      >
        <span className={styles.disc}>
          <Glyph />
        </span>
      </span>
    );
  return (
    <span
      className={styles.sample}
      data-sample={sample}
      style={{ "--fg": fg, "--bg": bg } as React.CSSProperties}
      aria-hidden="true"
    >
      {sample === "glyph" && <Glyph />}
    </span>
  );
}

/**
 * The Styling page's contrast guide (Mat, 2026-11-07: "make the section more interactive.
 * show color palettes. allow a user to adjust color palettes and see the contrasts change
 * … make table less text"): Clover's palette, each color to change by a picker or its hex,
 * from a palette chosen on the switch over its card (`ExampleSwitch`), and every pair
 * Clover draws, each drawn small in its two colors and measured as the palette changes,
 * against what it needs (WCAG 1.4.3, 1.4.11), its result a mark and a word, never color
 * alone (1.4.1), with a status saying how many pass (4.1.3). Under it, the CSS that sets
 * what was changed. Drawn on the server with Clover's own colors, so the page's Markdown
 * keeps every pair and its ratio for audits and agents.
 */
export function ContrastGuide() {
  const id = useId();
  const { basePath } = useRouter();
  const view = useRef<HTMLIFrameElement>(null);
  const [chosen, setChosen] = useState(0);
  const [palette, setPalette] = useState<Palette>(CLOVER);
  /** Whether `accent-text` follows the accent, as Clover's does until it is set. */
  const [follows, setFollows] = useState(true);
  const start = PALETTES[chosen].palette;
  const set = (token: Token, value: string) => {
    if (token === "accent-text") setFollows(false);
    setPalette((was) => ({
      ...was,
      [token]: value,
      ...(token === "accent" && follows ? { "accent-text": value } : {}),
    }));
  };
  const choose = (index: number) => {
    setChosen(index);
    setPalette(PALETTES[index].palette);
    setFollows(
      PALETTES[index].palette["accent-text"] === PALETTES[index].palette.accent,
    );
  };
  /*
   * The Viewer over the palette, in Clover's look, dressed in its colors as they change,
   * on its page's ground in `secondary` (as Styling's "Do" asks), with no higher-contrast
   * mode the docs page may have, so it shows the palette as it is.
   */
  const dress = useCallback(() => {
    const root = view.current?.contentDocument?.documentElement;
    if (!root) return;
    for (const { token } of TOKENS)
      root.style.setProperty(`--clover-color-${token}`, palette[token]);
    const ground = rgb(palette.secondary);
    root.style.setProperty("background-color", palette.secondary);
    root.style.setProperty(
      "color-scheme",
      ratio(ground, WHITE) > ratio(ground, BLACK) ? "dark" : "light",
    );
    root.removeAttribute("data-high-contrast");
  }, [palette]);
  useEffect(dress, [dress]);
  const rows = useMemo(
    () =>
      PAIRS.map((pair) => {
        const { fg, bg } = pair.colors(palette);
        const value = ratio(fg, bg);
        const judged = judge(value, pair.needs);
        return {
          ...pair,
          fg: hexOf(fg),
          bg: hexOf(bg),
          value,
          judged,
          unless:
            pair.unless &&
            judged?.result === "fail" &&
            (!pair.unless.following || follows)
              ? exception(pair.unless, palette)
              : null,
        };
      }),
    [palette, follows],
  );
  const required = rows.filter((row) => row.judged !== null);
  const failing = required.filter((row) => row.judged?.result === "fail");
  const close = required.filter((row) => row.judged?.result === "close");
  const names = (list: typeof rows) =>
    list
      .map((row) =>
        row.unless && row.unless.judged.result !== "fail"
          ? `${row.name} (passes with highContrast)`
          : row.name,
      )
      .join(", ");
  const changed = TOKENS.filter(
    ({ token }) =>
      palette[token] !== CLOVER[token] && !(token === "accent-text" && follows),
  );
  const css = changed.length
    ? [
        ".my-layout {",
        ...changed.map(
          ({ token }) => `  --clover-color-${token}: ${palette[token]};`,
        ),
        "}",
      ]
    : ["/* Clover's own colors: nothing to set. */"];
  return (
    <>
      <ExampleSwitch
        id={`${id}-palette`}
        label="Palette"
        options={PALETTES.map(({ key, label }) => ({ key, label }))}
        chosen={chosen}
        onChoose={choose}
      />
      <figure className={frame.example}>
        {/* A template, to the card's edges; the frame names it, as an example. */}
        <div
          className={`${frame.preview} ${styles.viewer}`}
          data-bleed=""
          {...example()}
        >
          <iframe
            ref={view}
            className={styles.view}
            src={`${basePath}/examples/stylesheets/styles.html?level=3`}
            title="Example: the Viewer in this palette"
            loading="lazy"
            onLoad={dress}
          />
        </div>
        <div className={styles.palette}>
          {TOKENS.map(({ token, paints }) => (
            <Swatch
              key={token}
              token={token}
              paints={paints}
              value={palette[token]}
              onChange={(value) => set(token, value)}
            />
          ))}
        </div>
        <div className={styles.bar}>
          <p role="status" className={styles.summary}>
            {failing.length
              ? `${failing.length} of ${required.length} required contrasts fail: ${names(failing)}.`
              : close.length
                ? `All ${required.length} required contrasts pass, ${close.length} only just: ${names(close)}.`
                : `All ${required.length} required contrasts pass.`}
          </p>
          <button
            type="button"
            className={styles.reset}
            disabled={TOKENS.every(
              ({ token }) => palette[token] === start[token],
            )}
            onClick={() => choose(chosen)}
          >
            Reset
          </button>
        </div>
        <ScrollTable className={styles.table}>
          <thead>
            <Table.Tr>
              <Table.Th>Colors</Table.Th>
              <Table.Th>Contrast</Table.Th>
              <Table.Th>Requires</Table.Th>
              <Table.Th>Result</Table.Th>
            </Table.Tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <React.Fragment key={row.name}>
                <Table.Tr>
                  <Table.Td>
                    <span className={styles.pair}>
                      <PairSample sample={row.sample} fg={row.fg} bg={row.bg} />
                      <span>
                        <strong>{row.name}</strong>
                        <span className={styles.tokens}>{row.tokens}</span>
                        <span className={styles.where}>{row.where}</span>
                      </span>
                    </span>
                  </Table.Td>
                  <Table.Td className={styles.number}>
                    {shown(row.value)}
                  </Table.Td>
                  <Table.Td className={styles.number}>
                    {row.needs === null ? "None" : `${row.needs}:1`}
                  </Table.Td>
                  <Table.Td>
                    {row.judged === null ? (
                      <span className={styles.none}>—</span>
                    ) : (
                      <Result judged={row.judged} />
                    )}
                  </Table.Td>
                </Table.Tr>
                {row.unless && (
                  <Table.Tr className={styles.unless}>
                    <Table.Td>
                      <span className={styles.pair}>
                        <span className={styles.elbow} aria-hidden="true" />
                        <PairSample
                          sample={row.unless.sample ?? "ringed"}
                          fg={row.unless.fg}
                          bg={row.unless.bg}
                          ring={palette.accent}
                          ground={palette.secondary}
                        />
                        <span>
                          <strong>
                            <span className={styles.hidden}>{row.name}: </span>
                            With{" "}
                            <a href="#high-contrast">
                              <C>highContrast</C>
                            </a>
                          </strong>
                          <span className={styles.tokens}>
                            {row.unless.tokens}
                          </span>
                          <span className={styles.where}>
                            {row.unless.where}
                          </span>
                        </span>
                      </span>
                    </Table.Td>
                    <Table.Td className={styles.number}>
                      {shown(row.unless.value)}
                    </Table.Td>
                    <Table.Td className={styles.number}>
                      {`${row.unless.needs}:1`}
                    </Table.Td>
                    <Table.Td>
                      <Result judged={row.unless.judged} />
                      {!row.unless.sample && row.unless.ring < RING && (
                        <span className={styles.hint}>
                          Its accent ring is {shown(row.unless.ring)} against{" "}
                          <C>secondary</C>, under {RING}:1.
                        </span>
                      )}
                    </Table.Td>
                  </Table.Tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </ScrollTable>
        <div className={frame.code}>
          <CodeBlock lang="css" lines={css.length}>
            <pre data-lang="css">
              {/* As Nextra's highlighter writes a block: a line a span, breaks between. */}
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
