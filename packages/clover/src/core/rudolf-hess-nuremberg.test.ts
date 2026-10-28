import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canvasTextTranscripts } from "../components/Canvas/layout";
import hessJson from "../fixtures/mocks/rudolf-hess-nuremberg/manifest.json";
import { p4 } from "../fixtures/presentation4";
import { chaptersOf } from "./ranges";
import { parseVtt } from "./vtt";

/*
 * The docs' `rudolf-hess-nuremberg` mock carries its film's chapters, as Ranges titled with
 * the National Archives' description, and its English captions, as a WebVTT file and as a
 * plain-text transcript.
 */
describe("the rudolf-hess-nuremberg mock", () => {
  const manifest = p4(hessJson);
  const [film] = manifest.items as any[];
  const fixture = (name: string) =>
    readFileSync(
      resolve(__dirname, "../fixtures/mocks/rudolf-hess-nuremberg", name),
      "utf8",
    );

  it("gives its film nine chapters, each the archive's words, in order", () => {
    const chapters = chaptersOf(manifest, film.id, film.duration);
    expect(chapters).toHaveLength(9);
    expect(chapters[0]).toMatchObject({
      start: 12.5,
      end: 85.6,
      label: { en: ["Sitting in prisoners' dock listening to testimony"] },
    });
    expect(chapters[1].label).toEqual({
      en: ["Hess taken ill leaves prisoners' dock"],
    });
    expect(chapters.at(-1)!.end).toBe(600.4);
    chapters.slice(1).forEach((chapter, index) => {
      expect(chapter.start).toBe(chapters[index].end);
    });
  });

  it("names its captions as Cookbook 0219 does, and they read as WebVTT", () => {
    const page = film.annotations.find((each: any) =>
      each.items.some((item: any) => item.motivation.includes("supplementing")),
    );
    const [annotation] = page.items;
    // Presentation 4 holds its language as a list.
    expect(annotation.body).toMatchObject({
      type: "Text",
      format: "text/vtt",
      language: ["en"],
    });
    const cues = parseVtt(fixture("captions.vtt"));
    expect(cues).toHaveLength(99);
    expect(cues[0]).toMatchObject({ start: 23.2, end: 27.4 });
    // In order, none overlapping, none past the film.
    cues.slice(1).forEach((cue, index) => {
      expect(cue.start).toBeGreaterThanOrEqual(cues[index].end);
    });
    expect(cues.at(-1)!.end).toBeLessThan(film.duration);
    // Hess's own verdict, from the Russian interpretation.
    expect(
      cues.some(({ text }) => text.includes("guilty on Counts One and Two")),
    ).toBe(true);
  });

  it("gives the captions' words as a plain-text transcript, as Cookbook 0017 does", () => {
    expect(canvasTextTranscripts(film)).toEqual([
      {
        id: "https://clover.iiif.library.northwestern.edu/mocks/rudolf-hess-nuremberg/transcript.txt",
        label: { en: ["Transcript in plain text format"] },
        language: "en",
      },
    ]);
    const text = fixture("transcript.txt");
    const paragraphs = text.trim().split("\n\n");
    expect(paragraphs).toHaveLength(17);
    // Each paragraph of a stretch in Russian or French says so.
    expect(
      paragraphs.filter((each) => each.startsWith("[In Russian]")),
    ).toHaveLength(4);
    // Its words are the captions', with only those notes added.
    const words = (value: string) =>
      value
        .replace(/\[In (Russian|French)\]/g, "")
        .split(/\s+/)
        .filter(Boolean);
    const cues = parseVtt(fixture("captions.vtt"));
    expect(words(text)).toEqual(words(cues.map((cue) => cue.text).join(" ")));
  });
});
