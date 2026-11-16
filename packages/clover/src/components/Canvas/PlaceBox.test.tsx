import { fireEvent, render, screen, within } from "@testing-library/react";
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
    const onSwap = vi.fn();
    const box = (open: boolean, swapped = false) => (
      <PlaceBox
        id="box"
        open={open}
        swapped={swapped}
        onClose={onClose}
        onSwap={onSwap}
        feature={feature}
        name={feature.properties.label}
      />
    );
    const { rerender } = render(box(true));
    const group = screen.getByRole("group", { name: "Targeted Map" });
    // Small, an Inset (Mat, 2026-11-15: "default should be treated the same as document").
    expect(group).toHaveClass("clover-inset");
    expect(group.querySelector(".clover-geomap")).not.toBeNull();
    // The box names its one place: the map lists none under it.
    expect(group.querySelector(".clover-geomap-places")).toBeNull();
    // A press on it expands it, as its Expand map does.
    fireEvent.click(group.querySelector(".clover-geomap")!);
    fireEvent.click(screen.getByRole("button", { name: "Expand map" }));
    expect(onSwap).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(group, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);

    // Expanded: no box, the page's picture in one under the zoom row, its Collapse map
    // trading them back and its Close putting the map away (Mat, 2026-11-16).
    rerender(box(true, true));
    expect(group).not.toHaveClass("clover-inset");
    const page = group.querySelector<HTMLElement>(
      ".clover-geomap .clover-canvas-place-page",
    )!;
    expect(page).not.toBeNull();
    fireEvent.click(within(page).getByRole("button", { name: "Collapse map" }));
    expect(onSwap).toHaveBeenCalledTimes(3);
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
    fireEvent.click(within(page).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(onClose).toHaveBeenLastCalledWith(true);

    // Closed, nothing.
    rerender(box(false));
    expect(screen.queryByRole("group", { name: "Targeted Map" })).toBeNull();
  });
});
