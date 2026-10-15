import { render, screen } from "@testing-library/react";
import React from "react";

import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
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
      await screen.findByRole("heading", { name: "Simple Manifest - Book" }),
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
