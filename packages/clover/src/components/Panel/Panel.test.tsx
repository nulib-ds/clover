import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";

import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";

const manifest = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.org/manifest",
  type: "Manifest",
  label: { en: ["A letter"], fr: ["Une lettre"] },
  summary: { en: ["<p>Written in <b>1849</b> &amp; posted.</p>"] },
  metadata: [
    { label: { en: ["Date"] }, value: { en: ["1849"] } },
    {
      label: { en: ["Note"] },
      value: { en: ['<a href="javascript:alert(1)">bad</a> <i>ok</i>'] },
    },
  ],
  requiredStatement: {
    label: { en: ["Attribution"] },
    value: { en: ["Example Library"] },
  },
  rights: "https://creativecommons.org/licenses/by/4.0/",
  homepage: [
    {
      id: "https://example.org/letter",
      type: "Text",
      label: { en: ["The letter's page"] },
      format: "text/html",
    },
  ],
  rendering: [
    {
      id: "https://example.org/letter.pdf",
      type: "Text",
      label: { en: ["PDF"] },
      format: "application/pdf",
    },
  ],
  items: [
    {
      id: "https://example.org/canvas/1",
      type: "Canvas",
      label: { en: ["Page one"] },
      summary: { en: ["The first page."] },
      width: 100,
      height: 100,
      items: [],
    },
  ],
};

beforeEach(() => initCloverI18n({ lng: "en" }));

describe("primitives", () => {
  it("read the Root's Manifest, in its language, marked with it", async () => {
    render(
      <Clover.Root iiifContent={manifest} language="fr">
        <Clover.Label as="h1" />
        <Clover.Summary of="canvas" />
      </Clover.Root>,
    );
    const heading = await screen.findByRole("heading", { name: "Une lettre" });
    expect(heading).toHaveAttribute("lang", "fr");
    expect(screen.getByText("The first page.")).toHaveAttribute("lang", "en");
  });

  it("take a value outside a Root", () => {
    render(
      <>
        <Clover.Label label={{ none: ["Standalone"] }} />
        <Clover.Rights value="https://example.org/rights" />
      </>,
    );
    expect(screen.getByText("Standalone")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://example.org/rights",
    );
  });

  it("show HTML as text at once, then as sanitized HTML", async () => {
    render(<Clover.Summary value={manifest.summary} />);
    // Plain text first: tags gone, entities decoded.
    expect(screen.getByText("Written in 1849 & posted.")).toBeInTheDocument();
    // Then the sanitizer arrives and the markup is kept.
    expect(await screen.findByText("1849")).toContainHTML("<b>1849</b>");
  });

  // Strictly by format: plain text is shown as written, its line breaks kept.
  it("show a value declared plain as written, markup and all, its lines kept", () => {
    const { container } = render(
      <Clover.Value
        value={{ none: ["hospital\n <em>Note</em>"] }}
        format="text/plain"
      />,
    );
    expect(container.querySelector("em")).toBeNull();
    expect(container).toHaveTextContent("hospital <em>Note</em>");
    expect(container.querySelectorAll("br")).toHaveLength(1);
  });

  it("show a value with no format as HTML only when it is IIIF's HTML", async () => {
    const { container } = render(
      <Clover.Value value={{ none: ["Written in <b>1849</b>."] }} />,
    );
    expect(container).toHaveTextContent("Written in <b>1849</b>.");
    expect(container.querySelector("b")).toBeNull();
  });

  it("strip a javascript: link from a metadata value", async () => {
    const { container } = render(<Clover.Metadata value={manifest.metadata} />);
    await screen.findByText("ok", { selector: "i" });
    expect(container.querySelector("a")).not.toHaveAttribute("href");
    expect(container.innerHTML).not.toMatch(/javascript/);
  });

  it("read a Markdown value's lists and headings, the first at headingLevel", async () => {
    render(
      <Clover.Value
        value={{ none: ["# Provenance\n\n- Bought 1902\n- Given 1950"] }}
        format="text/markdown"
        headingLevel={4}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "Provenance", level: 4 }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("render nothing without a value", () => {
    const { container } = render(
      <>
        <Clover.Summary />
        <Clover.Metadata />
        <Clover.Homepage />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Panel", () => {
  it("shows About by default: summary, metadata, statement, rights, links and id", async () => {
    render(
      <Clover.Root iiifContent={manifest}>
        <Clover.Panel />
      </Clover.Root>,
    );
    const panel = await screen.findByRole("tabpanel", { name: "About" });
    expect((await within(panel).findByText("Date")).tagName).toBe("DT");
    expect(within(panel).getByText("Example Library").tagName).toBe("DD");
    expect(
      within(panel).getByRole("heading", { name: "Rights" }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole("link", { name: "PDF (application/pdf)" }),
    ).toHaveAttribute("href", "https://example.org/letter.pdf");
    expect(
      within(panel).getByRole("link", { name: "The letter's page" }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole("link", { name: manifest.id }),
    ).toBeInTheDocument();
  });

  it("names its row of tabs as the panel, not an action", async () => {
    render(
      <Clover.Root iiifContent={manifest}>
        <Clover.Panel />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("tablist", { name: "Information panel" }),
    ).toBeInTheDocument();
  });

  it("names its landmark as the panel, unless the host names it or it is none", async () => {
    const { rerender } = render(
      <Clover.Root iiifContent={manifest}>
        <Clover.Panel />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("complementary", { name: "Information panel" }),
    ).toBeInTheDocument();
    rerender(
      <Clover.Root iiifContent={manifest}>
        <Clover.Panel aria-label="Notes and details" />
      </Clover.Root>,
    );
    expect(
      screen.getByRole("complementary", { name: "Notes and details" }),
    ).toBeInTheDocument();
    rerender(
      <Clover.Root iiifContent={manifest}>
        <Clover.Panel as="div" />
      </Clover.Root>,
    );
    expect(document.querySelector(".clover-panel")).not.toHaveAttribute(
      "aria-label",
    );
  });

  it("puts About's headings a level under its own in the accordion", async () => {
    render(
      <Clover.Root iiifContent={manifest}>
        <Clover.Panel layout="accordion" />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("heading", { name: "About", level: 3 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Rights", level: 4 }),
    ).toBeInTheDocument();
  });

  it("sets its headings from headingLevel, in either layout", async () => {
    const { unmount } = render(
      <Clover.Root iiifContent={manifest}>
        <Clover.Panel layout="accordion" headingLevel={5} />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("heading", { name: "About", level: 5 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Rights", level: 6 }),
    ).toBeInTheDocument();
    unmount();

    // Tabs are not headings: their content starts at the level.
    render(
      <Clover.Root iiifContent={manifest}>
        <Clover.Panel headingLevel={4} />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("heading", { name: "Rights", level: 4 }),
    ).toBeInTheDocument();
  });

  it("past h6 draws no heading: each title names what it heads", async () => {
    const { unmount } = render(
      <Clover.Root iiifContent={manifest}>
        <Clover.Panel layout="accordion" headingLevel={6} />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("heading", { name: "About", level: 6 }),
    ).toBeInTheDocument();
    // About's titles would be 7: each names its section instead.
    expect(
      await screen.findByRole("group", { name: "Rights" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Rights" }),
    ).not.toBeInTheDocument();
    unmount();
    // The accordion's own headings, past 6 too, leave each panel named by its button.
    render(
      <Clover.Root iiifContent={manifest}>
        <Clover.Panel layout="accordion" headingLevel={7} />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("region", { name: "About" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("takes tabs of your own, moved between with the arrow keys", async () => {
    render(
      <Clover.Root iiifContent={manifest}>
        <Clover.Panel>
          <Clover.Tab value="about" label="About">
            <Clover.About />
          </Clover.Tab>
          <Clover.Tab value="notes" label="Notes">
            <p>My notes</p>
          </Clover.Tab>
        </Clover.Panel>
      </Clover.Root>,
    );
    const about = await screen.findByRole("tab", { name: "About" });
    expect(about).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Notes" }).tabIndex).toBe(-1);
    about.focus();
    fireEvent.keyDown(about, { key: "ArrowRight" });
    const notes = screen.getByRole("tab", { name: "Notes" });
    expect(notes).toHaveFocus();
    expect(notes).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Notes" })).toHaveTextContent(
      "My notes",
    );
    fireEvent.keyDown(notes, { key: "ArrowRight" });
    expect(about).toHaveAttribute("aria-selected", "true");
  });

  it("offers the Collection a Manifest is part of, fetching it only when opened", async () => {
    const SHELF = "https://example.org/letters";
    const letter = {
      ...manifest,
      partOf: [{ id: SHELF, type: "Collection", label: { en: ["Letters"] } }],
    };
    const collection = {
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: SHELF,
      type: "Collection",
      label: { en: ["Letters"] },
      items: [
        { id: letter.id, type: "Manifest", label: letter.label },
        {
          id: "https://example.org/second",
          type: "Manifest",
          label: { en: ["A reply"] },
        },
      ],
    };
    const fetch = vi.fn(
      async (url: string) =>
        new Response(JSON.stringify(url === SHELF ? collection : {}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    render(
      <Clover.Root iiifContent={letter} request={{ fetch }}>
        <Clover.Panel />
      </Clover.Root>,
    );
    const tab = await screen.findByRole("tab", { name: "Collection" });
    // Offered, but nothing is fetched until the reader opens it.
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(tab);
    const panel = screen.getByRole("tabpanel", { name: "Collection" });
    // The section loads with the tab, its first opening.
    await waitFor(() => expect(panel).toHaveTextContent("Letters"));
    const members = await within(panel).findAllByRole("option");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(SHELF);
    expect(members).toHaveLength(2);
    expect(members[0]).toHaveAttribute("aria-selected", "true");
  });

  it("lists a Collection's members under About, and opens the one chosen", async () => {
    const second = {
      ...manifest,
      id: "https://example.org/second",
      label: { en: ["A reply"] },
    };
    const collection = {
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/letters",
      type: "Collection",
      label: { en: ["Letters"] },
      items: [
        { id: manifest.id, type: "Manifest", label: manifest.label },
        { id: second.id, type: "Manifest", label: second.label },
      ],
    };
    const fetch = vi.fn(
      async (url: string) =>
        new Response(JSON.stringify(url === second.id ? second : manifest), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    render(
      <Clover.Root iiifContent={collection} request={{ fetch }}>
        <Clover.Label as="h2" />
        <Clover.Panel />
      </Clover.Root>,
    );
    const tab = await screen.findByRole("tab", { name: "Collection" });
    // Second, after About.
    expect(screen.getAllByRole("tab").map((each) => each.textContent)).toEqual([
      "About",
      "Collection",
    ]);
    fireEvent.click(tab);
    const panel = screen.getByRole("tabpanel", { name: "Collection" });
    expect(panel).toHaveTextContent("Letters");
    const members = within(panel).getAllByRole("option");
    expect(members).toHaveLength(2);
    expect(members[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.click(members[1]);
    expect(
      await screen.findByRole("heading", { name: "A reply" }),
    ).toBeInTheDocument();
  });
});

describe("Panel closing", () => {
  function Host({ closeOnEscape = false }: { closeOnEscape?: boolean }) {
    const [open, setOpen] = React.useState(true);
    return (
      <Clover.Root iiifContent={manifest}>
        <button
          type="button"
          aria-controls="wrapper"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          Info
        </button>
        <div id="wrapper" hidden={!open}>
          <Clover.Panel
            onClose={() => setOpen(false)}
            closeOnEscape={closeOnEscape}
          />
        </div>
      </Clover.Root>
    );
  }

  it("has no close button unless it can be closed", async () => {
    render(
      <Clover.Root iiifContent={manifest}>
        <Clover.Panel />
      </Clover.Root>,
    );
    await screen.findByRole("tab", { name: "About" });
    expect(
      screen.queryByRole("button", { name: "Close information panel" }),
    ).toBeNull();
  });

  it("closes from its button, handing focus back to the control that opens it", async () => {
    render(<Host />);
    const close = await screen.findByRole("button", {
      name: "Close information panel",
    });
    close.focus();
    fireEvent.click(close);
    const control = screen.getByRole("button", { name: "Info" });
    expect(control).toHaveAttribute("aria-expanded", "false");
    expect(control).toHaveFocus();
    expect(document.getElementById("wrapper")).not.toBeVisible();
  });

  it("closes on Escape only when asked to, as a floating panel is", async () => {
    const { unmount } = render(<Host />);
    const tab = await screen.findByRole("tab", { name: "About" });
    fireEvent.keyDown(tab, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Info" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    unmount();

    render(<Host closeOnEscape />);
    const next = await screen.findByRole("tab", { name: "About" });
    next.focus();
    fireEvent.keyDown(next, { key: "Escape" });
    const control = screen.getByRole("button", { name: "Info" });
    expect(control).toHaveAttribute("aria-expanded", "false");
    expect(control).toHaveFocus();
  });
});

describe("Viewer panel", () => {
  it("toggles the panel from the spine while open, and from the Canvas's controls once closed", async () => {
    render(<Clover.Viewer iiifContent={manifest} items={false} />);
    const toggle = () =>
      screen.getByRole("button", { name: "More information" });
    await screen.findByRole("button", { name: "More information" });
    const panel = document.getElementById(
      toggle().getAttribute("aria-controls")!,
    )!;
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(toggle().closest(".clover-template-default-spine")).not.toBeNull();
    expect(panel).toBeVisible();
    toggle().focus();
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle().closest(".clover-canvas-controls")).not.toBeNull();
    // It moved, and focus with it.
    await waitFor(() => expect(toggle()).toHaveFocus());
    expect(panel).not.toBeVisible();

    // Docked beside the stage, it has no close button of its own: the toggle closes it.
    expect(
      within(panel).queryByRole("button", { name: "Close information panel" }),
    ).toBeNull();
  });
});

/*
 * A Canvas given as the content is shown on its own: About says what it says of itself,
 * what it is part of, and opens that Manifest in its place, focus kept where it was.
 */
describe("About, for a Canvas shown on its own", () => {
  const MANIFEST = "https://example.org/letter-manifest";
  const canvas = {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    ...manifest.items[0],
    partOf: [
      { id: MANIFEST, type: "Manifest", label: { en: ["The whole letter"] } },
    ],
  };
  it("says what it is part of, and opens it in place, focus kept", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ ...manifest, id: MANIFEST }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    render(
      <Clover.Root iiifContent={canvas} request={{ fetch }}>
        <Clover.Panel />
      </Clover.Root>,
    );
    const open = await screen.findByRole("button", {
      name: "Open the full Manifest",
    });
    expect(open).toHaveAccessibleDescription("The whole letter");
    expect(screen.getByText("The first page.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "IIIF Canvas" }),
    ).toBeInTheDocument();
    open.focus();
    fireEvent.click(open);
    await screen.findByRole("heading", { name: "IIIF Manifest" });
    expect(
      screen.queryByRole("button", { name: "Open the full Manifest" }),
    ).toBeNull();
    // Focus stays in the section it was in: About's own heading, or About itself.
    const about = document.querySelector(".clover-about")!;
    const heading = about
      .closest(".clover-sections-item")
      ?.querySelector(".clover-sections-button");
    expect(document.activeElement).toBe(heading ?? about);
  });
});
