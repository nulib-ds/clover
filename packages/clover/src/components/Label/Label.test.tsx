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
});
