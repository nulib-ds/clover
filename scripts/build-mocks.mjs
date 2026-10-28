/**
 * Writes the published mocks to `public/mocks/`, from their generators in `docs/mocks/`.
 * Run with `npm run build:mocks` (vite-node, which reads the generators' JSON imports)
 * after changing a generator, and commit the output: the files are served as they are
 * by the docs site, at https://clover.iiif.library.northwestern.edu/mocks/.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PUBLIC_BASE,
  manifest,
  matches,
  ocrPage,
  searchResponse,
} from "../docs/mocks/content-search/index.mjs";
import {
  PUBLIC_BASE as GEOREFERENCE_BASE,
  manifest as georeferenceManifest,
} from "../docs/mocks/georeference/index.mjs";
import {
  PUBLIC_BASE as TAGGING_BASE,
  manifest as taggingManifest,
} from "../docs/mocks/tagging/index.mjs";
import {
  PUBLIC_BASE as NAVPLACE_BASE,
  manifest as navPlaceManifest,
} from "../docs/mocks/navplace/index.mjs";
import {
  PUBLIC_BASE as HINDENBURG_BASE,
  captions as hindenburgCaptions,
  manifest as hindenburgManifest,
} from "../docs/mocks/hindenburg/index.mjs";
import {
  PUBLIC_BASE as PAGED_BASE,
  manifest as pagedManifest,
  matches as pagedMatches,
  ocrPage as pagedOcrPage,
  pagesOfWords as pagedPages,
  searchResponse as pagedSearchResponse,
} from "../docs/mocks/paged/index.mjs";
import {
  PUBLIC_BASE as TRANSCRIPTS_BASE,
  manifest as transcriptsManifest,
} from "../docs/mocks/transcripts/index.mjs";
import {
  PUBLIC_BASE as HESS_BASE,
  captions as hessCaptions,
  manifest as hessManifest,
  transcript as hessTranscript,
} from "../docs/mocks/rudolf-hess-nuremberg/index.mjs";
import {
  PUBLIC_BASE as PAGE_TRANSCRIPT_BASE,
  manifest as pageTranscriptManifest,
  pageText,
} from "../docs/mocks/page-transcript/index.mjs";

import {
  PUBLIC_BASE as STANDALONE_CANVAS_BASE,
  canvas as standaloneCanvas,
} from "../docs/mocks/standalone-canvas/index.mjs";
import {
  PUBLIC_BASE as ESU_SHRINE_BASE,
  LAB_MODEL as ESU_SHRINE_LAB_MODEL,
  MODEL_FILE as ESU_SHRINE_MODEL,
  manifest as esuShrineManifest,
} from "../docs/mocks/esu-shrine/index.mjs";
import {
  PUBLIC_BASE as COOKBOOK_BASE,
  collection as cookbookCollection,
} from "../docs/mocks/cookbook/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/mocks/content-search");

/** Example searches published as files: one over two pages, one word, a phrase, a miss. */
export const EXAMPLES = ["nicht", "moskau", "drei jungen", "zzzz"];

/** Pretty, except the OCR pages: thousands of annotations, read by machines. */
const write = (path, json, { compact = false } = {}) => {
  const file = join(out, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(json, null, compact ? 0 : 2)}\n`);
};

rmSync(out, { recursive: true, force: true });
write("manifest.json", manifest(PUBLIC_BASE));
for (const n of [1, 2]) {
  write(`ocr/p${n}-lines.json`, ocrPage(PUBLIC_BASE, n, "line"), {
    compact: true,
  });
  write(`ocr/p${n}-words.json`, ocrPage(PUBLIC_BASE, n, "word"), {
    compact: true,
  });
}

const slug = (q) => q.replace(/\s+/g, "-");
const exampleUrl = (q, n) =>
  `${PUBLIC_BASE}/search/examples/${slug(q)}${n > 1 ? `-${n}` : ""}.json`;
for (const q of EXAMPLES) {
  const total = matches(q).length;
  const pages = Math.max(1, Math.ceil(total / 25));
  for (let n = 1; n <= pages; n++) {
    write(
      `search/examples/${slug(q)}${n > 1 ? `-${n}` : ""}.json`,
      searchResponse({ base: PUBLIC_BASE, q, page: n, pageUrl: exampleUrl }),
    );
  }
  console.log(`${q}: ${total} hits, ${pages} page(s)`);
}

// The georeferenced map: one static Manifest.
const georeference = join(root, "public/mocks/georeference");
rmSync(georeference, { recursive: true, force: true });
mkdirSync(georeference, { recursive: true });
writeFileSync(
  join(georeference, "manifest.json"),
  `${JSON.stringify(georeferenceManifest(GEOREFERENCE_BASE), null, 2)}\n`,
);
console.log("georeference: manifest.json");

// The tagged photogravure: one static Manifest.
const tagging = join(root, "public/mocks/tagging");
rmSync(tagging, { recursive: true, force: true });
mkdirSync(tagging, { recursive: true });
writeFileSync(
  join(tagging, "manifest.json"),
  `${JSON.stringify(taggingManifest(TAGGING_BASE), null, 2)}\n`,
);
console.log("tagging: manifest.json");

// The photograph placed on the map: one static Manifest.
const navPlace = join(root, "public/mocks/navplace");
rmSync(navPlace, { recursive: true, force: true });
mkdirSync(navPlace, { recursive: true });
writeFileSync(
  join(navPlace, "manifest.json"),
  `${JSON.stringify(navPlaceManifest(NAVPLACE_BASE), null, 2)}\n`,
);
console.log("navplace: manifest.json");

// The broadcast with its box, the box accompanying the sound, and its captions.
const hindenburg = join(root, "public/mocks/hindenburg");
rmSync(hindenburg, { recursive: true, force: true });
mkdirSync(hindenburg, { recursive: true });
writeFileSync(
  join(hindenburg, "manifest.json"),
  `${JSON.stringify(hindenburgManifest(HINDENBURG_BASE), null, 2)}\n`,
);
writeFileSync(join(hindenburg, "captions.vtt"), `${hindenburgCaptions()}\n`);
console.log("hindenburg: manifest.json, captions.vtt");

// The catalog in spreads, its double-page plate shown alone, its words read by machine
// and searchable: the Manifest, each page's OCR by line and by word, and example searches.
const paged = join(root, "public/mocks/paged");
rmSync(paged, { recursive: true, force: true });
const writePaged = (path, json, { compact = false } = {}) => {
  const file = join(paged, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(json, null, compact ? 0 : 2)}\n`);
};
writePaged("manifest.json", pagedManifest(PAGED_BASE));
const read = pagedPages().filter((page) => page.words.length);
for (const { key } of read) {
  for (const granularity of ["line", "word"]) {
    writePaged(
      `ocr/${key}-${granularity}s.json`,
      pagedOcrPage(PAGED_BASE, key, granularity),
      { compact: true },
    );
  }
}
/** Example searches published as files: a word on many pages, a phrase, a miss. */
const PAGED_EXAMPLES = ["steel", "model d", "zzzz"];
const pagedSlug = (q) => q.replace(/\s+/g, "-");
const pagedExampleUrl = (q, n) =>
  `${PAGED_BASE}/search/examples/${pagedSlug(q)}${n > 1 ? `-${n}` : ""}.json`;
for (const q of PAGED_EXAMPLES) {
  const pages = Math.max(1, Math.ceil(pagedMatches(q).length / 25));
  for (let n = 1; n <= pages; n++) {
    writePaged(
      `search/examples/${pagedSlug(q)}${n > 1 ? `-${n}` : ""}.json`,
      pagedSearchResponse({
        base: PAGED_BASE,
        q,
        page: n,
        pageUrl: pagedExampleUrl,
      }),
    );
  }
}
console.log(
  `paged: manifest.json, ocr/ (${read.length} pages), search/examples/ (${PAGED_EXAMPLES.join(", ")})`,
);

// The film with its captions and its transcript: one static Manifest.
const transcripts = join(root, "public/mocks/transcripts");
rmSync(transcripts, { recursive: true, force: true });
mkdirSync(transcripts, { recursive: true });
writeFileSync(
  join(transcripts, "manifest.json"),
  `${JSON.stringify(transcriptsManifest(TRANSCRIPTS_BASE), null, 2)}\n`,
);
console.log("transcripts: manifest.json");

// The film with defendants followed through it: a Manifest and its captions.
const hess = join(root, "public/mocks/rudolf-hess-nuremberg");
rmSync(hess, { recursive: true, force: true });
mkdirSync(hess, { recursive: true });
writeFileSync(
  join(hess, "manifest.json"),
  `${JSON.stringify(hessManifest(HESS_BASE), null, 2)}\n`,
);
writeFileSync(join(hess, "captions.vtt"), `${hessCaptions()}\n`);
writeFileSync(join(hess, "transcript.txt"), `${hessTranscript()}\n`);
console.log(
  "rudolf-hess-nuremberg: manifest.json, captions.vtt, transcript.txt",
);

// The newspaper issue with each page's OCR as a text file: a Manifest and two texts.
const pageTranscript = join(root, "public/mocks/page-transcript");
rmSync(pageTranscript, { recursive: true, force: true });
mkdirSync(join(pageTranscript, "text"), { recursive: true });
writeFileSync(
  join(pageTranscript, "manifest.json"),
  `${JSON.stringify(pageTranscriptManifest(PAGE_TRANSCRIPT_BASE), null, 2)}\n`,
);
for (const n of [1, 2]) {
  writeFileSync(join(pageTranscript, `text/p${n}.txt`), pageText(n));
}
console.log("page-transcript: manifest.json, text/p1.txt, text/p2.txt");

// A Canvas on its own, the map of the British Isles: one static Canvas.
const standalone = join(root, "public/mocks/standalone-canvas");
rmSync(standalone, { recursive: true, force: true });
mkdirSync(standalone, { recursive: true });
writeFileSync(
  join(standalone, "canvas.json"),
  `${JSON.stringify(standaloneCanvas(STANDALONE_CANVAS_BASE), null, 2)}\n`,
);
console.log("standalone-canvas: canvas.json");

// The Esu shrine's 3D model: a Manifest of one Scene, and the Lab's GLB beside it, which
// the Lab's server will not let another site fetch. Fetched from the Lab when it is not
// here yet (34.5 MB), and kept as it came: delete it to fetch it again.
const esuShrine = join(root, "public/mocks/esu-shrine");
mkdirSync(esuShrine, { recursive: true });
writeFileSync(
  join(esuShrine, "manifest.json"),
  `${JSON.stringify(esuShrineManifest(ESU_SHRINE_BASE), null, 2)}\n`,
);
const esuShrineModel = join(esuShrine, ESU_SHRINE_MODEL);
if (!existsSync(esuShrineModel)) {
  const response = await fetch(ESU_SHRINE_LAB_MODEL);
  if (!response.ok)
    throw new Error(`${ESU_SHRINE_LAB_MODEL} answered ${response.status}`);
  writeFileSync(esuShrineModel, Buffer.from(await response.arrayBuffer()));
}
console.log(`esu-shrine: manifest.json, ${ESU_SHRINE_MODEL}`);

// The IIIF Cookbook's recipes, curated as one Collection: one static Collection.
const cookbook = join(root, "public/mocks/cookbook");
rmSync(cookbook, { recursive: true, force: true });
mkdirSync(cookbook, { recursive: true });
writeFileSync(
  join(cookbook, "collection.json"),
  `${JSON.stringify(cookbookCollection(COOKBOOK_BASE), null, 2)}\n`,
);
console.log("cookbook: collection.json");
