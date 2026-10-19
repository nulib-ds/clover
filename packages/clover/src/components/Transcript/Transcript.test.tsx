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
import renderingJson from "../../fixtures/iiif-cookbook/0017-transcription-av.json";
import bothJson from "../../fixtures/mocks/transcripts/manifest.json";
import pagesJson from "../../fixtures/mocks/page-transcript/manifest.json";
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

  it("offers its caption files by their language codes, each named by its label in that label's language", async () => {
    render(
      <Clover.Root iiifContent={languagesJson} request={{ fetch }}>
        <Clover.Transcript />
      </Clover.Root>,
    );
    const english = await screen.findByRole("radio", {
      name: "EN Captions in WebVTT format",
    });
    const italian = screen.getByRole("radio", {
      name: "IT Sottotitoli in formato WebVTT",
    });
    expect(english).toBeChecked();
    expect(screen.getByRole("group", { name: "Captions" })).toContainElement(
      italian,
    );
    // The label, hidden behind its code, carries its language; its popover shows it.
    const label = italian.parentElement!;
    expect(label.querySelector('span[lang="it"]')).toHaveTextContent(
      "Sottotitoli in formato WebVTT",
    );
    expect(label.querySelector(".clover-tip")).toHaveTextContent(
      "Sottotitoli in formato WebVTT",
    );
    // Not in an accordion: the row is the transcript's own, over its cues.
    expect(
      italian.closest(".clover-transcript")?.querySelector("ol"),
    ).toBeInTheDocument();
    fireEvent.click(italian);
    await waitFor(() =>
      expect(document.querySelector(".clover-transcript-cues")).toHaveAttribute(
        "lang",
        "it",
      ),
    );
  });

  it("sits beside its heading in the information panel's accordion", async () => {
    render(
      <Clover.Root iiifContent={languagesJson} request={{ fetch }}>
        <Clover.InformationPanel layout="accordion" />
      </Clover.Root>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Transcript" }));
    const languages = await screen.findByRole("group", { name: "Captions" });
    const heading = screen
      .getByRole("button", { name: "Transcript" })
      .closest(".clover-sections-heading")!;
    // Right after the heading, before its region: read, and reached, in that order.
    expect(languages.parentElement).toHaveClass("clover-sections-actions");
    expect(heading.nextElementSibling).toBe(languages.parentElement);
    expect(
      screen.getByRole("region", { name: "Transcript" }),
    ).not.toContainElement(languages);
  });

  it("follows the caption file chosen in the Canvas's menu, and leads it; Off leaves it as it is", async () => {
    render(
      <Clover.Root iiifContent={languagesJson} request={{ fetch }}>
        <Spy />
        <Clover.Transcript />
      </Clover.Root>,
    );
    const italian = await screen.findByRole("radio", { name: /^IT / });
    const [, it] = (languagesJson as any).items[0].annotations[0].items[0].body
      .items;
    act(() => clover.captions.emit(it.id));
    expect(italian).toBeChecked();
    act(() => clover.captions.emit(null));
    expect(italian).toBeChecked();

    // Chosen here, it is the Root's choice too, for the Canvas to show.
    const [en] = (languagesJson as any).items[0].annotations[0].items[0].body
      .items;
    fireEvent.click(screen.getByRole("radio", { name: /^EN / }));
    expect(clover.captions.get()).toBe(en.id);
  });

  it("shows a transcript as plain text in its paragraphs, read as the file is encoded (Cookbook 0017)", async () => {
    // The published file: CRLF line endings, a blank line, and Windows-1252's apostrophe.
    const bytes = new Uint8Array([
      ...new TextEncoder().encode(
        "[DISCLAIMER: machine-generated transcript]\r\n\r\nThe ball falls within the opponent",
      ),
      0x92,
      ...new TextEncoder().encode("s court."),
    ]);
    const text = vi.fn(async () => new Response(bytes));
    render(
      <Clover.Root iiifContent={renderingJson} request={{ fetch: text }}>
        <Clover.Transcript />
      </Clover.Root>,
    );
    await waitFor(() =>
      expect(
        document.querySelectorAll(".clover-transcript-body > p"),
      ).toHaveLength(2),
    );
    const [disclaimer, words] = document.querySelectorAll(
      ".clover-transcript-body > p",
    );
    expect(disclaimer).toHaveTextContent(
      "[DISCLAIMER: machine-generated transcript]",
    );
    expect(words).toHaveTextContent(
      "The ball falls within the opponent’s court.",
    );
    // Untimed: nothing to press, and no choice where there is one file.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("offers a plain-text transcript after the captions, as TXT; choosing it leaves the captions as they are", async () => {
    // The docs' `transcripts` mock: English captions, and the film's transcript.
    const files = vi.fn(
      async (url: string) =>
        new Response(
          String(url).endsWith(".txt")
            ? "Just before lunch.\n\nIt was fun."
            : VTT,
        ),
    );
    render(
      <Clover.Root iiifContent={bothJson} request={{ fetch: files }}>
        <Spy />
        <Clover.Transcript />
      </Clover.Root>,
    );
    const english = await screen.findByRole("radio", {
      name: "EN Captions in WebVTT format",
    });
    const text = screen.getByRole("radio", {
      name: "TXT Transcript in plain text format",
    });
    // The row picks among transcripts of both kinds, so it is named for them.
    expect(screen.getByRole("group", { name: "Transcript" })).toContainElement(
      text,
    );
    expect(english).toBeChecked();
    act(() => clover.captions.emit(null));
    fireEvent.click(text);
    await waitFor(() =>
      expect(
        document.querySelectorAll(".clover-transcript-body > p"),
      ).toHaveLength(2),
    );
    expect(document.querySelector(".clover-transcript-body")).toHaveAttribute(
      "lang",
      "en",
    );
    // Plain text is not a caption file: the captions' choice is untouched.
    expect(clover.captions.get()).toBeNull();
  });

  it("shows an image's transcript, the page in view's, in its language", async () => {
    // The docs' `page-transcript` mock: a newspaper's two pages, each with its OCR as text.
    const pages = vi.fn(
      async (url: string) =>
        new Response(
          String(url).endsWith("p1.txt")
            ? "I. 54. Jahrgang\n\nNr. 29"
            : "Zweite Seite",
        ),
    );
    render(
      <Clover.Root iiifContent={pagesJson} request={{ fetch: pages }}>
        <Spy />
        <Clover.Transcript />
      </Clover.Root>,
    );
    await waitFor(() =>
      expect(
        document.querySelectorAll(".clover-transcript-body > p"),
      ).toHaveLength(2),
    );
    const body = () => document.querySelector(".clover-transcript-body");
    expect(body()).toHaveAttribute("lang", "de");
    expect(body()).toHaveTextContent("I. 54. Jahrgang");
    // The next page in view: its own text.
    act(() => clover.next());
    await waitFor(() => expect(body()).toHaveTextContent("Zweite Seite"));
  });

  it("joins the information panel when the view has a plain-text transcript", async () => {
    render(
      <Clover.Root
        iiifContent={renderingJson}
        request={{ fetch: vi.fn(async () => new Response("The words.")) }}
      >
        <Clover.InformationPanel />
      </Clover.Root>,
    );
    fireEvent.click(await screen.findByRole("tab", { name: "Transcript" }));
    await waitFor(() =>
      expect(
        screen.getByRole("tabpanel", { name: "Transcript" }),
      ).toHaveTextContent("The words."),
    );
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
