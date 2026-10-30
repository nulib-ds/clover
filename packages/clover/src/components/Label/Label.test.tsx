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
});
