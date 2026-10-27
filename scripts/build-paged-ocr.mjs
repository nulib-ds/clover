/**
 * Reads the words on every page of the `paged` mock (the White bicycle catalog) with
 * Apple's Vision framework (`scripts/ocr-vision.swift`, macOS only), and writes them to
 * `docs/mocks/paged/ocr.json`, which the mock's generator serves as OCR and searches
 * (Mat, 2026-10-26: "transcribe this item and build a iiif search endpoint for it").
 *
 * Each page is read from Northwestern's IIIF Image server at a size its `info.json`
 * lists, the largest no wider than `READ_WIDTH`, never a size of our own; the image is
 * kept only while it is read, in the system's temporary folder, never in the repository
 * (the record's attribution does not permit further distribution of its images). The
 * words' boxes are in each Canvas's own pixels.
 *
 * Run it when the record changes: `npm run build:paged-ocr`, then `npm run build:mocks`.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(
  readFileSync(join(root, "docs/mocks/paged/source.json"), "utf8"),
);
const script = join(root, "scripts/ocr-vision.swift");
const out = join(root, "docs/mocks/paged/ocr.json");

/** Wide enough for the catalog's smallest type, as Vision reads it. */
const READ_WIDTH = 2600;

const labelOf = (canvas) =>
  Object.values(canvas.label ?? {})
    .flat()
    .join(" ");

/** The listed size to read at: the largest no wider than `READ_WIDTH`, else the least. */
function sizeFor(info) {
  const sizes = [...(info.sizes ?? [])].sort((a, b) => b.width - a.width);
  if (!sizes.length) throw new Error(`${info.id} lists no sizes`);
  return sizes.find((size) => size.width <= READ_WIDTH) ?? sizes.at(-1);
}

const folder = mkdtempSync(join(tmpdir(), "clover-paged-ocr-"));
const pages = [];
try {
  for (const canvas of source.items) {
    const body = canvas.items[0].items[0].body;
    const service = [body.service].flat()[0].id;
    const info = await (await fetch(`${service}/info.json`)).json();
    const { width, height } = sizeFor(info);
    const file = join(folder, "page.jpg");
    const image = await fetch(
      `${service}/full/${width},${height}/0/default.jpg`,
    );
    if (!image.ok) throw new Error(`${service}: ${image.status}`);
    writeFileSync(file, Buffer.from(await image.arrayBuffer()));
    const read = JSON.parse(
      execFileSync(
        "swift",
        [script, file, String(canvas.width), String(canvas.height), "en-US"],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      ),
    );
    const lines = read.lines.map((line) => line.words);
    pages.push({ label: labelOf(canvas), lines });
    const words = lines.reduce((total, line) => total + line.length, 0);
    console.log(`${labelOf(canvas)}: ${lines.length} lines, ${words} words`);
  }
} finally {
  rmSync(folder, { recursive: true, force: true });
}

writeFileSync(
  out,
  `${JSON.stringify(
    {
      about:
        "Machine read with Apple's Vision framework (accurate, en-US, language correction), not corrected by hand. Each line is its words, each [text, x, y, width, height] in its Canvas's pixels.",
      pages,
    },
    null,
    1,
  )}\n`,
);
console.log(`wrote ${out}`);
