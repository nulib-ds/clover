/*
 * Under Preact, as the element ships (`vitest.preact.config.mjs`), so with DOM Testing
 * Library: React Testing Library would bring React.
 */
import { fireEvent, waitFor, within } from "@testing-library/dom";

import { defineCloverElements } from "../define";
import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import renderingJson from "../../fixtures/iiif-cookbook/0046-rendering.json";
import { stubViewport } from "../../components/Canvas/testing/viewport";
import { initCloverI18n } from "../../i18n";

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
type CloverViewer = HTMLElement & { iiifContent: unknown };
/** Made, and given its content, before the element is defined: a script loaded late. */
let early: CloverViewer;
beforeAll(() => {
  early = document.createElement("clover-viewer") as CloverViewer;
  early.iiifContent = bookJson;
  defineCloverElements({});
});
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  viewport = stubViewport();
});
afterEach(() => {
  viewport.restore();
  document.body.innerHTML = "";
});

function mount(
  attributes: Record<string, string> = {},
  content: unknown = bookJson,
) {
  const element = document.createElement("clover-viewer") as CloverViewer;
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.iiifContent = content;
  document.body.append(element);
  return element;
}

/** Wait for the Viewer to draw its title. */
const drawn = (element: HTMLElement) =>
  within(element).findByRole("heading", {
    level: 2,
    name: "Simple Manifest - Book",
  });

describe("<clover-viewer>", () => {
  it("renders the Viewer in its light DOM, from a IIIF object set as a property", async () => {
    const element = mount();
    expect(
      await within(element).findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
    expect(element.shadowRoot).toBeNull();
    // The stylesheet is in the document once, however many elements there are.
    mount();
    expect(
      document.querySelectorAll('style[data-clover="elements"]'),
    ).toHaveLength(1);
  });

  it("loads each of Clover's sheets with the code that draws what it styles, in their order", async () => {
    const element = mount();
    await drawn(element);
    const sheets = () => [
      ...document.head.querySelectorAll<HTMLElement>(
        "style[data-clover-index]",
      ),
    ];
    const keys = sheets().map((style) => style.dataset.clover);
    // Every element's scale, a part's own sheet, and the runs the rest ride in.
    expect(keys).toEqual(
      expect.arrayContaining(["styles/scale", "components/Label/Label"]),
    );
    expect(keys.some((key) => key!.startsWith("styles-"))).toBe(true);
    // Nothing it does not draw: no map, no media, no other template.
    for (const absent of [
      "maplibre",
      "components/Map/Map",
      "components/Canvas/media/Transport",
      "templates/document/Document",
    ])
      expect(keys).not.toContain(absent);
    // In the stylesheet's order, after the elements' own.
    const indexes = sheets().map((style) => Number(style.dataset.cloverIndex));
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    expect(
      document.head
        .querySelector('style[data-clover="elements"]')!
        .compareDocumentPosition(sheets()[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Each once, however many viewers.
    await drawn(mount());
    expect(sheets()).toHaveLength(keys.length);
  });

  it("maps attributes to the Viewer's props, `false`, in any case, turning a part off", async () => {
    const element = mount({ panel: " FALSE ", items: "False" });
    await drawn(element);
    expect(within(element).queryByRole("tab", { name: "About" })).toBeNull();
    expect(element.querySelector(".clover-items")).toBeNull();
  });

  it("download=false leaves the downloads out of About", async () => {
    const shown = mount({}, renderingJson);
    expect(
      await within(shown).findByRole("heading", { name: "Download" }),
    ).toBeInTheDocument();
    shown.remove();

    const element = mount({ download: "false" }, renderingJson);
    await within(element).findByRole("heading", { name: "About" });
    expect(
      within(element).queryByRole("heading", { name: "Download" }),
    ).toBeNull();
    expect(within(element).queryByRole("link", { name: /PDF/ })).toBeNull();
  });

  it("takes items' layout in any case, and warns of one it doesn't know", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const listed = mount({ items: "List" });
    await drawn(listed);
    expect(listed.querySelector(".clover-items")).toHaveAttribute(
      "data-layout",
      "list",
    );
    expect(warn).not.toHaveBeenCalled();

    const element = mount({ items: "carousel" });
    await drawn(element);
    expect(element.querySelector(".clover-items")).toHaveAttribute(
      "data-layout",
      "slider",
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('items="carousel"'),
    );
    warn.mockRestore();
  });

  // As `defaultManifestId`, which lets the reader move on (`Root.test.tsx`).
  it("opens a Collection at manifest-id", async () => {
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
        { id: bookJson.id, type: "Manifest", label: { en: ["The book"] } },
        { id: LETTER, type: "Manifest", label: { en: ["A letter"] } },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string) =>
          new Response(JSON.stringify(url === LETTER ? letter : bookJson), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    const element = mount({ "manifest-id": LETTER }, shelf);
    expect(
      await within(element).findByRole("heading", {
        level: 2,
        name: "A letter",
      }),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("takes a property set before the element was defined", async () => {
    document.body.append(early); // upgraded as it connects
    expect(await drawn(early)).toBeInTheDocument();
    expect(Object.prototype.hasOwnProperty.call(early, "iiifContent")).toBe(
      false,
    );
    expect(early.iiifContent).toBe(bookJson);
  });

  it("gives two viewers on one page ids of their own, each naming its own", async () => {
    const one = mount();
    const two = mount();
    await drawn(one);
    await drawn(two);
    const ids = [...document.querySelectorAll("[id]")].map(({ id }) => id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const element of [one, two]) {
      const references = [
        ...element.querySelectorAll(
          "[aria-controls], [aria-labelledby], [aria-describedby], label[for]",
        ),
      ].flatMap((node) =>
        ["aria-controls", "aria-labelledby", "aria-describedby", "for"]
          .flatMap((name) => node.getAttribute(name)?.split(/\s+/) ?? [])
          .filter(Boolean),
      );
      expect(references.length).toBeGreaterThan(0);
      for (const id of references) {
        expect(element.contains(document.getElementById(id))).toBe(true);
      }
    }
  });

  it("header=false leaves out the title over the Body", async () => {
    const element = mount({ header: "false" });
    // The strip still draws, so the Manifest has loaded.
    await within(element).findByRole("button", { name: "Next" });
    expect(
      within(element).queryByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      }),
    ).toBeNull();
  });

  it("heading-level sets the title's level, and the panel's a level below", async () => {
    const element = mount({ "heading-level": "4" });
    expect(
      await within(element).findByRole("heading", {
        level: 4,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
    expect(
      within(element).getByRole("heading", { level: 5, name: "About" }),
    ).toBeInTheDocument();
  });

  it("with header=false, the panel's sections take heading-level themselves", async () => {
    const element = mount({ header: "false", "heading-level": "3" });
    expect(
      await within(element).findByRole("heading", { level: 3, name: "About" }),
    ).toBeInTheDocument();
  });

  it("tells the page where the reader moves, as events", async () => {
    const element = mount();
    const moved = vi.fn();
    element.addEventListener("clover-canvas-change", (event) =>
      moved((event as CustomEvent).detail),
    );
    fireEvent.click(
      await within(element).findByRole("button", { name: "Next" }),
    );
    await waitFor(() =>
      expect(moved).toHaveBeenCalledWith({ canvasId: bookJson.items[1].id }),
    );
  });

  it("lets a page without React set Clover's language, and marks it where the page's differs", async () => {
    document.documentElement.lang = "fr";
    const Element = customElements.get("clover-viewer") as unknown as {
      initCloverI18n: typeof initCloverI18n;
    };
    const element = mount();
    const next = await within(element).findByRole("button", { name: "Next" });
    await waitFor(() => expect(next).toHaveAttribute("lang", "en"));
    expect(element.querySelector(".clover-root")).not.toHaveAttribute("lang");

    Element.initCloverI18n({ lng: "fr" });
    // Not even `lang=""`, which says the language is unknown: Preact leaves it.
    const suivant = await within(element).findByRole("button", {
      name: "Suivant",
    });
    await waitFor(() => expect(suivant).not.toHaveAttribute("lang"));
    expect(element.querySelector('[lang=""]')).toBeNull();
    document.documentElement.lang = "";
  });

  it("tears down when removed, and not when moved", async () => {
    const element = mount();
    await drawn(element);
    const other = document.createElement("div");
    document.body.append(other);
    other.append(element); // a move: disconnected, then connected again at once
    await Promise.resolve();
    expect(
      within(element).getByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
    element.remove();
    await Promise.resolve();
    await waitFor(() => expect(element.childNodes).toHaveLength(0));
  });
});
