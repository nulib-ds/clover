import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ChoiceMenu from "./ChoiceMenu";

/*
 * A multispectral set (Mat, 2026-11-20: dcmny.org's MISHA fish), as the Choice's items
 * come: each an image with a service of its own, labeled by its file's name.
 */
const service = (name: string) => `https://example.org/iiif/2/${name}`;
const names = ["TrueColor.tiff", "FalseColorMNF.tif", "MNF_band4.tif"];
const canvas = {
  id: "https://example.org/canvas/1",
  type: "Canvas",
  width: 5472,
  height: 3648,
  items: [
    {
      type: "AnnotationPage",
      items: [
        {
          type: "Annotation",
          motivation: "painting",
          target: "https://example.org/canvas/1",
          body: {
            type: "Choice",
            items: names.map((name) => ({
              id: `${service(name)}/full/full/0/default.jpg`,
              type: "Image",
              format: "image/jpeg",
              width: 5472,
              height: 3648,
              label: { en: [name] },
              service: [
                { id: service(name), type: "ImageService2", profile: "level2" },
              ],
            })),
          },
        },
      ],
    },
  ],
};
const group = {
  key: "choice",
  canvasId: canvas.id,
  items: canvas.items[0].items[0].body.items.map(({ id, label, type }) => ({
    id,
    label,
    type,
  })),
};

const fetch = vi.fn(async (url: string) =>
  Response.json({
    "@context": "http://iiif.io/api/image/2/context.json",
    "@id": url.replace(/\/info\.json$/, ""),
    protocol: "http://iiif.io/api/image",
    width: 5472,
    height: 3648,
    profile: ["http://iiif.io/api/image/2/level2.json"],
  }),
);

describe("ChoiceMenu", () => {
  it("lists each item as a row: its radio, its own picture and its label", async () => {
    render(
      <ChoiceMenu
        id="choice"
        triggerId="choice-trigger"
        label="Views"
        choices={[group]}
        selections={{ choice: 1 }}
        canvases={[canvas]}
        request={{ fetch: fetch as any }}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    // Titled by the control's name, as the Choice has no label of its own.
    const menu = screen.getByRole("group", { name: "Views" });
    const radios = within(menu).getAllByRole("radio");
    expect(radios.map((radio) => radio.closest("label")?.textContent)).toEqual(
      names,
    );
    // The one painted is checked, and its row marked as the current one.
    expect(within(menu).getByRole("radio", { name: names[1] })).toBeChecked();
    const rows = menu.querySelectorAll(".clover-canvas-choice-entry");
    expect([...rows].map((row) => row.getAttribute("data-selected"))).toEqual([
      "false",
      "true",
      "false",
    ]);
    // Each picture from its own image's service, never the first image's.
    await waitFor(() =>
      expect(
        [...menu.querySelectorAll("img.clover-entry-thumbnail")].map((img) =>
          img.getAttribute("src"),
        ),
      ).toEqual(names.map((name) => `${service(name)}/full/52,/0/default.jpg`)),
    );
    // Decorative: the label names the item.
    for (const img of menu.querySelectorAll("img"))
      expect(img).toHaveAttribute("alt", "");
  });
});
