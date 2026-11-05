import { fireEvent, render, screen } from "@testing-library/react";
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
});
