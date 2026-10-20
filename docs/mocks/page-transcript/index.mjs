/**
 * A page's transcript as plain text: the newspaper issue of the `content-search` mock
 * (two pages of the _Berliner Tageblatt_, February 16, 1925), each Canvas with its own
 * OCR as a `text/plain` file in its `rendering`, in German (`de`), as libraries publish a
 * page's OCR text beside its image. No search service and no OCR annotations: the text
 * files are the one way to the words.
 *
 * Each file is the page's OCR as `content-search` reads it (`ocr.json`, words in reading
 * order, grouped into lines by `linesOf`): a line of the page a line of the file, and a
 * blank line where the next line does not follow on below (a new column or block, read
 * from the boxes). Nothing is typed by hand.
 *
 * Static only: `scripts/build-mocks.mjs` writes it to `public/mocks/page-transcript/`,
 * published at https://nulib-ds.github.io/clover/mocks/page-transcript/. The images are
 * the IIIF reference image server's (level 1, CORS open). Documented at /docs/mocks.
 */
import {
  linesOf,
  manifest as issue,
  pagesOfWords,
} from "../content-search/index.mjs";

export const PUBLIC_BASE =
  "https://nulib-ds.github.io/clover/mocks/page-transcript";

/** Where a page's text is published, under `base`. */
export const textUrl = (base, n) => `${base}/text/p${n}.txt`;

/**
 * Page `n`'s OCR as plain text: its lines in reading order, a blank line where the next
 * line jumps up (a new column) or steps down more than 1.6 times the page's usual pitch
 * from line to line (a new block). OCR boxes overlap, so it is read from where the lines
 * start, not from the gaps between their boxes.
 */
export function pageText(n) {
  const page = pagesOfWords().find((item) => item.n === n);
  if (!page) return null;
  const lines = linesOf(page.words);
  const pitches = lines
    .slice(1)
    .map((line, index) => line.y - lines[index].y)
    .filter((pitch) => pitch > 0)
    .sort((a, b) => a - b);
  const usual = pitches[Math.floor(pitches.length / 2)] ?? 0;
  let text = "";
  lines.forEach((line, index) => {
    const last = lines[index - 1];
    if (last) {
      const pitch = line.y - last.y;
      text += pitch < -last.h || pitch > 1.6 * usual ? "\n\n" : "\n";
    }
    text += line.text;
  });
  return `${text}\n`;
}

/** The issue as the `content-search` mock publishes it, its pages with their text. */
export function manifest(base = PUBLIC_BASE) {
  const published = issue(base);
  const { service, ...rest } = published;
  return {
    ...rest,
    id: `${base}/manifest.json`,
    summary: {
      en: [
        "A mock for a page's transcript as plain text: a newspaper issue, each page's OCR as a text file. Published by Clover IIIF for testing viewers.",
      ],
    },
    items: published.items.map(({ annotations, ...canvas }, index) => ({
      ...canvas,
      rendering: [
        {
          id: textUrl(base, index + 1),
          type: "Text",
          format: "text/plain",
          label: { en: ["Text (OCR)"] },
          language: "de",
        },
      ],
    })),
  };
}
