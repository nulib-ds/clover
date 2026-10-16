import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

import languagesJson from "../../fixtures/iiif-cookbook/0074-multiple-language-captions.json";
import captionsJson from "../../fixtures/iiif-cookbook/0219-using-caption-file.json";
import { clearVttCache } from "../../core/vtt";
import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";
import { useClover } from "../../react/context";

const VTT = `WEBVTT

00:00:01.000 --> 00:00:03.000
Good manners

00:00:04.000 --> 00:00:06.000
<v Narrator>at lunch
`;

let fetch: ReturnType<typeof vi.fn>;
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  clearVttCache();
  fetch = vi.fn(async () => new Response(VTT));
});

/** Hands the test the Root's Clover, to stand in a media element as the Canvas would. */
let clover: ReturnType<typeof useClover>["clover"];
function Spy() {
  clover = useClover().clover;
  return null;
}

async function renderTranscript() {
  render(
    <Clover.Root iiifContent={captionsJson} request={{ fetch }}>
      <Spy />
      <Clover.Transcript />
    </Clover.Root>,
  );
  return screen.findAllByRole("button", { name: /Good manners|at lunch/ });
}

describe("Transcript", () => {
  it("lists the view's caption cues, with their times and speakers", async () => {
    const cues = await renderTranscript();
    expect(cues).toHaveLength(2);
    expect(cues[1]).toHaveTextContent("0:04Narrator: at lunch");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("marks the cue playing, re-rendering only as it changes, writing nothing", async () => {
    await renderTranscript();
    const video = document.createElement("video");
    act(() => clover.media.emit(video));
    const writes = vi.fn();
    clover.store.subscribe(writes);

    const at = (time: number) =>
      act(() => {
        Object.defineProperty(video, "currentTime", {
          configurable: true,
          value: time,
        });
        video.dispatchEvent(new Event("timeupdate"));
      });
    at(1.5);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("aria-current", "true");
    at(4.5);
    expect(items[1]).toHaveAttribute("aria-current", "true");
    expect(items[0]).not.toHaveAttribute("aria-current");
    at(3.5);
    expect(items.some((item) => item.hasAttribute("aria-current"))).toBe(false);
    expect(writes).not.toHaveBeenCalled();
  });

  it("seeks the media to a cue when pressed", async () => {
    const cues = await renderTranscript();
    const video = document.createElement("video");
    act(() => clover.media.emit(video));
    fireEvent.click(cues[1]);
    expect(video.currentTime).toBe(4);
  });

  it("goes to the cue's time when nothing is playing yet", async () => {
    const cues = await renderTranscript();
    fireEvent.click(cues[1]);
    expect(clover.store.get().target).toMatchObject({
      canvasId: captionsJson.items[0].id,
      time: 4,
    });
  });

  it("marks each caption file in the menu with the language of its label", async () => {
    render(
      <Clover.Root iiifContent={languagesJson} request={{ fetch }}>
        <Clover.Transcript />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("option", { name: "Captions in WebVTT format" }),
    ).toHaveAttribute("lang", "en");
    expect(
      screen.getByRole("option", { name: "Sottotitoli in formato WebVTT" }),
    ).toHaveAttribute("lang", "it");
  });

  it("joins the information panel when the view has captions", async () => {
    render(
      <Clover.Root iiifContent={captionsJson} request={{ fetch }}>
        <Clover.InformationPanel />
      </Clover.Root>,
    );
    fireEvent.click(await screen.findByRole("tab", { name: "Transcript" }));
    await waitFor(() =>
      expect(
        screen.getByRole("tabpanel", { name: "Transcript" }),
      ).toHaveTextContent("Good manners"),
    );
  });
});
