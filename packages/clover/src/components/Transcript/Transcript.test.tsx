import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

/*
 * Cookbook 0074 with its label in one language: with the label in two, the Root offers
 * the languages, and the Transcript follows it with no row of its own.
 */
const oneLanguage = {
  ...languagesJson,
  label: { en: (languagesJson as any).label.en },
};

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
      <Clover.Root iiifContent={oneLanguage} request={{ fetch }}>
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
      <Clover.Root iiifContent={oneLanguage} request={{ fetch }}>
        <Clover.Panel layout="accordion" />
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
      <Clover.Root iiifContent={oneLanguage} request={{ fetch }}>
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

  // Mat, 2026-10-28: "there should be one language toggle. always let root win".
  it("offers no languages of its own where the Root offers them, and reads in the Root's", async () => {
    const files = (languagesJson as any).items[0].annotations[0].items[0].body
      .items;
    render(
      <Clover.Root
        iiifContent={languagesJson}
        language="it"
        request={{ fetch }}
      >
        <Spy />
        <Clover.Transcript />
      </Clover.Root>,
    );
    // The Italian file, the Canvas's captions too.
    await waitFor(() => expect(clover.captions.get()).toBe(files[1].id));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(files[1].id, expect.anything()),
    );
    expect(screen.queryByRole("radio", { name: /^IT / })).toBeNull();
    expect(screen.queryByRole("radio", { name: /^EN / })).toBeNull();
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

  it("reads a WebVTT file that provides a transcript alone, never as the captions (Presentation 4)", async () => {
    // Cookbook 0219, its file a transcript: what is said, without the sounds captions give.
    const provided = (provides: string[]) => {
      const manifest = structuredClone(captionsJson) as any;
      manifest.items[0].annotations[0].items[0].provides = provides;
      return manifest;
    };
    const { unmount } = render(
      <Clover.Root
        iiifContent={provided(["transcript"])}
        language="en"
        request={{ fetch }}
      >
        <Spy />
        <Clover.Transcript />
      </Clover.Root>,
    );
    expect(
      await screen.findAllByRole("button", { name: /Good manners|at lunch/ }),
    ).toHaveLength(2);
    // Not a caption track: the Root's language does not choose it for the captions.
    expect(clover.captions.get()).toBeNull();
    unmount();

    render(
      <Clover.Root
        iiifContent={provided(["closedCaptions"])}
        language="en"
        request={{ fetch }}
      >
        <Spy />
        <Clover.Transcript />
      </Clover.Root>,
    );
    await screen.findAllByRole("button", { name: /Good manners|at lunch/ });
    await waitFor(() =>
      expect(clover.captions.get()).toBe(
        captionsJson.items[0].annotations[0].items[0].body.id,
      ),
    );
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
        <Clover.Panel />
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
        <Clover.Panel />
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

describe("Finding in a transcript", () => {
  // Three cues with "lunch", one without, and enough after them to draw in chunks.
  const LONG = `WEBVTT

${Array.from({ length: 100 }, (_, n) => {
  const start = String(n).padStart(2, "0");
  const words =
    n === 1 || n === 50 || n === 90 ? `Lunch ${n}, at lunch` : `Line ${n}`;
  return `00:${start}:00.000 --> 00:${start}:30.000\n${words}`;
}).join("\n\n")}
`;

  beforeEach(() => {
    fetch = vi.fn(async () => new Response(LONG));
  });

  async function renderFind() {
    render(
      <Clover.Root iiifContent={captionsJson} request={{ fetch }}>
        <Spy />
        <Clover.Transcript />
      </Clover.Root>,
    );
    await screen.findByRole("button", { name: /Line 0/ });
    return screen.getByRole("searchbox", { name: "Search" });
  }

  it("marks the cues with the words, the first current, and nothing moves", async () => {
    const field = await renderFind();
    const video = document.createElement("video");
    act(() => clover.media.emit(video));
    fireEvent.change(field, { target: { value: "LUNCH" } });
    await screen.findByText("Result 1 of 3");
    expect(screen.getByText("3 results")).toBeInTheDocument();
    // Each place the words are, marked; case aside.
    expect(
      screen
        .getByRole("button", { name: /Lunch 1, at lunch/ })
        .querySelectorAll("mark"),
    ).toHaveLength(2);
    expect(video.currentTime).toBe(0);
  });

  it("steps through the matches, seeking each, and Enter goes too", async () => {
    const field = await renderFind();
    const video = document.createElement("video");
    act(() => clover.media.emit(video));
    fireEvent.change(field, { target: { value: "lunch" } });
    await screen.findByText("Result 1 of 3");

    // Enter goes to the match current, then on.
    fireEvent.submit(field);
    expect(video.currentTime).toBe(60);
    fireEvent.submit(field);
    await screen.findByText("Result 2 of 3");
    expect(video.currentTime).toBe(50 * 60);

    // The third is past the first chunk, and drawn to be gone to.
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Result 3 of 3");
    expect(video.currentTime).toBe(90 * 60);
    expect(
      screen.getByRole("button", { name: /Lunch 90, at lunch/ }),
    ).toBeInTheDocument();
  });

  it("clears, focus back in the field, and says when nothing is found", async () => {
    const field = await renderFind();
    fireEvent.change(field, { target: { value: "zzzz" } });
    // Said in the status, and shown in the pill.
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("status")
          .some((status) => status.textContent === "No results"),
      ).toBe(true),
    );
    expect(
      within(screen.getByRole("search")).getByText("No results"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(field).toHaveValue("");
    expect(document.activeElement).toBe(field);
  });
});

describe("A long transcript", () => {
  const observers: Array<(entries: { isIntersecting: boolean }[]) => void> = [];
  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(
          callback: (entries: { isIntersecting: boolean }[]) => void,
        ) {
          observers.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    fetch = vi.fn(
      async () =>
        new Response(
          `WEBVTT\n\n${Array.from(
            { length: 100 },
            (_, n) =>
              `00:${String(n).padStart(2, "0")}:00.000 --> 00:${String(n).padStart(2, "0")}:30.000\nLine ${n}`,
          ).join("\n\n")}\n`,
        ),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("draws its cues a chunk at a time, more as the end nears or focus reaches it", async () => {
    render(
      <Clover.Root iiifContent={captionsJson} request={{ fetch }}>
        <Clover.Transcript />
      </Clover.Root>,
    );
    await screen.findByRole("button", { name: /Line 0/ });
    const drawn = () =>
      document.querySelectorAll(".clover-transcript-cue").length;
    expect(drawn()).toBe(40);
    // The cues can render before the effect starts observing their end.
    await waitFor(() => expect(observers).not.toHaveLength(0));
    act(() => observers.at(-1)!([{ isIntersecting: true }]));
    await waitFor(() => expect(drawn()).toBe(80));
    fireEvent.focus(screen.getByRole("button", { name: /Line 77/ }));
    await waitFor(() => expect(drawn()).toBe(100));
  });
});
