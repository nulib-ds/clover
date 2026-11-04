import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SeekMarks, groupMarks } from "./SeekMarks";

const marks = [
  { id: "a", start: 7, label: "The studio introduces the recording" },
  { id: "b", start: 123, label: "Morrison's recording begins" },
  { id: "c", start: 181, label: "The airship bursts into flames", lang: "en" },
];

describe("SeekMarks", () => {
  it("names each point by its time and words, in time's place along the bar", () => {
    render(<SeekMarks marks={marks} duration={856} onSelect={vi.fn()} />);
    const toolbar = screen.getByRole("toolbar", { name: "Annotations" });
    const points = within(toolbar).getAllByRole("button");
    expect(points.map((point) => point.getAttribute("aria-label"))).toEqual([
      "0:07 The studio introduces the recording",
      "2:03 Morrison's recording begins",
      "3:01 The airship bursts into flames",
    ]);
    expect(points[2]).toHaveAttribute("lang", "en");
    expect(points[1].parentElement!.style.left).toContain(`${123 / 856}`);
  });

  it("is one stop for the keyboard, its arrows going from one to the next", () => {
    const onSelect = vi.fn();
    const onActivate = vi.fn();
    render(
      <SeekMarks
        marks={marks}
        duration={856}
        onSelect={onSelect}
        onActivate={onActivate}
      />,
    );
    const points = screen.getAllByRole("button");
    expect(points.map((point) => point.tabIndex)).toEqual([0, -1, -1]);
    points[0].focus();
    fireEvent.keyDown(points[0], { key: "ArrowRight" });
    expect(points[1]).toHaveFocus();
    expect(onActivate).toHaveBeenLastCalledWith("b");
    fireEvent.keyDown(points[1], { key: "End" });
    expect(points[2]).toHaveFocus();
    // No further than the last.
    fireEvent.keyDown(points[2], { key: "ArrowRight" });
    expect(points[2]).toHaveFocus();
    fireEvent.keyDown(points[2], { key: "Home" });
    expect(points[0]).toHaveFocus();
    fireEvent.keyDown(points[0], { key: "ArrowLeft" });
    expect(points[0]).toHaveFocus();
    // The stop is the last focused, so Tab comes back to it.
    fireEvent.keyDown(points[0], { key: "ArrowRight" });
    expect(points.map((point) => point.tabIndex)).toEqual([-1, 0, -1]);
    fireEvent.click(points[1]);
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("starts the keyboard on the one picked, marked so", () => {
    render(
      <SeekMarks
        marks={marks}
        duration={856}
        selected="c"
        onSelect={vi.fn()}
      />,
    );
    const points = screen.getAllByRole("button");
    expect(points.map((point) => point.tabIndex)).toEqual([-1, -1, 0]);
    expect(points[2]).toHaveAttribute("data-active", "true");
    // Said as a picked hotspot says it.
    expect(points[2]).toHaveAttribute("aria-current", "true");
    expect(points[0]).not.toHaveAttribute("aria-current");
  });

  it("puts its popover away on Escape, and only it", () => {
    render(<SeekMarks marks={marks} duration={856} onSelect={vi.fn()} />);
    const [point] = screen.getAllByRole("button");
    const group = point.parentElement!;
    point.focus();
    // Taken: nothing around it closes too (a floating Panel, a dialog).
    expect(fireEvent.keyDown(point, { key: "Escape" })).toBe(false);
    expect(group).toHaveAttribute("data-tip-hidden");
    // Away now, the next Escape is for what is around it.
    expect(fireEvent.keyDown(point, { key: "Escape" })).toBe(true);
    // One already handled is left alone.
    fireEvent.focusIn(point);
    const handled = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    handled.preventDefault();
    point.dispatchEvent(handled);
    expect(group).not.toHaveAttribute("data-tip-hidden");
  });

  it("takes those whose points would overlap as one", () => {
    const near = [
      { id: "a", start: 12.62, label: "Hermann Göring" },
      { id: "b", start: 12.62, label: "Wilhelm Keitel" },
      { id: "c", start: 14, label: "Erich Raeder" },
      { id: "d", start: 85, label: "Hess is led out of the dock" },
    ];
    const ids = (groups: { id: string }[][]) =>
      groups.map((group) => group.map((mark) => mark.id).join(""));
    // 671 seconds along 800px: 1.4s is under 26px, 72s is not.
    expect(ids(groupMarks(near, 671, 800, 26))).toEqual(["abc", "d"]);
    // Unmeasured, only those that start together.
    expect(ids(groupMarks(near, 671, 0, 0))).toEqual(["ab", "c", "d"]);
  });

  it("pages through a group in its popover, each step picking the next", () => {
    const onSelect = vi.fn();
    const together = [
      { id: "a", start: 12, label: "Hermann Göring" },
      { id: "b", start: 12, label: "Wilhelm Keitel" },
      { id: "c", start: 12, label: "Erich Raeder" },
    ];
    const { rerender } = render(
      <SeekMarks marks={together} duration={671} onSelect={onSelect} />,
    );
    const toolbar = screen.getByRole("toolbar", { name: "Annotations" });
    const point = within(toolbar).getByRole("button", {
      name: "0:12 Hermann Göring 1 / 3",
    });
    // The point, then its popover's steps, Previous unavailable at the first.
    expect(
      within(toolbar).getByRole("button", { name: "Previous" }),
    ).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(within(toolbar).getByRole("button", { name: "Next" }));
    expect(onSelect).toHaveBeenLastCalledWith("b");
    rerender(
      <SeekMarks
        marks={together}
        duration={671}
        selected="b"
        onSelect={onSelect}
      />,
    );
    expect(point).toHaveAccessibleName("0:12 Wilhelm Keitel 2 / 3");
    expect(point.nextElementSibling).toHaveTextContent("0:12Wilhelm Keitel");
    fireEvent.click(point);
    expect(onSelect).toHaveBeenLastCalledWith("b");
  });

  it("marks nothing without a duration or annotations", () => {
    const { container, rerender } = render(
      <SeekMarks marks={marks} duration={0} onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<SeekMarks marks={[]} duration={856} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
