import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";

import articlesJson from "../../fixtures/iiif-cookbook/0025-newspaper-article-index.json";
import stringFormats from "../../fixtures/iiif-cookbook/0007-string-formats.json";
import homepageJson from "../../fixtures/iiif-cookbook/0047-homepage.json";
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

  it("never put a value's own paragraph in a paragraph (Cookbook 0007)", async () => {
    const { container } = render(
      <Clover.Summary value={stringFormats.summary as any} />,
    );
    const link = await screen.findByRole("link", {
      name: "IIIF Technical Coordinator",
    });
    expect(link).toHaveAttribute("href", "https://github.com/glenrobson");
    // Its <p> in a <div>, never a <p> in a <p>.
    const summary = container.querySelector(".clover-summary")!;
    expect(summary.tagName).toBe("DIV");
    const own = [...summary.children].find((child) => child.tagName === "P");
    expect(own).toContainElement(link);
    expect(container.querySelector("p p")).toBeNull();
  });

  it("never put a value's own paragraph in a span or a heading either", async () => {
    const { container } = render(
      <>
        <Clover.Value value={{ none: ["<p>In a span</p>"] }} />
        <Clover.Summary as="h3" value={{ none: ["<p>In a heading</p>"] }} />
        <Clover.Value value={{ none: ["<b>Inline stays in a span</b>"] }} />
      </>,
    );
    await screen.findByText("In a span");
    expect(screen.getByText("In a span").parentElement!.tagName).toBe("DIV");
    expect(screen.getByText("In a heading").parentElement!.tagName).toBe("DIV");
    expect(
      screen.getByText("Inline stays in a span").parentElement!.tagName,
    ).toBe("SPAN");
    expect(container.querySelector(":is(span, h3, p) p")).toBeNull();
  });

  it("mark a homepage link's words by its label, and its page by its own language (Cookbook 0047)", () => {
    render(<Clover.Homepage value={homepageJson.homepage as any} />);
    const link = screen.getByRole("link", {
      name: "Home page at the Getty Museum Collection",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://www.getty.edu/art/collection/object/103RQQ",
    );
    // The words: the label's `en`. The page: the entry's `language`, ["en"].
    expect(link).toHaveAttribute("lang", "en");
    expect(link).toHaveAttribute("hreflang", "en");
    // A page away from the viewer: in a tab of its own, told nothing of this one.
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    // An entry that gives no language says nothing of its page.
    const { container } = render(
      <Clover.Homepage
        value={[{ id: "https://example.org/", type: "Text" }] as any}
      />,
    );
    expect(container.querySelector("a")).not.toHaveAttribute("hreflang");
  });

  it("open partOf's Collections and the resource's own id in a tab of their own", () => {
    render(
      <>
        <Clover.PartOf
          value={
            [
              {
                id: "https://example.org/collection.json",
                type: "Collection",
                label: { en: ["The collection"] },
              },
            ] as any
          }
        />
        <Clover.Id value="https://example.org/manifest.json" />
      </>,
    );
    for (const name of [
      "The collection",
      "https://example.org/manifest.json",
    ]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
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
  // Cookbook 0318: a Manifest's date for navigation, among what About says of it.
  it("gives the Manifest's navDate a section of its own, in the reader's language", async () => {
    await initCloverI18n({ lng: "fr" }).ready();
    render(
      <Clover.Root
        iiifContent={{ ...manifest, navDate: "1849-06-12T00:00:00Z" }}
      >
        <Clover.Panel />
      </Clover.Root>,
    );
    const date = await screen.findByRole("heading", { name: "Date" });
    // Written as it arrives: the dates' writing loads where there is a date.
    const time = await waitFor(() => {
      const found = date.parentElement!.querySelector("time");
      expect(found).toBeTruthy();
      return found!;
    });
    expect(time).toHaveTextContent("12 juin 1849");
    expect(time).toHaveAttribute("datetime", "1849-06-12");
  });

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
    // The downloads are behind About's Download button, not in what it says.
    expect(
      within(panel).queryByRole("link", { name: "PDF (application/pdf)" }),
    ).toBeNull();
    expect(
      within(panel).getByRole("button", { name: "Download" }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole("link", { name: "The letter's page" }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole("link", { name: manifest.id }),
    ).toBeInTheDocument();
  });

  /*
   * About's heading offers the downloads (Mat, 2026-10-28): a button that discloses the
   * page's and the Manifest's renderings as links, in named groups, the links next in the
   * tab order; Escape closes it and hands focus back.
   */
  it("lists the downloads from a Download button beside About's heading", async () => {
    render(
      <Clover.Root iiifContent={manifest}>
        <Clover.Panel layout="accordion" />
      </Clover.Root>,
    );
    const button = await screen.findByRole("button", { name: "Download" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    // Not in About's own section.
    expect(
      screen.queryByRole("heading", { name: "Download" }),
    ).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    // Its popover loads as it first opens.
    const popover = await waitFor(() => {
      const found = document.getElementById(
        button.getAttribute("aria-controls")!,
      );
      expect(found).not.toBeNull();
      return found!;
    });
    const link = within(popover).getByRole("link", {
      name: "PDF (application/pdf)",
    });
    expect(link).toHaveAttribute("href", "https://example.org/letter.pdf");
    expect(link.closest('[role="group"]')).toHaveAccessibleName(
      expect.stringMatching(/^(This page|All pages)$/),
    );
    // Groups, not headings, in a popover.
    expect(within(popover).queryByRole("heading")).toBeNull();
    link.focus();
    fireEvent.keyDown(link, { key: "Escape" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();

    // Focus moving on past it closes it, so it never covers where focus went (2.4.11).
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    act(() => screen.getByRole("link", { name: manifest.id }).focus());
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("leaves the Download button out with download={false}", async () => {
    render(
      <Clover.Root iiifContent={manifest}>
        <Clover.Panel layout="accordion" download={false} />
      </Clover.Root>,
    );
    await screen.findByRole("button", { name: "About" });
    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: "PDF (application/pdf)" }),
    ).toBeNull();
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

    // Docked beside the Body, it has no close button of its own: the toggle closes it.
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

/*
 * What the Manifest says of itself in several languages (Cookbook 0006): a row of their
 * codes picks the one About reads it in, beside its heading in an accordion.
 */
describe("The languages to read a resource in", () => {
  const bilingual = {
    ...manifest,
    label: { en: ["A letter"], fr: ["Une lettre"] },
    summary: { en: ["Written in 1849."], fr: ["Écrite en 1849."] },
    metadata: [
      { label: { en: ["Date"], fr: ["Date"] }, value: { none: ["1849"] } },
    ],
  };

  it("offers the languages, starting in the Root's, and reads the Root in the one chosen", async () => {
    render(
      <Clover.Root iiifContent={bilingual}>
        <Clover.Label as="h1" />
        <Clover.Panel />
      </Clover.Root>,
    );
    const panel = await screen.findByRole("tabpanel", { name: "About" });
    const row = await screen.findByRole("group", { name: "Language" });
    const english = within(row).getByRole("radio", { name: /English/ });
    const french = within(row).getByRole("radio", { name: /français/ });
    expect(english).toBeChecked();
    expect(within(panel).getByText("Written in 1849.")).toHaveAttribute(
      "lang",
      "en",
    );
    fireEvent.click(french);
    expect(french).toBeChecked();
    expect(await within(panel).findByText("Écrite en 1849.")).toHaveAttribute(
      "lang",
      "fr",
    );
    expect(
      within(panel).getByRole("heading", { name: "Une lettre" }),
    ).toBeInTheDocument();
    // The choice is the Root's: the title over it reads in French too.
    expect(
      await screen.findByRole("heading", { name: "Une lettre", level: 1 }),
    ).toHaveAttribute("lang", "fr");
  });

  it("lets the page's own language win again as it changes", async () => {
    const { rerender } = render(
      <Clover.Root iiifContent={bilingual} language="en">
        <Clover.Label as="h1" />
        <Clover.Panel />
      </Clover.Root>,
    );
    fireEvent.click(await screen.findByRole("radio", { name: /français/ }));
    expect(
      await screen.findByRole("heading", { name: "Une lettre", level: 1 }),
    ).toBeInTheDocument();
    rerender(
      <Clover.Root iiifContent={bilingual} language="fr">
        <Clover.Label as="h1" />
        <Clover.Panel />
      </Clover.Root>,
    );
    rerender(
      <Clover.Root iiifContent={bilingual} language="en">
        <Clover.Label as="h1" />
        <Clover.Panel />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("heading", { name: "A letter", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /English/ })).toBeChecked();
  });

  it("holds its row beside About's heading, shown whichever section is open", async () => {
    render(
      <Clover.Root iiifContent={bilingual} language="fr">
        <Clover.Panel layout="accordion">
          <Clover.Tab value="about" label="About">
            <Clover.About />
          </Clover.Tab>
          <Clover.Tab value="notes" label="Notes">
            <p>My notes</p>
          </Clover.Tab>
        </Clover.Panel>
      </Clover.Root>,
    );
    const row = await screen.findByRole("group", { name: "Language" });
    expect(row.closest(".clover-about")).toBeNull();
    expect(
      row.closest(".clover-sections-actions")?.parentElement,
    ).toHaveAttribute("data-value", "about");
    expect(screen.getAllByRole("group", { name: "Language" })).toHaveLength(1);
    // The languages furthest along the row, the Download button before them.
    expect(row.parentElement?.lastElementChild).toBe(row);
    expect(row.parentElement?.firstElementChild).toContainElement(
      screen.getByRole("button", { name: "Download" }),
    );
    expect(within(row).getByRole("radio", { name: /français/ })).toBeChecked();
    expect(await screen.findByText("Écrite en 1849.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Notes" }));
    expect(await screen.findByText("My notes")).toBeVisible();
    expect(screen.getByRole("group", { name: "Language" })).toBeVisible();
  });

  it("holds its row itself where About is alone", async () => {
    render(
      <Clover.Root iiifContent={bilingual}>
        <Clover.About />
      </Clover.Root>,
    );
    const row = await screen.findByRole("group", { name: "Language" });
    expect(row.closest(".clover-about")).not.toBeNull();
  });

  it("leaves the choice out with languages={false}, alone or in a Panel", async () => {
    const { unmount } = render(
      <Clover.Root iiifContent={bilingual}>
        <Clover.Panel layout="accordion" languages={false} />
      </Clover.Root>,
    );
    expect(await screen.findByText("Written in 1849.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Language" })).toBeNull();
    unmount();
    render(
      <Clover.Root iiifContent={bilingual}>
        <Clover.About languages={false} />
      </Clover.Root>,
    );
    expect(await screen.findByText("Written in 1849.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Language" })).toBeNull();
  });

  it("offers none where what it says is in one language", async () => {
    render(
      <Clover.Root
        iiifContent={{
          ...bilingual,
          label: { en: ["A letter"] },
          summary: undefined,
          metadata: [],
        }}
      >
        <Clover.Panel />
      </Clover.Root>,
    );
    await screen.findByRole("tabpanel", { name: "About" });
    expect(screen.queryByRole("group", { name: "Language" })).toBeNull();
  });
});

// Cookbook 0025: an article's column picked on the Canvas.
describe("A Range's region picked", () => {
  it("opens Contents, its article current there, and moves no focus", async () => {
    let clover: any;
    const Spy = () => {
      clover = Clover.useClover("Spy").clover;
      return null;
    };
    render(
      <Clover.Root iiifContent={articlesJson}>
        <Spy />
        <Clover.Panel layout="accordion" />
      </Clover.Root>,
    );
    const about = await screen.findByRole("button", { name: "About" });
    expect(about).toHaveAttribute("aria-expanded", "true");
    await vi.waitFor(() => expect(clover.store.get().regions).not.toBeNull());
    const region = clover.store
      .get()
      .regions.entries.find((entry: any) => entry.place?.index === 2);
    const before = document.activeElement;
    act(() => clover.selectAnnotation(region.id));
    expect(
      await screen.findByRole("button", { name: "Contents" }),
    ).toHaveAttribute("aria-expanded", "true");
    const nav = await screen.findByRole("navigation", { name: "Contents" });
    expect(
      within(nav).getByRole("button", { name: "Tagesneuigkeiten" }),
    ).toHaveAttribute("aria-current", "true");
    expect(nav.querySelector(".clover-steps-position")).toHaveTextContent(
      "2 / 4",
    );
    expect(document.activeElement).toBe(before);
  });
});
