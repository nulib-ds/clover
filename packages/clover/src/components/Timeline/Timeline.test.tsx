import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import audioJson from "../../fixtures/iiif-cookbook/0002-mvm-audio.json";
import audioV4Json from "../../fixtures/iiif-cookbook/0002-mvm-audio-v4.json";
import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import { p4 } from "../../fixtures/presentation4";
import { stubViewport } from "../Canvas/testing/viewport";
import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";
import { CanvasRenderer } from "../../lib/renderer";

// Canvas's renderer, for the Canvas here: a Timeline never makes one.
vi.mock("../../lib/renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/renderer")>()),
  CanvasRenderer: vi.fn().mockImplementation(() => ({
    host: document.createElement("div"),
    setImages: vi.fn().mockResolvedValue(undefined),
    setGestures: vi.fn(),
    setDismiss: vi.fn(),
    dispose: vi.fn(),
    isOpen: false,
    backendKind: "webgl2",
    getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    invalidate: vi.fn(),
    attachNavigator: vi.fn(() => vi.fn()),
    overlays: { container: document.createElement("div"), add: vi.fn() },
    on: () => () => undefined,
  })),
}));

let viewport: ReturnType<typeof stubViewport>;
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  viewport = stubViewport();
});
afterEach(() => viewport.restore());

describe("Timeline", () => {
  it("plays Cookbook 0002's Presentation 4 Timeline, whose sound is an Audio body", async () => {
    const timeline = audioV4Json.items[0];
    render(<Clover.Timeline timeline={timeline as never} />);
    const figure = screen.getByTestId("clover-canvas");
    expect(figure).toHaveClass("clover-canvas", "clover-timeline");
    expect(figure).toHaveAttribute("data-media", "audio");
    // Its transport, with Canvas's player.
    expect(
      await screen.findByRole("button", { name: "Play" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("clover-canvas-navigator")).toBeNull();
  });

  /*
   * It draws on a surface of its own, so a page that plays sound loads no image renderer
   * and holds none of the page's WebGL contexts. Its view keeps its name and keys.
   */
  it("plays without Canvas's image renderer, its view still named and focusable", async () => {
    vi.mocked(CanvasRenderer).mockClear();
    render(
      <Clover.Timeline
        timeline={audioV4Json.items[0] as never}
        label="A recording"
      />,
    );
    await screen.findByRole("button", { name: "Play" });
    expect(CanvasRenderer).not.toHaveBeenCalled();
    const view = screen.getByRole("img", { name: "A recording" });
    expect(view).toHaveAttribute("tabindex", "0");
    expect(view).toHaveAttribute("aria-keyshortcuts", "K Space J L M");
  });

  it("plays and pauses on a click on its view, and from the keyboard", async () => {
    render(<Clover.Timeline timeline={audioV4Json.items[0] as never} />);
    await screen.findByRole("button", { name: "Play" });
    const view = screen.getByTestId("clover-canvas-viewport");
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    const click = (type: string, timeStamp: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0 });
      Object.defineProperties(event, {
        pointerType: { value: "mouse" },
        isPrimary: { value: true },
        timeStamp: { value: timeStamp },
      });
      view.dispatchEvent(event);
    };
    click("pointerdown", 0);
    click("pointerup", 80);
    expect(play).toHaveBeenCalledTimes(1);
    view.focus();
    view.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", bubbles: true }),
    );
    expect(play).toHaveBeenCalledTimes(2);
    play.mockRestore();
  });

  it("still draws a Canvas with the renderer", async () => {
    vi.mocked(CanvasRenderer).mockClear();
    render(<Clover.Canvas canvases={[bookJson.items[0] as never]} />);
    await screen.findByTestId("clover-canvas");
    expect(CanvasRenderer).toHaveBeenCalledTimes(1);
  });

  it("plays as a player, its title for the eye alone", async () => {
    const timeline = audioV4Json.items[0];
    render(
      <Clover.Timeline timeline={timeline as never} label="A recording" />,
    );
    const title = await screen.findByText("A recording", {
      selector: ".clover-canvas-player-title",
    });
    expect(title).toHaveAttribute("aria-hidden", "true");
    // The view is named by the same words, for assistive technology.
    expect(
      screen.getByRole("img", { name: "A recording" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".clover-canvas-sound-label")).toBeNull();
  });

  it("shows no name over a picture", async () => {
    render(<Clover.Canvas canvases={[bookJson.items[0] as never]} />);
    await screen.findByTestId("clover-canvas");
    expect(document.querySelector(".clover-canvas-sound-label")).toBeNull();
  });

  it("loads a Manifest's first Timeline itself", async () => {
    render(<Clover.Timeline iiifContent={audioV4Json as never} />);
    expect(
      await screen.findByRole("button", { name: "Play" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("clover-canvas")).toHaveClass("clover-timeline");
  });

  /*
   * Loading its own, it plays as a Root's Timeline does: with the chapters the
   * Manifest's Ranges give it, and from the time a content state names.
   */
  const TIMELINE = audioV4Json.items[0].id;
  const chaptered = {
    ...audioV4Json,
    structures: [
      {
        id: "https://example.org/range/top",
        type: "Range",
        label: { en: ["Symphony No. 3"] },
        items: [
          {
            id: "https://example.org/range/1",
            type: "Range",
            label: { en: ["First movement"] },
            items: [{ id: `${TIMELINE}#t=0,600`, type: "Timeline" }],
          },
          {
            id: "https://example.org/range/2",
            type: "Range",
            label: { en: ["Second movement"] },
            items: [{ id: `${TIMELINE}#t=600,1985`, type: "Timeline" }],
          },
        ],
      },
    ],
  };

  it("loading its own, plays with the chapters its Manifest's Ranges give it", async () => {
    render(<Clover.Timeline iiifContent={chaptered as never} />);
    expect(
      await screen.findByRole("button", { name: "Chapters" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("First movement", {
        selector: ".clover-canvas-transport-chapter",
      }),
    ).toHaveAttribute("lang", "en");
  });

  const MANIFEST = "https://example.org/symphony.json";
  // A content state 12 minutes into the recording, its Manifest fetched by its `partOf`.
  const twelveMinutesIn = {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: "https://example.org/state/1",
    type: "Annotation",
    motivation: ["contentState"],
    target: {
      type: "SpecificResource",
      source: {
        id: TIMELINE,
        type: "Timeline",
        partOf: [{ id: MANIFEST, type: "Manifest" }],
      },
      selector: { type: "FragmentSelector", value: "t=720" },
    },
  };
  const fetchSymphony = () =>
    vi.fn(
      async () =>
        new Response(JSON.stringify({ ...chaptered, id: MANIFEST }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
  /** The media element (the last made; one may be let go first), its metadata loaded. */
  const metadataLoaded = async (onMediaElement: ReturnType<typeof vi.fn>) => {
    const latest = () =>
      onMediaElement.mock.calls.at(-1)?.[0] as HTMLMediaElement | null;
    await waitFor(() => expect(latest()).toBeTruthy());
    const element = latest()!;
    element.dispatchEvent(new Event("loadedmetadata"));
    return element;
  };

  /*
   * A recording with nothing to draw is never laid out, so its time is applied without
   * waiting for the Canvas to open, as only a region needs.
   */
  it("loading a content state, starts at the time it names", async () => {
    const fetch = fetchSymphony();
    const onMediaElement = vi.fn();
    render(
      <Clover.Timeline
        iiifContent={twelveMinutesIn as never}
        options={{ request: { fetch } }}
        onMediaElement={onMediaElement}
      />,
    );
    expect((await metadataLoaded(onMediaElement)).currentTime).toBe(720);
    expect(fetch).toHaveBeenCalledWith(MANIFEST, expect.anything());
  });

  it("in a Root, starts at the time a content state names", async () => {
    const onMediaElement = vi.fn();
    render(
      <Clover.Root
        iiifContent={twelveMinutesIn as never}
        request={{ fetch: fetchSymphony() }}
      >
        <Clover.Timeline onMediaElement={onMediaElement} />
      </Clover.Root>,
    );
    expect((await metadataLoaded(onMediaElement)).currentTime).toBe(720);
  });

  it("plays a track pressed in the player's list from its start, its time a cue's", async () => {
    const onMediaElement = vi.fn();
    render(
      <Clover.Timeline
        iiifContent={chaptered as never}
        onMediaElement={onMediaElement}
      />,
    );
    const track = await screen.findByRole("button", {
      name: /Second movement/,
    });
    const element = await metadataLoaded(onMediaElement);
    const play = vi.spyOn(element, "play").mockResolvedValue(undefined);
    fireEvent.click(track);
    expect(element.currentTime).toBe(600);
    expect(play).toHaveBeenCalled();
    expect(track.querySelector(".clover-cue-time")).toHaveTextContent("10:00");
  });

  it("says so when the content has no Timeline", async () => {
    render(<Clover.Timeline iiifContent={bookJson as never} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "It has no Timeline to show.",
    );
  });

  it("plays a Root's Timeline view, and nothing for a Canvas", async () => {
    const { unmount } = render(
      <Clover.Root iiifContent={audioV4Json as never}>
        <Clover.Timeline />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("button", { name: "Play" }),
    ).toBeInTheDocument();
    unmount();

    render(
      <Clover.Root iiifContent={bookJson as never}>
        <Clover.Timeline />
        <Clover.Label />
      </Clover.Root>,
    );
    await screen.findByText("Simple Manifest - Book");
    expect(screen.queryByTestId("clover-canvas")).toBeNull();
  });
});

describe("Body, for a Timeline", () => {
  it("draws a Timeline view with Timeline: a Presentation 3 Canvas of sound upgrades to one", async () => {
    expect(p4(audioJson).items[0].type).toBe("Timeline");
    render(
      <Clover.Root iiifContent={audioJson as never}>
        <Clover.Body />
      </Clover.Root>,
    );
    await waitFor(() =>
      expect(document.querySelector(".clover-body")).toHaveAttribute(
        "data-renderer",
        "timeline",
      ),
    );
    expect(
      await screen.findByRole("button", { name: "Play" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("clover-canvas")).toHaveClass("clover-timeline");
  });

  it("keeps drawing a Canvas view with Canvas", async () => {
    render(
      <Clover.Root iiifContent={bookJson as never}>
        <Clover.Body />
      </Clover.Root>,
    );
    await screen.findByTestId("clover-canvas");
    expect(document.querySelector(".clover-body")).toHaveAttribute(
      "data-renderer",
      "canvas",
    );
    expect(screen.getByTestId("clover-canvas")).not.toHaveClass(
      "clover-timeline",
    );
  });
});
