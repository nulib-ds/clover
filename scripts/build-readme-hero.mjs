import { execFileSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, ".github/assets");
const FIXTURES = join(OUT, "fixtures");

/*
 * The READMEs' hero (Mat, 2026-11-11: "evoke clover's modular capabilities across media
 * types … think hero landing page graphic/superbowl commercial"; "make it look more flat
 * at 0deg with a slight perspective as if I am looking up at it straight on. the items
 * should appear as if they [are] exploding out of the screen"; "make the bike catalog the
 * main thing … the main one should look like the viewer", the Esu Scene and the Hess
 * Canvas beside it as options; "make things explode out still!!! fun!! superbowl. think
 * back to the first graphic with the 3d look"; then "make it explode more. make sure the
 * spreads of a `paged` canvases are showing in both items and the Canvas. tuck scene and
 * Canvas a little underneath the right side of viewer").
 *
 * A Viewer, straight on and seen from a little below, as its Default template shows the
 * White bicycle catalog, a `paged` book, with Page 4's Now annotation set: its Label;
 * its Body on the spread of Page 3 and Page 4, Now's region marked; Items, its spreads,
 * Page 3 and Page 4 chosen; and its Panel of Annotations, a line from Now to its region,
 * and About. Its parts are blocks on a Root, white faces and the accent's sides, each
 * named in its top edge. It shows flat for a beat, then blows apart: the blocks spring
 * off the Root and away from its middle, with speed lines and sparks, and from under its
 * right side slide the other media, a Canvas of the Nuremberg footage (Hess annotated)
 * and a Scene, the Esu shrine standing out of it.
 *
 * `npm run build:readme-hero` writes `.github/assets/hero-light.svg` and `hero-dark.svg`,
 * and a still copy of each (`-still`), which the READMEs pick by GitHub's theme and the
 * reader's motion preference (`<picture>`), and their alt and credit line. The fixtures'
 * pictures are taken once into `.github/assets/fixtures/` (the shrine drawn by three.js
 * through this picture's own camera) and kept; `--fetch` takes them again.
 *
 * Its colors are the site's tokens (`docs/styles/tokens.css`) and Clover's control's,
 * each step mixed as the tokens mix theirs, in OKLab; its type the site's, Google Sans
 * Flex, embedded ("make sure fonts are google sans"), which loads even under the policy
 * GitHub serves an SVG with. Every word in it is in the alt.
 *
 * Its motion plays once, in under 5 seconds, then holds (WCAG 2.2.2): every element's own
 * style is how it ends, so the still copy is the same file with no motion. Nothing flashes
 * (2.3.1).
 */

/* ── Colors ──────────────────────────────────────────────────────────────── */

const channels = (hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gamma = (c) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

function toOklab(hex) {
  const [r, g, b] = channels(hex).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb
    .map((c) =>
      Math.round(gamma(Math.min(1, Math.max(0, c))) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** `color-mix(in oklab, a share, b)`, as the tokens mix their steps. */
const mix = (a, share, b) => {
  const x = toOklab(a);
  const y = toOklab(b);
  return fromOklab(x.map((v, i) => v * share + y[i] * (1 - share)));
};

const ACCENT = "#0f62fe";
const BLACK = "#000000";
const WHITE = "#ffffff";
/* Clover's round controls: its `control` fill, under its white `control-glyph`. */
const CONTROL = "#1a1d1e";

const GRAYS = {
  light: {
    g1: "#ffffff",
    g2: "#f9f9fb",
    g3: "#f0f0f3",
    g4: "#e8e8ec",
    g6: "#dddde3",
    g8: "#b9bbc6",
    g11: "#60646c",
    g12: "#1c2024",
    ink: "#000000",
  },
  dark: {
    g1: "#111113",
    g2: "#18191b",
    g3: "#212225",
    g4: "#272a2d",
    g6: "#363a3f",
    g8: "#4a4f55",
    g11: "#b0b4ba",
    g12: "#edeef0",
    ink: "#ffffff",
  },
};

function palette(name) {
  const dark = name === "dark";
  const g = GRAYS[name];
  return {
    name,
    dark,
    ...g,
    a9: ACCENT,
    a3: mix(ACCENT, dark ? 0.22 : 0.12, g.g1),
    a6: mix(ACCENT, dark ? 0.45 : 0.38, g.g1),
    a11: dark ? mix(ACCENT, 0.62, WHITE) : mix(ACCENT, 0.82, BLACK),
    /* The parts: white faces (the dark page's raised surface), the accent's sides. */
    face: dark ? g.g4 : WHITE,
    side: ACCENT,
    shade: mix(ACCENT, 0.72, BLACK),
    edge: g.g6,
    /* The Body, behind the pages, and its round controls. */
    body: dark ? g.g2 : g.g3,
    control: dark ? g.g8 : CONTROL,
    /* The Root under them. */
    rootFace: dark ? g.g3 : g.g2,
    rootSide: dark ? g.g2 : g.g4,
    rootShade: dark ? mix(g.g2, 0.7, BLACK) : g.g6,
    shadow: dark ? 0.55 : 0.18,
    line: dark ? g.g8 : g.g6,
  };
}

/* ── Type ────────────────────────────────────────────────────────────────── */

/* The site's family, embedded (`docs/styles/fonts.css` serves the same file). */
const FONT_FACE = `@font-face{font-family:"Google Sans Flex";src:url(data:font/woff2;base64,${readFileSync(join(ROOT, "docs/styles/fonts/google-sans-flex-latin.woff2")).toString("base64")}) format("woff2");font-weight:400 700;font-display:block}`;
const FONT_SANS = "'Google Sans Flex', ui-sans-serif, system-ui, sans-serif";
/*
 * A part's name, in the site's family as every word here is (Mat, 2026-11-11: "make sure
 * fonts are google sans", then "Switch to Google Sans" for the names too): its size, its
 * weight, and how wide each name sets in it (`prepareType`), so its pill fits it and
 * every engine sets it alike (`textLength`).
 */
const NAME = { size: 20, weight: 600 };
const NAMES = {};
/*
 * An annotation's words, as Clover sets them, in regular weight (Mat, 2026-11-11: "Now
 * should not be bold"): in the Panel's list (`ENTRY`), and on its Tip over the Body
 * (`TIP`), each at its size, its lines' spacing and how wide they may run, broken where
 * they set past that (`LINES`, by `prepareType`).
 */
const ENTRY = { size: 17, line: 23, wide: 268 };
const TIP = { size: 18, line: 25, wide: 236, pad: [16, 13] };
const LINES = {};

/** How wide each name sets, and where each text breaks, in the embedded family, as a
 * browser sets them. */
async function prepareType(names, texts) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><style>${FONT_FACE}</style>`);
    const nameFont = `${NAME.weight} ${NAME.size}px "Google Sans Flex"`;
    const set = await page.evaluate(
      async ({ names, texts, nameFont }) => {
        const fonts = [nameFont, ...texts.map(({ font }) => font)];
        for (const font of fonts) await document.fonts.load(font);
        if (!fonts.every((font) => document.fonts.check(font))) return null;
        const context = document.createElement("canvas").getContext("2d");
        const width = (font, words) => {
          context.font = font;
          return context.measureText(words).width;
        };
        return {
          names: names.map((name) => width(nameFont, name)),
          texts: texts.map(({ text, font, wide }) => {
            const lines = [];
            for (const word of text.split(" ")) {
              const last = lines.length - 1;
              if (last >= 0 && width(font, `${lines[last]} ${word}`) <= wide)
                lines[last] = `${lines[last]} ${word}`;
              else lines.push(word);
            }
            return {
              lines,
              widest: Math.max(...lines.map((line) => width(font, line))),
            };
          }),
        };
      },
      { names, texts, nameFont },
    );
    if (!set)
      throw new Error("Google Sans Flex did not load to measure the words");
    names.forEach((name, i) => (NAMES[name] = set.names[i]));
    texts.forEach(({ key }, i) => (LINES[key] = set.texts[i]));
  } finally {
    await browser.close();
  }
}

/* ── The camera ──────────────────────────────────────────────────────────── */

/*
 * A pinhole camera in front of the screen, a little below its middle and looking a little
 * up at it (Mat, 2026-11-11: "as if I am looking up at it straight on"), so the Viewer is
 * flat and square to the reader, its top a touch narrower, and what stands out of it
 * shows its underside. The world's x runs right, y down, z out of the screen toward the
 * reader, in the picture's pixels where the Root's face is.
 */
const FOCAL = 2150;
const CAMERA = [0, 560, 2200];
const TARGET = [0, -140, 0];
/* The picture's size and the camera's middle in it, set once its frame is known
 * (`frame`): a first pass gathers where everything falls (`BOUNDS`). */
let W = 0;
let H = 0;
let PX = 0;
let PY = 0;
let BOUNDS = null;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => {
  const length = Math.hypot(...a);
  return a.map((v) => v / length);
};
const FORWARD = unit(sub(TARGET, CAMERA));
const RIGHT = [1, 0, 0];
const DOWN = [0, -FORWARD[2], FORWARD[1]];

/** Where a point of the world falls in the picture. */
function project(point) {
  const q = sub(point, CAMERA);
  const depth = dot(q, FORWARD);
  const x = PX + (FOCAL * dot(q, RIGHT)) / depth;
  const y = PY + (FOCAL * dot(q, DOWN)) / depth;
  if (BOUNDS) {
    BOUNDS[0] = Math.min(BOUNDS[0], x);
    BOUNDS[1] = Math.min(BOUNDS[1], y);
    BOUNDS[2] = Math.max(BOUNDS[2], x);
    BOUNDS[3] = Math.max(BOUNDS[3], y);
  }
  return [x, y];
}

const n = (x) => Math.round(x * 10) / 10;
const f4 = (x) => Math.round(x * 10000) / 10000;
const xy = ([x, y]) => `${n(x)} ${n(y)}`;
const polygon = (points) => `M${points.map(xy).join("L")}Z`;

function solve3(m, b) {
  const det = (a) =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const d = det(m);
  return [0, 1, 2].map(
    (k) => det(m.map((row, r) => row.map((v, c) => (c === k ? b[r] : v)))) / d,
  );
}

/**
 * The flat transform that best carries a rectangle drawn in its own coordinates (`w` by
 * `h`) onto four points of the picture: exact for what is square to the camera, a
 * least-squares fit, a pixel or two at most here, for what is turned.
 */
function fit(w, h, corners) {
  const local = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const m = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const bx = [0, 0, 0];
  const by = [0, 0, 0];
  local.forEach(([x, y], i) => {
    const v = [x, y, 1];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) m[r][c] += v[r] * v[c];
      bx[r] += v[r] * corners[i][0];
      by[r] += v[r] * corners[i][1];
    }
  });
  const [a, c, e] = solve3(m, bx);
  const [b, d, f] = solve3(m, by);
  return [a, b, c, d, e, f];
}

const matrix = (m) =>
  `matrix(${m.map((v, i) => (i < 4 ? f4(v) : n(v))).join(" ")})`;
const css = (m) =>
  `matrix(${m.map((v, i) => (i < 4 ? f4(v) : n(v))).join(",")})`;
const apply = (m, [x, y]) => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];
const invert = ([a, b, c, d, e, f]) => {
  const det = a * d - b * c;
  return [
    d / det,
    -b / det,
    -c / det,
    a / det,
    (c * f - d * e) / det,
    (b * e - a * f) / det,
  ];
};

/** The transform that carries a face `w` by `h` onto the rectangle (x, y, sw, sh) at z. */
const faceOnto = (w, h, [x, y, sw, sh], z) =>
  fit(w, h, [
    project([x, y, z]),
    project([x + sw, y, z]),
    project([x + sw, y + sh, z]),
    project([x, y + sh, z]),
  ]);

/** Projects what passes and leaves the picture's frame to the rest (a ring, a streak). */
function unbounded(draw) {
  const kept = BOUNDS;
  BOUNDS = null;
  try {
    return draw();
  } finally {
    BOUNDS = kept;
  }
}

/** Turns a point about x, then y, then z, by degrees. */
function turn([x, y, z], [rx = 0, ry = 0, rz = 0]) {
  const [a, b, c] = [rx, ry, rz].map((d) => (d * Math.PI) / 180);
  let [px, py, pz] = [
    x,
    y * Math.cos(a) - z * Math.sin(a),
    y * Math.sin(a) + z * Math.cos(a),
  ];
  [px, pz] = [
    px * Math.cos(b) + pz * Math.sin(b),
    -px * Math.sin(b) + pz * Math.cos(b),
  ];
  [px, py] = [
    px * Math.cos(c) - py * Math.sin(c),
    px * Math.sin(c) + py * Math.cos(c),
  ];
  return [px, py, pz];
}

/**
 * A flat thing `w` by `h` in the world, its middle at `at`, turned by `angles`: its
 * corners in the world, `depth` behind its face, and the transform its face is drawn by.
 */
function pose({ at, w, h, angles = [0, 0, 0] }) {
  const corner = (u, v, depth = 0) => {
    const [x, y, z] = turn([u - w / 2, v - h / 2, -depth], angles);
    return [at[0] + x, at[1] + y, at[2] + z];
  };
  const face = [corner(0, 0), corner(w, 0), corner(w, h), corner(0, h)];
  return { corner, face, m: fit(w, h, face.map(project)) };
}

/** A rounded rectangle square to the camera at `z`: its outline's points in the world. */
function outline(x, y, w, h, r, z) {
  const points = [];
  const corners = [
    [x + w - r, y + r, -90],
    [x + w - r, y + h - r, 0],
    [x + r, y + h - r, 90],
    [x + r, y + r, 180],
  ];
  for (const [cx, cy, start] of corners)
    for (let i = 0; i <= 6; i++) {
      const a = ((start + (90 * i) / 6) * Math.PI) / 180;
      points.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]);
    }
  return points;
}

function hull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (
        out.length >= 2 &&
        cross(out[out.length - 2], out[out.length - 1], p) <= 0
      )
        out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/**
 * A block square to the camera, its face (`x`, `y`, `w`, `h`, `r`) from `back` to `front`
 * in z: its sides as one shape, its underside, and its face's outline and transform.
 */
function block({ x, y, w, h, r }, back, front) {
  const near = outline(x, y, w, h, r, front).map(project);
  const far = outline(x, y, w, h, r, back).map(project);
  const under = [
    project([x + r, y + h, front]),
    project([x + w - r, y + h, front]),
    project([x + w - r, y + h, back]),
    project([x + r, y + h, back]),
  ];
  const sides = hull([...near, ...far]);
  return {
    sides: polygon(sides),
    under: polygon(under),
    /* The same, as points, to draw in a face's own coordinates. */
    sidesAt: sides,
    underAt: under,
    faceAt: near,
    face: polygon(near),
    m: fit(w, h, [
      project([x, y, front]),
      project([x + w, y, front]),
      project([x + w, y + h, front]),
      project([x, y + h, front]),
    ]),
  };
}

/* ── Shapes ──────────────────────────────────────────────────────────────── */

let ids = 0;
const uid = (prefix) => `${prefix}${++ids}`;
const hairline = (color) =>
  ` stroke="${color}" stroke-width="1" vector-effect="non-scaling-stroke"`;
const rect = (x, y, w, h, rx, attrs = "") =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rx ? ` rx="${n(rx)}"` : ""} ${attrs}/>`;
const escape = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A rounded rectangle's outline, as path data, to cut out of another (`evenodd`). */
const roundedPath = (x, y, w, h, r) =>
  `M${n(x + r)} ${n(y)}H${n(x + w - r)}A${r} ${r} 0 0 1 ${n(x + w)} ${n(y + r)}V${n(y + h - r)}A${r} ${r} 0 0 1 ${n(x + w - r)} ${n(y + h)}H${n(x + r)}A${r} ${r} 0 0 1 ${n(x)} ${n(y + h - r)}V${n(y + r)}A${r} ${r} 0 0 1 ${n(x + r)} ${n(y)}Z`;

/** A clip, in the coordinates of whatever uses it. */
function clip(defs, shape) {
  const id = uid("c");
  defs.push(`<clipPath id="${id}">${shape}</clipPath>`);
  return `clip-path="url(#${id})"`;
}
const roundClip = (defs, x, y, w, h, r = 0) => clip(defs, rect(x, y, w, h, r));

/** A pointer, its tip at (x, y). */
const pointer = (x, y) =>
  `<path transform="translate(${n(x)} ${n(y)}) rotate(-8) scale(1.6)" d="M0 0L0 25L6.2 19.6L10.4 29.2L14.6 27.4L10.5 18H19Z" fill="${BLACK}" stroke="${WHITE}" stroke-width="2" stroke-linejoin="round"/>`;

/**
 * A disc standing out of a face toward the reader, its middle at (x, y) of the world and
 * its face at `front`: its side, its face and what is on it (in its own coordinates, its
 * middle at 0, 0), e.g. a control's glyph.
 */
function disc(x, y, r, back, front, { face, side }, glyph = "") {
  const ring = (z) =>
    Array.from({ length: 49 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2;
      return [x + r * Math.cos(a), y + r * Math.sin(a), z];
    });
  const near = ring(front).map(project);
  const far = ring(back).map(project);
  const m = fit(2 * r, 2 * r, [
    project([x - r, y - r, front]),
    project([x + r, y - r, front]),
    project([x + r, y + r, front]),
    project([x - r, y + r, front]),
  ]);
  return `<path d="${polygon(hull([...near, ...far]))}" fill="${side}"/><path d="${polygon(near)}" fill="${face}"/><g transform="${matrix(m)}"><g transform="translate(${r} ${r})">${glyph}</g></g>`;
}

const plusGlyph = (r, minus = false) =>
  `<path d="M${-r * 0.4} 0H${r * 0.4}${minus ? "" : `M0 ${-r * 0.4}V${r * 0.4}`}" stroke="${WHITE}" stroke-width="${n(r * 0.17)}" stroke-linecap="round"/>`;
const playGlyph = (r) =>
  `<path d="M${n(-r * 0.28)} ${n(-r * 0.44)}L${n(r * 0.46)} 0L${n(-r * 0.28)} ${n(r * 0.44)}Z" fill="${WHITE}" stroke="${WHITE}" stroke-width="${n(r * 0.09)}" stroke-linejoin="round"/>`;
/** Items' caret, pointing on (or back), as its previous and next draw it. */
const caretGlyph = (r, back = false) =>
  `<path d="M${n(-r * 0.14)} ${n(-r * 0.38)}L${n(r * 0.24)} 0L${n(-r * 0.14)} ${n(r * 0.38)}"${back ? ` transform="scale(-1 1)"` : ""} fill="none" stroke="${WHITE}" stroke-width="${n(r * 0.17)}" stroke-linecap="round" stroke-linejoin="round"/>`;

/* ── The fixtures ────────────────────────────────────────────────────────── */

/*
 * The docs' examples the hero shows (Mat, 2026-11-11: "the bike catalog, the hess video,
 * the esu shrine"), each taken once, at a size its server lists.
 */
/*
 * The White Sewing Machine Company's 1896 bicycle catalog, the playground's Catalog, as
 * the `paged` mock keeps it: its Canvases by label, each with its picture's service, and
 * its annotations, read from there, never retyped.
 */
const CATALOG = JSON.parse(
  readFileSync(join(ROOT, "public/mocks/paged/manifest.json"), "utf8"),
);
const canvasOf = (label) => {
  const canvas = CATALOG.items.find((each) =>
    Object.values(each.label).flat().includes(label),
  );
  if (!canvas) throw new Error(`The catalog has no Canvas labeled ${label}`);
  return canvas;
};
const keyOf = (label) => label.toLowerCase().replace(/\s+/g, "");
/*
 * Its views Items shows, as Clover pairs the catalog's Canvases (`groupViews`, in
 * `core/sequence.ts`: the Front Cover alone, Page 15 alone, its `facing-pages`, the rest
 * two by two), the chosen one in the middle: Page 24 and Page 25 (Mat, 2026-11-11: "use
 * page 24 and 25 now and then instead"), on the Body, Page 24 the one annotated.
 */
const SPREADS = [
  ["Page 20", "Page 21"],
  ["Page 22", "Page 23"],
  ["Page 24", "Page 25"],
  ["Page 26", "Page 27"],
  ["Page 28", "Page 29"],
];
const SHOWN = ["Page 24", "Page 25"];
const ANNOTATED = "Page 24";
const PAGES = SPREADS.flat().map((label) => [keyOf(label), label]);
/* Page 24's Then and Now, its annotations' words and the regions they target. */
const [THEN, NOW] = ["Then", "Now"].map((word) => {
  const annotation = canvasOf(ANNOTATED)
    .annotations.flatMap((page) => page.items)
    .find((each) => [each.body].flat()[0].value.startsWith(`${word} `));
  return {
    key: word.toLowerCase(),
    text: [annotation.body].flat()[0].value,
    region: annotation.target.split("#xywh=")[1].split(",").map(Number),
  };
});
/*
 * Each picture no larger than the READMEs show it (Mat, 2026-11-11: "use smaller images if
 * possible"): GitHub shows the hero at most about 900 px wide, so a page of the Body's
 * spread about 180 px (360 on a 2× screen), a thumbnail about 30, the footage about 170
 * and the shrine about 100.
 */
const FIXTURE = {
  ...Object.fromEntries(
    PAGES.map(([name, label]) => {
      const [service] = canvasOf(label).items[0].items[0].body.service;
      return [
        name,
        {
          service: service.id ?? service["@id"],
          width: SHOWN.includes(label) ? 480 : 140,
        },
      ];
    }),
  ),
  /* The Nuremberg judgment, as Commons publishes the National Archives' reel, the
   * playground's Footage: 14 seconds in, where its annotations follow Hess. */
  hess: {
    video:
      "https://upload.wikimedia.org/wikipedia/commons/6/6f/Sentencing_of_Nazi_Leaders_at_Nuremberg.webm",
    at: 14,
    width: 480,
  },
  /* The Esu shrine, the playground's Model (© 2025 Northwestern University), its model
   * as this repository keeps it, drawn through this picture's camera. */
  esu: { model: "public/mocks/esu-shrine/model.glb", scale: 1.25 },
};
/* Hess, where the footage's annotations box him 14 seconds in (`tracks.json`). */
const HESS = [262, 151, 128, 160];
/* The catalog's metadata, as its record gives it. */
const METADATA = [
  ["Contributor", "White Sewing Machine Company (Author)"],
  ["Date", "1896"],
  ["Location", "Ohio--Cleveland"],
  ["Publisher", "The White Sewing Machine Co."],
];

/** Encodes a picture as WebP, in the browser, at a width of its own if given. */
async function webp(page, bytes, type, size = {}) {
  const data = await page.evaluate(
    async ({ src, width }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = width ?? img.naturalWidth;
      canvas.height = Math.round(
        (img.naturalHeight * canvas.width) / img.naturalWidth,
      );
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/webp", 0.8);
    },
    { src: `data:${type};base64,${bytes.toString("base64")}`, ...size },
  );
  return Buffer.from(data.split(",")[1], "base64");
}

async function fetched(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "clover-readme-hero (https://github.com/nulib-ds/clover)",
    },
  });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** A IIIF image at the smallest size its info.json lists of at least `width`. */
async function iiifImage(service, width) {
  const info = JSON.parse((await fetched(`${service}/info.json`)).toString());
  const size = [...info.sizes]
    .sort((a, b) => a.width - b.width)
    .find((s) => s.width >= width);
  return fetched(
    `${info.id ?? info["@id"]}/full/${size.width},${size.height}/0/default.jpg`,
  );
}

/** The shrine, drawn by three.js through the hero's camera, and where it falls. */
async function drawShrine(browser, scale) {
  const page = await browser.newPage();
  /* A frame as wide and tall either side of the camera's middle, of which the picture is
   * a window (three.js's view offset), so its middle need not be the picture's. */
  const full = [2 * Math.max(PX, W - PX), 2 * Math.max(PY, H - PY)];
  const view = {
    width: Math.round(W * scale),
    height: Math.round(H * scale),
    full: full.map((v) => Math.round(v * scale)),
    offset: [(full[0] / 2 - PX) * scale, (full[1] / 2 - PY) * scale],
    fov: (2 * Math.atan(full[1] / 2 / FOCAL) * 180) / Math.PI,
    camera: [CAMERA[0], -CAMERA[1], CAMERA[2]],
    target: [TARGET[0], -TARGET[1], TARGET[2]],
    foot: [SHRINE.foot[0], -SHRINE.foot[1], SHRINE.foot[2]],
    tall: SHRINE.height,
    turn: (-39.52263429999999 * Math.PI) / 180,
  };
  const html = `<!doctype html><html><head><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script></head><body style="margin:0"><script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
const view = ${JSON.stringify(view)};
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(view.width, view.height); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(-1, 3, 4); scene.add(sun);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.55));
const model = (await new GLTFLoader().loadAsync("/model.glb")).scene;
model.rotation.y = view.turn;
model.updateMatrixWorld(true);
let box = new THREE.Box3().setFromObject(model);
model.scale.setScalar(view.tall / (box.max.y - box.min.y));
model.updateMatrixWorld(true);
box = new THREE.Box3().setFromObject(model);
const middle = box.getCenter(new THREE.Vector3());
model.position.set(view.foot[0] - middle.x, view.foot[1] - box.min.y, view.foot[2] - middle.z);
scene.add(model);
const camera = new THREE.PerspectiveCamera(view.fov, view.full[0] / view.full[1], 10, 20000);
camera.position.set(...view.camera); camera.lookAt(...view.target);
camera.setViewOffset(view.full[0], view.full[1], view.offset[0], view.offset[1], view.width, view.height);
renderer.render(scene, camera);
const flat = document.createElement("canvas"); flat.width = view.width; flat.height = view.height;
const ctx = flat.getContext("2d"); ctx.drawImage(renderer.domElement, 0, 0);
const { data } = ctx.getImageData(0, 0, view.width, view.height);
let x0 = view.width, y0 = view.height, x1 = 0, y1 = 0;
for (let y = 0; y < view.height; y++) for (let x = 0; x < view.width; x++) if (data[(y * view.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
const cut = document.createElement("canvas"); cut.width = x1 - x0 + 3; cut.height = y1 - y0 + 3;
cut.getContext("2d").drawImage(flat, x0 - 1, y0 - 1, cut.width, cut.height, 0, 0, cut.width, cut.height);
window.drawn = { webp: cut.toDataURL("image/webp", 0.82), at: [x0 - 1, y0 - 1], size: [cut.width, cut.height] };
</script></body></html>`;
  await page.route("http://hero.local/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/")
      return route.fulfill({ contentType: "text/html", body: html });
    if (path === "/model.glb")
      return route.fulfill({
        contentType: "model/gltf-binary",
        body: readFileSync(join(ROOT, FIXTURE.esu.model)),
      });
    if (path.startsWith("/three/"))
      return route.fulfill({
        contentType: "text/javascript",
        body: readFileSync(join(ROOT, "node_modules", path)),
      });
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto("http://hero.local/");
  await page.waitForFunction(() => window.drawn, null, { timeout: 180000 });
  const drawn = await page.evaluate(() => window.drawn);
  await page.close();
  return drawn;
}

/** Takes each fixture's picture that is missing, or all of them with `--fetch`. */
async function takeFixtures() {
  const again = process.argv.includes("--fetch");
  const path = (name) => join(FIXTURES, `${name}.webp`);
  /* The shrine is drawn again whenever the camera, the frame, its place or its scale
   * changes. */
  const view = JSON.stringify({
    drawing: 3,
    ...{ CAMERA, TARGET, FOCAL, W, H, PX: n(PX), PY: n(PY), SHRINE },
    scale: FIXTURE.esu.scale,
  });
  const drawnFor = () => {
    try {
      return JSON.parse(readFileSync(join(FIXTURES, "esu.json"), "utf8")).view;
    } catch {
      return null;
    }
  };
  /* A picture kept at another width than it is wanted at is taken again. */
  const kept = (name) => {
    const fixture = FIXTURE[name];
    if (!existsSync(path(name))) return false;
    if (!fixture.width) return true;
    return webpSize(readFileSync(path(name)))[0] === fixture.width;
  };
  /* A picture the hero no longer shows goes, so the folder holds only what it does. */
  if (existsSync(FIXTURES))
    for (const file of readdirSync(FIXTURES))
      if (file.endsWith(".webp") && !(file.slice(0, -5) in FIXTURE)) {
        rmSync(join(FIXTURES, file));
        console.log(`.github/assets/fixtures/${file}  removed`);
      }
  const missing = Object.keys(FIXTURE).filter(
    (name) => again || !kept(name) || (name === "esu" && drawnFor() !== view),
  );
  if (!missing.length) return;
  mkdirSync(FIXTURES, { recursive: true });
  const browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage();
  try {
    for (const name of missing) {
      const fixture = FIXTURE[name];
      let picture;
      if (fixture.service)
        picture = await webp(
          page,
          await iiifImage(fixture.service, fixture.width),
          "image/jpeg",
          { width: fixture.width },
        );
      if (fixture.video) {
        const dir = mkdtempSync(join(tmpdir(), "readme-hero-"));
        const still = join(dir, "frame.png");
        try {
          execFileSync("ffmpeg", [
            "-loglevel",
            "error",
            "-user_agent",
            "clover-readme-hero (https://github.com/nulib-ds/clover)",
            "-ss",
            String(fixture.at),
            "-i",
            fixture.video,
            "-frames:v",
            "1",
            still,
          ]);
        } catch {
          throw new Error(
            "Taking the footage's frame needs ffmpeg (brew install ffmpeg)",
          );
        }
        picture = await webp(page, readFileSync(still), "image/png", {
          width: fixture.width,
        });
        rmSync(dir, { recursive: true, force: true });
      }
      if (fixture.model) {
        const { scale } = fixture;
        const drawn = await drawShrine(browser, scale);
        picture = Buffer.from(drawn.webp.split(",")[1], "base64");
        /* Where it falls, written as Prettier writes JSON, its pairs on one line. */
        const at = drawn.at.map((c) => n(c / scale));
        const size = drawn.size.map((c) => n(c / scale));
        writeFileSync(
          join(FIXTURES, "esu.json"),
          `{\n  "at": [${at.join(", ")}],\n  "size": [${size.join(", ")}],\n  "view": ${JSON.stringify(view)}\n}\n`,
        );
      }
      writeFileSync(path(name), picture);
      console.log(
        `.github/assets/fixtures/${name}.webp  ${(picture.length / 1024).toFixed(1)} kB`,
      );
    }
  } finally {
    await browser.close();
  }
}

/** A WebP's size, from its VP8, VP8L or VP8X chunk. */
function webpSize(bytes) {
  const kind = bytes.toString("ascii", 12, 16);
  if (kind === "VP8 ")
    return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  if (kind === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
}

/** Each fixture's picture, as an image in the hero's defs, at its size. */
function fixtureImages() {
  const images = {};
  for (const name of Object.keys(FIXTURE)) {
    const bytes = readFileSync(join(FIXTURES, `${name}.webp`));
    const [width, height] = webpSize(bytes);
    images[name] = {
      width,
      height,
      svg: `<image id="${name}" width="${width}" height="${height}" href="data:image/webp;base64,${bytes.toString("base64")}"/>`,
    };
  }
  images.esu.at = JSON.parse(readFileSync(join(FIXTURES, "esu.json"), "utf8"));
  return images;
}

/**
 * `region` of a fixture's picture (in its own pixels; all of it when not given) filling
 * `into` (x, y, width, height): cropped to it, or whole in it with `meet`.
 */
function picture(images, name, region, into, meet = false) {
  const image = images[name];
  const [rx, ry, rw, rh] = region ?? [0, 0, image.width, image.height];
  const [x, y, w, h] = into;
  const scale = (meet ? Math.min : Math.max)(w / rw, h / rh);
  const dx = x + (w - rw * scale) / 2 - rx * scale;
  const dy = y + (h - rh * scale) / 2 - ry * scale;
  return `<use href="#${name}" transform="translate(${n(dx)} ${n(dy)}) scale(${f4(scale)})"/>`;
}

/** A region of the annotated page, from its Canvas's pixels to the kept picture's. */
const onAnnotated = (images, [x, y, w, h]) => {
  const k = images[keyOf(ANNOTATED)].width / canvasOf(ANNOTATED).width;
  return [x * k, y * k, w * k, h * k];
};

/** Hess, in the kept frame's pixels. */
const onHess = (images) => {
  const k = images.hess.width / 654;
  return HESS.map((v) => v * k);
};

/* ── The brand ───────────────────────────────────────────────────────────── */

/* The hero's stroke (`--swoosh` in tokens.css), in its 300 × 24 box. */
const SWOOSH = decodeURIComponent(
  readFileSync(join(ROOT, "docs/styles/tokens.css"), "utf8").match(
    /--swoosh:\s*url\("data:image\/svg\+xml,([^"]+)"\)/,
  )[1],
).match(/d='([^']+)'/)[1];

/* The wordmark's shapes (`docs/components/Logo.tsx`), in its 45.11 × 8.15 box. */
const WORDMARK = [
  ...readFileSync(join(ROOT, "docs/components/Logo.tsx"), "utf8")
    .match(/const PATHS = \[([\s\S]*?)\];/)[1]
    .matchAll(/"([^"]+)"/g),
].map((match) => match[1]);

/* ── The layout ──────────────────────────────────────────────────────────── */

/* The Root, in the world, its face at z = 0, its middle at the origin. As the parts blow
 * off it, it reaches up under the Label (`rootTop`; Mat, 2026-11-11: "the base under body
 * annotations items and metadata should extend under label as well"). It has no name in
 * its edge ("just remove the root label"). */
const ROOT_SLAB = { x: -664, y: -404, w: 1328, h: 808, r: 36, depth: 36 };
/*
 * Its parts, as the Default template lays them out (Mat, 2026-11-11: "the main one should
 * look like the viewer"), from the top left of the Viewer (1280 by 760, inside the Root),
 * each a block, how far off the Root it springs (`lift`), and how far from the Viewer's
 * middle (`shift`), the Label nearest: what is above the camera rises as it nears, so it
 * rises clear of the Body under it, and no further (Mat, 2026-11-11: "this label should
 * be closer to the body and annotations"). A block is `DEPTH` deep, the Label less, so
 * its underside, seen from below, shows no deeper than the Body's ("make extruded blue
 * part less deep. like it is for body").
 */
const VIEWER = { x: -640, y: -380 };
const GAP = 10;
const PARTS = [
  {
    id: "label",
    name: "<Label />",
    x: 0,
    y: 0,
    w: 1280,
    h: 88,
    lift: 230,
    shift: [0, -40],
    depth: 24,
  },
  {
    id: "body",
    name: "<Body />",
    x: 0,
    y: 88,
    w: 860,
    h: 524,
    lift: 200,
    shift: [-48, 6],
  },
  {
    id: "items",
    name: "<Items />",
    x: 0,
    y: 612,
    w: 860,
    h: 148,
    lift: 140,
    shift: [-26, 88],
  },
  {
    id: "annotations",
    name: "<Annotations />",
    x: 860,
    y: 88,
    w: 420,
    h: 292,
    lift: 170,
    shift: [70, -28],
  },
  {
    id: "metadata",
    name: "<Metadata />",
    x: 860,
    y: 380,
    w: 420,
    h: 380,
    lift: 110,
    shift: [70, 52],
  },
];
const DEPTH = 60;
const depthOf = (part) => part.depth ?? DEPTH;
/* A part's block, inside its room, `GAP` from its neighbors, and where it springs to. */
const boxOf = ({ x, y, w, h }, [dx, dy] = [0, 0]) => ({
  x: VIEWER.x + x + GAP + dx,
  y: VIEWER.y + y + GAP + dy,
  w: w - 2 * GAP,
  h: h - 2 * GAP,
  r: 16,
});
const frontOf = (id) => {
  const part = PARTS.find((each) => each.id === id);
  return part.lift + depthOf(part);
};
/*
 * The Body's view, zoomed in a little on Now (Mat, 2026-11-11: "zoom the canvas in a
 * bit"), as a picked annotation brings its region into view: Page 24 as tall as the Body,
 * its middle `ANNOTATED_AT` across it, Page 25 beside it at the gutter. In the Body's
 * face's coordinates.
 */
const BODY_FACE = { w: 860 - 2 * GAP, h: 524 - 2 * GAP };
const ANNOTATED_AT = 0.42;
/* Now's Tip, a block standing out of the Body by its region's edge ("have an extruded
 * label for the annotation body on the canvas"): how far it stands out, its corners, and
 * how far down the region it hangs, below Then's picture. */
const NOW_TIP = { depth: 26, r: 8, down: 134 };
/* The Label's title: the catalog's own (Mat, 2026-11-11: "make title the same title we
 * use for the bike catalog"). */
const TITLE =
  "Portfolio of illustrations showing the White bicycles : then and now";

/* Under the Viewer's right side, the other media as options, each a block of its own. */
const VIDEO = { at: [896, -150, 70], w: 400, h: 300, angles: [0, -12, 3] };
const MODEL = { at: [867, 266, 50], w: 360, h: 300, angles: [0, -10, -3] };
/* Where the shrine stands, out of the Scene's block, on its right: its foot and height. */
const SHRINE = { foot: [985, 386, 200], height: 330 };

/* What the picture shows, every word in it named: its title, and the READMEs' alt. */
const ALT = `The Clover IIIF wordmark over a Clover Viewer blown apart into its blocks on a Root, each block named in its edge, seen from a little below, showing the White bicycle catalog as a paged book: its Label, “${TITLE}”; its Body zoomed in on ${ANNOTATED} of the spread of ${SHOWN.join(" and ")}, its Then and Now annotations framed as Clover frames them, Now picked, the picture around it dimmed, and its Tip standing out of the Body saying “${NOW.text}”; Items, its views ${SPREADS.map((spread) => spread.join(" and ")).join(", ")}, ${SHOWN.join(" and ")} chosen, between its previous and next buttons; and a Panel of Annotations, under ${ANNOTATED}, “${THEN.text}” and “${NOW.text}”, Now chosen, a line from Now to its Tip on the Body, and About, its Metadata (${METADATA.map(([label, value]) => `${label}, ${value}`).join("; ")}). Sliding out from under its right side, other media as options: a Canvas of the Nuremberg footage, Rudolf Hess annotated, a pointer pressing its play button, and a Scene, the Esu shrine standing out of it.`;
/* Whose the examples are, under the picture. */
const CREDIT = `The White Sewing Machine Company's bicycle catalog (1896), courtesy of Northwestern University Libraries; an Esu shrine, © 2025 Northwestern University; the Nuremberg judgment (1946), National Archives, via Wikimedia Commons.`;

/* ── Motion ──────────────────────────────────────────────────────────────── */

const STYLE = `
${FONT_FACE}
.a{animation-duration:var(--t,.7s);animation-delay:var(--d,0s);animation-fill-mode:both;animation-timing-function:cubic-bezier(.2,.8,.2,1)}
.burst{animation-name:burst;--t:.9s;transform-box:view-box;transform-origin:0 0;animation-timing-function:cubic-bezier(.2,1.3,.35,1)}
.blast{animation-name:blast;--t:1s;transform-box:view-box;transform-origin:0 0}
.ring{animation-name:ring;--t:.9s;opacity:0;transform-box:fill-box;transform-origin:center;animation-timing-function:cubic-bezier(.1,.7,.3,1)}
.reach{animation-name:reach;--t:.8s;transform-box:view-box;transform-origin:0 0;animation-timing-function:cubic-bezier(.2,.9,.25,1)}
.fade{animation-name:fade;--t:.45s}
.rise{animation-name:rise;--t:.6s}
.pop{animation-name:pop;--t:.8s;transform-box:fill-box;transform-origin:50% 100%;animation-timing-function:cubic-bezier(.2,1.5,.4,1)}
.boing{animation-name:boing;--t:.7s;transform-box:fill-box;transform-origin:center;animation-timing-function:ease-out}
.glide{animation-name:glide;--t:.7s;animation-timing-function:cubic-bezier(.2,.9,.3,1)}
.press{animation-name:press;--t:.3s;transform-box:fill-box;transform-origin:0 0;animation-timing-function:ease-in-out}
.ripple{animation-name:ripple;--t:.9s;opacity:0;transform-box:fill-box;transform-origin:center}
.streak{animation-name:streak;--t:.6s;opacity:0;stroke-dasharray:1;animation-timing-function:ease-out}
.spark{animation-name:spark;--t:.45s;opacity:0;transform-box:fill-box;transform-origin:center}
.draw{animation-name:draw;--t:.8s;stroke-dasharray:1;animation-timing-function:cubic-bezier(.45,0,.2,1)}
.type{animation-name:type;--t:1.1s}
.win{animation-name:win;--t:.7s;animation-timing-function:cubic-bezier(.5,0,.2,1)}
.ink{animation-name:ink;--t:.7s;animation-timing-function:cubic-bezier(.5,0,.2,1)}
svg{font-family:${FONT_SANS}}
@keyframes burst{0%{opacity:0;transform:var(--from)}12%{opacity:1}}
@keyframes blast{0%{transform:var(--from);animation-timing-function:cubic-bezier(.55,0,.9,.45)}22%{transform:var(--squeeze);animation-timing-function:cubic-bezier(.2,1.7,.35,1)}}
@keyframes ring{0%{opacity:0;transform:scale(.3)}8%{opacity:.9}100%{opacity:0;transform:scale(1.7)}}
@keyframes reach{from{transform:var(--from)}}
@keyframes fade{from{opacity:0}}
@keyframes rise{from{opacity:0;transform:translateY(30px)}}
@keyframes pop{0%{opacity:0;transform:translateY(60px) scale(.3)}30%{opacity:1}}
@keyframes boing{0%{opacity:0;transform:scale(.2)}45%{opacity:1;transform:scale(1.22)}65%{transform:scale(.9)}82%{transform:scale(1.06)}100%{transform:none}}
@keyframes glide{from{opacity:0;transform:translate(120px,90px)}}
@keyframes press{50%{transform:scale(.82)}}
@keyframes ripple{0%{opacity:0;transform:scale(.25)}12%{opacity:.9}100%{opacity:0;transform:scale(1.7)}}
@keyframes streak{0%{opacity:0;stroke-dashoffset:1}30%{opacity:.9}100%{opacity:0;stroke-dashoffset:-1}}
@keyframes spark{0%{opacity:0;transform:scale(.3)}30%{opacity:1}100%{opacity:0;transform:scale(1.3)}}
@keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes type{from{transform:none}}
@keyframes win{from{transform:translateX(calc(-1px*var(--w)))}}
@keyframes ink{from{transform:translateX(calc(1px*var(--w)))}}
@media (prefers-reduced-motion:reduce){.a{animation:none!important}}
`;

const anim = (cls, delay, extra = "") =>
  `class="a ${cls}" style="--d:${Math.round(delay * 100) / 100}s${extra ? `;${extra}` : ""}"`;

/* The beats: the Viewer shows flat, then gathers itself (`SQUEEZE`, the first 22% of
 * `blast`) and blows apart, and the options slide out. */
const SHOW = 0.1;
const BOOM = 0.95;
const SQUEEZE = 0.22;
const BLAST = BOOM + SQUEEZE;
const BURST = BLAST + 0.12;

/* ── The Viewer's parts ──────────────────────────────────────────────────── */

/** The spread's pages on the Body, side by side at the gutter: each one's box. */
function bodyPages(images) {
  const { w, h } = BODY_FACE;
  const widths = SHOWN.map((label) => {
    const image = images[keyOf(label)];
    return (image.width / image.height) * h;
  });
  const at = SHOWN.indexOf(ANNOTATED);
  let x =
    w * ANNOTATED_AT -
    widths[at] / 2 -
    widths.slice(0, at).reduce((sum, wide) => sum + wide, 0);
  return widths.map((wide) => {
    const box = [x, 0, wide, h];
    x += wide;
    return box;
  });
}

/** An annotation's region, where the Body shows it (in the Body's face's coordinates). */
function shownRegion(images, [rx, ry, rw, rh]) {
  const [x, y, w] = bodyPages(images)[SHOWN.indexOf(ANNOTATED)];
  const scale = w / canvasOf(ANNOTATED).width;
  return [x + rx * scale, y + ry * scale, rw * scale, rh * scale];
}

/** Now's Tip on the Body: its box, by the region's right edge, as wide as its words. */
function nowTip(images) {
  const [x, y, w] = shownRegion(images, NOW.region);
  const { lines, widest } = LINES.nowTip;
  const [padX, padY] = TIP.pad;
  return {
    x: x + w - 10,
    y: y + NOW_TIP.down,
    w: widest + 2 * padX,
    h: 2 * padY + TIP.size + (lines.length - 1) * TIP.line + 5,
    lines,
  };
}

/* The Panel's Annotations: its page's name, and its entries, each as tall as its words. */
const PANEL = { group: 82, top: 94, gap: 6, least: 70 };
function panelEntries() {
  let y = PANEL.top;
  return [THEN, NOW].map((note) => {
    const { lines } = LINES[note.key];
    const h = Math.max(PANEL.least, (lines.length - 1) * ENTRY.line + 50);
    const entry = { ...note, lines, y, h, chosen: note === NOW };
    y += h + PANEL.gap;
    return entry;
  });
}

/** A frame around a region, as Clover draws an annotation's: at rest, its dark edge and a
 * light line inside it; picked, from the outside in, a dark edge, the accent's band and a
 * light line (`Canvas/Annotations.css`), each twice as wide, to show at this size. */
function hotspot([x, y, w, h], picked, p, extra = "") {
  const ring = (out, width, color, more = "") =>
    rect(
      x - out,
      y - out,
      w + 2 * out,
      h + 2 * out,
      6 + out,
      `fill="none" stroke="${color}" stroke-width="${width}"${more}`,
    );
  if (!picked) return ring(-1, 2, CONTROL) + ring(-3, 2, WHITE);
  return (
    ring(5, 2, CONTROL) +
    `<g ${extra}>${ring(2, 4, p.a9)}</g>` +
    ring(-1, 2, WHITE)
  );
}

/* Items' strip: its pictures' size, the room between its views, and its top. */
const STRIP = { size: 66, gap: 20, top: 16 };

/* Each draws its part's face, in its own coordinates (`w` by `h`), clipped to it. */
const FACES = {
  label({ p, h }) {
    const length = 1040;
    let out = `<text x="28" y="${h / 2}" dy="0.35em" font-size="30" font-weight="700" fill="${p.g12}" textLength="${length}" lengthAdjust="spacingAndGlyphs">${escape(TITLE)}</text>`;
    out += `<g ${anim("type", SHOW + 0.25, `transform:translateX(${length + 16}px);animation-timing-function:steps(${TITLE.length},end)`)}>${rect(22, 6, length + 16, h - 12, 0, `fill="${p.face}"`)}</g>`;
    return out;
  },

  body({ p, images, w, h }) {
    let out = rect(0, 0, w, h, 0, `fill="${p.body}"`);
    const pages = bodyPages(images);
    pages.forEach((box, i) => {
      out += picture(images, keyOf(SHOWN[i]), null, box);
    });
    /* The gutter, where the pages meet. */
    const [gx, gy, , gh] = pages[1];
    out += `<path d="M${n(gx)} ${n(gy)}V${n(gy + gh)}" stroke="${BLACK}" stroke-opacity="0.22" stroke-width="2"/>`;
    /* Its annotations as Clover draws them: Then at rest; Now picked, nothing laid over
     * what it marks, the picture around it dimmed a little instead (Mat, 2026-11-11:
     * "draw annotation for Now more close to how it is in our content"). */
    out += hotspot(shownRegion(images, THEN.region), false, p);
    const now = shownRegion(images, NOW.region);
    const [x, y, sw, sh] = now;
    out += `<g ${anim("fade", BLAST + 0.4)}><path d="M0 0H${w}V${h}H0Z${roundedPath(x, y, sw, sh, 6)}" fill="${BLACK}" fill-opacity="0.133" fill-rule="evenodd"/>${hotspot(now, true, p, `${anim("draw", BLAST + 0.4)}`)}</g>`;
    return out;
  },

  items({ p, defs, images, w }) {
    const { size, gap, top } = STRIP;
    const widths = SPREADS.map((spread) => spread.length * size);
    const span =
      widths.reduce((sum, v) => sum + v, 0) + gap * (SPREADS.length - 1);
    let left = (w - span) / 2;
    /* Its previous and next stand out of it, as the Body's zoom buttons do (`hero`). */
    let out = "";
    SPREADS.forEach((spread) => {
      const width = spread.length * size;
      const chosen = spread.join() === SHOWN.join();
      out += `<g ${roundClip(defs, left, top, width, size, 8)}>${rect(left, top, width, size, 0, `fill="${p.body}"`)}${spread.map((label, k) => picture(images, keyOf(label), null, [left + k * size, top, size, size])).join("")}</g>`;
      if (spread.length === 2)
        out += `<path d="M${n(left + size)} ${top}V${top + size}" stroke="${BLACK}" stroke-opacity="0.18" stroke-width="1.5"/>`;
      /* Each page's label under it, the chosen view's in the accent's text, as Items
       * marks them. */
      spread.forEach((label, k) => {
        out += `<text x="${n(left + k * size + size / 2)}" y="${top + size + 22}" text-anchor="middle" font-size="13"${chosen ? ` font-weight="600" fill="${p.a11}"` : ` fill="${p.g11}"`}>${escape(label)}</text>`;
      });
      if (chosen)
        out += rect(
          left - 4.5,
          top - 4.5,
          width + 9,
          size + 9,
          12,
          `fill="none" stroke="${p.a9}" stroke-width="3.5"`,
        );
      left += width + gap;
    });
    return out;
  },

  annotations({ p, defs, images, w }) {
    let out = `<text x="22" y="46" font-size="22" font-weight="700" fill="${p.g12}">Annotations</text><path d="M${w - 40} 36l8 8 8-8" fill="none" stroke="${p.g11}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    /* As Clover lists them: under their page's name, each its picture and its words, in
     * regular weight, the chosen one on the accent's tint with its band. */
    out += `<text x="22" y="${PANEL.group}" font-size="15" font-weight="600" fill="${p.g11}">${escape(ANNOTATED)}</text>`;
    panelEntries().forEach(({ region, lines, y, h, chosen }) => {
      if (chosen)
        out += `${rect(16, y, w - 32, h, 8, `fill="${p.a3}"`)}${rect(16, y, 6, h, 3, `fill="${p.a9}"`)}`;
      const at = y + (h - 52) / 2;
      out += `<g ${roundClip(defs, 32, at, 52, 52, 6)}>${picture(images, keyOf(ANNOTATED), onAnnotated(images, region), [32, at, 52, 52])}</g>`;
      lines.forEach((line, k) => {
        out += `<text x="98" y="${n(y + (h - (lines.length - 1) * ENTRY.line) / 2 + 6 + k * ENTRY.line)}" font-size="${ENTRY.size}" fill="${p.g12}">${escape(line)}</text>`;
      });
    });
    return out;
  },

  metadata({ p, w }) {
    let out = `<text x="22" y="46" font-size="22" font-weight="700" fill="${p.g12}">About</text><path d="M${w - 40} 36l8 8 8-8" fill="none" stroke="${p.g11}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    METADATA.forEach(([label, value], i) => {
      const y = 92 + i * 66;
      out += `<text x="22" y="${y}" font-size="16" font-weight="700" fill="${p.g11}">${escape(label)}</text><text x="22" y="${y + 26}" font-size="19" fill="${p.g12}">${escape(value)}</text>`;
    });
    return out;
  },
};

/* ── What slides out ─────────────────────────────────────────────────────── */

/**
 * A flat thing coming out of the Viewer: from flat at `from` (in the world, at `fromZ`,
 * `fromScale` its size there) to its pose, its face drawn by `draw`, a block's depth
 * behind it seen from below (`thick`), and its shadow.
 */
function burst(layers, defs, p, item, delay) {
  const { w, h, from, thick = 30 } = item;
  const end = pose(item);
  const startScale = item.fromScale ?? 0.6;
  const fz = item.fromZ ?? 0;
  const sw = w * startScale;
  const sh = h * startScale;
  const start = fit(w, h, [
    project([from[0] - sw / 2, from[1] - sh / 2, fz]),
    project([from[0] + sw / 2, from[1] - sh / 2, fz]),
    project([from[0] + sw / 2, from[1] + sh / 2, fz]),
    project([from[0] - sw / 2, from[1] + sh / 2, fz]),
  ]);
  const front = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ].map((c) => apply(end.m, c));
  const lift = item.at[2];
  const cast = front.map(([x, y]) => [
    x + 18 + lift * 0.09,
    y + 26 + lift * 0.15,
  ]);
  layers.push(
    `<g ${anim("fade", delay + 0.55)}><path d="${polygon(cast)}" fill="${BLACK}" opacity="${p.shadow * 0.85}" filter="url(#blur)"/></g>`,
  );
  const back = [
    end.corner(0, 0, thick),
    end.corner(w, 0, thick),
    end.corner(w, h, thick),
    end.corner(0, h, thick),
  ].map(project);
  /* Its sides, in its face's coordinates, so they travel with it. */
  const inside = invert(end.m);
  const local = (points) =>
    polygon(points.map((point) => apply(inside, point)));
  layers.push(
    `<g ${anim("burst", delay, `transform:${css(end.m)};--from:${css(start)}`)}><path d="${local(hull([...back, ...front]))}" fill="${p.side}"/><path d="${local(back)}" fill="${p.shade}"/>${item.draw({ p, defs, w, h })}</g>`,
  );
  return end;
}

/* ── The scene ───────────────────────────────────────────────────────────── */

/**
 * The picture, in `p`'s colors. `still` holds it as its motion ends, for a reader who asks
 * for less motion: the READMEs' `<picture>` picks it by `prefers-reduced-motion`, which an
 * image's own styles cannot be relied on to see.
 */
function hero(p, images, still = false) {
  ids = 0;
  const defs = [
    `<filter id="blur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="10"/></filter>`,
    `<filter id="blur-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26"/></filter>`,
    ...Object.values(images).map((image) => image.svg),
  ];
  const layers = {
    root: [],
    behind: [],
    shadows: [],
    parts: [],
    above: [],
    top: [],
  };

  /* A part's name, set into its top edge as an example switch's legend is, or into
   * another edge at (x, y) of its face. */
  const named = (word, x = 14, y = 0, on = p) => {
    const wide = NAMES[word];
    if (wide === undefined)
      throw new Error(`${word} is not measured: add it to prepareType's names`);
    return `<rect x="${n(x)}" y="${n(y - 14)}" width="${n(wide + 20)}" height="28" rx="14" fill="${on.dark ? on.g2 : WHITE}"${hairline(on.edge)}/><text x="${n(x + 10)}" y="${n(y)}" dy="0.36em" font-size="${NAME.size}" font-weight="${NAME.weight}" fill="${on.a11}" textLength="${n(wide)}" lengthAdjust="spacingAndGlyphs">${escape(word)}</text>`;
  };

  /* The Root: its shadow, its sides seen from below, its face. It hugs the Viewer, then
   * reaches up under the Label as the parts blow off it: drawn in its tall face's
   * coordinates, so its sides and shadow reach with it. */
  {
    const { x, y, w, h, r, depth } = ROOT_SLAB;
    const top = rootTop();
    const tall = { x, y: top, w, h: y + h - top, r };
    const root = block(tall, -depth, 0);
    const inside = invert(root.m);
    const local = (points) =>
      polygon(points.map((point) => apply(inside, point)));
    const hugging = faceOnto(tall.w, tall.h, [x, y, w, h], 0);
    const shadow = root.faceAt.map(([px, py]) => [px, py + 40]);
    layers.root.push(
      `<g ${anim("rise", SHOW - 0.1)}><g opacity="0.5" ${anim("reach", BLAST, `transform:${css(root.m)};--from:${css(hugging)}`)}><path d="${local(shadow)}" fill="${BLACK}" opacity="${p.shadow}" filter="url(#blur-soft)"/><path d="${local(root.sidesAt)}" fill="${p.rootSide}"/><path d="${local(root.underAt)}" fill="${p.rootShade}"/><path d="${local(root.faceAt)}" fill="${p.rootFace}"${hairline(p.edge)}/></g></g>`,
    );
    /* A ring out from its middle, behind the parts, as they blow apart. */
    const ring = unbounded(() =>
      Array.from({ length: 97 }, (_, k) => {
        const a = (k / 96) * Math.PI * 2;
        return project([Math.cos(a) * 620, Math.sin(a) * 620, DEPTH]);
      }),
    );
    layers.root.push(
      `<g ${anim("ring", BLAST)}><path d="${polygon(ring)}" fill="none" stroke="${p.a9}" stroke-width="6" vector-effect="non-scaling-stroke"/></g>`,
    );
  }

  /* The parts, flat on the Root, then off it and apart, farthest first. */
  const blocks = {};
  [...PARTS]
    .sort((a, b) => a.lift - b.lift)
    .forEach((part, i) => {
      const flatBox = boxOf(part);
      const box = boxOf(part, part.shift);
      const depth = depthOf(part);
      const flat = block(flatBox, 0, depth);
      const off = block(box, part.lift, part.lift + depth);
      /* Gathering itself first: pressed into the Root, drawn in to its middle. */
      const k = 0.95;
      const squeeze = faceOnto(
        box.w,
        box.h,
        [flatBox.x * k, flatBox.y * k, flatBox.w * k, flatBox.h * k],
        Math.max(0, depth - 14),
      );
      blocks[part.id] = { box, off };
      const inner = FACES[part.id]({ p, defs, images, w: box.w, h: box.h });
      const shadowAt = [box.x + part.lift * 0.12, box.y + part.lift * 0.2];
      layers.shadows.push(
        `<g ${anim("fade", BLAST + 0.1)}><path d="${polygon(outline(shadowAt[0], shadowAt[1], box.w, box.h, box.r, 0).map(project))}" fill="${BLACK}" opacity="${p.shadow}" filter="url(#blur)"/></g>`,
      );
      /* Its sides, in its face's coordinates, so they travel with it, showing as it
       * springs off. */
      const inside = invert(off.m);
      const local = (points) =>
        polygon(points.map((point) => apply(inside, point)));
      const delay = 0.04 * i;
      layers.parts.push(
        `<g ${anim("fade", SHOW + delay)}><g ${anim("blast", BOOM + delay, `transform:${css(off.m)};--from:${css(flat.m)};--squeeze:${css(squeeze)}`)}><g ${anim("fade", BLAST + delay, "--t:.3s")}><path d="${local(off.sidesAt)}" fill="${p.side}"/><path d="${local(off.underAt)}" fill="${p.shade}"/></g><g ${roundClip(defs, 0, 0, box.w, box.h, box.r)}>${rect(0, 0, box.w, box.h, 0, `fill="${p.face}"`)}${inner}</g>${rect(0, 0, box.w, box.h, box.r, `fill="none"${hairline(p.edge)}`)}${named(part.name)}</g></g>`,
      );
      /* Sparks at its outer corners as it springs off. */
      [
        [box.x, box.y],
        [box.x + box.w, box.y],
        [box.x + box.w, box.y + box.h],
        [box.x, box.y + box.h],
      ].forEach(([cx, cy], k) => {
        if ((k + i) % 2) return;
        const [x, y] = project([cx, cy, part.lift]);
        const out = Math.atan2(cy, cx);
        const lines = [-0.45, 0, 0.45]
          .map((by) => {
            const a = out + by;
            return `M${n(x + Math.cos(a) * 14)} ${n(y + Math.sin(a) * 14)}L${n(x + Math.cos(a) * 40)} ${n(y + Math.sin(a) * 40)}`;
          })
          .join("");
        layers.above.push(
          `<g ${anim("spark", BLAST + 0.12 + 0.04 * i)}><path d="${lines}" stroke="${p.a9}" stroke-width="4" stroke-linecap="round"/></g>`,
        );
      });
    });

  /* Speed lines, out from the Viewer's middle, as it blows apart: behind the parts, so
   * they show between and past them, never over their words. */
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2 + 0.2;
    const [[x0, y0], [x1, y1]] = unbounded(() => [
      project([Math.cos(a) * 600, Math.sin(a) * 360, 200]),
      project([Math.cos(a) * 1000, Math.sin(a) * 640, 320]),
    ]);
    layers.root.push(
      `<path d="M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}" pathLength="1" ${anim("streak", BLAST + 0.012 * k)} fill="none" stroke="${p.a9}" stroke-width="5" stroke-linecap="round"/>`,
    );
  }

  /* The Body's zoom buttons, as discs standing out of its face, in a row at its top
   * right, as the control cluster lays them out (`ui/ControlCluster.css`). */
  {
    const { box } = blocks.body;
    const front = frontOf("body");
    ["in", "out"].forEach((kind, i) => {
      const x = box.x + box.w - 36 - (1 - i) * 50;
      const y = box.y + 36;
      layers.above.push(
        `<g ${anim("boing", BLAST + 0.4 + i * 0.08)}>${disc(x, y, 20, front, front + 16, { face: p.control, side: BLACK }, plusGlyph(20, kind === "out"))}</g>`,
      );
    });
  }

  /* Items' previous and next, discs standing out of it, as the zoom buttons do (Mat,
   * 2026-11-11: "this should be black, I think. and make it extrude like the + -
   * buttons"), in Clover's control fill, as its round buttons are (`ui/Button.css`). */
  {
    const { box } = blocks.items;
    const front = frontOf("items");
    const y = box.y + STRIP.top + STRIP.size / 2;
    [box.x + 34, box.x + box.w - 34].forEach((x, i) => {
      layers.above.push(
        `<g ${anim("boing", BLAST + 0.5 + i * 0.08)}>${disc(x, y, 20, front, front + 16, { face: p.control, side: BLACK }, caretGlyph(20, i === 0))}</g>`,
      );
    });
  }

  /* Now's Tip, a block standing out of the Body by its region's edge, as Clover's Tip
   * shows an annotation's words, in its control fill (`ui/Tip.css`), and a line to it
   * from the Panel's Now. */
  const label = (() => {
    const body = blocks.body.box;
    const front = frontOf("body");
    const { x, y, w, h, lines } = nowTip(images);
    const { r, depth } = NOW_TIP;
    const tip = block(
      { x: body.x + x, y: body.y + y, w, h, r },
      front,
      front + depth,
    );
    const [padX, padY] = TIP.pad;
    const words = lines
      .map(
        (line, k) =>
          `<text x="${padX}" y="${padY + TIP.size - 2 + k * TIP.line}" font-size="${TIP.size}" fill="${WHITE}">${escape(line)}</text>`,
      )
      .join("");
    /* Its shadow on the Body, as a part's is on the Root, so it stands out of it. */
    const cast = outline(body.x + x + 8, body.y + y + 14, w, h, r, front).map(
      project,
    );
    layers.above.push(
      `<g ${anim("fade", BLAST + 0.75)}><path d="${polygon(cast)}" fill="${BLACK}" opacity="${p.shadow * 1.6}" filter="url(#blur)"/></g>`,
      `<g ${anim("boing", BLAST + 0.5)}><path d="${tip.sides}" fill="${BLACK}"/><path d="${tip.under}" fill="${BLACK}"/><path d="${tip.face}" fill="${p.control}"/><g transform="${matrix(tip.m)}">${words}</g></g>`,
    );
    return { at: [body.x + x + w, body.y + y + h / 2], front: front + depth };
  })();
  {
    const panel = blocks.annotations.box;
    const now = panelEntries().find(({ chosen }) => chosen);
    const from = project([
      panel.x + 16,
      panel.y + now.y + now.h / 2,
      frontOf("annotations"),
    ]);
    const to = project([...label.at, label.front]);
    layers.above.push(
      `<g ${anim("fade", BLAST + 0.55)}><circle cx="${n(from[0])}" cy="${n(from[1])}" r="8" fill="${p.a9}"/></g><path d="M${xy(from)}L${xy(to)}" ${anim("draw", BLAST + 0.6)} pathLength="1" fill="none" stroke="${p.a9}" stroke-width="4" stroke-linecap="round"/><g ${anim("fade", BLAST + 1.15)}><circle cx="${n(to[0])}" cy="${n(to[1])}" r="8" fill="${p.a9}"/></g>`,
    );
  }

  /* From under the Viewer's right side, the other media as options: a Canvas, and a
   * Scene, the shrine standing out of it. They are drawn behind the Viewer. */
  {
    const body = blocks.body.box;
    const delay = BURST;
    const play = [132, VIDEO.h - 70];
    const video = burst(
      layers.behind,
      defs,
      p,
      {
        ...VIDEO,
        from: [body.x + body.w * 0.8, body.y + body.h * 0.3],
        fromZ: 20,
        draw: ({ defs: d, w, h }) => {
          let out = `<g ${roundClip(d, 0, 0, w, h, 14)}>${rect(0, 0, w, h, 0, `fill="${BLACK}"`)}${picture(images, "hess", null, [0, 0, w, h])}`;
          const k = Math.max(w / images.hess.width, h / images.hess.height);
          const dx = (w - images.hess.width * k) / 2;
          const dy = (h - images.hess.height * k) / 2;
          const [hx, hy, hw, hh] = onHess(images).map((v) => v * k);
          out += `${rect(dx + hx, dy + hy, hw, hh, 6, `fill="${ACCENT}" fill-opacity="0.14" stroke="${ACCENT}" stroke-width="4"`)}</g>`;
          return out + named("<Canvas />", 84, 0);
        },
      },
      delay,
    );
    /* Its play button, a disc standing out of its lower left, and a pointer pressing it. */
    const button = video.corner(play[0], play[1]);
    layers.behind.push(
      `<g ${anim("boing", delay + 0.6)}>${disc(button[0], button[1], 46, button[2], button[2] + 24, { face: ACCENT, side: mix(ACCENT, 0.72, BLACK) }, playGlyph(46))}</g>`,
    );
    const [px, py] = project([button[0] + 18, button[1] + 24, button[2] + 24]);
    const at = delay + 0.85;
    layers.top.push(
      `<g ${anim("glide", at)}><g ${anim("press", at + 0.62)}>${pointer(px, py)}</g></g><g ${anim("ripple", at + 0.62)}><ellipse cx="${n(px)}" cy="${n(py)}" rx="30" ry="30" fill="none" stroke="${WHITE}" stroke-width="3"/></g>`,
    );
  }
  {
    const body = blocks.body.box;
    const delay = BURST + 0.15;
    burst(
      layers.behind,
      defs,
      p,
      {
        ...MODEL,
        from: [body.x + body.w * 0.8, body.y + body.h * 0.75],
        fromZ: 20,
        draw: ({ defs: d, w, h }) => {
          const lines = [];
          for (let g = 28; g < Math.max(w, h); g += 28) {
            if (g < w) lines.push(`M${g} 0V${h}`);
            if (g < h) lines.push(`M0 ${g}H${w}`);
          }
          return `<g ${roundClip(d, 0, 0, w, h, 14)}>${rect(0, 0, w, h, 0, `fill="${p.dark ? p.g3 : p.g2}"`)}<path d="${lines.join("")}" stroke="${p.dark ? p.g6 : p.g4}" stroke-width="1.5"/></g>${rect(0, 0, w, h, 14, `fill="none"${hairline(p.edge)}`)}${named("<Scene />", 84, 0)}`;
        },
      },
      delay,
    );
    const [fx, fy, fz] = SHRINE.foot;
    const ring = (r, y) =>
      Array.from({ length: 73 }, (_, i) => {
        const a = (i / 72) * Math.PI * 2;
        return [fx + r * Math.cos(a), y, fz + r * Math.sin(a)];
      });
    const orbit = ring(140, fy - SHRINE.height * 0.3);
    const path = (points) => `M${points.map(project).map(xy).join("L")}`;
    const shadow = project([fx - 10, fy - 6, MODEL.at[2] + 10]);
    layers.above.push(
      `<g ${anim("fade", delay + 0.5)}><ellipse cx="${n(shadow[0])}" cy="${n(shadow[1])}" rx="96" ry="24" fill="${BLACK}" opacity="${p.shadow * 1.3}" filter="url(#blur)"/></g>`,
      `<path d="${path(orbit.filter(([, , z]) => z <= fz))}" ${anim("draw", delay + 1)} pathLength="1" fill="none" stroke="${p.a9}" stroke-width="5" stroke-linecap="round"/>`,
    );
    const { width, height, at: placed } = images.esu;
    layers.above.push(
      `<g ${anim("pop", delay + 0.35)}><use href="#esu" transform="translate(${placed.at[0]} ${placed.at[1]}) scale(${f4(placed.size[0] / width)} ${f4(placed.size[1] / height)})"/></g>`,
      `<path d="${path(orbit.filter(([, , z]) => z >= fz))}" ${anim("draw", delay + 1.2)} pathLength="1" fill="none" stroke="${p.a9}" stroke-width="5" stroke-linecap="round"/>`,
    );
  }

  const [mx, my] = markAt();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="title"><title id="title">${escape(ALT)}</title><style>${STYLE.trim()}${still ? "\n.a{animation:none!important}" : ""}</style><defs>${defs.join("")}</defs><rect width="${W}" height="${H}" rx="32" fill="${p.g1}"/>${layers.root.join("")}${layers.behind.join("")}${layers.shadows.join("")}${layers.parts.join("")}${layers.above.join("")}${layers.top.join("")}${wordmark(p, BURST + 1.9, mx, my)}</svg>\n`;
}

/* The wordmark's size: its scale, and the box it and its stroke fill. */
const MARK = { scale: 9.6, width: 45.11 * 9.6, height: 8.15 * 9.6 + 34 };

/** Where the wordmark sits: over the Label, the nearest block, at its left edge. */
function markAt() {
  const label = PARTS.find((part) => part.id === "label");
  const box = boxOf(label, label.shift);
  const [x] = project([box.x, box.y, frontOf("label")]);
  const [, y] = project([0, rootTop(), 0]);
  return [x + 6, y - 36 - MARK.height];
}

/** How far up the Root reaches once the parts are off: over the Label's name, by a
 * little, in the picture. */
function rootTop() {
  const label = PARTS.find((part) => part.id === "label");
  const box = boxOf(label, label.shift);
  const [, name] = unbounded(() =>
    project([box.x, box.y - 14, frontOf("label")]),
  );
  const over = name - 30;
  let low = -4000;
  let high = ROOT_SLAB.y;
  for (let k = 0; k < 48; k++) {
    const middle = (low + high) / 2;
    const [, at] = unbounded(() => project([0, middle, 0]));
    if (at < over) low = middle;
    else high = middle;
  }
  return Math.min(ROOT_SLAB.y, high);
}

/** The wordmark, with the hero's stroke drawing under it. */
function wordmark(p, delay, left, top) {
  const SCALE = MARK.scale;
  const em = 8.15 / 0.75;
  const x0 = -0.04 * em;
  const x1 = 45.11 + 0.06 * em;
  const y0 = 8.15 - 0.035 * em;
  const height = 0.42 * em;
  const width = x1 - x0;
  const reach = n(width * SCALE);
  return `<g transform="translate(${n(left)} ${n(top)})"><g ${anim("win", delay, `--w:${reach}`)}><clipPath id="stroke-window"><rect x="${n(x0 * SCALE - 4)}" y="${n(y0 * SCALE - 20)}" width="${n(width * SCALE + 8)}" height="${n(height * SCALE + 40)}"/></clipPath><g clip-path="url(#stroke-window)"><g ${anim("ink", delay, `--w:${reach}`)}><g transform="scale(${SCALE}) rotate(1.5 ${n((x0 + x1) / 2)} ${n(y0 + height / 2)})"><linearGradient id="stroke-ink" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${ACCENT}" stop-opacity="0.3"/><stop offset="1" stop-color="${ACCENT}"/></linearGradient><path transform="translate(${f4(x0)} ${f4(y0)}) scale(${f4(width / 300)} ${f4(height / 24)})" d="${SWOOSH}" fill="url(#stroke-ink)"/></g></g></g></g><g ${anim("fade", 0.05)} transform="scale(${SCALE})" fill="${p.ink}">${WORDMARK.map((d) => `<path d="${d}"/>`).join("")}</g></g>`;
}

/**
 * The picture's frame: a first pass, with stand-ins for the fixtures' pictures, gathers
 * where everything falls (and the shrine's box, and the wordmark's), and the picture is
 * that, with room around it, the camera's middle wherever that puts it.
 */
function frame() {
  const stand = (width, height) => ({ width, height, svg: "" });
  const stands = {
    ...Object.fromEntries(
      PAGES.map(([name]) => [
        name,
        stand(FIXTURE[name].width, Math.round(FIXTURE[name].width * 0.984)),
      ]),
    ),
    hess: stand(
      FIXTURE.hess.width,
      Math.round((FIXTURE.hess.width * 480) / 654),
    ),
    esu: { ...stand(1, 1), at: { at: [0, 0], size: [1, 1] } },
  };
  BOUNDS = [Infinity, Infinity, -Infinity, -Infinity];
  hero(palette("light"), stands);
  const [fx, fy, fz] = SHRINE.foot;
  for (const dx of [-110, 110])
    for (const dz of [-110, 110])
      for (const y of [fy, fy - SHRINE.height]) project([fx + dx, y, fz + dz]);
  const [mx, my] = markAt();
  BOUNDS[0] = Math.min(BOUNDS[0], mx);
  BOUNDS[1] = Math.min(BOUNDS[1], my);
  const [x0, y0, x1, y1] = BOUNDS;
  BOUNDS = null;
  const margin = 56;
  W = Math.ceil(x1 - x0 + margin * 2);
  H = Math.ceil(y1 - y0 + margin * 2);
  PX = margin - x0;
  PY = margin - y0;
}

await prepareType(
  [...PARTS.map(({ name }) => name), "<Canvas />", "<Scene />"],
  [
    ...[THEN, NOW].map(({ key, text }) => ({
      key,
      text,
      font: `${ENTRY.size}px "Google Sans Flex"`,
      wide: ENTRY.wide,
    })),
    {
      key: "nowTip",
      text: NOW.text,
      font: `${TIP.size}px "Google Sans Flex"`,
      wide: TIP.wide,
    },
  ],
);
frame();
await takeFixtures();
const images = fixtureImages();
mkdirSync(OUT, { recursive: true });
for (const name of ["light", "dark"])
  for (const still of [false, true]) {
    const file = `hero-${name}${still ? "-still" : ""}.svg`;
    const svg = hero(palette(name), images, still);
    writeFileSync(join(OUT, file), svg);
    console.log(
      `.github/assets/${file}  ${(Buffer.byteLength(svg) / 1024).toFixed(1)} kB`,
    );
  }

/* The READMEs' alt and credit, kept to what the picture shows (WCAG 1.1.1). */
for (const readme of ["README.md", "packages/clover/README.md"]) {
  const path = join(ROOT, readme);
  const text = readFileSync(path, "utf8");
  const img = /(<img alt=")[^"]*(" src="[^"]*hero-light\.svg">)/;
  if (!img.test(text)) throw new Error(`${readme} has no hero to describe`);
  const credit = /(<\/picture>\n\n<sub>)[^<]*(<\/sub>)/;
  let next = text.replace(img, `$1${escape(ALT).replace(/"/g, "&quot;")}$2`);
  next = credit.test(next)
    ? next.replace(credit, `$1${escape(CREDIT)}$2`)
    : next.replace(
        "</picture>\n",
        `</picture>\n\n<sub>${escape(CREDIT)}</sub>\n`,
      );
  if (next !== text) writeFileSync(path, next);
  console.log(
    `${readme}  alt and credit ${next === text ? "current" : "written"}`,
  );
}
