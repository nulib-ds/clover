import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { p4 } from "../../fixtures/presentation4";
import React from "react";

import Canvas from ".";
import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import rtlJson from "../../fixtures/iiif-cookbook/0010-book-2-viewing-direction-rtl.json";
import placeholderVideoJson from "../../fixtures/iiif-cookbook/0013-placeholderCanvas.json";
import metadataAnywhereJson from "../../fixtures/iiif-cookbook/0029-metadata-anywhere.json";
import choiceJson from "../../fixtures/iiif-cookbook/0033-choice.json";
import audioJson from "../../fixtures/iiif-cookbook/0002-mvm-audio.json";
import hotspotJson from "../../fixtures/iiif-cookbook/0022-linking-with-a-hotspot.json";
import fullCanvasJson from "../../fixtures/iiif-cookbook/0266-full-canvas-annotation.json";
import { initCloverI18n } from "../../i18n";
import { IdPrefixContext } from "../../ui/useUniqueId";
import { CanvasRenderer } from "../../lib/renderer";
import { Root } from "../Root/Root";
import { stubViewport } from "./testing/viewport";

// Published fixtures, upgraded to Presentation 4 as Clover holds them.
const book = p4(bookJson);
const rtl = p4(rtlJson);
const placeholderVideo = p4(placeholderVideoJson);
const metadataAnywhere = p4(metadataAnywhereJson);
const choice = p4(choiceJson);

const listeners: Record<string, (detail?: unknown) => void> = {};
let renderer: Record<string, any>;

vi.mock("../../lib/renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/renderer")>()),
  CanvasRenderer: vi.fn().mockImplementation(() => renderer),
}));

// Each Canvas is on screen, so it loads; see the lazy-loading test for one that is not.
let viewport: ReturnType<typeof stubViewport>;
beforeEach(() => {
  viewport = stubViewport();
});
afterEach(() => viewport.restore());

beforeEach(() => {
  vi.clearAllMocks();
  const overlays = document.createElement("div");
  renderer = {
    host: document.createElement("div"),
    setImages: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
    setGestures: vi.fn(),
    setDismiss: vi.fn(),
    dispose: vi.fn(),
    isOpen: false,
    backendKind: "webgl2",
    getBounds: () => ({ x: 1, y: 2, width: 3, height: 4 }),
    zoomBy: vi.fn(),
    rotateBy: vi.fn(),
    home: vi.fn(),
    invalidate: vi.fn(),
    fitItemRect: vi.fn(),
    fitBounds: vi.fn(),
    fitAnnotation: vi.fn(),
    attachNavigator: vi.fn(() => vi.fn()),
    itemRectToWorld: vi.fn((_: number, rect: any) => rect),
    overlays: { container: overlays, add: vi.fn(() => vi.fn()) },
    on: (event: string, listener: (detail?: unknown) => void) => {
      listeners[event] = listener;
      return () => delete listeners[event];
    },
  };
  document.body.appendChild(overlays);
});

/** The image opens; the hotspots and the Canvas's menus, which load on demand, arrive. */
const open = async () => {
  act(() => listeners.open());
  await loaded();
};
/** Let the modules a Canvas loads on demand (hotspots, its menus) arrive. */
const loaded = () =>
  act(async () => {
    await Promise.all([
      import("./AnnotationState"),
      import("./AnnotationMenu"),
      import("./ChoiceMenu"),
    ]);
  });

describe("Canvas", () => {
  // Never an empty box: busy, with the loading mark, as every Body part is meanwhile.
  it("shows its box busy while its part for a Root loads", async () => {
    render(
      <Root iiifContent={bookJson as never}>
        <Canvas />
      </Root>,
    );
    const pending = document.querySelector(".clover-canvas");
    expect(pending).toHaveAttribute("aria-busy", "true");
    expect(await screen.findByTestId("clover-canvas")).toBeInTheDocument();
  });

  it("says in the middle of the Body when its image could not be loaded", async () => {
    render(<Canvas iiifContent={book as never} />);
    const status = await waitFor(() => {
      const region = document.querySelector(".clover-body-unloadable");
      expect(region).not.toBeNull();
      return region!;
    });
    // Always there, so its words are announced as they come.
    expect(status).toHaveAttribute("role", "status");
    expect(status).toBeEmptyDOMElement();
    act(() => listeners.unloadable(true));
    expect(status).toHaveTextContent("This image could not be loaded.");
    act(() => listeners.unloadable(false));
    expect(status).toBeEmptyDOMElement();
  });

  it("renders nothing without a source, as Image does", () => {
    const { container } = render(<Canvas src={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  // Outside any Root, it loads what it draws: a Canvas, or a Manifest's first.
  it("loads a Canvas given as iiifContent, or a Manifest's first, and draws it", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(bookJson), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    const { unmount } = render(
      <Canvas
        iiifContent="https://example.org/book.json"
        options={{ request: { fetch } }}
      />,
    );
    // The Manifest's first Canvas, named by its label.
    // The loading chunk, the content and the upgrader arrive first: slow under load.
    await waitFor(
      () =>
        expect(
          screen.getByTestId("clover-canvas-viewport"),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://example.org/book.json",
      expect.anything(),
    );
    // Its images are set once it knows it is near the window, a step after the viewport is
    // drawn: on a loaded machine, not yet as the viewport appears.
    await waitFor(() => expect(renderer.setImages).toHaveBeenCalled(), {
      timeout: 3000,
    });
    unmount();
    render(<Canvas iiifContent={bookJson.items[1] as any} />);
    await waitFor(
      () =>
        expect(
          screen.getByTestId("clover-canvas-viewport"),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  // Its own annotations, as a Canvas on its own carries them: drawn where they target.
  it("draws the annotations a Canvas loaded as iiifContent carries", async () => {
    const canvas = {
      "@context": "http://iiif.io/api/presentation/3/context.json",
      ...bookJson.items[1],
      annotations: [
        {
          id: "https://example.org/tags",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.org/tags/1",
              type: "Annotation",
              motivation: "tagging",
              body: {
                type: "TextualBody",
                value: "A tag",
                format: "text/plain",
              },
              target: `${bookJson.items[1].id}#xywh=10,20,30,40`,
            },
          ],
        },
      ],
    };
    render(<Canvas iiifContent={canvas as any} />);
    await waitFor(
      () =>
        expect(
          screen.getByTestId("clover-canvas-viewport"),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
    await open();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "A tag" })).toBeInTheDocument(),
    );
  });

  it("shows its box, busy, with the loading mark until what it loads arrives, and says why it failed", async () => {
    let answer!: (response: Response) => void;
    const fetch = vi.fn(
      () => new Promise<Response>((resolve) => (answer = resolve)),
    );
    const { container } = render(
      <Canvas
        iiifContent="https://example.org/missing.json"
        options={{ request: { fetch } }}
      />,
    );
    // Never an empty box: the Canvas's own, busy, its loading mark along the top.
    const box = container.querySelector(".clover-canvas")!;
    expect(box).toHaveAttribute("aria-busy", "true");
    expect(box.querySelector(".clover-loading")).not.toBeNull();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    answer(new Response("Not found", { status: 404 }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This could not be loaded.");
    expect(alert.querySelector(".clover-status-detail")?.textContent).not.toBe(
      "",
    );
    expect(container.querySelector(".clover-canvas")).toHaveAttribute(
      "data-status",
      "error",
    );
  });

  it("loads the Canvas a content state names, its note drawn there", async () => {
    const BOOK = "https://example.org/book.json";
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ ...bookJson, id: BOOK }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    render(
      <Canvas
        iiifContent={{
          "@context": "http://iiif.io/api/presentation/3/context.json",
          id: "https://example.org/state/1",
          type: "Annotation",
          motivation: ["contentState"],
          target: {
            type: "SpecificResource",
            source: {
              id: bookJson.items[2].id,
              type: "Canvas",
              partOf: [{ id: BOOK, type: "Manifest" }],
            },
            selector: { type: "FragmentSelector", value: "xywh=10,20,30,40" },
          },
          body: [
            { type: "TextualBody", value: "A note", format: "text/plain" },
          ],
        }}
        options={{ request: { fetch } }}
      />,
    );
    await waitFor(
      () =>
        expect(
          screen.getByTestId("clover-canvas-viewport"),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(fetch).toHaveBeenCalledWith(BOOK, expect.anything());
    await open();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "A note" }),
      ).toBeInTheDocument(),
    );
    // Its region framed, as a Root frames a deep link's.
    expect(renderer.fitBounds).toHaveBeenCalledWith(expect.anything(), true);
  });

  // Cookbook 0022: its hotspot leads to the Manifest's other Canvas, which it then shows.
  it("follows a linking hotspot to another Canvas of what it loaded, focus kept on its viewport", async () => {
    render(<Canvas iiifContent={hotspotJson as any} />);
    await waitFor(
      () =>
        expect(
          screen.getByTestId("clover-canvas-viewport"),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
    await open();
    const hotspot = await screen.findByRole("button", {
      name: "A link to a close up of Gänseliesel-Brunnen fountain.",
    });
    renderer.setImages.mockClear();
    fireEvent.click(hotspot);
    await waitFor(() =>
      expect(renderer.setImages).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            service: expect.stringContaining("fountain"),
          }),
        ],
        expect.anything(),
      ),
    );
    expect(screen.getByTestId("clover-canvas-viewport")).toHaveFocus();
  });

  // Cookbook 0266: a comment on the whole Canvas has no region; the caption shows it.
  it("shows comments on the whole Canvas in its caption", async () => {
    render(<Canvas iiifContent={fullCanvasJson as any} />);
    await waitFor(
      () =>
        expect(
          screen.getByTestId("clover-canvas-viewport"),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
    await open();
    fireEvent.click(await screen.findByRole("button", { name: "About" }));
    const caption = screen.getByTestId("clover-canvas-caption");
    await waitFor(() =>
      expect(caption).toHaveTextContent(
        "Göttinger Marktplatz mit Gänseliesel Brunnen",
      ),
    );
    expect(caption).toHaveTextContent("Annotations");
    expect(caption.querySelector(".clover-annotations-text")).toHaveAttribute(
      "lang",
      "de",
    );
  });

  it("renders an accessible, focusable viewport", () => {
    render(<Canvas src="https://example.org/a.jpg" label="A letter" />);
    const viewport = screen.getByRole("img", { name: "A letter" });
    expect(viewport).toHaveAttribute("tabindex", "0");
    expect(screen.getByTestId("clover-canvas")).toHaveAttribute(
      "data-status",
      "loading",
    );
  });

  it("says the viewport can be operated, and with which keys (WCAG 4.1.2)", () => {
    render(<Canvas src="https://example.org/a.jpg" label="A letter" />);
    const viewport = screen.getByRole("img", { name: "A letter" });
    expect(viewport).toHaveAttribute("aria-roledescription", "zoomable image");
    expect(viewport).toHaveAttribute(
      "aria-keyshortcuts",
      "ArrowLeft ArrowRight ArrowUp ArrowDown Plus - 0 R Shift+R",
    );
    expect(viewport).toHaveAccessibleDescription(
      "Use the arrow keys to pan, with Shift for larger steps, plus and minus to zoom, 0 to reset the view, and R or Shift+R to rotate.",
    );
  });

  it("makes its controls' ids as Clover makes every id, so two copies of Clover on a page never share one (WCAG 4.1.2)", () => {
    // An element's prefix, as each of the elements' hosts gives it.
    render(
      <IdPrefixContext.Provider value="clover-7-">
        <Canvas src="https://example.org/a.jpg" label="A letter" />
      </IdPrefixContext.Provider>,
    );
    const viewport = screen.getByRole("img", { name: "A letter" });
    const keys = viewport
      .getAttribute("aria-describedby")!
      .split(" ")
      .find((id) => id.startsWith("keys-"));
    expect(keys).toMatch(/^keys-clover-canvas-clover-7-/);
    expect(document.getElementById(keys!)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Zoom in" }).id).toMatch(
      /^zoomIn-clover-canvas-clover-7-/,
    );
  });

  it("gives a lone recording's viewport media's keys, and no image's role description", () => {
    render(<Canvas canvases={[p4(audioJson).items[0]]} />);
    const viewport = screen.getByTestId("clover-canvas-viewport");
    expect(viewport).not.toHaveAttribute("aria-roledescription");
    expect(viewport).toHaveAttribute("aria-keyshortcuts", "K Space J L M");
    expect(viewport).toHaveAccessibleDescription(/Space or K to play or pause/);
  });

  it("names no camera keys, nor the image as zoomable, when the host holds it still", () => {
    render(
      <Canvas
        src="https://example.org/a.jpg"
        label="A letter"
        options={{ gestures: { navigable: false } }}
      />,
    );
    const viewport = screen.getByRole("img", { name: "A letter" });
    expect(viewport).not.toHaveAttribute("aria-roledescription");
    expect(viewport).not.toHaveAttribute("aria-keyshortcuts");
    expect(viewport).not.toHaveAttribute("aria-describedby");
    // No grab hand, and nothing panned clear of the controls.
    expect(screen.getByTestId("clover-canvas")).toHaveAttribute(
      "data-navigable",
      "false",
    );
  });

  it("names no keys behind a placeholder, where none does anything", () => {
    render(<Canvas canvases={[placeholderVideo.items[0]]} />);
    const viewport = screen.getByTestId("clover-canvas-viewport");
    expect(viewport).not.toHaveAttribute("aria-keyshortcuts");
    expect(viewport).not.toHaveAttribute("aria-describedby");
  });

  it("names the viewport from the body's label, or generically, when given none", () => {
    const { unmount } = render(
      <Canvas
        body={{
          id: "https://example.org/a.jpg",
          type: "Image",
          label: { en: ["A map"] },
        }}
      />,
    );
    expect(screen.getByRole("img", { name: "A map" })).toBeInTheDocument();
    unmount();
    render(<Canvas src="https://example.org/a.jpg" />);
    expect(screen.getByRole("img", { name: "Image" })).toBeInTheDocument();
  });

  it("names the viewport in a Root from the Manifest's label when the Canvas has none", async () => {
    const unlabeled = {
      ...bookJson,
      label: { en: ["A book"] },
      items: [{ ...bookJson.items[0], label: undefined }],
    };
    render(
      <Root iiifContent={unlabeled}>
        <Canvas />
      </Root>,
    );
    expect(
      await screen.findByRole("img", { name: "A book" }),
    ).toBeInTheDocument();
  });

  it("tiles a body from its image service, keeping body.id as the fallback", () => {
    render(
      <Canvas
        body={{
          id: "https://example.org/iiif/abc/full/max/0/default.jpg",
          type: "Image",
          width: 8949,
          height: 5709,
          region: "100,200,300,400",
          service: [
            { "@id": "https://example.org/iiif/abc", "@type": "ImageService2" },
          ] as any,
        }}
      />,
    );
    expect(renderer.setImages).toHaveBeenCalledWith(
      [
        {
          id: "0:https://example.org/iiif/abc/full/max/0/default.jpg|100,200,300,400",
          service: "https://example.org/iiif/abc",
          url: "https://example.org/iiif/abc/full/max/0/default.jpg",
          width: 8949,
          height: 5709,
          region: "100,200,300,400",
        },
      ],
      expect.anything(),
    );
  });

  it("treats src as an image service with isTiledImage", () => {
    render(
      <Canvas src="https://example.org/iiif/abc/info.json" isTiledImage />,
    );
    expect(renderer.setImages).toHaveBeenCalledWith(
      [
        {
          id: "0:https://example.org/iiif/abc/info.json",
          service: "https://example.org/iiif/abc/info.json",
        },
      ],
      expect.anything(),
    );
  });

  it("does not reload when the parent re-renders with equal sources", () => {
    const { rerender } = render(<Canvas src={["a.jpg", "b.jpg"]} />);
    rerender(<Canvas src={["a.jpg", "b.jpg"]} />);
    expect(renderer.setImages).toHaveBeenCalledTimes(1);
    expect(CanvasRenderer).toHaveBeenCalledTimes(1);
  });

  it("hands over a handle when the renderer opens, and reports the viewport", () => {
    const onReady = vi.fn();
    const onViewportChange = vi.fn();
    render(
      <Canvas
        src="a.jpg"
        onReady={onReady}
        onViewportChange={onViewportChange}
      />,
    );
    act(() => {
      listeners.open();
      listeners.viewport();
    });
    expect(screen.getByTestId("clover-canvas")).toHaveAttribute(
      "data-status",
      "ready",
    );
    // A handle that delegates to the renderer, not the renderer itself.
    const handle = onReady.mock.calls[0][0];
    expect(handle).not.toBe(renderer);
    expect(handle.backendKind).toBe("webgl2");
    expect(handle.getBounds()).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    handle.zoomBy(2);
    expect(renderer.zoomBy).toHaveBeenCalledWith(2, undefined, undefined);
    expect(onViewportChange).toHaveBeenCalledWith({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    });
  });

  it("renders a host's own controls in the cluster, after Clover's", () => {
    render(
      <Canvas src="a.jpg">
        <button type="button">Plugin</button>
      </Canvas>,
    );
    const cluster = screen.getByTestId("clover-canvas-controls");
    expect(cluster.lastElementChild).toHaveTextContent("Plugin");
  });

  describe("controls", () => {
    it("renders Image's cluster, with the same data-button hooks", () => {
      render(<Canvas src="a.jpg" instanceId="x" />);
      const buttons = screen
        .getByTestId("clover-canvas-controls")
        .querySelectorAll("button");
      expect([...buttons].map((b) => b.dataset.button)).toEqual([
        "zoom-in",
        "zoom-out",
        "full-page",
        "rotate-right",
        "rotate-left",
        "reset",
      ]);
      expect(buttons[0]).toHaveAttribute("id", "zoomIn-x");
    });

    it("offers no full screen where an element cannot have it (iPhone Safari)", () => {
      Object.defineProperty(document, "fullscreenEnabled", {
        configurable: true,
        value: undefined,
      });
      try {
        render(<Canvas src="a.jpg" />);
        expect(
          screen.queryByRole("button", { name: "Full screen" }),
        ).toBeNull();
        expect(screen.getByRole("button", { name: "Zoom in" })).toBeVisible();
      } finally {
        Object.defineProperty(document, "fullscreenEnabled", {
          configurable: true,
          value: true,
        });
      }
    });

    it("drives the renderer by click rather than OpenSeadragon's id binding", () => {
      render(<Canvas src="a.jpg" />);
      fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
      fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
      fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
      fireEvent.click(screen.getByRole("button", { name: "Rotate left" }));
      fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
      expect(renderer.zoomBy).toHaveBeenNthCalledWith(1, 2);
      expect(renderer.zoomBy).toHaveBeenNthCalledWith(2, 0.5);
      expect(renderer.rotateBy).toHaveBeenNthCalledWith(1, 90);
      expect(renderer.rotateBy).toHaveBeenNthCalledWith(2, -90);
      expect(renderer.home).toHaveBeenCalled();
    });

    it("shows a subset of controls, or none", () => {
      const { rerender } = render(
        <Canvas src="a.jpg" controls={{ rotation: false }} />,
      );
      expect(
        screen.getByRole("button", { name: "Zoom in" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Rotate right" })).toBeNull();

      rerender(<Canvas src="a.jpg" controls={false} />);
      expect(screen.queryByTestId("clover-canvas-controls")).toBeNull();
    });

    it("labels them in Clover's language, as Image does", async () => {
      await initCloverI18n({ lng: "fr" }).ready();
      try {
        render(<Canvas src="a.jpg" />);
        expect(
          screen.getByRole("button", { name: "Zoom avant" }),
        ).toBeInTheDocument();
      } finally {
        act(() => {
          initCloverI18n({ lng: "en" });
        });
      }
    });

    it("honors controlButtons replacements", () => {
      const ZoomIn = ({ buttonProps, label }: any) => (
        <button {...buttonProps} data-custom>
          {label}!
        </button>
      );
      render(<Canvas src="a.jpg" controlButtons={{ zoomIn: ZoomIn }} />);
      const custom = screen.getByRole("button", { name: "Zoom in" });
      expect(custom).toHaveAttribute("data-custom");
      fireEvent.click(custom);
      expect(renderer.zoomBy).toHaveBeenCalledWith(2);
    });
  });

  describe("navigator", () => {
    it("is off by default", () => {
      render(<Canvas src="a.jpg" />);
      expect(screen.queryByTestId("clover-canvas-navigator")).toBeNull();
      expect(renderer.attachNavigator).not.toHaveBeenCalled();
    });

    it("attaches an overview when turned on", () => {
      render(<Canvas src="a.jpg" navigator />);
      const navigator = screen.getByTestId("clover-canvas-navigator");
      expect(renderer.attachNavigator).toHaveBeenCalledWith(navigator);
    });
  });

  describe("annotations", () => {
    const annotations = [
      {
        targetIndex: 0,
        annotation: {
          id: "https://example.org/anno/1",
          type: "Annotation",
          body: [
            {
              type: "TextualBody",
              value: "<b>Fountain</b> &amp; square",
              format: "text/html",
            },
          ],
          target: "https://example.org/canvas#xywh=10,20,30,40",
        } as any,
      },
      {
        targetIndex: 0,
        annotation: {
          id: "https://example.org/anno/point",
          type: "Annotation",
          target: {
            source: "https://example.org/canvas",
            selector: { type: "PointSelector", x: 1, y: 2 },
          },
        } as any,
      },
    ];

    it("pins a named button to each rectangular target, once laid out", async () => {
      render(<Canvas src="a.jpg" annotations={annotations} label="Photo" />);
      expect(screen.queryByRole("button", { name: /Fountain/ })).toBeNull();
      await open();

      // Hotspots must stay reachable: an `img` role would hide them.
      expect(screen.getByRole("group", { name: "Photo" })).toBeInTheDocument();
      // HTML bodies are read as text, never injected.
      const button = screen.getByRole("button", { name: "Fountain & square" });
      expect(button.querySelector("b")).toBeNull();
      expect(button.parentElement).toBe(renderer.overlays.container);
      expect(renderer.overlays.add).toHaveBeenCalledWith(button, {
        x: 10,
        y: 20,
        width: 30,
        height: 40,
      });
      // Only rect targets get a hotspot.
      expect(renderer.overlays.add).toHaveBeenCalledTimes(1);
    });

    it("marks the hovered or focused hotspot active and reports it", async () => {
      const onAnnotationActive = vi.fn();
      render(
        <Canvas
          src="a.jpg"
          annotations={annotations}
          onAnnotationActive={onAnnotationActive}
        />,
      );
      await open();
      const button = screen.getByRole("button", { name: "Fountain & square" });
      fireEvent.mouseOver(button);
      expect(button).toHaveAttribute("data-active", "true");
      expect(onAnnotationActive).toHaveBeenLastCalledWith(
        "https://example.org/anno/1",
      );
      fireEvent.mouseOut(button);
      expect(button).toHaveAttribute("data-active", "false");
      expect(onAnnotationActive).toHaveBeenLastCalledWith(null);
      fireEvent.focus(button);
      expect(button).toHaveAttribute("data-active", "true");
    });

    /*
     * The pick is let go by Escape in the Canvas (WCAG 2.1.1), as by a click or tap off
     * every hotspot (the renderer's `dismiss`, which the gestures ask before a zoom).
     */
    it("lets go of the picked hotspot on Escape or a click off it, and says Escape does", async () => {
      const onAnnotationSelect = vi.fn();
      render(
        <Canvas
          src="a.jpg"
          annotations={annotations}
          onAnnotationSelect={onAnnotationSelect}
        />,
      );
      await open();
      const viewport = screen.getByTestId("clover-canvas-viewport");
      expect(viewport.getAttribute("aria-keyshortcuts")).toMatch(/ Escape$/);
      expect(viewport).toHaveAccessibleDescription(
        /Press Escape to clear the selected annotation\.$/,
      );
      const button = screen.getByRole("button", { name: "Fountain & square" });
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-current", "true");
      fireEvent.keyDown(viewport, { key: "Escape" });
      expect(button).not.toHaveAttribute("aria-current");
      expect(button).toHaveAttribute("data-active", "false");
      expect(onAnnotationSelect).toHaveBeenLastCalledWith(null);

      fireEvent.click(button);
      const [dismiss] = renderer.setDismiss.mock.calls.at(-1);
      let dismissed: boolean | undefined;
      act(() => {
        dismissed = dismiss();
      });
      expect(dismissed).toBe(true);
      expect(button).not.toHaveAttribute("aria-current");
      // Nothing left to let go: that tap zooms, as ever.
      act(() => {
        dismissed = dismiss();
      });
      expect(dismissed).toBe(false);
    });

    it("lists them in a menu from a comment control; picking one zooms to it", async () => {
      render(<Canvas src="a.jpg" annotations={annotations} />);
      await open();
      const control = screen.getByRole("button", { name: "Annotations" });
      expect(control).toHaveAttribute("data-button", "annotations");
      expect(control).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(control);
      expect(control).toHaveAttribute("aria-expanded", "true");
      // Only the drawable (rectangular) annotation is listed, by its text.
      const items = screen.getAllByRole("radio");
      expect(items).toHaveLength(1);
      const item = screen.getByRole("radio", { name: "Fountain & square" });
      expect(item).not.toBeChecked();

      fireEvent.click(item);
      expect(item).toBeChecked();
      expect(renderer.fitAnnotation).toHaveBeenCalledWith(
        {
          x: 10,
          y: 20,
          width: 30,
          height: 40,
        },
        true,
      );
      // Its hotspot stays highlighted as the current one.
      expect(
        screen.getByRole("button", { name: "Fountain & square" }),
      ).toHaveAttribute("data-active", "true");

      fireEvent.keyDown(document, { key: "Escape" });
      expect(control).toHaveAttribute("aria-expanded", "false");
      expect(control).toHaveFocus();
    });

    // A cut by default; the glide only when the host asks for it.
    it("frames a picked annotation at once, or glides to it with animateAnnotations", async () => {
      const { unmount } = render(
        <Canvas src="a.jpg" annotations={annotations} />,
      );
      await open();
      fireEvent.click(
        screen.getByRole("button", { name: "Fountain & square" }),
      );
      expect(renderer.fitAnnotation).toHaveBeenLastCalledWith(
        expect.any(Object),
        true,
      );
      unmount();
      render(
        <Canvas src="a.jpg" annotations={annotations} animateAnnotations />,
      );
      await open();
      fireEvent.click(
        screen.getByRole("button", { name: "Fountain & square" }),
      );
      expect(renderer.fitAnnotation).toHaveBeenLastCalledWith(
        expect.any(Object),
        false,
      );
    });

    it("offers no annotations control without drawable annotations, or when turned off", async () => {
      const { unmount } = render(<Canvas src="a.jpg" />);
      await open();
      expect(screen.queryByRole("button", { name: "Annotations" })).toBeNull();
      unmount();

      render(
        <Canvas
          src="a.jpg"
          annotations={annotations}
          controls={{ annotations: false }}
        />,
      );
      await open();
      expect(screen.queryByRole("button", { name: "Annotations" })).toBeNull();
    });

    it("zooms to an annotation through the handle, focusing its hotspot", async () => {
      const onReady = vi.fn();
      render(
        <Canvas src="a.jpg" annotations={annotations} onReady={onReady} />,
      );
      await open();
      const handle = onReady.mock.calls[0][0];
      const hotspot = screen.getByRole("button", { name: "Fountain & square" });
      let zoomed = false;
      act(() => {
        zoomed = handle.zoomToAnnotation(hotspot.id);
      });
      expect(zoomed).toBe(true);
      expect(renderer.fitAnnotation).toHaveBeenCalledWith(
        {
          x: 10,
          y: 20,
          width: 30,
          height: 40,
        },
        true,
      );
      expect(hotspot).toHaveFocus();
      expect(handle.zoomToAnnotation("https://example.org/none")).toBe(false);
    });

    it("zooms to its target on click", async () => {
      render(<Canvas src="a.jpg" annotations={annotations} />);
      await open();
      fireEvent.click(
        screen.getByRole("button", { name: "Fountain & square" }),
      );
      expect(renderer.fitAnnotation).toHaveBeenCalledWith(
        {
          x: 10,
          y: 20,
          width: 30,
          height: 40,
        },
        true,
      );
    });
  });

  it("disposes the renderer on unmount", () => {
    const { unmount } = render(<Canvas src="a.jpg" />);
    unmount();
    expect(renderer.dispose).toHaveBeenCalled();
  });

  describe("IIIF Canvases", () => {
    const lastScene = () => renderer.setImages.mock.lastCall;
    const pages = book.items as any[];

    it("composes a Canvas's painted images, with the Canvas as the world", () => {
      render(<Canvas canvases={[pages[0]]} />);
      const [images, { world }] = lastScene();
      expect(images).toHaveLength(1);
      expect(world).toEqual({ x: 0, y: 0, width: 3204, height: 4613 });
    });

    it("draws the Canvases a host hands over together, in reading order", () => {
      render(
        <Canvas
          canvases={pages.slice(1, 3)}
          viewingDirection="right-to-left"
        />,
      );
      const [images] = lastScene();
      // Right to left: the first page sits to the right of the second.
      expect(images[0].placement.x).toBeGreaterThan(images[1].placement.x);
    });

    it("frames afresh when the host hands over different Canvases", () => {
      const { rerender } = render(<Canvas canvases={[pages[0]]} />);
      expect(lastScene()[1].fit).toBe(false);
      rerender(<Canvas canvases={pages.slice(1, 3)} />);
      expect(lastScene()[1].fit).toBe(true);
    });

    it("shows the loading mark, busy, until it draws, and again for the next view", () => {
      const mark = () => document.querySelector(".clover-loading");
      const viewport = () => screen.getByTestId("clover-canvas-viewport");
      const { rerender } = render(<Canvas canvases={[pages[0]]} />);
      expect(mark()).toHaveAttribute("aria-hidden", "true");
      expect(mark()).toHaveAttribute("data-overlay", "true");
      expect(viewport()).toHaveAttribute("aria-busy", "true");
      act(() => listeners.open());
      expect(mark()).toBeNull();
      expect(viewport()).toHaveAttribute("aria-busy", "false");
      // Moving on: loading again, over the Body as it is, until the next view draws.
      renderer.isOpen = true;
      rerender(<Canvas canvases={[pages[1]]} />);
      expect(mark()).not.toBeNull();
      act(() => listeners.change());
      expect(mark()).toBeNull();
    });

    /*
     * On a move the last view stays up until the next one draws: its hotspots, and the
     * framing of a pick on it, wait for that, so the camera moves in the scene it ends
     * in: the spread fitted first, then the annotation.
     */
    it("waits for the next view to draw before its hotspots and a pick's framing", async () => {
      const note = (canvas: any) => ({
        targetIndex: 0,
        annotation: {
          id: `${canvas.id}/note`,
          type: "Annotation",
          body: { type: "TextualBody", value: "A note" },
          target: `${canvas.id}#xywh=10,20,30,40`,
        } as any,
      });
      const { rerender } = render(
        <Canvas
          canvases={[pages[0]]}
          annotations={[note(pages[0])]}
          selectedAnnotation={null}
        />,
      );
      await open();
      expect(screen.getAllByRole("button", { name: "A note" })).toHaveLength(1);
      renderer.isOpen = true;
      rerender(
        <Canvas
          canvases={[pages[1]]}
          annotations={[note(pages[1])]}
          selectedAnnotation={`${pages[1].id}/note`}
        />,
      );
      // Still the last view: no hotspot laid over it, and the camera left alone.
      expect(screen.queryByRole("button", { name: "A note" })).toBeNull();
      expect(renderer.fitAnnotation).not.toHaveBeenCalled();
      act(() => listeners.change());
      await loaded();
      expect(
        screen.getByRole("button", { name: "A note" }),
      ).toBeInTheDocument();
      expect(renderer.fitAnnotation).toHaveBeenCalledTimes(1);
    });

    it("clears at once for another Manifest, not for another of its Canvases", () => {
      const { rerender } = render(
        <Canvas canvases={[pages[0]]} manifestId="https://example.org/a" />,
      );
      rerender(
        <Canvas canvases={[pages[1]]} manifestId="https://example.org/a" />,
      );
      expect(renderer.clear).not.toHaveBeenCalled();
      rerender(
        <Canvas canvases={[pages[1]]} manifestId="https://example.org/b" />,
      );
      expect(renderer.clear).toHaveBeenCalledTimes(1);
    });

    it("never says it is loading for sound alone, which has no image to wait for", () => {
      render(<Canvas canvases={[(p4(audioJson) as any).items[0]]} />);
      expect(document.querySelector(".clover-loading")).toBeNull();
      expect(screen.getByTestId("clover-canvas-viewport")).toHaveAttribute(
        "aria-busy",
        "false",
      );
    });

    it("has no previous/next of its own: stepping is the host's job", () => {
      render(<Canvas canvases={pages.slice(1, 3)} />);
      expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    });

    it("places an annotation on the Canvas its target names", () => {
      const spread = rtl.items.slice(1, 3) as any[];
      render(
        <Canvas
          canvases={spread}
          viewingDirection="right-to-left"
          annotations={[
            {
              targetIndex: 0,
              annotation: {
                id: "https://example.org/anno/a",
                type: "Annotation",
                body: [{ type: "TextualBody", value: "On the second page" }],
                target: `${spread[1].id}#xywh=0,0,100,100`,
              } as any,
            },
          ]}
        />,
      );
      act(() => listeners.open());
      // The second Canvas is on the left in right-to-left order, so x stays at 0.
      expect(renderer.overlays.add).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({ x: 0, y: 0 }),
      );
    });
  });
  describe("Choice", () => {
    const xrayCanvas = choice.items as any[];

    it("offers a choice control only when the Canvas has a Choice", () => {
      const { rerender } = render(
        <Canvas canvases={book.items.slice(0, 1) as any} />,
      );
      expect(screen.queryByRole("button", { name: "Choice" })).toBeNull();
      rerender(<Canvas canvases={xrayCanvas} />);
      const control = screen.getByRole("button", { name: "Choice" });
      expect(control).toHaveAttribute("data-button", "choice");
      expect(control).toHaveAttribute("aria-expanded", "false");
    });

    it("lists the items, first selected, and paints the one picked", () => {
      render(<Canvas canvases={xrayCanvas} />);
      expect(renderer.setImages.mock.lastCall[0][0].url).toMatch(/natural/i);

      fireEvent.click(screen.getByRole("button", { name: "Choice" }));
      expect(screen.getByRole("button", { name: "Choice" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      expect(
        screen.getByRole("radio", { name: "Natural Light" }),
      ).toBeChecked();

      fireEvent.click(screen.getByRole("radio", { name: "X-Ray" }));
      const [images, { fit }] = renderer.setImages.mock.lastCall;
      expect(images[0].url).toMatch(/xray/i);
      // Same Canvas: the reader's view is kept.
      expect(fit).toBe(false);
    });

    it("shows an unlabeled item's number beside its radio button", () => {
      const unlabeled = JSON.parse(JSON.stringify(xrayCanvas));
      const strip = (node: any): void => {
        if (!node || typeof node !== "object") return;
        if (node.type === "Choice")
          for (const item of node.items) delete item.label;
        Object.values(node).forEach(strip);
      };
      strip(unlabeled);
      render(<Canvas canvases={unlabeled} />);
      fireEvent.click(screen.getByRole("button", { name: "Choice" }));
      const menu = screen.getByTestId("clover-canvas-choice");
      expect(within(menu).getByText("1")).toBeVisible();
      expect(within(menu).getByText("2")).toBeVisible();
      expect(screen.getByRole("radio", { name: "1" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "2" })).not.toHaveAttribute(
        "aria-label",
      );
    });

    it("closes on Escape, returning focus to the control", () => {
      render(<Canvas canvases={xrayCanvas} />);
      const control = screen.getByRole("button", { name: "Choice" });
      fireEvent.click(control);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByTestId("clover-canvas-choice")).toBeNull();
      expect(control).toHaveFocus();
    });

    it("closes on an Escape elsewhere, leaving focus where it is", () => {
      render(
        <>
          <Canvas canvases={xrayCanvas} />
          <input type="search" aria-label="Find" />
        </>,
      );
      const control = screen.getByRole("button", { name: "Choice" });
      fireEvent.click(control);
      expect(
        screen.getByRole("radio", { name: "Natural Light" }),
      ).toHaveFocus();
      // Tab on out of the menu, which stays open, and press Escape in a field.
      const field = screen.getByRole("searchbox", { name: "Find" });
      field.focus();
      // Not handled here, so the field, or whatever holds it, still has its Escape.
      expect(fireEvent.keyDown(field, { key: "Escape" })).toBe(true);
      expect(screen.queryByTestId("clover-canvas-choice")).toBeNull();
      expect(control).toHaveAttribute("aria-expanded", "false");
      expect(field).toHaveFocus();
    });

    it("closes only itself on an Escape in it, not a dialog or panel around it", () => {
      // What a modal `<dialog>` or a floating Panel does with Escape: close,
      // unless the key's default was prevented.
      const around = vi.fn();
      render(
        <dialog
          open
          onKeyDown={(event) => {
            if (event.key === "Escape" && !event.defaultPrevented) around();
          }}
        >
          <Canvas canvases={xrayCanvas} />
        </dialog>,
      );
      const control = screen.getByRole("button", { name: "Choice" });
      fireEvent.click(control);
      const radio = screen.getByRole("radio", { name: "Natural Light" });
      expect(radio).toHaveFocus();
      expect(fireEvent.keyDown(radio, { key: "Escape" })).toBe(false);
      expect(screen.queryByTestId("clover-canvas-choice")).toBeNull();
      expect(control).toHaveFocus();
      expect(around).not.toHaveBeenCalled();
      // With the menu closed, the next Escape is the dialog's.
      expect(fireEvent.keyDown(control, { key: "Escape" })).toBe(true);
      expect(around).toHaveBeenCalledTimes(1);
    });
  });

  describe("placeholder", () => {
    const placeholderCanvas = (id: string) => ({
      id: `${id}/placeholder`,
      type: "Canvas",
      width: 400,
      height: 300,
      items: [
        {
          items: [
            {
              motivation: "painting",
              body: {
                id: `${id}/still.jpg`,
                type: "Image",
                width: 400,
                height: 300,
              },
              target: `${id}/placeholder`,
            },
          ],
        },
      ],
    });
    const withPlaceholder = (canvas: any) => ({
      ...canvas,
      placeholderContainer: placeholderCanvas(canvas.id),
    });
    const [first, second] = (book.items as any[]).map(withPlaceholder);
    const openViewer = () =>
      screen.getByRole("button", { name: "Open image viewer" });
    const closeViewer = () =>
      screen.getByRole("button", { name: "Close image viewer" });

    it("shows the still fitted in place of the Canvas, with only a toggle", () => {
      render(<Canvas canvases={[first]} />);
      // The viewport shares the Canvas's name, so the still is found in its own frame.
      const still = within(
        screen.getByTestId("clover-canvas-placeholder"),
      ).getByRole("img", { name: "Blank page" });
      expect(still).toHaveAttribute("src", `${first.id}/still.jpg`);
      expect(screen.getByTestId("clover-canvas")).toHaveAttribute(
        "data-placeholder",
        "true",
      );
      expect(openViewer()).toHaveAttribute("data-button", "placeholder");
      // Nothing of the Canvas is fetched, and no other control is shown.
      expect(renderer.setImages).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
    });

    // The reader asked to see it: a list beside the Canvas, or a link, picked it.
    it("opens past the still for a pick made outside it, once its annotation is in view", () => {
      const note = {
        targetIndex: 0,
        annotation: {
          id: "https://example.org/anno/1",
          type: "Annotation",
          body: { type: "TextualBody", value: "A note" },
          target: `${first.id}#xywh=10,20,30,40`,
        } as any,
      };
      const { rerender } = render(
        <Canvas
          canvases={[first]}
          annotations={[note]}
          selectedAnnotation={null}
        />,
      );
      // One on no Canvas in view opens nothing.
      rerender(
        <Canvas
          canvases={[first]}
          annotations={[note]}
          selectedAnnotation="https://example.org/anno/elsewhere"
        />,
      );
      expect(openViewer()).toBeInTheDocument();
      expect(renderer.setImages).not.toHaveBeenCalled();
      rerender(
        <Canvas
          canvases={[first]}
          annotations={[note]}
          selectedAnnotation="https://example.org/anno/1"
        />,
      );
      expect(renderer.setImages).toHaveBeenCalledTimes(1);
      expect(closeViewer()).toBeInTheDocument();
    });

    // Its annotations are to hand over the still: picking one opens it there.
    it("keeps the annotations menu over the still; a pick from it opens the Canvas and frames it once drawn", async () => {
      const note = {
        targetIndex: 0,
        annotation: {
          id: "https://example.org/anno/1",
          type: "Annotation",
          body: { type: "TextualBody", value: "A note" },
          target: `${first.id}#xywh=10,20,30,40`,
        } as any,
      };
      render(<Canvas canvases={[first]} annotations={[note]} />);
      await loaded();
      const control = screen.getByRole("button", { name: "Annotations" });
      expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
      fireEvent.click(control);
      fireEvent.click(screen.getByRole("radio", { name: "A note" }));
      // Opened, but nothing to frame until the Canvas draws.
      expect(renderer.setImages).toHaveBeenCalledTimes(1);
      expect(renderer.fitAnnotation).not.toHaveBeenCalled();
      await open();
      expect(renderer.fitAnnotation).toHaveBeenCalledTimes(1);
      expect(renderer.fitAnnotation).toHaveBeenLastCalledWith(
        expect.any(Object),
        true,
      );
      expect(screen.getByRole("button", { name: "A note" })).toHaveAttribute(
        "aria-current",
        "true",
      );
    });

    // Closed, nothing of the pick shows: it is let go, so picking it again reopens.
    it("lets go of the pick when the Canvas is closed back to its still", async () => {
      const onAnnotationSelect = vi.fn();
      const note = {
        targetIndex: 0,
        annotation: {
          id: "https://example.org/anno/1",
          type: "Annotation",
          body: { type: "TextualBody", value: "A note" },
          target: `${first.id}#xywh=10,20,30,40`,
        } as any,
      };
      render(
        <Canvas
          canvases={[first]}
          annotations={[note]}
          onAnnotationSelect={onAnnotationSelect}
        />,
      );
      await loaded();
      fireEvent.click(screen.getByRole("button", { name: "Annotations" }));
      fireEvent.click(screen.getByRole("radio", { name: "A note" }));
      await open();
      expect(onAnnotationSelect).toHaveBeenLastCalledWith(
        "https://example.org/anno/1",
      );
      fireEvent.click(closeViewer());
      expect(onAnnotationSelect).toHaveBeenLastCalledWith(null);
      expect(openViewer()).toBeInTheDocument();
    });

    it("opens the Canvas from the toggle, and goes back to the still", async () => {
      render(<Canvas canvases={[first]} />);
      fireEvent.click(openViewer());
      expect(renderer.setImages).toHaveBeenCalledTimes(1);
      // The still stays, inert, until the Canvas first draws.
      expect(screen.getByTestId("clover-canvas-placeholder")).toHaveAttribute(
        "data-lingering",
        "true",
      );
      await open();
      expect(screen.queryByTestId("clover-canvas-placeholder")).toBeNull();
      expect(screen.getByTestId("clover-canvas-controls")).toHaveAttribute(
        "data-has-placeholder",
        "true",
      );

      renderer.isOpen = true;
      fireEvent.click(closeViewer());
      expect(screen.getByTestId("clover-canvas-placeholder")).toBeVisible();
      expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();

      // Reopening frames the Canvas afresh.
      fireEvent.click(openViewer());
      expect(renderer.setImages.mock.lastCall[1].fit).toBe(true);
    });

    it("opens straight away when told to skip the placeholder", () => {
      render(<Canvas canvases={[first]} placeholder={false} />);
      expect(screen.queryByTestId("clover-canvas-placeholder")).toBeNull();
      expect(renderer.setImages).toHaveBeenCalledTimes(1);
    });

    it("opens from a click on the still", async () => {
      render(<Canvas canvases={[first]} />);
      fireEvent.click(
        within(screen.getByTestId("clover-canvas-placeholder")).getByRole(
          "img",
          { name: "Blank page" },
        ),
      );
      await open();
      expect(screen.queryByTestId("clover-canvas-placeholder")).toBeNull();
      expect(closeViewer()).toBeInTheDocument();
    });

    it("fits a spread's stills together", () => {
      render(<Canvas canvases={[first, second]} />);
      const stills = within(
        screen.getByTestId("clover-canvas-placeholder"),
      ).getAllByRole("img");
      expect(stills.map((still) => still.style.width)).toEqual(["50%", "50%"]);
    });

    it("keeps the reader's choice, open or closed, from view to view", async () => {
      const { rerender } = render(<Canvas canvases={[first]} />);
      fireEvent.click(openViewer());
      await open();

      // The next page opens too, its still in view (inert) until it draws.
      rerender(<Canvas canvases={[second]} />);
      expect(screen.getByTestId("clover-canvas-placeholder")).toHaveAttribute(
        "data-lingering",
        "true",
      );
      expect(renderer.setImages.mock.lastCall[0][0].url).not.toMatch(/still/);
      await open();
      expect(screen.queryByTestId("clover-canvas-placeholder")).toBeNull();

      renderer.isOpen = true;
      fireEvent.click(closeViewer());
      rerender(<Canvas canvases={[first]} />);
      expect(screen.getByTestId("clover-canvas")).toHaveAttribute(
        "data-placeholder",
        "true",
      );
      expect(openViewer()).toBeInTheDocument();
    });

    it("starts each video at its poster, though images were opened", () => {
      const [video] = placeholderVideo.items as any[];
      const { rerender } = render(<Canvas canvases={[first]} />);
      fireEvent.click(openViewer());
      rerender(<Canvas canvases={[video]} />);
      expect(screen.getByTestId("clover-canvas")).toHaveAttribute(
        "data-placeholder",
        "true",
      );
      expect(screen.queryByTestId("clover-canvas-media")).toBeNull();
    });

    it("holds back video until opened, keeping the information control", async () => {
      const [video] = placeholderVideo.items as any[];
      render(
        <Canvas canvases={[{ ...video, summary: { en: ["An opera"] } }]} />,
      );
      expect(screen.getByTestId("clover-canvas-placeholder")).toBeVisible();
      expect(screen.queryByTestId("clover-canvas-media")).toBeNull();
      // Information is not held back.
      fireEvent.click(screen.getByRole("button", { name: "About" }));
      expect(screen.getByTestId("clover-canvas-caption")).toHaveAttribute(
        "data-open",
        "true",
      );

      // A play button in the middle, as a video player has; opening plays.
      const play = vi
        .spyOn(HTMLMediaElement.prototype, "play")
        .mockResolvedValue(undefined);
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      expect(
        await screen.findByTestId("clover-canvas-media", {}, { timeout: 5000 }),
      ).toBeInTheDocument();
      // Playback starts in an effect once the element exists, which can trail the Body.
      await vi.waitFor(() => expect(play).toHaveBeenCalled());
      // The toggle is the close control in the top right now, named for the player.
      const close = screen.getByRole("button", { name: "Close player" });
      expect(close).toHaveAttribute("data-button", "placeholder");
      expect(close.querySelector(".clover-tip")).toHaveTextContent(
        "Close player",
      );
      play.mockRestore();
    });

    it("holds back Choice and the hotspots, not the annotations menu", async () => {
      const [canvas] = choice.items as any[];
      render(
        <Canvas
          canvases={[withPlaceholder(canvas)]}
          annotations={[
            {
              targetIndex: 0,
              annotation: {
                id: "https://example.org/anno/1",
                type: "Annotation",
                motivation: "commenting",
                body: [{ type: "TextualBody", value: "A note" }],
                target: `${canvas.id}#xywh=0,0,10,10`,
              },
            } as any,
          ]}
        />,
      );
      await open();
      expect(screen.queryByRole("button", { name: "Choice" })).toBeNull();
      // The menu is to hand; a pick from it opens the Canvas (tested above).
      expect(screen.getByRole("button", { name: "Annotations" })).toBeVisible();
      expect(screen.queryByRole("button", { name: "A note" })).toBeNull();

      fireEvent.click(openViewer());
      await open();
      expect(screen.getByRole("button", { name: "Choice" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Annotations" })).toBeVisible();
    });
  });

  describe("information", () => {
    const [natural, xray] = metadataAnywhere.items as any[];
    const about = () => screen.getByRole("button", { name: "About" });
    const caption = () => screen.getByTestId("clover-canvas-caption");

    it("offers an information control only when a Canvas has a summary or metadata", () => {
      const { rerender } = render(
        <Canvas canvases={book.items.slice(0, 1) as any} />,
      );
      expect(screen.queryByRole("button", { name: "About" })).toBeNull();
      expect(screen.queryByTestId("clover-canvas-caption")).toBeNull();

      rerender(<Canvas canvases={[natural]} />);
      expect(about()).toHaveAttribute("data-button", "information");
      expect(about()).toHaveAttribute("aria-expanded", "false");
      expect(about()).toHaveAttribute("aria-controls", caption().id);
      expect(caption().tagName).toBe("FIGCAPTION");
      expect(caption()).toHaveAttribute("data-open", "false");

      rerender(
        <Canvas
          canvases={[
            { ...natural, metadata: undefined, summary: { en: ["A note"] } },
          ]}
        />,
      );
      expect(about()).toBeInTheDocument();
    });

    it("is hidden when turned off", () => {
      render(<Canvas canvases={[natural]} controls={{ information: false }} />);
      expect(screen.queryByRole("button", { name: "About" })).toBeNull();
      expect(screen.queryByTestId("clover-canvas-caption")).toBeNull();
    });

    it("slides out the Canvas's label and metadata, naming the figure", async () => {
      render(<Canvas canvases={[natural]} />);
      expect(
        screen.getByRole("figure", { name: "Painting under natural light" }),
      ).toBe(screen.getByTestId("clover-canvas"));

      fireEvent.click(about());
      expect(about()).toHaveAttribute("aria-expanded", "true");
      expect(caption()).toHaveAttribute("data-open", "true");
      expect(caption()).toHaveFocus();
      expect(await screen.findByText("Description")).toBeInTheDocument();
      expect(screen.getByText(/house at Mortlake/)).toBeInTheDocument();

      fireEvent.click(about());
      expect(caption()).toHaveAttribute("data-open", "false");
    });

    it("captions each Canvas of a spread", async () => {
      render(<Canvas canvases={[natural, xray]} />);
      fireEvent.click(about());
      expect(
        screen.getByText("Painting under natural light"),
      ).toBeInTheDocument();
      expect(screen.getByText("X-ray view of painting")).toBeInTheDocument();
      expect(await screen.findAllByText("Description")).toHaveLength(2);
    });

    it("closes from its close button or Escape, returning focus to the control", () => {
      render(<Canvas canvases={[natural]} />);
      fireEvent.click(about());
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(caption()).toHaveAttribute("data-open", "false");
      expect(about()).toHaveFocus();

      fireEvent.click(about());
      // Prevented: a modal `<dialog>` around it stays open.
      expect(fireEvent.keyDown(caption(), { key: "Escape" })).toBe(false);
      expect(caption()).toHaveAttribute("data-open", "false");
      expect(about()).toHaveFocus();
    });

    // WCAG 2.4.11: what it covers, a hotspot say, comes back without moving focus.
    it("closes on an Escape anywhere in the figure, leaving focus where it is", () => {
      render(<Canvas canvases={[natural]} />);
      fireEvent.click(about());
      const viewport = screen.getByTestId("clover-canvas-viewport");
      viewport.focus();
      // Prevented: a modal `<dialog>` around it stays open.
      expect(fireEvent.keyDown(viewport, { key: "Escape" })).toBe(false);
      expect(caption()).toHaveAttribute("data-open", "false");
      expect(viewport).toHaveFocus();
      // Closed, the next Escape is left to what is around the figure.
      expect(fireEvent.keyDown(viewport, { key: "Escape" })).toBe(true);
    });
  });

  describe("controls that come and go", () => {
    afterEach(() => vi.useRealTimers());

    it("show on pointer activity and fade after the hide delay", () => {
      vi.useFakeTimers();
      render(<Canvas src="a.jpg" options={{ hideDelay: 500 }} />);
      const canvas = screen.getByTestId("clover-canvas");
      expect(canvas).toHaveAttribute("data-controls", "hidden");

      fireEvent.pointerMove(canvas);
      expect(canvas).toHaveAttribute("data-controls", "visible");
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(canvas).toHaveAttribute("data-controls", "hidden");
    });

    it("hide a second after a mouse leaves", () => {
      vi.useFakeTimers();
      render(<Canvas src="a.jpg" />);
      const canvas = screen.getByTestId("clover-canvas");
      fireEvent.pointerMove(canvas);
      fireEvent.pointerLeave(canvas, { pointerType: "mouse" });
      expect(canvas).toHaveAttribute("data-controls", "visible");
      act(() => void vi.advanceTimersByTime(1000));
      expect(canvas).toHaveAttribute("data-controls", "hidden");
      vi.useRealTimers();
    });

    it("show under a finger on a tap on the picture, and hide on the next, never on a timer", () => {
      vi.useFakeTimers();
      render(<Canvas src="a.jpg" options={{ hideDelay: 500 }} />);
      const canvas = screen.getByTestId("clover-canvas");
      const picture = screen.getByTestId("clover-canvas-viewport");
      const tap = () =>
        ["pointerdown", "pointerup"].forEach((type) =>
          act(
            () =>
              void picture.dispatchEvent(
                Object.assign(
                  new MouseEvent(type, { clientX: 5, bubbles: true }),
                  { pointerId: 1, pointerType: "touch", isPrimary: true },
                ),
              ),
          ),
        );

      tap();
      act(() => void vi.advanceTimersByTime(300));
      expect(canvas).toHaveAttribute("data-controls", "visible");
      act(() => void vi.advanceTimersByTime(60_000));
      expect(canvas).toHaveAttribute("data-controls", "visible");
      tap();
      act(() => void vi.advanceTimersByTime(300));
      expect(canvas).toHaveAttribute("data-controls", "hidden");
    });
  });
});
