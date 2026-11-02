import { act, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildContentState } from "../core/content-state";
import { useContentStateOutput } from "./useContentStateOutput";

afterEach(() => vi.useRealTimers());

/** A place that moves with `x`, as a camera panning across a Canvas would. */
const at = (x: number) =>
  buildContentState({
    manifestId: "https://example.org/manifest",
    canvasId: "https://example.org/canvas",
    region: { x, y: 0, w: 100, h: 100 },
  });

describe("useContentStateOutput", () => {
  // Mat, 2026-11-01: "the callback is slow"; it waited for the view to settle.
  it("reports a place on the move at most every 100ms, and always its last", () => {
    vi.useFakeTimers();
    let x = 0;
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useContentStateOutput(() => at(x), onChange),
    );
    // A pan of a second, a frame each 16ms.
    for (let time = 0; time < 1000; time += 16) {
      x = time;
      act(() => result.current());
      act(() => vi.advanceTimersByTime(16));
    }
    act(() => vi.advanceTimersByTime(100));
    expect(onChange.mock.calls.length).toBeGreaterThanOrEqual(9);
    expect(onChange.mock.calls.length).toBeLessThanOrEqual(11);
    const [last] = onChange.mock.lastCall!;
    expect(last.json.target.selector.value).toBe(`xywh=${x},0,100,100`);
  });

  it("reports nothing while the place holds still, nor without a callback", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ callback }) => useContentStateOutput(() => at(5), callback),
      { initialProps: { callback: onChange as typeof onChange | undefined } },
    );
    act(() => result.current());
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current());
    act(() => vi.advanceTimersByTime(100));
    expect(onChange).toHaveBeenCalledTimes(1);
    rerender({ callback: undefined });
    act(() => result.current());
    act(() => vi.advanceTimersByTime(100));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  // `next dev` mounts, unmounts and mounts again: a report let go then must not block.
  it("reports after a remount, as Strict Mode makes", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    // As a Root's subscriptions do: a change reported as the part mounts.
    renderHook(
      () => {
        const changed = useContentStateOutput(() => at(7), onChange);
        React.useEffect(changed, [changed]);
      },
      { wrapper: React.StrictMode },
    );
    act(() => vi.advanceTimersByTime(100));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
