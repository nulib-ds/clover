import { render, screen } from "@testing-library/react";
import React from "react";

import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import pagedJson from "../../fixtures/mocks/paged/manifest.json";
import { initCloverI18n } from "../../i18n";
import Viewer, * as Clover from "../../index";
import { Document } from "../../templates/index";

beforeEach(() => initCloverI18n({ lng: "en" }));

describe("Viewer", () => {
  it("is the package's default export, and Clover.Viewer", () => {
    expect(Viewer).toBe(Clover.Viewer);
  });

  it("draws the Default template when given none", async () => {
    const { container } = render(<Viewer iiifContent={bookJson} />);
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("clover-template-default");
  });

  it("draws the template it is passed, with that template's props", async () => {
    const { container } = render(
      <Viewer
        iiifContent={bookJson}
        template={Document}
        defaultSidebarOpen={false}
        download={false}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "Simple Manifest - Book" }),
    ).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("clover-template-document");
    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
  });

  it("draws a template of your own", async () => {
    function Plain(props: Clover.RootProps) {
      return (
        <Clover.Root {...props}>
          <Clover.Label as="h1" />
        </Clover.Root>
      );
    }
    render(<Viewer iiifContent={bookJson} template={Plain} />);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Simple Manifest - Book",
      }),
    ).toBeInTheDocument();
  });

  it("hands a template the panel's sections, which reach its panel", async () => {
    render(
      <Viewer
        iiifContent={pagedJson}
        panelLayout="tabs"
        panelSections={["contents", "annotations"]}
      />,
    );
    await screen.findByRole("tab", { name: "Contents" });
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Contents",
      "Annotations",
    ]);
  });

  it("keeps no room, and no toggle, for a panel with nothing to show", async () => {
    const { container } = render(
      <Viewer iiifContent={bookJson} panelSections={["contents", "search"]} />,
    );
    await screen.findByRole("heading", { name: "Simple Manifest - Book" });
    // This book has neither Ranges nor a search service, so the pane, its bar and its
    // toggle are all left out.
    expect(container.querySelector(".clover-template-panel")).toBeNull();
    expect(container.querySelector(".clover-template-panel-handle")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "More information" }),
    ).not.toBeInTheDocument();
  });

  it("reads the resource in its language, title and About alike, marked with it", async () => {
    // Shaped as nulib-ds/clover#321's manifest: every value in four languages.
    const map = (zhHant: string, zhCN: string, en: string, ja: string) => ({
      "zh-Hant": [zhHant],
      "zh-CN": [zhCN],
      en: [en],
      ja: [ja],
    });
    const manifest = {
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/manifest/multilingual",
      type: "Manifest",
      label: map("感懷帖", "感怀帖", "Reminiscence Post", "感懐帖"),
      summary: map("書信", "书信", "A letter", "書簡"),
      metadata: [
        {
          label: map("朝代", "朝代", "Dynasty", "王朝"),
          value: map("東晉", "东晋", "Eastern Jin", "東晋"),
        },
      ],
      requiredStatement: {
        label: map("出處", "出处", "Attribution", "帰属"),
        value: map("館藏", "馆藏", "The library", "所蔵"),
      },
      items: [
        {
          id: "https://example.org/canvas/multilingual/1",
          type: "Canvas",
          label: { none: ["1"] },
          width: 100,
          height: 100,
          items: [],
        },
      ],
    };
    render(<Viewer iiifContent={manifest} language="ja" />);
    expect(
      await screen.findByRole("heading", { level: 2, name: "感懐帖" }),
    ).toHaveAttribute("lang", "ja");
    for (const text of ["書簡", "王朝", "東晋", "帰属", "所蔵"])
      expect(await screen.findByText(text)).toHaveAttribute("lang", "ja");
    expect(screen.queryByText("Reminiscence Post")).toBeNull();
  });

  it("types its props by its template", () => {
    // Checked by `tsc`, not at run time: each line must be a type error.
    const types = () => (
      <>
        {/* @ts-expect-error Document's prop, without Document */}
        <Viewer iiifContent={bookJson} defaultSidebarOpen />
        {/* @ts-expect-error Default's prop, on Document */}
        <Viewer iiifContent={bookJson} template={Document} panel={false} />
      </>
    );
    expect(types).toBeTypeOf("function");
  });
});
