/*
 * The parts that read their root's state, as elements (phase 3 of WEB-COMPONENTS.md),
 * under Preact as they ship: each draws its part from the `<clover-root>` it is in, or
 * the value it is given; a part that needs a root draws nothing without one, and says so.
 */
import { fireEvent, waitFor, within } from "@testing-library/dom";

import { defineCloverElements } from "../define";
import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import renderingJson from "../../fixtures/iiif-cookbook/0046-rendering.json";
import shapeJson from "../../fixtures/iiif-cookbook/0261-non-rectangular-commenting.json";
import pagedJson from "../../fixtures/mocks/paged/manifest.json";
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

const ASSETS = { styles: [{ key: "clover-1", css: ".clover-root{}" }] };

let viewport: ReturnType<typeof stubViewport>;
beforeAll(() => defineCloverElements(ASSETS));
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  viewport = stubViewport();
});
afterEach(async () => {
  viewport.restore();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  await Promise.resolve();
});

type WithContent = HTMLElement & { iiifContent: unknown };

/** A `<clover-root>` holding `html`, its content set as a property, on the page. */
function root(html: string, content: unknown = pagedJson) {
  const element = document.createElement("clover-root") as WithContent;
  element.innerHTML = html;
  element.iiifContent = content;
  document.body.append(element);
  return element;
}

const paged = pagedJson as Record<string, any>;

describe("The parts that read a root's state, as elements", () => {
  it("draws each property of the root's Manifest", async () => {
    const element = root(`
      <clover-summary></clover-summary>
      <clover-metadata></clover-metadata>
      <clover-required-statement></clover-required-statement>
      <clover-rights></clover-rights>
      <clover-homepage></clover-homepage>
      <clover-see-also></clover-see-also>
      <clover-part-of></clover-part-of>
      <clover-id></clover-id>
      <clover-thumbnail alt=""></clover-thumbnail>
    `);
    const part = (tag: string) => element.querySelector(tag)!;
    await waitFor(() =>
      expect(part("clover-summary")).toHaveTextContent(
        "The White Sewing Machine Company",
      ),
    );
    await waitFor(() =>
      expect(part("clover-metadata").querySelector("dl")).not.toBeNull(),
    );
    expect(part("clover-metadata")).toHaveTextContent("Alternate Title");
    expect(part("clover-required-statement")).toHaveTextContent("Attribution");
    expect(
      within(part("clover-rights") as HTMLElement).getByRole("link"),
    ).toHaveAttribute("href", paged.rights);
    expect(
      within(part("clover-id") as HTMLElement).getByRole("link"),
    ).toHaveAttribute("href", paged.id);
    expect(
      within(part("clover-homepage") as HTMLElement).getByRole("link"),
    ).toHaveAttribute("href", paged.homepage[0].id);
    expect(
      within(part("clover-see-also") as HTMLElement).getAllByRole("link")
        .length,
    ).toBeGreaterThan(0);
    expect(
      within(part("clover-part-of") as HTMLElement).getAllByRole("link").length,
    ).toBeGreaterThan(0);
    await waitFor(() =>
      expect(part("clover-thumbnail").querySelector("img")).toHaveAttribute(
        "alt",
        "",
      ),
    );
  });

  it("lists the providers, and with a clover-logo in it, each one's logo alone", async () => {
    const element = root(`
      <clover-provider data-test="whole"></clover-provider>
      <clover-provider data-test="logos"><clover-logo></clover-logo></clover-provider>
      <clover-logo data-test="alone"></clover-logo>
    `);
    const part = (name: string) =>
      element.querySelector<HTMLElement>(`[data-test="${name}"]`)!;
    const [agent] = paged.provider;
    await waitFor(() =>
      expect(
        within(part("whole")).getByRole("link", {
          name: "Northwestern University Libraries",
        }),
      ).toHaveAttribute("href", agent.homepage[0].id),
    );
    await waitFor(() =>
      expect(
        within(part("logos")).getByRole("img", {
          name: "Northwestern University Libraries",
        }),
      ).toBeInTheDocument(),
    );
    // Its clover-logo is read, not drawn: one logo, the provider's, and no name beside it.
    expect(part("logos").querySelectorAll("img")).toHaveLength(1);
    expect(
      within(part("logos")).queryByText("Northwestern University Libraries"),
    ).toBeNull();
    await waitFor(() =>
      expect(
        within(part("alone")).getByRole("img", {
          name: "Northwestern University Libraries",
        }),
      ).toHaveAttribute("src", agent.logo[0].id),
    );
  });

  it("reads the Canvas in view with of=canvas, and shows a value given it, anywhere", async () => {
    const element = root(`
      <clover-label of="canvas" as="p"></clover-label>
      <clover-next></clover-next>
    `);
    const place = element.querySelector("clover-label")!;
    await waitFor(() => expect(place).toHaveTextContent("Front Cover"));
    fireEvent.click(
      await within(element).findByRole("button", { name: "Next" }),
    );
    await waitFor(() => expect(place).toHaveTextContent("Page 1"));

    // Alone, each shows what it is given: text, a URL, or JSON.
    document.body.insertAdjacentHTML(
      "beforeend",
      `<clover-summary value='{"en":["A summary of my own"]}'></clover-summary>
       <clover-rights value="https://creativecommons.org/licenses/by/4.0/"></clover-rights>
       <clover-value value="**Bold**, from Markdown" format="text/markdown"></clover-value>`,
    );
    await waitFor(() =>
      expect(document.querySelector("clover-summary")).toHaveTextContent(
        "A summary of my own",
      ),
    );
    await waitFor(() =>
      expect(document.querySelector("clover-rights a")).toHaveAttribute(
        "href",
        "https://creativecommons.org/licenses/by/4.0/",
      ),
    );
    // Markdown's converter and the sanitizer load the first time they are needed.
    await waitFor(
      () =>
        expect(document.querySelector("clover-value b")).toHaveTextContent(
          "Bold",
        ),
      { timeout: 5000 },
    );
  });

  it("steps through the views with Previous, Next and Position", async () => {
    const element = root(
      `<clover-previous></clover-previous>
       <clover-position></clover-position>
       <clover-next></clover-next>`,
      bookJson,
    );
    const position = element.querySelector("clover-position")!;
    await waitFor(() => expect(position).toHaveTextContent(/1\D+3/));
    const previous = await within(element).findByRole("button", {
      name: "Previous",
    });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(within(element).getByRole("button", { name: "Next" }));
    await waitFor(() => expect(position).toHaveTextContent(/2\D+3/));
  });

  it("says what the root is doing, and lists the Manifest's sections", async () => {
    const element = root(`
      <clover-status></clover-status>
      <clover-contents></clover-contents>
      <clover-about heading-level="2"></clover-about>
    `);
    const status = element.querySelector("clover-status")!;
    await waitFor(() =>
      expect(status.querySelector('[role="status"]')).not.toBeNull(),
    );
    const contents = element.querySelector("clover-contents")!;
    await waitFor(() =>
      expect(
        within(contents as HTMLElement).getByRole("navigation"),
      ).toBeInTheDocument(),
    );
    expect(contents).toHaveTextContent("Introduction");
    const about = element.querySelector("clover-about")!;
    await waitFor(() =>
      expect(
        within(about as HTMLElement).getAllByRole("heading", { level: 2 })
          .length,
      ).toBeGreaterThan(0),
    );
  });

  it("lists the downloads, and the annotations", async () => {
    const downloads = root(
      `<clover-download heading-level="2"></clover-download>`,
      renderingJson,
    );
    await waitFor(() =>
      expect(
        within(downloads).getByRole("link", { name: /PDF/ }),
      ).toBeInTheDocument(),
    );
    const annotated = root(
      `<clover-annotations></clover-annotations>`,
      shapeJson,
    );
    await waitFor(() =>
      expect(annotated.querySelector("clover-annotations")).toHaveTextContent(
        "Gänseliesel-Brunnen",
      ),
    );
  });

  it("shows the Collection and its menu, and tells the page what was chosen", async () => {
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
    const element = root(
      `<clover-label as="h2"></clover-label>
       <clover-collection heading-level="3"></clover-collection>
       <clover-collection-select></clover-collection-select>`,
      shelf,
    );
    const chosen = vi.fn();
    element.addEventListener("clover-change", (event) =>
      chosen((event as CustomEvent).detail),
    );
    await waitFor(() =>
      expect(element.querySelector("clover-collection")).toHaveTextContent(
        "A letter",
      ),
    );
    const select = await within(element).findByRole("combobox");
    fireEvent.change(select, { target: { value: LETTER } });
    await waitFor(() =>
      expect(chosen).toHaveBeenCalledWith({ manifestId: LETTER }),
    );
    expect(
      await within(element).findByRole("heading", {
        level: 2,
        name: "A letter",
      }),
    ).toBeInTheDocument();
  });

  it("draws nothing of a root's part outside a root, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    document.body.innerHTML = `<clover-search></clover-search><clover-position></clover-position>`;
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "<clover-search> shows a <clover-root>'s state",
        ),
      ),
    );
    expect(document.querySelector("clover-search")!.childElementCount).toBe(0);
    expect(document.querySelector("clover-position")!.childElementCount).toBe(
      0,
    );
    warn.mockRestore();
  });

  it("warns of ARIA put on the element, which names a box no reader is told of", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    root(`<clover-contents aria-label="Chapters"></clover-contents>`);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "<clover-contents>: aria-label names the element",
      ),
    );
    warn.mockRestore();
  });
});
