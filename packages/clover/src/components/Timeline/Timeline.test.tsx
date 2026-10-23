import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

import audioJson from "../../fixtures/iiif-cookbook/0002-mvm-audio.json";
import audioV4Json from "../../fixtures/iiif-cookbook/0002-mvm-audio-v4.json";
import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import { p4 } from "../../fixtures/presentation4";
import { stubViewport } from "../Canvas/testing/viewport";
import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";

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

  it("names a sound with no picture in its Body, for the eye alone", async () => {
    const timeline = audioV4Json.items[0];
    render(
      <Clover.Timeline timeline={timeline as never} label="A recording" />,
    );
    const name = screen.getByText("A recording", {
      selector: ".clover-canvas-sound-label",
    });
    expect(name).toHaveAttribute("aria-hidden", "true");
    // The view is named by the same words, for assistive technology.
    expect(
      screen.getByRole("img", { name: "A recording" }),
    ).toBeInTheDocument();
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
