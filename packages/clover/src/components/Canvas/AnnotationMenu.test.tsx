import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AnnotationMenu from "./AnnotationMenu";
import type { ListedAnnotation } from "./Annotations";

const annotations: ListedAnnotation[] = [
  { id: "a", label: "First verse", start: 0 },
  { id: "b", label: "Second verse", start: 30 },
  { id: "c", label: "Third verse", start: 60 },
];

function menu() {
  const onSelect = vi.fn();
  render(
    <>
      <button id="annotations-trigger" type="button">
        Annotations
      </button>
      <AnnotationMenu
        id="annotations"
        triggerId="annotations-trigger"
        label="Annotations"
        annotations={annotations}
        selected="a"
        onSelect={onSelect}
        onActivate={() => {}}
        onClose={() => {}}
      />
    </>,
  );
  return { onSelect };
}

/** An arrow key's move to a radio, as a browser checks it: the key, then the change. */
function arrowTo(radio: HTMLElement) {
  fireEvent.keyDown(radio, { key: "ArrowDown" });
  fireEvent.click(radio);
}

/*
 * Picking a timed annotation plays from where it starts. Looking through the names with
 * the arrow keys only goes there, never starting the sound (WCAG 3.2.2), as the chapters
 * menu does; Enter, Space or a press plays.
 */
describe("AnnotationMenu", () => {
  it("only goes to what the arrow keys reach, and plays on Enter", () => {
    const { onSelect } = menu();
    const second = screen.getByRole("radio", { name: /Second verse/ });
    arrowTo(second);
    expect(onSelect).toHaveBeenLastCalledWith(annotations[1], false);
    fireEvent.keyDown(second, { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith(annotations[1]);
  });

  it("plays what a pointer picks, the checked one again too", () => {
    const { onSelect } = menu();
    const second = screen.getByRole("radio", { name: /Second verse/ });
    fireEvent.pointerDown(second.closest("label")!);
    fireEvent.click(second);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith(annotations[1], true);
    const first = screen.getByRole("radio", { name: /First verse/ });
    fireEvent.pointerDown(first.closest("label")!);
    fireEvent.click(first);
    expect(onSelect).toHaveBeenLastCalledWith(annotations[0]);
  });

  /*
   * Cookbook 0139: one whose body is a place opens its box over the Canvas as it is picked,
   * a popup, which closes the menu. Picked on a press, Enter or Space, the menu closed
   * first, focus on its control (WCAG 2.4.3), never on an arrow key's move (3.2.2).
   */
  it("picks one whose body is a place on a press, Enter or Space, closing the menu first", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const library = {
      id: "library",
      label: "Evanston Public Library",
      world: { x: 0, y: 0, width: 10, height: 10 },
      source: {
        targetIndex: 0,
        annotation: {
          id: "library",
          type: "Annotation",
          motivation: "tagging",
          target: "https://example.org/sheet-17#xywh=100,100,200,200",
          body: {
            type: "Feature",
            properties: { label: { en: ["Evanston Public Library"] } },
            geometry: { type: "Point", coordinates: [-87.683, 42.049] },
          },
        },
      },
    } as unknown as ListedAnnotation;
    render(
      <>
        <button id="annotations-trigger" type="button">
          Annotations
        </button>
        <AnnotationMenu
          id="annotations"
          triggerId="annotations-trigger"
          label="Annotations"
          annotations={[annotations[0], library]}
          selected="a"
          onSelect={onSelect}
          onActivate={() => {}}
          onClose={onClose}
        />
      </>,
    );
    const radio = screen.getByRole("radio", {
      name: /Evanston Public Library/,
    });
    arrowTo(radio);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    const picked = () => {
      expect(onClose).toHaveBeenCalledWith(true);
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenLastCalledWith(library);
      expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(
        onSelect.mock.invocationCallOrder[0],
      );
      onClose.mockClear();
      onSelect.mockClear();
    };
    fireEvent.keyDown(radio, { key: "Enter" });
    picked();
    fireEvent.pointerDown(radio.closest("label")!);
    fireEvent.click(radio);
    picked();
    fireEvent.keyDown(radio, { key: " " });
    fireEvent.click(radio);
    picked();
  });
});

// nulib-ds/clover#440: each entry as the Annotations section shows it, by Canvas.
describe("AnnotationMenu, as the Annotations section lists", () => {
  const canvas = (id: string, label: string) => ({
    id,
    type: "Canvas",
    label: { en: [label] },
    width: 1000,
    height: 1000,
    items: [
      {
        type: "AnnotationPage",
        items: [
          {
            type: "Annotation",
            motivation: "painting",
            target: id,
            body: {
              id: `${id}/full/max/0/default.jpg`,
              type: "Image",
              width: 1000,
              height: 1000,
              service: [
                { id: `${id}/image`, type: "ImageService3", profile: "level2" },
              ],
            },
          },
        ],
      },
    ],
  });
  const left = canvas("https://example.org/page/3", "Page 3");
  const right = canvas("https://example.org/page/4", "Page 4");
  const textual = (id: string, target: string, value: string) => ({
    id,
    label: value,
    world: { x: 0, y: 0, width: 10, height: 10 },
    pageId: "https://example.org/commentary",
    page: { text: "Commentary" },
    source: {
      targetIndex: 0,
      pageId: "https://example.org/commentary",
      annotation: {
        id,
        type: "Annotation",
        motivation: "commenting",
        target: `${target}#xywh=100,100,200,200`,
        body: {
          type: "TextualBody",
          value: `<p>${value}</p>`,
          format: "text/html",
        },
      },
    },
  });

  it("groups by the Canvas each is on, under its label, with its picture and words", () => {
    render(
      <>
        <button id="annotations-trigger" type="button">
          Annotations
        </button>
        <AnnotationMenu
          id="annotations"
          triggerId="annotations-trigger"
          label="Annotations"
          annotations={
            [
              textual("then", left.id, "Then"),
              textual("now", right.id, "Now"),
            ] as any
          }
          canvases={[left, right]}
          hiddenPages={[]}
          onPageVisibilityChange={() => {}}
          selected="now"
          onSelect={() => {}}
          onActivate={() => {}}
          onClose={() => {}}
        />
      </>,
    );
    // Titled at its top, the title naming the group of them all, its eye beside it.
    const all = screen.getByRole("group", { name: "Annotations" });
    const title = all.querySelector(":scope > legend")!;
    expect(title).toHaveTextContent("Annotations");
    expect(title.querySelector('input[type="checkbox"]')).not.toBeNull();
    const page3 = screen.getByRole("group", { name: "Page 3" });
    const page4 = screen.getByRole("group", { name: "Page 4" });
    expect(
      within(page3).getByRole("radio", { name: "Then" }),
    ).not.toBeChecked();
    expect(within(page4).getByRole("radio", { name: "Now" })).toBeChecked();
    // The AnnotationPage's title is not shown: by Canvas alone, as the section.
    expect(screen.queryByText("Commentary")).toBeNull();
    // Each region's picture holds its room from the start.
    expect(page3.querySelectorAll(".clover-entry-thumbnail")).toHaveLength(1);
    // One toggle at its head, for every page.
    expect(
      screen.getAllByRole("checkbox", { name: "Hide annotations" }),
    ).toHaveLength(1);
  });
});
