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
import hotspotJson from "../../fixtures/iiif-cookbook/0022-linking-with-a-hotspot.json";
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
    setDismiss: vi.fn(),
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
  children: React.ReactNode = <Clover.Annotations scope="view" />,
) {
  render(
    <Clover.Root iiifContent={imageJson}>
      <Clover.Body />
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

  // Cookbook 0022: where a linking annotation leads, followed from the list too.
  it("follows a linking annotation to its Canvas, focus going to the Canvas", async () => {
    let clover: Clover.Clover | undefined;
    const Spy = () => {
      clover = Clover.useClover("Spy").clover;
      return null;
    };
    render(
      <Clover.Root iiifContent={hotspotJson}>
        <Clover.Body />
        <Clover.Annotations scope="view" />
        <Spy />
      </Clover.Root>,
    );
    await waitFor(() => expect(renderer.setImages).toHaveBeenCalled());
    emit("open");
    const follow = await screen.findByRole("button", {
      name: "Open the link",
    });
    fireEvent.click(follow);
    expect(clover!.store.get().canvasId).toBe(hotspotJson.items[1].id);
    expect(screen.getByTestId("clover-canvas-viewport")).toHaveFocus();
  });

  it("frames a picked annotation on the Canvas, and marks it picked", async () => {
    await renderWithStage();
    fireEvent.click(screen.getByRole("button", { name: /Find on the image/ }));
    expect(renderer.fitAnnotation).toHaveBeenCalledWith(
      {
        x: 138,
        y: 550,
        width: 1477,
        height: 1710,
      },
      true,
    );
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

  it("hides a set's annotations from the Canvas with its eye", async () => {
    await renderWithStage();
    expect(document.getElementById(annotationId)).not.toBeNull();
    // A checkbox drawn as an eye, its popover the one word.
    const hide = screen.getByRole("checkbox", { name: "Hide annotations" });
    expect(hide).not.toBeChecked();
    expect(hide.closest("label")).toHaveClass("clover-hide");
    expect(
      hide.closest("label")!.querySelector(".clover-tip"),
    ).toHaveTextContent("Hide");
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
        <Clover.Panel />
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
        <Clover.Annotations scope="view" />
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
        <Clover.Annotations scope="view" headingLevel={4} />
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
        <Clover.Annotations scope="view" headingLevel={4} />
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
          <Clover.Annotations scope="view" />
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
          <Clover.Annotations scope="view" />
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
          <Clover.Annotations scope="view" />
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
        <Clover.Body />
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

describe("Annotations, every Canvas's (scope all)", () => {
  const base = "https://example.org/all";
  const note = (canvas: number, id: string, value: string) => ({
    id: `${base}/annotation/${id}`,
    type: "Annotation",
    motivation: "commenting",
    body: { type: "TextualBody", value, format: "text/plain" },
    target: `${base}/canvas/${canvas}`,
  });
  const page = (
    canvas: number,
    id: string,
    items: unknown[],
    label?: string,
  ) => ({
    id: `${base}/page/${id}`,
    type: "AnnotationPage",
    ...(label ? { label: { en: [label] } } : {}),
    items,
  });
  // Three pages: tags on pages 1 and 3, one page each and unlabeled, as most Manifests
  // publish them; Comments on pages 2 and 3, page 3's only referenced.
  const manifest = {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: `${base}/manifest.json`,
    type: "Manifest",
    label: { en: ["Three pages"] },
    items: [1, 2, 3].map((n) => ({
      id: `${base}/canvas/${n}`,
      type: "Canvas",
      label: { en: [`Page ${n}`] },
      width: 100,
      height: 100,
      items: [],
      annotations: [
        ...(n !== 2
          ? [page(n, `tags-${n}`, [note(n, `tag-${n}`, `Tag ${n}`)])]
          : []),
        ...(n === 2
          ? [
              page(
                n,
                "comments-2",
                [note(n, "comment-2", "Comment 2")],
                "Comments",
              ),
            ]
          : []),
        ...(n === 3
          ? [{ id: `${base}/page/comments-3`, type: "AnnotationPage" }]
          : []),
      ],
    })),
  };
  const referenced = page(
    3,
    "comments-3",
    [note(3, "comment-3", "Comment 3")],
    "Comments",
  );

  let clover: any;
  function Spy() {
    clover = Clover.useClover().clover;
    return null;
  }

  it("lists them by layer, one hide toggle each, then by Canvas under its label, those in view current", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(referenced)));
    render(
      <Clover.Root iiifContent={manifest} request={{ fetch }}>
        <Spy />
        <Clover.Annotations scope="all" />
      </Clover.Root>,
    );
    // Every Canvas's pages are fetched for it: page 3's Comments, only referenced.
    await screen.findByText("Comment 3");
    expect(fetch).toHaveBeenCalledWith(
      `${base}/page/comments-3`,
      expect.anything(),
    );
    /*
     * Two layers: the unlabeled tags (two pages, one toggle), and the Comments, each
     * toggle named "Hide" and its layer's label, which follows it in the header.
     */
    const boxes = [
      screen.getByRole("checkbox", { name: "Hide annotations" }),
      screen.getByRole("checkbox", { name: "Hide Comments" }),
    ];
    expect(
      boxes[1].closest(".clover-annotations-set-header"),
    ).toHaveTextContent("Comments");
    const comments = screen.getByRole("region", { name: "Comments" });
    expect(
      within(comments)
        .getAllByRole("heading")
        .map((heading) => heading.textContent),
    ).toEqual(["Comments", "Page 2", "Page 3"]);
    // Page 1 is in view, so its group is current.
    const groups = () =>
      [...document.querySelectorAll(".clover-annotations-canvas")].map(
        (group) => [
          group.querySelector(".clover-annotations-canvas-label")?.textContent,
          group.getAttribute("aria-current"),
        ],
      );
    expect(groups()).toEqual([
      ["Page 1", "true"],
      ["Page 3", null],
      ["Page 2", null],
      ["Page 3", null],
    ]);
    act(() => clover.goTo(`${base}/canvas/3`));
    expect(groups()).toEqual([
      ["Page 1", null],
      ["Page 3", "true"],
      ["Page 2", null],
      ["Page 3", "true"],
    ]);

    // One toggle hides the whole layer, both of its pages.
    fireEvent.click(boxes[0]);
    expect(clover.store.get().hiddenSets).toEqual([
      `${base}/page/tags-1`,
      `${base}/page/tags-3`,
    ]);
    expect(boxes[0]).toBeChecked();
  });

  // What each marks, beside what it says: its region, cut small by the image server.
  it("shows each entry's region, cut small by its image's server", async () => {
    const service = "https://example.org/iiif/one";
    const pictured = {
      ...manifest,
      items: [
        {
          ...manifest.items[0],
          width: 100,
          height: 100,
          items: [
            {
              id: `${base}/canvas/1/page`,
              type: "AnnotationPage",
              items: [
                {
                  id: `${base}/canvas/1/paint`,
                  type: "Annotation",
                  motivation: "painting",
                  target: `${base}/canvas/1`,
                  body: {
                    id: `${service}/full/max/0/default.jpg`,
                    type: "Image",
                    width: 1000,
                    height: 1000,
                    service: [
                      { id: service, type: "ImageService3", profile: "level1" },
                    ],
                  },
                },
              ],
            },
          ],
          annotations: [
            page(1, "notes-1", [
              {
                ...note(1, "boxed", "Boxed"),
                target: `${base}/canvas/1#xywh=10,20,30,40`,
              },
            ]),
          ],
        },
      ],
    };
    const { container } = render(
      <Clover.Root iiifContent={pictured}>
        <Clover.Annotations scope="all" />
      </Clover.Root>,
    );
    await screen.findByText("Boxed");
    const picture = container.querySelector("img.clover-annotations-thumbnail");
    expect(picture).toHaveAttribute(
      "src",
      `${service}/100,200,300,400/!52,52/0/default.jpg`,
    );
    // Decorative: the entry's text names it.
    expect(picture).toHaveAttribute("alt", "");
  });

  it("lists a Manifest of one Canvas by layer alone, with no Canvas to name", async () => {
    const one = {
      ...manifest,
      items: [
        {
          ...manifest.items[0],
          annotations: [
            page(
              1,
              "comments-1",
              [note(1, "comment-1", "Comment 1")],
              "Comments",
            ),
          ],
        },
      ],
    };
    render(
      <Clover.Root iiifContent={one}>
        <Clover.Annotations scope="all" />
      </Clover.Root>,
    );
    const comments = await screen.findByRole("region", { name: "Comments" });
    expect(
      within(comments)
        .getAllByRole("heading")
        .map((heading) => heading.textContent),
    ).toEqual(["Comments"]);
    expect(comments).toHaveTextContent("Comment 1");
    expect(comments.querySelector("[aria-current]")).toBeNull();
  });

  it("joins the information panel listing every Canvas's, not only the view's", async () => {
    render(
      <Clover.Root
        iiifContent={manifest}
        request={{
          fetch: vi.fn(async () => new Response(JSON.stringify(referenced))),
        }}
      >
        <Clover.Panel />
      </Clover.Root>,
    );
    fireEvent.click(await screen.findByRole("tab", { name: "Annotations" }));
    const panel = screen.getByRole("tabpanel", { name: "Annotations" });
    await waitFor(() => expect(panel).toHaveTextContent("Comment 3"));
    expect(panel).toHaveTextContent("Tag 1");
    expect(panel).toHaveTextContent("Comment 2");
  });
});
