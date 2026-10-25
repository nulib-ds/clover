/**
 * A radio broadcast with its box: Northwestern University Libraries' record of WLS-AM's
 * broadcast of Herbert Morrison and Charlie Nehlsen's recording of the Hindenburg disaster
 * (May 1937), from the Charles Deering McCormick Library of Special Collections, as its
 * Digital Collections API published it on October 24, 2026 (`source.json`, kept as
 * fetched): a Canvas of sound, the reel's, then four photographs, the front and back of
 * the reel's enclosure and of its carrier. Its changes:
 *
 * - the Manifest and its Canvases take ids under the mock's own address;
 * - the Canvas of sound, and its sound, lose the API's `width` and `height` (100 × 100,
 *   a stand-in: sound has no extent), so it is a Timeline once upgraded;
 * - the photographs lose the API's `duration` (1, a stand-in: a still has no time);
 * - the Canvas of sound takes an `accompanyingCanvas`, which the record does not carry:
 *   the enclosure's back, the box the reel came in, where its label is written ("Hindenburg
 *   broadcast, 1936", the label the record's Notes quote; Mat, 2026-10-24).
 *   It paints the record's own image of it, so a player shows the box while the
 *   broadcast plays;
 * - English captions (`captions.json`, written out by `captions()`), a `supplementing`
 *   WebVTT file, as Cookbook recipe 0219 gives one. The record has no transcript: the
 *   words were transcribed from the broadcast by speech recognition (Whisper's
 *   `medium.en`, October 24, 2026), then corrected by hand, its names from the record and
 *   the broadcast itself (Herbert Morrison, Charles Nehlsen, WLS, the Prairie Farmer
 *   station, Lakehurst) and those of the airship's commanders and survivors as history
 *   gives them. A word that could not be told is `[unclear]`, and so is the answer of a
 *   passenger Morrison speaks with (10:25–10:54). Not yet checked word for word by a
 *   listener;
 * - chapters (`structures`), a Range for each part of the broadcast, titled with its own
 *   words where that part begins (`CHAPTERS`);
 * - a page of annotations on the broadcast's time (`NOTES`), each a stretch of it and
 *   what happens there, in the broadcast's own terms.
 *
 * `scripts/build-mocks.mjs` writes it to `public/mocks/hindenburg/` (the Manifest and
 * `captions.vtt`), published at https://nulib-ds.github.io/clover/mocks/hindenburg/;
 * `npm run dev` serves it live under `/api/mocks/hindenburg/`, its captions with it. The
 * sound is Northwestern's HLS stream and the images its IIIF Image API (level 2), both
 * CORS open. Documented at /docs/mocks.
 */
import cues from "./captions.json";
import source from "./source.json";

export const PUBLIC_BASE = "https://nulib-ds.github.io/clover/mocks/hindenburg";

/** The photograph the Canvas of sound is accompanied by: the enclosure's back, its label. */
export const ACCOMPANYING = "enclosure back";

/**
 * The broadcast's parts, each titled with its own words where it begins: the studio's
 * introduction, Morrison asked about the scene, his recording of the landing, the fire,
 * his description after it, his return from the wreck, the passengers he meets, the count
 * of the saved, and the studio's close. `[start, end, title]`, in seconds.
 */
const CHAPTERS = [
  [0, 84.68, "In place of a program originally scheduled"],
  [84.68, 123.1, "Was there anything unusual about the scene?"],
  [123.1, 181.18, "The ship is riding majestically toward us"],
  [181.18, 242.6, "It burst into flames!"],
  [242.6, 394.78, "I'm going to have to stop for a minute"],
  [394.78, 577.98, "Ladies and gentlemen, I'm back again"],
  [577.98, 681.34, "We're back with another important bulletin"],
  [681.34, 814.9, "I have some very good news for you"],
  [814.9, 856.611, "You've been listening to an actual eyewitness description"],
];

/**
 * What happens in the broadcast, a stretch at a time, as it tells it:
 * `[start, end, note]`, in seconds.
 */
const NOTES = [
  [
    7.08,
    84.68,
    "The studio introduces the recording, made at Lakehurst, New Jersey, the night before.",
  ],
  [
    123.1,
    181.18,
    "Morrison's recording begins as the Hindenburg nears the mooring mast, its ropes dropped to the ground crew.",
  ],
  [
    181.18,
    188.16,
    "The airship bursts into flames as Morrison describes the landing.",
  ],
  [
    206.37,
    216.76,
    "The frame crashes to the ground short of the mooring mast: “Oh, the humanity.”",
  ],
  [
    394.78,
    462.78,
    "Morrison meets Philip Mangone of New York, a passenger who jumped clear, and sees him to a car.",
  ],
  [
    577.98,
    677.24,
    "Two more passengers come to Morrison, safe, Mr. O'Laughlin of Chicago among them.",
  ],
  [
    689.14,
    718.96,
    "From the emergency station: between 25 and 30 of about 106 on board saved and accounted for.",
  ],
  [814.9, 846.1, "The studio closes the broadcast, Herbert Morrison with it."],
];

/** A time as WebVTT writes it, `hh:mm:ss.ttt`. */
const stamp = (seconds) => {
  const pad = (value, width) => String(value).padStart(width, "0");
  const whole = Math.floor(seconds);
  return `${pad(Math.floor(whole / 3600), 2)}:${pad(Math.floor(whole / 60) % 60, 2)}:${pad(
    (seconds % 60).toFixed(3),
    6,
  )}`;
};

/** A cue's words in two lines at most, balanced, each within 42 characters. */
const lines = (text, width = 42) => {
  if (text.length <= width) return [text];
  const words = text.split(" ");
  let best;
  for (let i = 1; i < words.length; i++) {
    const [a, b] = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const cost = Math.abs(a.length - b.length);
    if (a.length <= width && b.length <= width && (!best || cost < best[0]))
      best = [cost, [a, b]];
  }
  if (!best) throw new Error(`A caption too long for two lines: ${text}`);
  return best[1];
};

/** The English captions, as WebVTT. */
export function captions() {
  return [
    "WEBVTT",
    "",
    "NOTE",
    "English captions for WLS's broadcast of Herbert Morrison and Charles Nehlsen's",
    "recording of the Hindenburg disaster (Northwestern University Libraries). Transcribed",
    "by speech recognition and corrected by hand: names from the record and the broadcast.",
    "[unclear] marks words that could not be told.",
    "",
    ...cues.flatMap(([start, end, text], index) => [
      String(index + 1),
      `${stamp(start)} --> ${stamp(end)}`,
      ...lines(text),
      "",
    ]),
  ].join("\n");
}

/** A stretch of the sound, as a Media Fragments selector on it. */
const stretch = (canvas, start, end) => ({
  type: "SpecificResource",
  source: { id: canvas, type: "Canvas" },
  selector: {
    type: "FragmentSelector",
    conformsTo: "http://www.w3.org/TR/media-frags/",
    value: `t=${start},${end}`,
  },
});

/** One painting annotation page, its ids under `canvas`, its body as published. */
const painting = (canvas, page) => ({
  id: `${canvas}/page`,
  type: "AnnotationPage",
  items: page.items.map((annotation, index) => ({
    id: `${canvas}/page/${index + 1}`,
    type: "Annotation",
    motivation: annotation.motivation,
    body: annotation.body,
    target: canvas,
  })),
});

const label = (canvas) => canvas.label.none?.[0];

/** A Canvas or its body without `keys`. */
const without = (resource, keys) =>
  Object.fromEntries(
    Object.entries(resource).filter(([key]) => !keys.includes(key)),
  );

/** Sound without the API's stand-in extent. */
const sound = (canvas) => ({
  ...without(canvas, ["width", "height"]),
  items: canvas.items.map((page) => ({
    ...page,
    items: page.items.map((annotation) => ({
      ...annotation,
      body: without(annotation.body, ["width", "height"]),
    })),
  })),
});

/** A Canvas as published, its ids (and its placeholder's) under `id`. */
function canvasAt(canvas, id) {
  const { placeholderCanvas } = canvas;
  const placeholder = `${id}/placeholder`;
  return {
    ...canvas,
    id,
    ...(placeholderCanvas && {
      placeholderCanvas: {
        ...placeholderCanvas,
        id: placeholder,
        items: placeholderCanvas.items.map((page) =>
          painting(placeholder, page),
        ),
      },
    }),
    items: canvas.items.map((page) => painting(id, page)),
  };
}

export function manifest(base = PUBLIC_BASE) {
  // A copy, so the imported source is never changed.
  const record = JSON.parse(JSON.stringify(source));
  const [reel, ...photographs] = record.items;
  const enclosure = photographs.find(
    (canvas) => label(canvas) === ACCOMPANYING,
  );
  if (!enclosure) throw new Error(`hindenburg: no "${ACCOMPANYING}" Canvas`);

  const id = `${base}/canvas/1`;
  const accompanying = `${id}/accompanying`;
  const still = (canvas) => without(canvas, ["duration"]);

  return {
    ...record,
    id: `${base}/manifest.json`,
    items: [
      {
        ...canvasAt(sound(reel), id),
        annotations: [
          {
            id: `${id}/annotations/notes`,
            type: "AnnotationPage",
            label: { en: ["The broadcast"] },
            items: NOTES.map(([start, end, note], index) => ({
              id: `${id}/annotations/notes/${index + 1}`,
              type: "Annotation",
              motivation: "describing",
              body: {
                type: "TextualBody",
                value: note,
                language: "en",
                format: "text/plain",
              },
              target: stretch(id, start, end),
            })),
          },
          {
            id: `${id}/annotations/captions`,
            type: "AnnotationPage",
            items: [
              {
                id: `${id}/annotations/captions/1`,
                type: "Annotation",
                motivation: "supplementing",
                body: {
                  id: `${base}/captions.vtt`,
                  type: "Text",
                  format: "text/vtt",
                  label: { en: ["Captions in WebVTT format"] },
                  language: "en",
                },
                target: id,
              },
            ],
          },
        ],
        accompanyingCanvas: {
          ...without(still(enclosure), ["id", "placeholderCanvas"]),
          id: accompanying,
          items: enclosure.items.map((page) => painting(accompanying, page)),
        },
      },
      ...photographs.map((canvas, index) =>
        canvasAt(still(canvas), `${base}/canvas/${index + 2}`),
      ),
    ],
    structures: CHAPTERS.map(([start, end, title], index) => ({
      id: `${base}/range/${index + 1}`,
      type: "Range",
      label: { en: [title] },
      items: [stretch(id, start, end)],
    })),
  };
}
