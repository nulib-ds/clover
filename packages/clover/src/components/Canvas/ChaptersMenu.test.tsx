import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ChaptersMenu from "./ChaptersMenu";

const chapters = [
  { id: "a", label: "Arrival", start: 0, end: 30 },
  { id: "b", label: "Landing", start: 30, end: 60 },
  { id: "c", label: "Fire", start: 60, end: 90 },
];

function menu(overStill: boolean) {
  const onChapter = vi.fn();
  const onClose = vi.fn();
  render(
    <>
      <button id="chapters-trigger" type="button">
        Chapters
      </button>
      <ChaptersMenu
        id="chapters"
        triggerId="chapters-trigger"
        label="Chapters"
        chapters={chapters}
        element={null}
        onChapter={onChapter}
        overStill={overStill}
        onClose={onClose}
      />
    </>,
  );
  return { onChapter, onClose };
}

/** An arrow key's move to a radio, as a browser checks it: the key, then the change. */
function arrowTo(radio: HTMLElement) {
  fireEvent.keyDown(radio, { key: "ArrowDown" });
  fireEvent.click(radio);
}

describe("ChaptersMenu", () => {
  it("goes to each chapter the arrow keys reach while the recording is open", () => {
    const { onChapter } = menu(false);
    arrowTo(screen.getByRole("radio", { name: /Landing/ }));
    expect(onChapter).toHaveBeenCalledWith(30);
  });

  /*
   * Over the recording's still, going to a chapter opens the recording and plays it:
   * looking through the names with the arrow keys never starts it (WCAG 3.2.2).
   */
  it("over the still, only marks what the arrow keys reach, and Enter goes there", () => {
    const { onChapter, onClose } = menu(true);
    const landing = screen.getByRole("radio", { name: /Landing/ });
    arrowTo(landing);
    expect(onChapter).not.toHaveBeenCalled();
    expect(landing).toBeChecked();
    fireEvent.keyDown(landing, { key: "Enter" });
    expect(onChapter).toHaveBeenCalledWith(30);
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("over the still, a press goes there at once", () => {
    const { onChapter } = menu(true);
    const fire = screen.getByRole("radio", { name: /Fire/ });
    fireEvent.pointerDown(fire.closest("label")!);
    fireEvent.click(fire);
    expect(onChapter).toHaveBeenCalledWith(60);
  });
});
