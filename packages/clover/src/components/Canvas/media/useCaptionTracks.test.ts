import { act, renderHook } from "@testing-library/react";

import { type CaptionOption, useCaptionTracks } from "./useCaptionTracks";
import {
  type FakeTrack,
  FakeTrackList,
  fakeTrack,
} from "../testing/textTracks";

/** A video whose text tracks are `list`. */
function videoWith(list: FakeTrackList) {
  const video = document.createElement("video");
  Object.defineProperty(video, "textTracks", {
    configurable: true,
    value: list,
  });
  return video;
}

const ENGLISH: CaptionOption = {
  label: "Captions in WebVTT format",
  labelLang: "en",
  language: "en",
};
const ITALIAN: CaptionOption = {
  label: "Sottotitoli in formato WebVTT",
  labelLang: "it",
  language: "it",
};

function setup(own: CaptionOption[], list: FakeTrackList, key = "a") {
  const element = videoWith(list);
  return {
    element,
    ...renderHook(
      ({ key }: { key: string }) => useCaptionTracks(element, own, key),
      { initialProps: { key } },
    ),
  };
}

describe("useCaptionTracks", () => {
  it("offers the tracks the media carries after the Manifest's, by their own names", () => {
    const list = new FakeTrackList([fakeTrack({ label: "English" })]);
    const { result } = setup([ENGLISH], list);
    act(() => {
      list.add({ kind: "subtitles", label: "Deutsch", language: "de" });
      // An HLS stream's timed metadata is no caption.
      list.add({ kind: "metadata", label: "id3" });
      list.add({ label: "", language: "fr" });
      list.add({ label: "" });
    });
    expect(result.current.options).toEqual([
      ENGLISH,
      { label: "Deutsch", labelLang: "de", language: "de" },
      // Named by a language code alone, the name is not tagged with it.
      { label: "fr", labelLang: undefined, language: "fr" },
      { label: "4", labelLang: undefined, language: undefined },
    ]);
    // The Manifest's first shows, as the Player shows it.
    expect(result.current.active).toBe(0);
    expect(result.current.track).toBe(list.items[0]);
  });

  it("keeps the chosen track hidden for Clover to draw, and the media's others off", () => {
    const list = new FakeTrackList([fakeTrack(), fakeTrack()]);
    const { result } = setup([ENGLISH, ITALIAN], list);
    let deutsch!: FakeTrack;
    act(() => {
      // Added as hls.js adds them, `hidden`; neither fires `change`.
      deutsch = list.add({ kind: "subtitles", label: "Deutsch" });
      list.add({ kind: "metadata" });
    });
    // The media's caption track is turned off; its metadata is left alone.
    expect(list.modes()).toEqual(["hidden", "hidden", "disabled", "hidden"]);

    act(() => result.current.select(2));
    expect(result.current.active).toBe(2);
    expect(result.current.track).toBe(deutsch);
    expect(list.modes()).toEqual(["hidden", "hidden", "hidden", "hidden"]);

    // iOS Safari shows a track by the reader's caption settings: it goes back.
    act(() => {
      list.items[1].mode = "showing";
      list.change();
    });
    expect(list.modes()).toEqual(["hidden", "hidden", "hidden", "hidden"]);
    expect(result.current.track).toBe(deutsch);

    act(() => result.current.select(-1));
    expect(result.current.track).toBeUndefined();
    expect(list.modes()).toEqual(["hidden", "hidden", "disabled", "hidden"]);
  });

  it("shows a track the browser or the stream shows, where the Manifest has none, until the reader chooses", () => {
    const list = new FakeTrackList();
    const { result } = setup([], list);
    expect(result.current.active).toBe(-1);
    let english!: FakeTrack;
    act(() => {
      english = list.add({ label: "English", language: "en" });
    });
    expect(result.current.active).toBe(-1);
    expect(english.mode).toBe("disabled");

    // The stream's default, or the reader's settings, turn it on.
    act(() => {
      english.mode = "showing";
      list.change();
    });
    expect(result.current.active).toBe(0);
    expect(result.current.track).toBe(english);
    // Drawn by Clover, not the browser.
    expect(english.mode).toBe("hidden");

    // Once the reader turns it off, it stays off.
    act(() => result.current.select(-1));
    act(() => {
      english.mode = "showing";
      list.change();
    });
    expect(result.current.active).toBe(-1);
    expect(english.mode).toBe("disabled");
  });

  it("hands the chosen track to the system player, and takes the reader's choice from its menu", () => {
    const list = new FakeTrackList([fakeTrack(), fakeTrack()]);
    const { result, element } = setup([ENGLISH, ITALIAN], list);
    expect(list.modes()).toEqual(["hidden", "hidden"]);

    // An iPhone's full screen draws only a track that is showing.
    act(() => {
      element.dispatchEvent(new Event("webkitbeginfullscreen"));
    });
    expect(list.modes()).toEqual(["showing", "hidden"]);

    // The reader picks Italian in the system player's own menu.
    act(() => {
      list.items[0].mode = "disabled";
      list.items[1].mode = "showing";
      list.change();
    });
    expect(result.current.active).toBe(1);
    expect(list.modes()).toEqual(["hidden", "showing"]);

    // Back on the page, Clover draws it again.
    act(() => {
      element.dispatchEvent(new Event("webkitendfullscreen"));
    });
    expect(result.current.active).toBe(1);
    expect(list.modes()).toEqual(["hidden", "hidden"]);
  });

  it("takes Off from the system player's menu too, and shows the track in picture in picture", () => {
    const list = new FakeTrackList([fakeTrack()]);
    const { result, element } = setup([ENGLISH], list);
    act(() => {
      element.dispatchEvent(new Event("enterpictureinpicture"));
    });
    expect(list.modes()).toEqual(["showing"]);
    act(() => {
      list.items[0].mode = "disabled";
      list.change();
    });
    expect(result.current.active).toBe(-1);

    act(() => result.current.select(0));
    expect(list.modes()).toEqual(["showing"]);
    act(() => {
      element.dispatchEvent(new Event("leavepictureinpicture"));
    });
    expect(list.modes()).toEqual(["hidden"]);
  });

  it("starts another recording from its first track", () => {
    const list = new FakeTrackList([fakeTrack(), fakeTrack()]);
    const { result, rerender } = setup([ENGLISH, ITALIAN], list);
    act(() => result.current.select(1));
    expect(result.current.active).toBe(1);
    rerender({ key: "b" });
    expect(result.current.active).toBe(0);
  });
});
