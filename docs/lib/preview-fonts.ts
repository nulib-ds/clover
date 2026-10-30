import {
  EB_Garamond,
  Inter,
  Libre_Franklin,
  Lora,
  Merriweather,
  Open_Sans,
} from "next/font/google";

/**
 * Font families offered by the playground's page-theme control.
 *
 * A mix of Google families and system stacks, so a reader can see Clover pick up a real
 * webfont as well as something already on their machine.
 *
 * Loading six extra families sounds expensive and is not: `next/font/google` self-hosts
 * them and emits an `@font-face` per family, but a browser only downloads a font file
 * once a rule actually applies that family. Until someone picks one from the dropdown,
 * the cost is a few hundred bytes of CSS and zero font requests. Nothing is fetched from
 * Google at runtime either, so the static export stays self-contained.
 *
 * Weights are pinned to 400 and 700 to match the two-weight system the docs use
 * (`--weight-regular` / `--weight-bold` in `tokens.css`); the variable families cover
 * that range from one file, so `weight` is only declared for the static ones.
 *
 * These loaders have to be reachable from `pages/_app.tsx` — which they are, via
 * `docs/lib/page-theme.ts`. Reached only from `_document`, Next emits class names but no
 * stylesheet and downloads nothing.
 */

/*
 * Options are written out per loader rather than shared from one object. `next/font`
 * options have to be statically analyzable — the compiler reads them at build time to
 * fetch the files — so a spread would not survive, and each family also types `weight`
 * and `subsets` as its own literal union.
 */
const openSans = Open_Sans({ subsets: ["latin"], display: "swap" });
const libreFranklin = Libre_Franklin({ subsets: ["latin"], display: "swap" });
const inter = Inter({ subsets: ["latin"], display: "swap" });
const lora = Lora({ subsets: ["latin"], display: "swap" });
const ebGaramond = EB_Garamond({ subsets: ["latin"], display: "swap" });
const merriweather = Merriweather({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
});

export interface FontPreset {
  name: string;
  value: string;
  category: "Sans serif" | "Serif" | null;
}

export const fontPresets: FontPreset[] = [
  /* The site's own face (`--font-sans`, self-hosted), so choosing it clears the override. */
  { name: "Google Sans", value: "", category: "Sans serif" },
  {
    name: "Open Sans",
    value: openSans.style.fontFamily,
    category: "Sans serif",
  },
  {
    name: "Libre Franklin",
    value: libreFranklin.style.fontFamily,
    category: "Sans serif",
  },
  { name: "Inter", value: inter.style.fontFamily, category: "Sans serif" },
  {
    name: "System UI",
    value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    category: "Sans serif",
  },

  { name: "Lora", value: lora.style.fontFamily, category: "Serif" },
  {
    name: "EB Garamond",
    value: ebGaramond.style.fontFamily,
    category: "Serif",
  },
  {
    name: "Merriweather",
    value: merriweather.style.fontFamily,
    category: "Serif",
  },
  {
    name: "Georgia",
    value: 'Georgia, "Times New Roman", serif',
    category: "Serif",
  },
];
