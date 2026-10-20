import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";

import tocJson from "../../fixtures/iiif-cookbook/0024-book-4-toc.json";
import operaJson from "../../fixtures/iiif-cookbook/0026-toc-opera.json";
import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";

beforeEach(() => initCloverI18n({ lng: "en" }));

describe("Contents", () => {
  it("nests the Ranges, marks where the reader is, and goes to an entry", async () => {
    render(
      <Clover.Root iiifContent={tocJson}>
        <Clover.Label of="canvas" data-testid="canvas" />
        <Clover.Contents />
      </Clover.Root>,
    );
    const nav = await screen.findByRole("navigation", { name: "Contents" });
    const lists = nav.querySelectorAll("ol");
    expect(lists.length).toBe(2);
    const first = within(nav).getAllByRole("button")[0];
    expect(first).toHaveAttribute("aria-current", "true");

    fireEvent.click(within(nav).getByRole("button", { name: "Monday" }));
    expect(within(nav).getByRole("button", { name: "Monday" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(first).not.toHaveAttribute("aria-current");
  });

  it("marks each entry with the language of its label", async () => {
    render(
      <Clover.Root iiifContent={operaJson}>
        <Clover.Contents />
      </Clover.Root>,
    );
    const nav = await screen.findByRole("navigation", { name: "Contents" });
    expect(
      within(nav).getByRole("button", { name: "Atto Primo" }),
    ).toHaveAttribute("lang", "it");
    expect(
      within(nav).getByRole("button", { name: "Remainder of Atto Primo" }),
    ).toHaveAttribute("lang", "en");
  });

  /*
   * One highlight with the seek bar, through the Root: hovering or focusing an entry
   * names its Range there, and the chapter under the pointer there marks its entry.
   */
  it("shares the chapter hovered with the seek bar", async () => {
    let clover: any;
    const Spy = () => {
      clover = Clover.useClover("Spy").clover;
      return null;
    };
    render(
      <Clover.Root iiifContent={operaJson}>
        <Spy />
        <Clover.Contents />
      </Clover.Root>,
    );
    const nav = await screen.findByRole("navigation", { name: "Contents" });
    const act1 = within(nav).getByRole("button", { name: "Atto Primo" });
    fireEvent.mouseEnter(act1);
    const id = clover.chapter.get();
    expect(id).toEqual(expect.stringContaining("http"));
    expect(act1).toHaveAttribute("data-highlighted", "true");
    fireEvent.mouseLeave(act1);
    expect(clover.chapter.get()).toBeNull();
    expect(act1).not.toHaveAttribute("data-highlighted");

    // From the seek bar.
    act(() => clover.chapter.emit(id));
    expect(act1).toHaveAttribute("data-highlighted", "true");
  });

  it("renders nothing without structures", async () => {
    render(
      <Clover.Root iiifContent={{ ...tocJson, structures: undefined }}>
        <Clover.Label as="h1" />
        <Clover.Contents />
      </Clover.Root>,
    );
    await screen.findByRole("heading");
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
