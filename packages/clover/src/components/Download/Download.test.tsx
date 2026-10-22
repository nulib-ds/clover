import { render, screen, within } from "@testing-library/react";
import React from "react";

import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import renderingJson from "../../fixtures/iiif-cookbook/0046-rendering.json";
import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";

beforeEach(() => initCloverI18n({ lng: "en" }));

/** Cookbook 0046 with a page of its own given a rendering too. */
const withPage = {
  ...renderingJson,
  items: renderingJson.items.map((canvas, index) =>
    index === 0
      ? {
          ...canvas,
          rendering: [
            {
              id: "https://example.org/page-1.jpg",
              type: "Image",
              label: { en: ["Full-size image"] },
              format: "image/jpeg",
            },
          ],
        }
      : canvas,
  ),
};

describe("Download", () => {
  it("lists the page's and the Manifest's renderings as links, with no button", async () => {
    render(
      <Clover.Root iiifContent={withPage}>
        <Clover.Download />
      </Clover.Root>,
    );
    const page = await screen.findByRole("region", { name: "This page" });
    expect(
      within(page).getByRole("link", { name: /Full-size image/ }),
    ).toHaveAttribute("href", "https://example.org/page-1.jpg");
    const all = screen.getByRole("region", { name: "All pages" });
    const pdf = within(all).getByRole("link", { name: /PDF version/ });
    expect(pdf).toHaveAttribute(
      "href",
      "https://fixtures.iiif.io/other/UCLA/kabuki_ezukushi_rtl.pdf",
    );
    expect(pdf).toHaveTextContent("(application/pdf)");
    expect(pdf).toHaveAttribute("target", "_blank");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("titles its groups at headingLevel, h3 by default", async () => {
    const { unmount } = render(
      <Clover.Root iiifContent={withPage}>
        <Clover.Download />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("heading", { level: 3, name: "This page" }),
    ).toBeInTheDocument();
    unmount();

    render(
      <Clover.Root iiifContent={withPage}>
        <Clover.Download headingLevel={5} />
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("heading", { level: 5, name: "This page" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 5, name: "All pages" }),
    ).toBeInTheDocument();
  });

  it("takes a host's class and attributes on its own element", async () => {
    const { container } = render(
      <Clover.Root iiifContent={renderingJson}>
        <Clover.Download className="mine" data-x="1" />
      </Clover.Root>,
    );
    await screen.findByRole("link", { name: /PDF version/ });
    const part = container.querySelector(".clover-download");
    expect(part).toHaveClass("mine");
    expect(part).toHaveAttribute("data-x", "1");
  });

  it("renders nothing with nothing to download", async () => {
    const { container } = render(
      <Clover.Root iiifContent={bookJson}>
        <Clover.Label as="h1" />
        <Clover.Download />
      </Clover.Root>,
    );
    await screen.findByRole("heading");
    expect(container.querySelector(".clover-download")).toBeNull();
  });

  it("lists the same downloads in About, under a Download heading", async () => {
    render(
      <Clover.Root iiifContent={withPage}>
        <Clover.About />
      </Clover.Root>,
    );
    const heading = await screen.findByRole("heading", { name: "Download" });
    const section = heading.closest("section")!;
    expect(
      within(section).getByRole("heading", { name: "This page", level: 4 }),
    ).toBeInTheDocument();
    expect(
      within(section).getByRole("link", { name: /Full-size image/ }),
    ).toHaveAttribute("href", "https://example.org/page-1.jpg");
    expect(
      within(section).getByRole("link", { name: /PDF version/ }),
    ).toHaveAttribute(
      "href",
      "https://fixtures.iiif.io/other/UCLA/kabuki_ezukushi_rtl.pdf",
    );
  });
});
