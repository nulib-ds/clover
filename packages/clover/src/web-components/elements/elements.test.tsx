/*
 * Clover's elements under Preact, as they ship (`vitest.preact.config.mjs`): what phase
 * 1 of WEB-COMPONENTS.md must prove of one host tree for the page. Upgrade order and
 * properties set early are in `upgrade.test.tsx`, which needs a page of its own.
 */
import { fireEvent, waitFor, within } from "@testing-library/dom";

import { defineElement } from "../base";
import { defineCloverElements } from "../define";
import type { HostedProps } from "../host";
import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import tocJson from "../../fixtures/iiif-cookbook/0024-book-4-toc.json";
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
/** How many times each counting part has drawn. */
const draws = new Map<HTMLElement, number>();
/** What a lazy part was last given, and its loader. */
let lazyProps: Record<string, unknown> = {};
const loadLazy = vi.fn(
  async () =>
    function Lazy({ props }: HostedProps) {
      lazyProps = props;
      return <span>Loaded</span>;
    },
);
/** The event a picking part hands its callback, as a part hands its own event. */
const picked = { preventDefault: vi.fn() };
beforeAll(() => {
  defineCloverElements(ASSETS);
  // A part that counts its draws, to show the host re-renders only what changed.
  defineElement(
    {
      tag: "clover-test-count",
      kind: "part",
      attributes: { value: { prop: "value", type: "string" } },
    },
    async () =>
      function Counting({ hosted, props }: HostedProps) {
        draws.set(hosted.element, (draws.get(hosted.element) ?? 0) + 1);
        return <span>{String(props.value)}</span>;
      },
    ASSETS,
  );
  // A part loaded on demand, and one that answers its callback, to show what a spec gives.
  defineElement(
    {
      tag: "clover-test-lazy",
      kind: "part",
      attributes: {
        size: { prop: "size", type: "number", min: 2 },
        data: { prop: "data", type: "data" },
      },
    },
    loadLazy,
    ASSETS,
  );
  defineElement(
    {
      tag: "clover-test-pick",
      kind: "part",
      attributes: {},
      events: {
        "clover-test-pick": {
          prop: "onPick",
          detail: ["value"],
          cancelable: true,
        },
      },
    },
    async () =>
      function Picking({ props }: HostedProps) {
        const pick = props.onPick as (value: string, event: unknown) => void;
        return (
          <button type="button" onClick={() => pick("chosen", picked)}>
            Pick
          </button>
        );
      },
    ASSETS,
  );
  // A part that fails, to show one element's failure is its own.
  defineElement(
    { tag: "clover-test-broken", kind: "part", attributes: {} },
    async () =>
      function Broken(): React.ReactNode {
        throw new Error("Broken on purpose");
      },
    ASSETS,
  );
});
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  viewport = stubViewport();
});
afterEach(async () => {
  viewport.restore();
  document.body.innerHTML = "";
  document.documentElement.lang = "en";
  // Let the host see the elements go.
  await Promise.resolve();
});

type WithContent = HTMLElement & { iiifContent: unknown };

/** A `<clover-root>` holding `html`, its content set as a property, on the page. */
function root(html: string, content: unknown = bookJson, into = document.body) {
  const element = document.createElement("clover-root") as WithContent;
  element.innerHTML = html;
  element.iiifContent = content;
  into.append(element);
  return element;
}

const BOOK = "Simple Manifest - Book";
const TOC = "Ethiopic Ms 10";

describe("Clover's elements", () => {
  it("draws each part into its own element, and leaves the page's markup as written", async () => {
    const element = root(`
      <p class="intro">From the collection</p>
      <clover-label as="h2"></clover-label>
      <clover-body style="height: 300px"><span class="mine">Mine</span></clover-body>
      <clover-items></clover-items>
    `);
    const intro = element.querySelector(".intro")!;
    const mine = element.querySelector(".mine")!;
    const heading = await within(element).findByRole("heading", {
      level: 2,
      name: BOOK,
    });
    expect(heading.parentElement!.localName).toBe("clover-label");
    // The page's own nodes, the same nodes, where the page put them.
    expect(element.querySelector(".intro")).toBe(intro);
    expect(element.firstElementChild).toBe(intro);
    expect(element.querySelector("clover-body > .mine")).toBe(mine);
    // Each element draws as its own code arrives: the Body's comes with the Canvas.
    await waitFor(() =>
      expect(
        element.querySelector("clover-body > .clover-body"),
      ).not.toBeNull(),
    );
    // Its views: the book's five pages, the middle ones in spreads.
    expect(
      within(element.querySelector("clover-items")!).getAllByRole("option"),
    ).toHaveLength(3);
    // The element is the Root: its class and status, its live region last inside it.
    expect(element).toHaveClass("clover-root");
    await waitFor(() =>
      expect(element).toHaveAttribute("data-status", "ready"),
    );
    expect(element.lastElementChild).toHaveClass("clover-announcer");
  });

  it("gives every part its root's context: one place, shared", async () => {
    const element = root(`
      <clover-label of="canvas" as="p"></clover-label>
      <clover-body></clover-body>
      <clover-items></clover-items>
    `);
    const label = element.querySelector("clover-label")!;
    await waitFor(() => expect(label).toHaveTextContent("Blank page"));
    const second = within(element).getAllByRole("option")[1];
    fireEvent.click(second);
    // The label, in another portal, follows what the items chose.
    await waitFor(() => expect(label).toHaveTextContent("Frontispiece"));
    expect(second).toHaveAttribute("aria-selected", "true");
  });

  it("marks Clover's words where the page's language differs, read where each root is", async () => {
    document.documentElement.lang = "fr";
    const french = root(`<clover-items></clover-items>`);
    const english = root(`<clover-items></clover-items>`, tocJson);
    english.setAttribute("lang", "en");
    // Clover's words, not the IIIF labels, which carry their own language.
    const marked = (element: HTMLElement) =>
      element.querySelectorAll('[lang="en"]:not(.clover-items-label-text)')
        .length;
    await waitFor(() => expect(marked(french)).toBeGreaterThan(0));
    await within(english).findAllByRole("option");
    expect(marked(english)).toBe(0);
  });

  it("makes ids unique across two roots, each naming only its own", async () => {
    const one = root(
      `<clover-body></clover-body><clover-items></clover-items>`,
    );
    const two = root(
      `<clover-body></clover-body><clover-items></clover-items>`,
      tocJson,
    );
    await within(one).findAllByRole("option");
    await within(two).findAllByRole("option");
    await waitFor(() =>
      expect(document.querySelectorAll(".clover-canvas")).toHaveLength(2),
    );
    const ids = [...document.querySelectorAll("[id]")].map(({ id }) => id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    // Never Preact's ids alone, which a page's own Preact would make too.
    expect(ids.filter((id) => /^P\d/.test(id))).toEqual([]);
    for (const element of [one, two]) {
      const references = [
        ...element.querySelectorAll(
          "[aria-controls], [aria-labelledby], [aria-describedby], [aria-activedescendant], label[for]",
        ),
      ].flatMap((node) =>
        [
          "aria-controls",
          "aria-labelledby",
          "aria-describedby",
          "aria-activedescendant",
          "for",
        ]
          .flatMap((name) => node.getAttribute(name)?.split(/\s+/) ?? [])
          .filter(Boolean),
      );
      expect(references.length).toBeGreaterThan(0);
      for (const id of references) {
        expect(element.contains(document.getElementById(id))).toBe(true);
      }
    }
  });

  it("keeps a root's place when it moves, and a part moved to another root reads that one", async () => {
    const one = root(`
      <clover-label as="h2"></clover-label>
      <clover-label of="canvas" as="p"></clover-label>
      <clover-items></clover-items>
    `);
    const two = root(`<clover-label as="h2"></clover-label>`, tocJson);
    await within(one).findByRole("heading", { name: BOOK });
    await within(two).findByRole("heading", { name: TOC });
    fireEvent.click(within(one).getAllByRole("option")[2]);
    const place = one.querySelector('clover-label[of="canvas"]')!;
    const third = (bookJson as { items: { label: { en: string[] } }[] })
      .items[3].label.en[0];
    await waitFor(() => expect(place).toHaveTextContent(third));

    // The whole root, moved: nothing reloads, and the reader is where they were.
    const elsewhere = document.createElement("section");
    document.body.append(elsewhere);
    elsewhere.append(one);
    await Promise.resolve();
    expect(place).toHaveTextContent(third);
    expect(
      within(one).getByRole("heading", { name: BOOK }),
    ).toBeInTheDocument();

    // A part, moved into the other root: it reads that root now.
    two.append(place);
    await waitFor(() => expect(place).toHaveTextContent("f. 1r"));
    expect(one.querySelector('clover-label[of="canvas"]')).toBeNull();
  });

  it("draws a part alone where it needs no root, and a root's part nothing outside one", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    document.body.innerHTML = `
      <clover-label label="A label of my own" as="h3"></clover-label>
      <clover-body></clover-body>
    `;
    expect(
      await within(document.body).findByRole("heading", {
        level: 3,
        name: "A label of my own",
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("put it inside one"),
      ),
    );
    expect(document.querySelector("clover-body")!.childElementCount).toBe(0);
    warn.mockRestore();
  });

  it("keeps one element's failure its own", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const element = root(`
      <clover-test-broken></clover-test-broken>
      <clover-label as="h2"></clover-label>
    `);
    expect(
      await within(element).findByRole("heading", { name: BOOK }),
    ).toBeInTheDocument();
    expect(error).toHaveBeenCalledWith(
      "<clover-test-broken>:",
      expect.objectContaining({ message: "Broken on purpose" }),
    );
    error.mockRestore();
  });

  it("reads attributes as written, in any case, and warns of what it can't", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const element = root(`
      <clover-label as="H2"></clover-label>
      <clover-label as="script" class="unsafe"></clover-label>
      <clover-items layout="Grid"></clover-items>
    `);
    expect(
      await within(element).findByRole("heading", { level: 2, name: BOOK }),
    ).toBeInTheDocument();
    // Not any tag: `script` is refused, and the label is drawn as text.
    expect(
      element.querySelector("clover-label.unsafe > span"),
    ).toHaveTextContent(BOOK);
    expect(element.querySelector("script")).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('as="script"'));
    await waitFor(() =>
      expect(element.querySelector(".clover-items")).toHaveAttribute(
        "data-layout",
        "grid",
      ),
    );
    // Changed, an attribute is read again.
    element.querySelector("clover-items")!.setAttribute("layout", "list");
    await waitFor(() =>
      expect(element.querySelector(".clover-items")).toHaveAttribute(
        "data-layout",
        "list",
      ),
    );
    warn.mockRestore();
  });

  it("moves the reader when canvas-id changes, having opened where it said", async () => {
    const element = root(`
      <clover-label of="canvas" as="p"></clover-label>
      <clover-items></clover-items>
    `);
    const book = bookJson as { items: { id: string }[] };
    element.setAttribute("canvas-id", book.items[2].id);
    const place = element.querySelector("clover-label")!;
    await waitFor(() => expect(place).toHaveTextContent("Title page"));
    element.setAttribute("canvas-id", book.items[1].id);
    await waitFor(() => expect(place).toHaveTextContent("Frontispiece"));
  });

  it("re-renders only the element that changed, however many share the page's tree", async () => {
    const element = root(
      Array.from(
        { length: 6 },
        (_, index) =>
          `<clover-test-count value="${index}"></clover-test-count>`,
      ).join(""),
    );
    const counted = [
      ...element.querySelectorAll<HTMLElement>("clover-test-count"),
    ];
    await waitFor(() => expect(counted[5]).toHaveTextContent("5"));
    const before = counted.map((part) => draws.get(part));

    counted[2].setAttribute("value", "changed");
    await waitFor(() => expect(counted[2]).toHaveTextContent("changed"));
    // Another element joining the root, or another root on the page, draws no others.
    element.append(document.createElement("clover-test-count"));
    root(`<clover-label></clover-label>`, tocJson);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(counted.map((part) => draws.get(part))).toEqual(
      before.map((count, index) => (index === 2 ? count! + 1 : count)),
    );
  });

  it("loads an element's code the first time one connects, once for all of them", async () => {
    expect(loadLazy).not.toHaveBeenCalled();
    const made = [1, 2, 3].map(() =>
      document.createElement("clover-test-lazy"),
    );
    expect(loadLazy).not.toHaveBeenCalled();
    document.body.append(...made);
    await waitFor(() =>
      made.forEach((element) => expect(element).toHaveTextContent("Loaded")),
    );
    expect(loadLazy).toHaveBeenCalledTimes(1);
  });

  it("reads data as a URL or JSON, and a number with its least value", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const element = document.createElement("clover-test-lazy");
    element.setAttribute("data", '{"en": ["From JSON"]}');
    element.setAttribute("size", "3");
    document.body.append(element);
    await waitFor(() =>
      expect(lazyProps).toMatchObject({ data: { en: ["From JSON"] }, size: 3 }),
    );
    element.setAttribute("data", "https://example.org/manifest.json");
    element.setAttribute("size", "1");
    await waitFor(() =>
      expect(lazyProps.data).toBe("https://example.org/manifest.json"),
    );
    expect(lazyProps.size).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('size="1" is less than 2'),
    );
    element.setAttribute("data", '{"en": ');
    await waitFor(() => expect(lazyProps.data).toBeUndefined());
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("is not JSON"));
    warn.mockRestore();
  });

  it("sends a part's callbacks as events, bubbling, and cancelable where the part's are", async () => {
    const element = document.createElement("clover-test-pick");
    document.body.append(element);
    const heard = vi.fn((event: Event) => {
      expect(event.bubbles && event.composed && event.cancelable).toBe(true);
      event.preventDefault();
    });
    document.body.addEventListener("clover-test-pick", (event) => heard(event));
    fireEvent.click(await within(element).findByRole("button"));
    expect(heard).toHaveBeenCalledTimes(1);
    expect((heard.mock.calls[0][0] as CustomEvent).detail).toEqual({
      value: "chosen",
    });
    // Canceled by the page, it prevents the default of the part's own event.
    expect(picked.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("tells the page where its root's reader is, as events", async () => {
    const element = root(`<clover-items></clover-items>`);
    const statuses: string[] = [];
    const moved = vi.fn();
    element.addEventListener("clover-status-change", (event) =>
      statuses.push((event as CustomEvent).detail.status),
    );
    element.addEventListener("clover-canvas-change", (event) =>
      moved((event as CustomEvent).detail),
    );
    const options = await within(element).findAllByRole("option");
    await waitFor(() => expect(statuses).toContain("ready"));
    fireEvent.click(options[1]);
    const book = bookJson as { items: { id: string }[] };
    await waitFor(() =>
      expect(moved).toHaveBeenCalledWith({ canvasId: book.items[1].id }),
    );
  });

  it("never leaves lang=\"\" where Clover's words come to match the page's", async () => {
    document.documentElement.lang = "fr";
    const element = root(`<clover-items></clover-items>`);
    await waitFor(() =>
      expect(
        element.querySelectorAll('button[lang="en"]').length,
      ).toBeGreaterThan(0),
    );
    // Now Clover speaks the page's French: Preact would leave `lang=""` behind.
    await initCloverI18n({ lng: "fr" });
    await waitFor(() =>
      expect(element.querySelectorAll('button[lang="en"]')).toHaveLength(0),
    );
    await waitFor(() =>
      expect(element.querySelectorAll('[lang=""]')).toHaveLength(0),
    );
  });

  it("puts the elements' styles in the document once, however many there are", async () => {
    const one = root(
      `<clover-label></clover-label><clover-items></clover-items>`,
    );
    root(`<clover-label></clover-label>`, tocJson);
    await within(one).findAllByRole("option");
    expect(
      document.head.querySelectorAll('style[data-clover="elements"]'),
    ).toHaveLength(1);
    expect(
      document.head.querySelectorAll('style[data-clover="clover-1"]'),
    ).toHaveLength(1);
    const css = document.head.querySelector(
      'style[data-clover="elements"]',
    )!.textContent!;
    expect(css).toMatch(/^@layer clover\{/);
    // A label is no box of its own, and one the page hides stays hidden.
    expect(css).toMatch(
      /:is\(clover-label,[^)]*\):not\(\[hidden\]\)\{display:contents\}/,
    );
  });
});
