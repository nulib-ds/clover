import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React, { useState } from "react";

import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import rtlJson from "../../fixtures/iiif-cookbook/0010-book-2-viewing-direction-rtl.json";
import { initCloverI18n } from "../../i18n";
import { useClover } from "../../react/context";
import { stubViewport } from "../Canvas/testing/viewport";
import * as Clover from "../../index";

const canvasIds = bookJson.items.map((canvas) => canvas.id);

/** A renderer stand-in that, unlike the real one, needs no WebGL: several listeners per event. */
const listeners = new Map<string, Set<(detail?: unknown) => void>>();
const emit = (event: string) =>
  act(() => listeners.get(event)?.forEach((listener) => listener()));
let renderer: Record<string, any>;

vi.mock("../../lib/renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/renderer")>()),
  CanvasRenderer: vi.fn().mockImplementation(() => renderer),
}));

let viewport: ReturnType<typeof stubViewport>;
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  viewport = stubViewport();
  listeners.clear();
  renderer = {
    host: document.createElement("div"),
    setImages: vi.fn().mockResolvedValue(undefined),
    setGestures: vi.fn(),
    setDismiss: vi.fn(),
    dispose: vi.fn(),
    isOpen: false,
    backendKind: "webgl2",
    getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    fitBounds: vi.fn(),
    zoomBy: vi.fn(),
    rotateBy: vi.fn(),
    home: vi.fn(),
    invalidate: vi.fn(),
    attachNavigator: vi.fn(() => vi.fn()),
    itemRectToWorld: vi.fn(),
    overlays: { container: document.createElement("div"), add: vi.fn() },
    on: (event: string, listener: (detail?: unknown) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
      return () => listeners.get(event)?.delete(listener);
    },
  };
});
afterEach(() => viewport.restore());

const shownCanvases = () =>
  (renderer.setImages.mock.calls.at(-1)?.[0] as Array<{ id: string }>).map(
    (image) => image.id.split("|")[0],
  );

describe("Clover.Root and its parts", () => {
  it("loads content and shares it: label, Body and pager", async () => {
    render(
      <Clover.Root iiifContent={bookJson}>
        <Clover.Label as="h1" />
        <Clover.Body />
        <Clover.Items layout="pager" />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("heading", { name: "Simple Manifest - Book" }),
    ).toHaveAttribute("lang", "en");
    expect(screen.getByText(/Item 1 of/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await waitFor(() => expect(renderer.setImages).toHaveBeenCalled());
    expect(shownCanvases()).toEqual([canvasIds[0]]);
  });

  it("keeps focus on Next at the last view, where a press does nothing", async () => {
    const onClick = vi.fn();
    render(
      <Clover.Root iiifContent={bookJson}>
        <Clover.Position />
        <Clover.Previous />
        <Clover.Next onClick={onClick} />
      </Clover.Root>,
    );
    const previous = await screen.findByRole("button", { name: "Previous" });
    const next = screen.getByRole("button", { name: "Next" });
    // Nowhere to go back to: said so, and out of the tab order, as a disabled button is.
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(previous).toHaveAttribute("tabindex", "-1");
    expect(next).not.toHaveAttribute("aria-disabled");
    expect(next).not.toHaveAttribute("tabindex");

    next.focus();
    const position = document.querySelector(".clover-pager-position");
    fireEvent.click(next);
    fireEvent.click(next);
    expect(position).toHaveTextContent("Item 3 of 3");
    // Not `disabled`, which would drop focus to the page (WCAG 2.4.3).
    expect(next).toBeEnabled();
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(next).toHaveFocus();
    expect(onClick).toHaveBeenCalledTimes(2);

    fireEvent.click(next);
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(position).toHaveTextContent("Item 3 of 3");
    expect(next).toHaveFocus();
    expect(previous).not.toHaveAttribute("aria-disabled");
    expect(previous).not.toHaveAttribute("tabindex");
  });

  it("lets a host disable Previous or Next itself", async () => {
    render(
      <Clover.Root iiifContent={bookJson}>
        <Clover.Next disabled />
      </Clover.Root>,
    );
    const next = await screen.findByRole("button", { name: "Next" });
    expect(next).toBeDisabled();
    expect(next).not.toHaveAttribute("aria-disabled");
  });

  it("steps by view, a spread at a time, and announces where it went", async () => {
    render(
      <Clover.Root iiifContent={bookJson}>
        <Clover.Body />
        <Clover.Items layout="pager" />
      </Clover.Root>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    // "2 / 3" on screen; the sentence, in the reader's language, for assistive technology.
    const position = document.querySelector<HTMLElement>(
      ".clover-pager-position",
    )!;
    expect(position.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      /^2 \/ \d+$/,
    );
    expect(within(position).getByText(/^Item 2 of \d+$/)).not.toHaveAttribute(
      "aria-hidden",
    );
    await waitFor(() =>
      expect(shownCanvases()).toEqual([canvasIds[1], canvasIds[2]]),
    );
    // The Root's announcer, among the page's status regions (each Body has its own).
    const status = screen
      .getAllByRole("status")
      .find((region) => region.classList.contains("clover-announcer"))!;
    expect(status).toHaveTextContent(/^Frontispiece, Item 2 of \d+$/);
    // The label in its own language, the position in the reader's.
    expect(within(status).getByText("Frontispiece")).toHaveAttribute(
      "lang",
      "en",
    );
    expect(status).toHaveAttribute("aria-atomic", "true");
  });

  it("points the arrows the way a right-to-left book reads", async () => {
    render(
      <Clover.Root iiifContent={rtlJson}>
        <Clover.Items layout="pager" />
      </Clover.Root>,
    );
    const next = await screen.findByRole("button", { name: "Next" });
    expect(next).toHaveAttribute("data-direction", "right-to-left");
    expect(next.querySelector("path")).toHaveAttribute(
      "transform",
      "rotate(180 8 8)",
    );
    // Next sits on the left, where the book continues.
    expect(screen.getByRole("navigation").firstElementChild).toBe(next);
  });

  it("follows a controlled canvasId, asking onCanvasChange to move", async () => {
    const onCanvasChange = vi.fn();
    function Host() {
      const [canvasId, setCanvasId] = useState(canvasIds[1]);
      return (
        <Clover.Root
          iiifContent={bookJson}
          canvasId={canvasId}
          onCanvasChange={(id) => {
            onCanvasChange(id);
            setCanvasId(id);
          }}
        >
          <Clover.Label of="canvas" data-testid="canvas-label" />
          <Clover.Items layout="pager" />
        </Clover.Root>
      );
    }
    render(<Host />);
    expect(await screen.findByTestId("canvas-label")).toHaveTextContent(
      bookJson.items[1].label.en[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onCanvasChange).toHaveBeenLastCalledWith(canvasIds[3]);
    expect(screen.getByTestId("canvas-label")).toHaveTextContent(
      bookJson.items[3].label.en[0],
    );
  });

  it("frames a deep link's region once the Canvas is laid out, past its placeholder", async () => {
    const encoded = btoa(
      encodeURIComponent(
        JSON.stringify({
          type: "Annotation",
          motivation: ["contentState"],
          target: {
            type: "SpecificResource",
            source: { id: canvasIds[0], type: "Canvas" },
            selector: { type: "FragmentSelector", value: "xywh=10,20,30,40" },
          },
        }),
      ),
    );
    // A content state naming a Canvas with no `partOf` loads that Canvas.
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            "@context": "http://iiif.io/api/presentation/3/context.json",
            ...bookJson.items[0],
          }),
        ),
    );
    render(
      <Clover.Root iiifContent={encoded} request={{ fetch }}>
        <Clover.Body />
      </Clover.Root>,
    );
    await waitFor(() => expect(renderer.setImages).toHaveBeenCalled());
    expect(renderer.fitBounds).not.toHaveBeenCalled();
    emit("open");
    expect(renderer.fitBounds).toHaveBeenCalledTimes(1);
    const [world] = renderer.fitBounds.mock.calls[0];
    expect(world).toEqual({ x: 10, y: 20, width: 30, height: 40 });
    // Consumed: a later layout does not frame it again.
    emit("change");
    expect(renderer.fitBounds).toHaveBeenCalledTimes(1);
  });

  it("sends viewport updates through a channel, writing nothing to the store", async () => {
    let clover: ReturnType<typeof useClover>["clover"] | null = null;
    function Spy() {
      clover = useClover().clover;
      return null;
    }
    render(
      <Clover.Root iiifContent={bookJson}>
        <Spy />
        <Clover.Body />
      </Clover.Root>,
    );
    await waitFor(() => expect(renderer.setImages).toHaveBeenCalled());
    emit("open");
    const writes = vi.fn();
    const heard = vi.fn();
    clover!.store.subscribe(writes);
    clover!.viewport.subscribe(heard);
    for (let frame = 0; frame < 60; frame++) emit("viewport");
    expect(heard).toHaveBeenCalledTimes(60);
    expect(heard.mock.lastCall?.[0]).toMatchObject({ canvasId: canvasIds[0] });
    expect(writes).not.toHaveBeenCalled();
  });

  it("shows loading and error states", async () => {
    const fetch = vi.fn(async () => new Response("nope", { status: 500 }));
    render(
      <Clover.Root iiifContent="https://example.org/broken" request={{ fetch }}>
        <Clover.Status />
      </Clover.Root>,
    );
    // Announced in words; seen as Clover's mark, which assistive technology skips.
    const status = screen.getByText("Loading…").closest('[role="status"]');
    expect(status).toHaveClass("clover-status");
    expect(status?.querySelector(".clover-loading")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This could not be loaded.",
    );
  });

  it("opens a Collection at defaultManifestId, and lets the reader move on from it", async () => {
    const BOOK = bookJson.id;
    const LETTER = "https://example.org/letter";
    const letter = {
      ...bookJson,
      id: LETTER,
      label: { en: ["A letter"] },
      items: [bookJson.items[0]],
    };
    const shelf = {
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/shelf",
      type: "Collection",
      label: { en: ["Shelf"] },
      items: [
        { id: BOOK, type: "Manifest", label: { en: ["The book"] } },
        { id: LETTER, type: "Manifest", label: { en: ["A letter"] } },
      ],
    };
    const fetch = vi.fn(
      async (url: string) =>
        new Response(JSON.stringify(url === LETTER ? letter : bookJson), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const moved = vi.fn();
    let clover: ReturnType<typeof useClover>["clover"] | undefined;
    function Probe() {
      clover = useClover().clover;
      return null;
    }
    render(
      <Clover.Root
        iiifContent={shelf}
        defaultManifestId={LETTER}
        onManifestChange={moved}
        request={{ fetch }}
      >
        <Probe />
        <Clover.Label as="h1" />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("heading", { name: "A letter" }),
    ).toBeInTheDocument();
    // Not held there, as `manifestId` would hold it: the reader's choice is made.
    act(() => void clover!.goToManifest(BOOK));
    expect(
      await screen.findByRole("heading", { name: "Simple Manifest - Book" }),
    ).toBeInTheDocument();
    expect(moved).toHaveBeenCalledWith(BOOK);
  });

  it("keeps one status region, so each load is announced as a change to it (WCAG 4.1.3)", async () => {
    const BOOK = bookJson.id;
    const LETTER = "https://example.org/letter";
    const letter = {
      ...bookJson,
      id: LETTER,
      label: { en: ["A letter"] },
      items: [bookJson.items[0]],
    };
    const shelf = {
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/shelf",
      type: "Collection",
      label: { en: ["Shelf"] },
      items: [
        { id: BOOK, type: "Manifest", label: { en: ["The book"] } },
        { id: LETTER, type: "Manifest", label: { en: ["A letter"] } },
      ],
    };
    const fetch = vi.fn(
      async (url: string) =>
        new Response(JSON.stringify(url === LETTER ? letter : bookJson), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    let clover: ReturnType<typeof useClover>["clover"] | undefined;
    function Probe() {
      clover = useClover().clover;
      return null;
    }
    render(
      <Clover.Root iiifContent={shelf} request={{ fetch }}>
        <Probe />
        <Clover.Label as="h1" />
        <Clover.Status />
      </Clover.Root>,
    );
    const region = document.querySelector('.clover-status[role="status"]');
    expect(region).not.toBeNull();
    await screen.findByRole("heading", { name: "Simple Manifest - Book" });
    // Ready: the same region, empty and out of sight, waiting for the next message.
    expect(region).toBeInTheDocument();
    expect(region).toBeEmptyDOMElement();
    expect(region).toHaveStyle({ position: "absolute" });
    expect(region).not.toHaveAttribute("data-status");

    act(() => void clover!.goToManifest(LETTER));
    expect(region).toHaveTextContent("Loading…");
    expect(region).toHaveAttribute("data-status", "loading");
    expect(region).not.toHaveStyle({ position: "absolute" });
    await screen.findByRole("heading", { name: "A letter" });
    expect(region).toBeInTheDocument();
    expect(region).toBeEmptyDOMElement();
  });

  it("keeps its status region, empty, beside the alert on failure", async () => {
    const fetch = vi.fn(async () => new Response("nope", { status: 500 }));
    render(
      <Clover.Root iiifContent="https://example.org/broken" request={{ fetch }}>
        <Clover.Status />
      </Clover.Root>,
    );
    const region = document.querySelector('.clover-status[role="status"]');
    await screen.findByRole("alert");
    expect(region).toBeInTheDocument();
    expect(region).toBeEmptyDOMElement();
  });

  it("only announces loading, with loading={false}, where the Body shows it", async () => {
    render(
      <Clover.Root iiifContent={bookJson}>
        <Clover.Status loading={false} />
        <Clover.Body />
      </Clover.Root>,
    );
    const status = screen.getByText("Loading…").closest('[role="status"]');
    expect(status).toHaveStyle({ position: "absolute" });
    expect(status?.querySelector(".clover-loading")).toBeNull();
    // The Body is busy, with the mark in its middle, until the Manifest is in.
    const bodyElement = document.querySelector(".clover-body")!;
    expect(bodyElement).toHaveAttribute("aria-busy", "true");
    expect(
      bodyElement.querySelector(":scope > .clover-loading"),
    ).not.toBeNull();
    await screen.findByTestId("clover-canvas");
    expect(bodyElement).toHaveAttribute("aria-busy", "false");
    expect(bodyElement.querySelector(":scope > .clover-loading")).toBeNull();
  });

  it("assembles the ready-made Viewer from the same parts", async () => {
    render(<Clover.Viewer iiifContent={bookJson} />);
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Items" })).toBeInTheDocument();
  });

  it("names the part used outside a Root", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Clover.Previous />)).toThrow(/<Clover.Root>/);
  });
});
