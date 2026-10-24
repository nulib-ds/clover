import { render, screen, within } from "@testing-library/react";
import React from "react";

import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";

const library = {
  id: "https://example.org/about",
  type: "Agent",
  label: { fr: ["Bibliothèque d'exemple"] },
  homepage: [
    {
      id: "https://example.org/",
      type: "Text",
      label: { en: ["Example Library's homepage"] },
      format: "text/html",
    },
  ],
  logo: [
    {
      id: "https://example.org/logo.png",
      type: "Image",
      format: "image/png",
      width: 240,
      height: 60,
    },
  ],
};

const unnamed = {
  id: "https://example.org/press",
  type: "Agent",
  homepage: [
    {
      id: "https://example.org/press/",
      type: "Text",
      label: { en: ["The press"] },
    },
  ],
  logo: [{ id: "https://example.org/press.png", type: "Image" }],
};

const manifest = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.org/manifest",
  type: "Manifest",
  label: { en: ["A letter"] },
  provider: [library],
  items: [
    {
      id: "https://example.org/canvas/1",
      type: "Canvas",
      width: 100,
      height: 100,
      items: [],
    },
  ],
};

beforeEach(() => initCloverI18n({ lng: "en" }));

describe("Provider", () => {
  it("lists each provider: its logo and its name, linked to its homepage", () => {
    render(<Clover.Provider value={[library]} />);
    const link = screen.getByRole("link", { name: "Bibliothèque d'exemple" });
    expect(link).toHaveAttribute("href", "https://example.org/");
    // Its name is written beside it, so the logo is drawn only.
    const logo = within(link).getByRole("presentation");
    expect(logo).toHaveAttribute("src", "https://example.org/logo.png");
    expect(logo).toHaveAttribute("alt", "");
    expect(within(link).getByText("Bibliothèque d'exemple")).toHaveAttribute(
      "lang",
      "fr",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("names a provider with no name of its own by its homepage", () => {
    render(<Clover.Provider value={unnamed} />);
    expect(screen.getByRole("link", { name: "The press" })).toHaveAttribute(
      "href",
      "https://example.org/press/",
    );
  });

  it("draws what it holds once for each provider: a logo alone, named", () => {
    render(
      <Clover.Provider value={[library, unnamed]}>
        <Clover.Logo />
      </Clover.Provider>,
    );
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://example.org/",
      "https://example.org/press/",
    ]);
    expect(
      screen.getByRole("img", { name: "Bibliothèque d'exemple" }),
    ).toHaveAttribute("lang", "fr");
    expect(screen.getByRole("img", { name: "The press" })).toBeInTheDocument();
    expect(screen.queryByText("Bibliothèque d'exemple")).toBeNull();
  });

  it("has Label and the link parts read the provider inside it", () => {
    render(
      <Clover.Provider value={library} link={false}>
        <Clover.Label />
        <Clover.Homepage />
      </Clover.Provider>,
    );
    expect(screen.getByText("Bibliothèque d'exemple")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Example Library's homepage" }),
    ).toHaveAttribute("href", "https://example.org/");
  });

  it("reads the Root's Manifest, and shows in About", async () => {
    render(
      <Clover.Root iiifContent={manifest}>
        <Clover.Panel />
      </Clover.Root>,
    );
    const panel = await screen.findByRole("tabpanel", { name: "About" });
    expect(
      await within(panel).findByRole("heading", { name: "Provider" }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole("link", { name: "Bibliothèque d'exemple" }),
    ).toHaveAttribute("href", "https://example.org/");
  });

  it("renders nothing without a provider", () => {
    const { container } = render(<Clover.Provider value={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Logo", () => {
  it("shows each provider's first logo, named by the provider", () => {
    render(<Clover.Logo value={[library, unnamed]} />);
    const logos = screen.getAllByRole("img");
    expect(logos.map((logo) => logo.getAttribute("alt"))).toEqual([
      "Bibliothèque d'exemple",
      "The press",
    ]);
    expect(logos[0]).toHaveAttribute("width", "240");
    expect(logos[0]).toHaveAttribute("height", "60");
  });

  it("names a bare image by Clover's word, unless given its own", () => {
    const { rerender } = render(
      <Clover.Logo value={{ id: "https://example.org/mark.svg" }} />,
    );
    expect(screen.getByRole("img", { name: "Logo" })).toBeInTheDocument();
    rerender(
      <Clover.Logo value={{ id: "https://example.org/mark.svg" }} alt="Mark" />,
    );
    expect(screen.getByRole("img", { name: "Mark" })).not.toHaveAttribute(
      "lang",
    );
  });

  it("reads the Root's providers", async () => {
    render(
      <Clover.Root iiifContent={manifest}>
        <Clover.Logo />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("img", { name: "Bibliothèque d'exemple" }),
    ).toHaveAttribute("src", "https://example.org/logo.png");
  });
});
