import { chaptersOf, parseTime } from "./ranges";
import { cueAt, parseVtt } from "./vtt";

const VTT = `WEBVTT
Kind: captions

NOTE a comment

1
00:00:01.000 --> 00:00:04.000 align:start
<v Ann>Hello &amp; <i>welcome</i>.

00:05.500 --> 00:08.000
Second cue
on two lines

STYLE
::cue { color: red }

01:00:00.000 --> 01:00:02.000
An hour in
`;

describe("parseVtt", () => {
  it("reads cues: times, text without tags, the speaker", () => {
    expect(parseVtt(VTT)).toEqual([
      { start: 1, end: 4, text: "Hello & welcome.", voice: "Ann" },
      { start: 5.5, end: 8, text: "Second cue\non two lines" },
      { start: 3600, end: 3602, text: "An hour in" },
    ]);
  });

  it("decodes numeric character references, once", () => {
    const [cue] = parseVtt(
      "WEBVTT\n\n00:01.000 --> 00:02.000\nit&#39;s &#x266A; &amp;#39; &#0; &bogus;\n",
    );
    expect(cue.text).toBe("it's ♪ &#39; &#0; &bogus;");
  });

  it("finds the cue playing by binary search, none between cues", () => {
    const cues = parseVtt(VTT);
    expect(cueAt(cues, 0.5)).toBe(-1);
    expect(cueAt(cues, 1)).toBe(0);
    expect(cueAt(cues, 4.5)).toBe(-1);
    expect(cueAt(cues, 7.9)).toBe(1);
    expect(cueAt(cues, 3601)).toBe(2);
  });

  it("keeps an earlier cue that is still running past a later start", () => {
    const cues = [
      { start: 0, end: 10, text: "long" },
      { start: 2, end: 3, text: "short" },
    ];
    expect(cueAt(cues, 2.5)).toBe(1);
    expect(cueAt(cues, 5)).toBe(0);
  });
});

describe("chaptersOf", () => {
  const canvas = "https://example.org/canvas/1";
  const manifest = (item: (t: string) => unknown) =>
    ({
      id: "https://example.org/m",
      type: "Manifest",
      structures: [
        {
          id: "https://example.org/r/0",
          type: "Range",
          label: { en: ["Whole"] },
          items: [
            {
              id: "https://example.org/r/1",
              type: "Range",
              label: { en: ["Act two"] },
              items: [item("30,60")],
            },
            {
              id: "https://example.org/r/2",
              type: "Range",
              label: { en: ["Act one"] },
              items: [item("0")],
            },
          ],
        },
      ],
    }) as any;

  it.each([
    [
      "a fragment on the id",
      (t: string) => ({ id: `${canvas}#t=${t}`, type: "Canvas" }),
    ],
    [
      "a FragmentSelector",
      (t: string) => ({
        type: "SpecificResource",
        source: { id: canvas, type: "Canvas" },
        selector: { type: "FragmentSelector", value: `t=${t}` },
      }),
    ],
    ["a string", (t: string) => `${canvas}#t=${t}`],
  ])("reads nested Ranges with %s, sorted with the gaps closed", (_, item) => {
    expect(chaptersOf(manifest(item), canvas, 90)).toEqual([
      { label: { en: ["Act one"] }, start: 0, end: 30 },
      { label: { en: ["Act two"] }, start: 30, end: 60 },
    ]);
  });

  it("reads a fragment the 4.0.3 upgrader turned into a path segment", () => {
    const upgraded = manifest((t) => ({
      id: `${canvas}/t=${t}`,
      type: "Canvas",
    }));
    expect(chaptersOf(upgraded, canvas, 90).map((c) => c.start)).toEqual([
      0, 30,
    ]);
  });

  it("walks a Range cycle once", () => {
    const range: any = { id: "loop", type: "Range", items: [] };
    range.items.push(range, { id: `${canvas}#t=5`, type: "Canvas" });
    expect(
      chaptersOf(
        { id: "m", type: "Manifest", structures: [range] } as any,
        canvas,
        10,
      ),
    ).toEqual([{ label: undefined, start: 5, end: 10 }]);
  });

  it("reads time fragments leniently, never as NaN", () => {
    expect(parseTime("30")).toEqual({ start: 30 });
    expect(parseTime("0,")).toEqual({ start: 0 });
    expect(parseTime("x,1")).toBeUndefined();
  });
});
