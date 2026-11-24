import { act, render, screen } from "@testing-library/react";
import React from "react";

import { GestureHint } from "./GestureHint";

describe("GestureHint", () => {
  it("keeps an empty live region until a finger's drag is left to the page", () => {
    render(<GestureHint kind={null} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  // Mat, 2026-11-23: "I want a finger icon showing pinch to zoom".
  it("says to use two fingers, with a pinching hand for the eye alone", async () => {
    render(<GestureHint kind="touch" />);
    const words = await screen.findByText("Use two fingers to move the view");
    expect(screen.getByRole("status")).toContainElement(words);
    const hand = words.querySelector("svg");
    expect(hand).toHaveAttribute("aria-hidden", "true");
    expect(hand).toHaveAttribute("focusable", "false");
    expect(hand).toHaveAttribute("viewBox", "0 0 512 512");
  });

  // Mat, 2026-11-23: "have it fade in out a little more gracefully".
  it("stays as it fades out, then empties its region", async () => {
    const { rerender } = render(<GestureHint kind="touch" />);
    const words = await screen.findByText("Use two fingers to move the view");
    vi.useFakeTimers();
    try {
      rerender(<GestureHint kind={null} />);
      expect(words).toHaveAttribute("data-leaving");
      // Back before it has gone: it stays, and is no longer leaving.
      rerender(<GestureHint kind="touch" />);
      expect(words).not.toHaveAttribute("data-leaving");
      rerender(<GestureHint kind={null} />);
      act(() => void vi.advanceTimersByTime(400));
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    } finally {
      vi.useRealTimers();
    }
  });
});
