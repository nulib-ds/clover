import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";

import Canvas from ".";
import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import metadataAnywhereJson from "../../fixtures/iiif-cookbook/0029-metadata-anywhere.json";
import choiceJson from "../../fixtures/iiif-cookbook/0033-choice.json";
import { p4 } from "../../fixtures/presentation4";
import { initCloverI18n } from "../../i18n";
import { Root } from "../Root/Root";
import { stubViewport } from "./testing/viewport";

/*
 * The Canvas reads IIIF text in the Root's language, or the one it is given, and marks
 * each piece with the language it is in (WCAG 3.1.2).
 */
const listeners: Record<string, (detail?: unknown) => void> = {};
let renderer: Record<string, any>;

vi.mock("../../lib/renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/renderer")>()),
  CanvasRenderer: vi.fn().mockImplementation(() => renderer),
}));

let viewport: ReturnType<typeof stubViewport>;
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  viewport = stubViewport();
  const overlays = document.createElement("div");
  document.body.appendChild(overlays);
  renderer = {
    host: document.createElement("div"),
    setImages: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
    setGestures: vi.fn(),
    setDismiss: vi.fn(),
    dispose: vi.fn(),
    isOpen: false,
    backendKind: "webgl2",
    getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    zoomBy: vi.fn(),
    rotateBy: vi.fn(),
    home: vi.fn(),
    invalidate: vi.fn(),
    fitItemRect: vi.fn(),
    fitAnnotation: vi.fn(),
    attachNavigator: vi.fn(() => vi.fn()),
    itemRectToWorld: vi.fn((_: number, rect: any) => rect),
    overlays: { container: overlays, add: vi.fn(() => vi.fn()) },
    on: (event: string, listener: (detail?: unknown) => void) => {
      listeners[event] = listener;
      return () => delete listeners[event];
    },
  };
});
afterEach(() => {
  viewport.restore();
  document.documentElement.lang = "";
  document.body.innerHTML = "";
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
const nameOf = (element: HTMLElement) =>
  document.getElementById(element.getAttribute("aria-labelledby") ?? "");

/** A copy of `value` with `edit` applied to every object in it. */
function edited<T>(value: T, edit: (node: Record<string, any>) => void): T {
  const copy = JSON.parse(JSON.stringify(value));
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    edit(node as Record<string, any>);
    Object.values(node).forEach(walk);
  };
  walk(copy);
  return copy;
}

describe("the Canvas's languages", () => {
  it("names the viewport in its label's language, by a hidden element apart from the hotspots", () => {
    render(<Canvas src="a.jpg" label={{ fr: ["Une carte"] }} />);
    const viewportElement = screen.getByRole("img", { name: "Une carte" });
    expect(viewportElement).not.toHaveAttribute("lang");
    expect(nameOf(viewportElement)).toHaveAttribute("lang", "fr");
  });

  it("names it plainly in the interface's language", () => {
    render(<Canvas src="a.jpg" label={{ en: ["A map"] }} />);
    const viewportElement = screen.getByRole("img", { name: "A map" });
    expect(viewportElement).toHaveAttribute("aria-label", "A map");
    expect(viewportElement).not.toHaveAttribute("aria-labelledby");
  });

  it("reads a label in the language it is given", () => {
    render(
      <Canvas
        src="a.jpg"
        label={{ en: ["A map"], fr: ["Une carte"] }}
        language="fr"
      />,
    );
    expect(screen.getByRole("img", { name: "Une carte" })).toBeInTheDocument();
  });

  it("reads the Root's language inside a Root", async () => {
    const book = edited(bookJson, (node) => {
      if (node.label?.en?.[0] === "Blank page") {
        node.label = { en: ["Blank page"], fr: ["Page blanche"] };
      }
    });
    render(
      <Root iiifContent={book} language="fr">
        <Canvas />
      </Root>,
    );
    expect(
      await screen.findByRole("img", { name: "Page blanche" }),
    ).toBeInTheDocument();
  });

  it("marks the caption's label with its language", () => {
    const [natural] = p4(metadataAnywhereJson).items as any[];
    render(<Canvas canvases={[{ ...natural, label: { fr: ["Peinture"] } }]} />);
    fireEvent.click(screen.getByRole("button", { name: "About" }));
    const label = within(screen.getByTestId("clover-canvas-caption")).getByText(
      "Peinture",
    );
    expect(label).toHaveAttribute("lang", "fr");
    expect(
      screen.getByRole("figure", { name: "Peinture" }),
    ).toBeInTheDocument();
  });

  it("names a Choice, its legend and its items in their languages", async () => {
    const canvases = edited(p4(choiceJson).items, (node) => {
      if (node.type === "Choice") node.label = { de: ["Ansichten"] };
      if (node.label?.en?.[0] === "X-Ray") node.label = { fr: ["Rayons X"] };
    }) as any[];
    render(<Canvas canvases={canvases} />);
    await loaded();
    const control = screen.getByRole("button", { name: "Ansichten" });
    expect(control).toHaveAttribute("lang", "de");
    fireEvent.click(control);
    const menu = screen.getByTestId("clover-canvas-choice");
    expect(within(menu).getByText("Ansichten")).toHaveAttribute("lang", "de");
    expect(within(menu).getByText("Rayons X")).toHaveAttribute("lang", "fr");
    expect(within(menu).getByText("Natural Light")).toHaveAttribute(
      "lang",
      "en",
    );
  });

  it("gives a placeholder's still the language of its alt", () => {
    const [first] = edited(p4(bookJson).items as any[], (node) => {
      if (node.label?.en) node.label = { fr: ["Page blanche"] };
    });
    const canvas = {
      ...first,
      placeholderContainer: {
        id: `${first.id}/placeholder`,
        type: "Canvas",
        width: 400,
        height: 300,
        items: [
          {
            items: [
              {
                motivation: "painting",
                body: {
                  id: `${first.id}/still.jpg`,
                  type: "Image",
                  width: 400,
                  height: 300,
                },
                target: `${first.id}/placeholder`,
              },
            ],
          },
        ],
      },
    };
    render(<Canvas canvases={[canvas]} />);
    const still = within(
      screen.getByTestId("clover-canvas-placeholder"),
    ).getByRole("img", { name: "Page blanche" });
    expect(still).toHaveAttribute("lang", "fr");
  });

  it("names hotspots in their bodies' language, choosing the closest of several", async () => {
    const annotation = (id: string, body: unknown) => ({
      targetIndex: 0,
      annotation: {
        id,
        type: "Annotation",
        body,
        target: "https://example.org/canvas#xywh=10,20,30,40",
      } as any,
    });
    render(
      <Canvas
        src="a.jpg"
        language="de"
        annotations={[
          annotation("https://example.org/1", {
            type: "TextualBody",
            value: "Fontaine",
            language: "fr",
          }),
          annotation("https://example.org/2", [
            { type: "TextualBody", value: "Fountain", language: "en" },
            { type: "TextualBody", value: "Brunnen", language: "de" },
          ]),
        ]}
      />,
    );
    await open();
    expect(screen.getByRole("button", { name: "Fontaine" })).toHaveAttribute(
      "lang",
      "fr",
    );
    expect(screen.getByRole("button", { name: "Brunnen" })).toHaveAttribute(
      "lang",
      "de",
    );
    fireEvent.click(screen.getByRole("button", { name: "Annotations" }));
    const menu = screen.getByTestId("clover-canvas-annotation-menu");
    expect(within(menu).getByText("Fontaine")).toHaveAttribute("lang", "fr");
  });

  it("marks its own strings, standalone, where the page's language is not Clover's", async () => {
    document.documentElement.lang = "fr";
    render(
      <Canvas src="a.jpg" label="Une carte">
        <button type="button">Ma commande</button>
      </Canvas>,
    );
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    await waitFor(() => expect(zoomIn).toHaveAttribute("lang", "en"));
    // Not the figure: it holds the host's content too, in the page's language.
    expect(screen.getByTestId("clover-canvas")).not.toHaveAttribute("lang");
    expect(
      screen.getByRole("button", { name: "Ma commande" }).closest("[lang]"),
    ).toBe(document.documentElement);
    // A plain string is the host's, in the page's language too.
    const viewportElement = screen.getByRole("img", { name: "Une carte" });
    expect(viewportElement).toHaveAttribute("aria-label", "Une carte");
    expect(viewportElement.closest("[lang]")).toBe(document.documentElement);
  });

  it("says the viewport's keys in Clover's language, and keeps the role's own name where that is not the page's", async () => {
    document.documentElement.lang = "fr";
    render(<Canvas src="a.jpg" label="Une carte" />);
    const viewportElement = screen.getByRole("img", { name: "Une carte" });
    const keys = () =>
      document
        .getElementById(viewportElement.getAttribute("aria-describedby")!)!
        .querySelector("[lang]");
    await waitFor(() => expect(keys()).toHaveAttribute("lang", "en"));
    expect(keys()).toHaveTextContent(/arrow keys to pan/);
    // An attribute cannot carry a language: the role's own name is read instead.
    expect(viewportElement).not.toHaveAttribute("aria-roledescription");
  });

  it("marks them against the Root's reading inside one", async () => {
    document.documentElement.lang = "fr";
    const { container } = render(
      <Root iiifContent={bookJson}>
        <Canvas />
      </Root>,
    );
    await screen.findByRole("img", { name: "Blank page" });
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    await waitFor(() => expect(zoomIn).toHaveAttribute("lang", "en"));
    expect(container.querySelector(".clover-root")).not.toHaveAttribute("lang");
    expect(screen.getByTestId("clover-canvas")).not.toHaveAttribute("lang");
  });

  it("reads the caption's details, standalone, in its language, and keeps the page's for text in none", async () => {
    document.documentElement.lang = "fr";
    const [natural] = p4(metadataAnywhereJson).items as any[];
    const canvas = {
      ...natural,
      summary: { none: ["Huile sur toile"] },
      metadata: [
        {
          label: { en: ["Description"], fr: ["Description"] },
          value: { en: ["A painting"], fr: ["Une peinture"] },
        },
      ],
    };
    render(<Canvas canvases={[canvas]} language="fr" />);
    fireEvent.click(screen.getByRole("button", { name: "About" }));
    const caption = screen.getByTestId("clover-canvas-caption");
    const summary = await within(caption).findByText("Huile sur toile");
    expect(summary.closest("[lang]")).toBe(document.documentElement);
    expect(within(caption).getByText("Une peinture")).toHaveAttribute(
      "lang",
      "fr",
    );
  });
});
