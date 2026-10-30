import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import PlaceBox from "./PlaceBox";
import { initCloverI18n } from "../../i18n";

const feature = {
  type: "Feature",
  properties: { label: { en: ["Targeted Map"] } },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-77.02, 38.91],
        [-77.11, 38.84],
        [-77.28, 39.0],
        [-77.19, 39.06],
      ],
    ],
  },
};

beforeEach(() => initCloverI18n({ lng: "en" }));

// Cookbook 0139 and 0154: where something is, on its map, as the information is shown.
describe("PlaceBox", () => {
  it("names the place over its map, and closes by Close or Escape", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <PlaceBox
        id="box"
        open
        onClose={onClose}
        feature={feature}
        name={feature.properties.label}
      />,
    );
    const box = screen.getByRole("group", { name: "Targeted Map" });
    expect(box).toHaveAttribute("data-open", "true");
    expect(box.querySelector(".clover-geomap")).not.toBeNull();
    // The box names its one place: the map lists none under it.
    expect(box.querySelector(".clover-geomap-places")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(box, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <PlaceBox
        id="box"
        open={false}
        onClose={onClose}
        feature={feature}
        name={feature.properties.label}
      />,
    );
    expect(box).toHaveAttribute("data-open", "false");
    expect(box.querySelector(".clover-geomap")).toBeNull();
  });
});
