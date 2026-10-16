import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";

import imageJson from "../../fixtures/iiif-cookbook/0377-image-in-annotation.json";
import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";
import { stubViewport } from "../Canvas/testing/viewport";
import { resolveContentState } from "../../core/content-state";

/** A renderer stand-in: several listeners per event, and the overlay layer hotspots use. */
const listeners = new Map<string, Set<(detail?: unknown) => void>>();
const emit = (event: string) =>
  act(() => listeners.get(event)?.forEach((listener) => listener()));
let renderer: Record<string, any>;

vi.mock("../../lib/renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/renderer")>()),
  CanvasRenderer: vi.fn().mockImplementation(() => renderer),
}));

const canvasId = imageJson.items[0].id;
const annotationId = imageJson.items[0].annotations[0].items[0].id;

let viewport: ReturnType<typeof stubViewport>;
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  viewport = stubViewport();
  listeners.clear();
  const overlays = document.createElement("div");
  document.body.appendChild(overlays);
  renderer = {
    host: document.createElement("div"),
    setImages: vi.fn().mockResolvedValue(undefined),
    setGestures: vi.fn(),
    dispose: vi.fn(),
    isOpen: false,
    backendKind: "webgl2",
    getBounds: () => ({ x: 0, y: 0, width: 4032, height: 3024 }),
    fitBounds: vi.fn(),
    fitAnnotation: vi.fn(),
    home: vi.fn(),
    invalidate: vi.fn(),
    attachNavigator: vi.fn(() => vi.fn()),
    itemRectToWorld: vi.fn(),
    overlays: { container: overlays, add: vi.fn(() => vi.fn()) },
    on: (event: string, listener: (detail?: unknown) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
      return () => listeners.get(event)?.delete(listener);
    },
  };
});
afterEach(() => viewport.restore());

async function renderWithStage(
  children: React.ReactNode = <Clover.Annotations />,
) {
  render(
    <Clover.Root iiifContent={imageJson}>
      <Clover.Content />
      {children}
    </Clover.Root>,
  );
  await waitFor(() => expect(renderer.setImages).toHaveBeenCalled());
  emit("open");
}

describe("Annotations", () => {
  it("lists the view's annotations by set, image and text bodies alike", async () => {
    await renderWithStage();
    const list = screen.getByRole("list");
    const [entry] = within(list).getAllByRole("listitem");
    expect(entry.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringMatching(/fountain/),
    );
    // The text beside it describes it, so the image says nothing more.
    expect(entry.querySelector("img")).toHaveAttribute("alt", "");
    expect(entry).toHaveTextContent("Gänseliesel fountain");
    expect(
      within(entry).getByRole("button", {
        name: /^Find on the image: Night picture/,
      }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("frames a picked annotation on the Canvas, and marks it picked", async () => {
    await renderWithStage();
    fireEvent.click(screen.getByRole("button", { name: /Find on the image/ }));
    expect(renderer.fitAnnotation).toHaveBeenCalledWith({
      x: 138,
      y: 550,
      width: 1477,
      height: 1710,
    });
    expect(
      screen.getByRole("button", { name: /Find on the image/ }),
    ).toHaveAttribute("aria-pressed", "true");
    // Its hotspot is the active one, and the current one (WCAG 4.1.2).
    expect(document.getElementById(annotationId)).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(document.getElementById(annotationId)).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("shares one highlight between the list and the hotspots, with no timers", async () => {
    await renderWithStage();
    const entry = screen.getByRole("listitem");
    fireEvent.mouseEnter(entry);
    expect(document.getElementById(annotationId)).toHaveAttribute(
      "data-active",
      "true",
    );
    fireEvent.mouseLeave(entry);
    expect(document.getElementById(annotationId)).toHaveAttribute(
      "data-active",
      "false",
    );
    fireEvent.mouseOver(document.getElementById(annotationId)!);
    expect(entry).toHaveAttribute("data-highlighted", "true");
  });

  it("hides a set's annotations from the Canvas with its checkbox", async () => {
    await renderWithStage();
    expect(document.getElementById(annotationId)).not.toBeNull();
    const hide = screen.getByRole("checkbox", { name: "Hide Annotations" });
    expect(hide).not.toBeChecked();
    // Its AnnotationPage has no label, so the set has no heading of its own.
    expect(screen.queryByRole("heading")).toBeNull();
    fireEvent.click(hide);
    expect(hide).toBeChecked();
    expect(document.getElementById(annotationId)).toBeNull();
    // The list keeps it, to switch back.
    expect(screen.getByRole("listitem")).toBeInTheDocument();
  });

  it("joins the information panel as a tab when there are annotations", async () => {
    render(
      <Clover.Root iiifContent={imageJson}>
        <Clover.InformationPanel />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("tab", { name: "Annotations" }),
    ).toBeInTheDocument();
  });

  it("shows annotations a host adds", async () => {
    const page = {
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/added",
      type: "AnnotationPage",
      label: { en: ["Added notes"] },
      items: [
        {
          id: "https://example.org/added/1",
          type: "Annotation",
          motivation: "commenting",
          body: { type: "TextualBody", value: "A note of mine" },
          target: `${canvasId}#xywh=0,0,10,10`,
        },
      ],
    };
    render(
      <Clover.Root iiifContent={imageJson} annotations={page}>
        <Clover.Annotations />
      </Clover.Root>,
    );
    // Marked with its label's language.
    expect(
      await screen.findByRole("heading", { name: "Added notes" }),
    ).toHaveAttribute("lang", "en");
    expect(
      screen.getByText("A note of mine", {
        selector: ".clover-annotations-text",
      }),
    ).toBeInTheDocument();
  });

  /*
   * WCAG 1.3.1: a Markdown body's lists are lists, and its headings headings, under the
   * set's own heading, or at its level in a set with none.
   */
  it("reads a Markdown body's lists and headings, a level under the set's heading", async () => {
    const pageOf = (label?: Record<string, string[]>) => ({
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/added",
      type: "AnnotationPage",
      ...(label ? { label } : {}),
      items: [
        {
          id: "https://example.org/added/1",
          type: "Annotation",
          motivation: "commenting",
          body: {
            type: "TextualBody",
            format: "text/markdown",
            value: "## Sources\n\n- One\n- Two\n\n1. First\n2. Second",
          },
          target: `${canvasId}#xywh=0,0,10,10`,
        },
      ],
    });
    const { unmount } = render(
      <Clover.Root
        iiifContent={imageJson}
        annotations={pageOf({ en: ["Notes"] })}
      >
        <Clover.Annotations headingLevel={4} />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("heading", { level: 4, name: "Notes" }),
    ).toBeInTheDocument();
    const sources = await screen.findByRole("heading", {
      level: 5,
      name: "Sources",
    });
    const body = sources.closest(".clover-annotations-text") as HTMLElement;
    const [bullets, numbers] = within(body).getAllByRole("list");
    expect(bullets.tagName).toBe("UL");
    expect(within(bullets).getAllByRole("listitem")).toHaveLength(2);
    expect(numbers.tagName).toBe("OL");
    expect(within(numbers).getByText("First")).toBeInTheDocument();
    // Its button is named by its text, without Markdown's syntax to read out (a name's
    // line breaks read as spaces).
    expect(
      screen.getByRole("button", {
        name: (name) =>
          name.replace(/\s+/g, " ") ===
          "Find on the image: Sources One Two First Second",
      }),
    ).toBeInTheDocument();
    unmount();

    render(
      <Clover.Root iiifContent={imageJson} annotations={pageOf()}>
        <Clover.Annotations headingLevel={4} />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("heading", { level: 4, name: "Sources" }),
    ).toBeInTheDocument();
  });

  /*
   * WCAG 1.1.1: an image with no text beside it is described by its label, or its
   * annotation's, or said to be an image.
   */
  describe("an image with no text beside it", () => {
    const pageOf = (annotation: Record<string, unknown>) => ({
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/added",
      type: "AnnotationPage",
      items: [
        {
          id: "https://example.org/added/1",
          type: "Annotation",
          motivation: "commenting",
          target: `${canvasId}#xywh=0,0,10,10`,
          ...annotation,
        },
      ],
    });
    const image = {
      id: "https://example.org/fountain.jpg",
      type: "Image",
      format: "image/jpeg",
    };
    const added = async (annotation: Record<string, unknown>) => {
      const { container } = render(
        <Clover.Root iiifContent={imageJson} annotations={pageOf(annotation)}>
          <Clover.Annotations />
        </Clover.Root>,
      );
      await waitFor(() =>
        expect(
          container.querySelector('[src="https://example.org/fountain.jpg"]'),
        ).not.toBeNull(),
      );
      return container.querySelector<HTMLImageElement>(
        '[src="https://example.org/fountain.jpg"]',
      )!;
    };

    it("is described by its own label, in its language, which names its button too", async () => {
      const img = await added({
        body: { ...image, label: { de: ["Der Gänseliesel-Brunnen"] } },
      });
      expect(img).toHaveAttribute("alt", "Der Gänseliesel-Brunnen");
      expect(img).toHaveAttribute("lang", "de");
      expect(
        screen.getByRole("button", {
          name: "Find on the image: Der Gänseliesel-Brunnen",
        }),
      ).toBeInTheDocument();
    });

    it("is described by its annotation's label when it has none of its own", async () => {
      const img = await added({
        label: { en: ["The fountain at night"] },
        body: image,
      });
      expect(img).toHaveAttribute("alt", "The fountain at night");
    });

    it("is said to be an image when nothing describes it", async () => {
      const img = await added({ body: image });
      expect(img).toHaveAttribute("alt", "Image");
      expect(img).not.toHaveAttribute("lang");
    });

    it("is named by its number when nothing describes it, as its hotspot is, so no two read alike", async () => {
      const page = {
        ...pageOf({ body: image }),
        items: [1, 2].map((n) => ({
          id: `https://example.org/added/${n}`,
          type: "Annotation",
          motivation: "commenting",
          target: `${canvasId}#xywh=0,0,10,10`,
          body: { ...image, id: `https://example.org/fountain-${n}.jpg` },
        })),
      };
      render(
        <Clover.Root iiifContent={imageJson} annotations={page}>
          <Clover.Annotations />
        </Clover.Root>,
      );
      expect(
        await screen.findByRole("button", { name: "Find on the image: 1" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Find on the image: 2" }),
      ).toBeInTheDocument();
    });
  });

  describe("on a page in another language than Clover's", () => {
    afterEach(() => {
      document.documentElement.lang = "";
    });

    it("keeps the page's language for a note in none, and names its button in both", async () => {
      document.documentElement.lang = "fr";
      const page = {
        "@context": "http://iiif.io/api/presentation/3/context.json",
        id: "https://example.org/added",
        type: "AnnotationPage",
        items: [
          {
            id: "https://example.org/added/1",
            type: "Annotation",
            motivation: "commenting",
            body: { type: "TextualBody", value: "Une note" },
            target: `${canvasId}#xywh=0,0,10,10`,
          },
        ],
      };
      const { container } = render(
        <Clover.Root iiifContent={imageJson} annotations={page}>
          <Clover.Annotations />
        </Clover.Root>,
      );
      const button = await screen.findByRole("button", {
        name: "Find on the image: Une note",
      });
      // Clover's words say they are English; the note, in none, keeps the page's French.
      expect(container.querySelector(".clover-root")).not.toHaveAttribute(
        "lang",
      );
      const note = screen.getByText("Une note", {
        selector: ".clover-annotations-text",
      });
      expect(note.closest("[lang]")).toBe(document.documentElement);
      expect(within(button).getByText("Find on the image:")).toHaveAttribute(
        "lang",
        "en",
      );
      expect(within(button).getByText("Une note").closest("[lang]")).toBe(
        document.documentElement,
      );
    });
  });
});

describe("content state", () => {
  it("reports where the reader is once it settles", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onContentStateChange = vi.fn();
    render(
      <Clover.Root
        iiifContent={imageJson}
        onContentStateChange={onContentStateChange}
      >
        <Clover.Content />
      </Clover.Root>,
    );
    await waitFor(() => expect(renderer.setImages).toHaveBeenCalled());
    emit("open");
    for (let frame = 0; frame < 10; frame++) emit("viewport");
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(onContentStateChange).toHaveBeenCalledTimes(1);
    const [{ json }] = onContentStateChange.mock.lastCall!;
    expect(resolveContentState(json)?.target).toMatchObject({ canvasId });
    vi.useRealTimers();
  });
});
