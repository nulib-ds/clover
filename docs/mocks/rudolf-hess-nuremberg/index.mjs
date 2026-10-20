/**
 * A film with people followed through it: "Sentencing of Nazi Leaders at Nuremberg", a
 * reel of the International Military Tribunal's judgment from the National Archives
 * (local identifier 111-ADC-10005), as Wikimedia Commons publishes it, with Rudolf Hess
 * and the defendants around him marked wherever each is in view and can be told: Hermann
 * Göring and Joachim von Ribbentrop either side of him, Wilhelm Keitel beyond Ribbentrop,
 * and, in the row behind, Erich Raeder, Baldur von Schirach and Fritz Sauckel.
 *
 * Commons is not a IIIF publisher, so the Manifest is the mock's own, made from the file's
 * record there (its Commons API `videoinfo`, read on 19 October 2026):
 *
 * - its label and summary are its own, on Hess's distress beside the other defendants;
 *   its metadata are the record's (the National Archives' title and description, among
 *   them), and its date the two days of the judgment the film shows (`SUMMARY`); its
 *   rights, the public domain (a work of the US Army Signal Corps);
 * - its one Canvas (654 × 480, 671.164 s) paints the original WebM file, at its display
 *   size; its `placeholderCanvas` is the still Commons cuts from the file at 14 s;
 * - it has two AnnotationPages (`tracks.json`). "Rudolf Hess" holds three annotations,
 *   one for each part of what the film shows of him: his distress (0:12–1:25), his being
 *   led out of the dock (1:25–1:40), and his return, from the next time he is in the dock
 *   to the end. "Other Defendants" holds one for each of the others followed, named by
 *   him, in the dock's order: Göring, Ribbentrop and Keitel, then Raeder, Schirach and
 *   Sauckel behind them. Karl Dönitz, behind Göring, is not marked: the close shots leave
 *   him out of frame, and in the wide ones he cannot be told. An annotation's targets are
 *   the stretches of the film he is in view and can be told, each the region he fills
 *   through that stretch: `xywh=x,y,w,h&t=start,end`, a
 *   FragmentSelector of both Media Fragments dimensions. Stretches that meet in time are
 *   one movement, which a viewer may draw as a glide between them; a gap between two (a
 *   cut, or Hess hidden behind the officer who leans over to him, 0:23–0:35) is time he is
 *   not in view;
 * - its English captions (`captions.json`, written out by `captions()`), a `supplementing`
 *   WebVTT file, as Cookbook recipe 0219 gives one: the words of the judgment read on the
 *   soundtrack, as the trial's record publishes them, checked against the soundtrack, the
 *   Russian and French interpretation it carries in places given in the record's English
 *   and marked so;
 * - the same words as a plain-text transcript, the Canvas's `rendering`, as Cookbook
 *   recipe 0017 gives one (`transcript()`);
 * - chapters (`structures`), a Range for each part of the film the National Archives'
 *   description names, titled with its words and timed to the film's cuts (`CHAPTERS`).
 *
 * `scripts/build-mocks.mjs` writes it to `public/mocks/rudolf-hess-nuremberg/` (the
 * Manifest, `captions.vtt` and `transcript.txt`), published at
 * https://nulib-ds.github.io/clover/mocks/rudolf-hess-nuremberg/; `npm run dev` serves it
 * live under `/api/mocks/rudolf-hess-nuremberg/`, its files with it. The video and the
 * still are served by Wikimedia (CORS open). Documented at /docs/mocks.
 */
import cues from "./captions.json";
import tracks from "./tracks.json";

export const PUBLIC_BASE =
  "https://nulib-ds.github.io/clover/mocks/rudolf-hess-nuremberg";

const COMMONS =
  "https://commons.wikimedia.org/wiki/File:Sentencing_of_Nazi_Leaders_at_Nuremberg.webm";
const FILE =
  "https://upload.wikimedia.org/wikipedia/commons/6/6f/Sentencing_of_Nazi_Leaders_at_Nuremberg.webm";
/** A still Commons cuts from the file at `seconds`, at one of its thumbnail widths. */
const still = (width, seconds) =>
  `https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Sentencing_of_Nazi_Leaders_at_Nuremberg.webm/${width}px-seek%3D${seconds}-Sentencing_of_Nazi_Leaders_at_Nuremberg.webm.jpg`;

/** The film's size as shown (stored 720 × 480, at a display aspect of 654:480) and length. */
export const WIDTH = 654;
export const HEIGHT = 480;
export const DURATION = 671.164;

/**
 * What the Manifest is for, in its own words: Hess's distress, beside the other
 * defendants, on the two days the judgment was read. The days are read from the film and
 * the trial's record: its first part ends as the Tribunal adjourns after the judgment on
 * the SS, as the session of 30 September 1946 did ("adjourned until 1 October 1946 at
 * 0930 hours"), and its second shows the verdicts on the defendants, read on 1 October.
 */
const SUMMARY =
  "Rudolf Hess in the dock of the International Military Tribunal at Nuremberg as its " +
  "judgment is read, beside the other defendants: Hermann Göring on one side, Joachim " +
  "von Ribbentrop on the other. On 30 September 1946, the first of the judgment's two " +
  "days, Hess shows distress, his head in his hand, rocking forward and back, until he " +
  "stands and is led out of the dock. The film shows him back in the dock before the " +
  "day's adjournment, and on 1 October, as the verdicts on the defendants are read, his " +
  "own among them. Its annotations follow him, and the defendants around him, through " +
  "the film.";

/** The National Archives' description, as the Commons record carries it. */
const DESCRIPTION =
  "MS, Hermann Goering, Baldur von Schirach, Joachim von Ribbentrop, Wilhelm Keitel, " +
  "Alfred Jodl, Rudolf Hess, sitting in prisoners' dock listening to testimony. Hess " +
  "taken ill leaves prisoners' dock. Shots of English and US prosecution tables. Scenes " +
  "of Justice Kravechenko, Russian Justice, reading statement from bench. Pan of " +
  "prisoners' dock and courtroom as voice of Justice Sir Geoffrey Lawrence (British) is " +
  "heard speaking about the SS, Slave Labor and experiments on human beings. The SS was " +
  "able to procure funds for human experiments from the government. The extermination " +
  "of the Jews was carried out by the SS.. Court adjourns. MS of Erich Raeder, Fritz " +
  "Sauckel, Hess, Goering, von Ribbentrop, in dock. Justice Francis Biddle in speaking " +
  "of von Ribbentrop declares that the latter merely stated he acted as a rubber stamp " +
  "for Adolf Hitler's ideas. The tribunal however, finds him guilty on all counts. " +
  "Camera on prisoners' dock as Justice Lawrence speaks about the defendant, Ernst " +
  "Kaltenbrunner.";

/**
 * The film's parts as the National Archives' description names them, in its own words
 * (each cut to the clause that names the shot), and where each runs, to the film's cuts:
 * `[start, end, title]`. The leaders before and after are no part.
 */
const CHAPTERS = [
  [12.5, 85.6, "Sitting in prisoners' dock listening to testimony"],
  [85.6, 117.2, "Hess taken ill leaves prisoners' dock"],
  [117.2, 158.1, "Shots of English and US prosecution tables"],
  [
    158.1,
    197.8,
    "Scenes of Justice Kravechenko, Russian Justice, reading statement from bench",
  ],
  [197.8, 297.5, "Pan of prisoners' dock and courtroom"],
  [297.5, 379.7, "Court adjourns"],
  [
    379.7,
    473.4,
    "MS of Erich Raeder, Fritz Sauckel, Hess, Goering, von Ribbentrop, in dock",
  ],
  [473.4, 528.2, "Justice Francis Biddle in speaking of von Ribbentrop"],
  [
    528.2,
    600.4,
    "Camera on prisoners' dock as Justice Lawrence speaks about the defendant, Ernst Kaltenbrunner",
  ],
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
    'English captions for "Sentencing of Nazi Leaders at Nuremberg" (National Archives',
    "Identifier 23769). The words are the International Military Tribunal's judgment, read",
    "on 30 September and 1 October 1946, as the trial's record publishes it (the Avalon",
    "Project, Yale Law School), checked against the soundtrack: where the record's two",
    "printings differ, the one the soundtrack agrees with. Where the soundtrack carries the",
    "Russian or French interpretation, the record's English is given, marked [In Russian]",
    "or [In French]. An ellipsis marks speech cut by the film's editing.",
    "",
    ...cues.flatMap(([start, end, text], index) => [
      String(index + 1),
      `${stamp(start)} --> ${stamp(end)}`,
      ...lines(text),
      "",
    ]),
  ].join("\n");
}

/**
 * The same words as plain text, as Cookbook recipe 0253 gives a film's transcript: the
 * cues joined, a paragraph for each stretch of the reading the film keeps whole. A stretch
 * starts after a pause of 2.5 s or more, at a cut to another shot (a cue that opens with
 * an ellipsis) and where the soundtrack changes language or voice (one that opens with a
 * bracketed note); a paragraph starts there too, and where the editing cuts the speech
 * within a stretch (a cue that ends with an ellipsis). A stretch's language note, which
 * the captions give once, opens each of its paragraphs.
 */
export function transcript() {
  const paragraphs = [];
  let note;
  cues.forEach(([start, , text], index) => {
    const before = cues[index - 1];
    const stretch = !before || start - before[1] >= 2.5 || /^[…[]/.test(text);
    if (stretch) note = /^\[In [^\]]+\]/.exec(text)?.[0];
    if (stretch || /…”?$/.test(before[2]))
      paragraphs.push(stretch || !note ? text : `${note} ${text}`);
    else paragraphs[paragraphs.length - 1] += ` ${text}`;
  });
  return paragraphs.join("\n\n");
}

const line = (label, value) => ({
  label: { en: [label] },
  value: { en: [value] },
});

/** A number as written in a fragment: no trailing zeros. */
const n = (value) => String(Number(value.toFixed(2)));

/**
 * One annotation on a person followed: what it says of him, its motivation as the data
 * gives it (it identifies him; one that says more than his name describes what he does,
 * too), and where he is in each stretch of the film it covers, each stretch a target of
 * its own.
 */
const following = (canvas, page, { key, label, motivation, keys }) => ({
  id: `${page}/${key}`,
  type: "Annotation",
  motivation,
  body: {
    type: "TextualBody",
    value: label,
    language: "en",
    format: "text/plain",
  },
  target: keys.map(([start, end, x, y, w, h]) => ({
    type: "SpecificResource",
    source: { id: canvas, type: "Canvas" },
    selector: {
      type: "FragmentSelector",
      conformsTo: "http://www.w3.org/TR/media-frags/",
      value: `xywh=${x},${y},${w},${h}&t=${n(start)},${n(end)}`,
    },
  })),
});

export function manifest(base = PUBLIC_BASE) {
  const canvas = `${base}/canvas/1`;
  const placeholder = `${canvas}/placeholder`;

  return {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: `${base}/manifest.json`,
    type: "Manifest",
    label: {
      en: ["Rudolf Hess at Nuremberg Sentencing, 30 September–1 October 1946"],
    },
    summary: { en: [SUMMARY] },
    navDate: "1946-09-30T00:00:00Z",
    metadata: [
      line("Title", "Sentencing of Nazi Leaders at Nuremberg"),
      line("Date", "30 September–1 October 1946"),
      line("Description", DESCRIPTION),
      line(
        "Creator",
        "Department of the Army. Office of the Chief Signal Officer.",
      ),
      line(
        "Series",
        "Moving Images Relating to Military Activities, 1947 - 1964",
      ),
      line(
        "Record Group",
        "Record Group 111: Records of the Office of the Chief Signal Officer, 1860 - 1985",
      ),
      line("National Archives Identifier", "23769"),
      line("Local Identifier", "111-ADC-10005"),
    ],
    rights: "http://creativecommons.org/publicdomain/mark/1.0/",
    homepage: [
      {
        id: COMMONS,
        type: "Text",
        label: { en: ["Wikimedia Commons"] },
        format: "text/html",
      },
      {
        id: "https://catalog.archives.gov/id/23769",
        type: "Text",
        label: { en: ["National Archives Catalog"] },
        format: "text/html",
      },
    ],
    thumbnail: [
      {
        id: still(250, 14),
        type: "Image",
        format: "image/jpeg",
        width: 250,
        height: 183,
      },
    ],
    items: [
      {
        id: canvas,
        type: "Canvas",
        label: { en: ["Sentencing of Nazi Leaders at Nuremberg"] },
        width: WIDTH,
        height: HEIGHT,
        duration: DURATION,
        placeholderCanvas: {
          id: placeholder,
          type: "Canvas",
          width: 500,
          height: 367,
          items: [
            {
              id: `${placeholder}/page`,
              type: "AnnotationPage",
              items: [
                {
                  id: `${placeholder}/page/1`,
                  type: "Annotation",
                  motivation: "painting",
                  body: {
                    id: still(500, 14),
                    type: "Image",
                    format: "image/jpeg",
                    width: 500,
                    height: 367,
                  },
                  target: placeholder,
                },
              ],
            },
          ],
        },
        items: [
          {
            id: `${canvas}/page`,
            type: "AnnotationPage",
            items: [
              {
                id: `${canvas}/page/1`,
                type: "Annotation",
                motivation: "painting",
                body: {
                  id: FILE,
                  type: "Video",
                  format: "video/webm",
                  width: WIDTH,
                  height: HEIGHT,
                  duration: DURATION,
                },
                target: canvas,
              },
            ],
          },
        ],
        // Rudolf Hess's page, one of the other defendants followed, and the captions.
        annotations: [
          ...Object.entries(tracks).map(([key, { label, annotations }]) => {
            const page = `${canvas}/annotations/${key}`;
            return {
              id: page,
              type: "AnnotationPage",
              label: { en: [label] },
              items: annotations.map((annotation) =>
                following(canvas, page, annotation),
              ),
            };
          }),
          {
            id: `${canvas}/annotations/captions`,
            type: "AnnotationPage",
            items: [
              {
                id: `${canvas}/annotations/captions/1`,
                type: "Annotation",
                motivation: "supplementing",
                body: {
                  id: `${base}/captions.vtt`,
                  type: "Text",
                  format: "text/vtt",
                  label: { en: ["Captions in WebVTT format"] },
                  language: "en",
                },
                target: canvas,
              },
            ],
          },
        ],
        // The captions' words as plain text, as recipe 0017 gives a transcript.
        rendering: [
          {
            id: `${base}/transcript.txt`,
            type: "Text",
            format: "text/plain",
            label: { en: ["Transcript in plain text format"] },
            language: "en",
          },
        ],
      },
    ],
    structures: CHAPTERS.map(([start, end, title], index) => ({
      id: `${base}/range/${index + 1}`,
      type: "Range",
      label: { en: [title] },
      items: [
        {
          type: "SpecificResource",
          source: { id: canvas, type: "Canvas" },
          selector: {
            type: "FragmentSelector",
            conformsTo: "http://www.w3.org/TR/media-frags/",
            value: `t=${start},${end}`,
          },
        },
      ],
    })),
  };
}
