import { render, screen } from "@testing-library/react";
import React from "react";

import * as Clover from "../../index";

describe("Label", () => {
  it("shows a label holding a reference outside Unicode as written", () => {
    render(
      <Clover.Label as="h2" label={{ en: ["Plate &#x110000; &amp; key"] }} />,
    );
    expect(
      screen.getByRole("heading", { name: "Plate &#x110000; & key" }),
    ).toHaveAttribute("lang", "en");
  });

  // Written right to left where its language is: a IIIF primitive's text as Clover's own.
  it("writes a label in Arabic right to left", () => {
    render(<Clover.Label as="h2" label={{ ar: ["مخطوطة"] }} />);
    const heading = screen.getByRole("heading", { name: "مخطوطة" });
    expect(heading).toHaveAttribute("lang", "ar");
    expect(heading).toHaveAttribute("dir", "rtl");
  });

  it("leaves a label in English to the page's direction", () => {
    render(<Clover.Label as="h2" label={{ en: ["Manuscript"] }} />);
    expect(
      screen.getByRole("heading", { name: "Manuscript" }),
    ).not.toHaveAttribute("dir");
  });

  // Mat, 2026-11-08: "expect there to be a string here at all times, even if an empty space".
  it("keeps its place while there is none, where asked, never an empty heading to assistive technology", () => {
    const { container, rerender } = render(<Clover.Label as="h2" />);
    expect(container.querySelector("h2")).toBeNull();
    rerender(<Clover.Label as="h2" keep />);
    const kept = container.querySelector("h2")!;
    expect(kept.textContent).toBe("\u00a0");
    expect(kept).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("heading")).toBeNull();
    rerender(<Clover.Label as="h2" keep label={{ en: ["Manuscript"] }} />);
    expect(
      screen.getByRole("heading", { name: "Manuscript" }),
    ).not.toHaveAttribute("aria-hidden");
  });
});
