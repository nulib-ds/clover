import { afterEach, describe, expect, it, vi } from "vitest";

import { bringIntoView, scrollerOf } from "./bringIntoView";

/** A box's rectangle, for jsdom, which lays nothing out. */
const at = (top: number, height: number) =>
  ({ top, bottom: top + height, height }) as DOMRect;

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("bringIntoView", () => {
  it("scrolls the box that scrolls the element, never the page", () => {
    const box = document.createElement("div");
    box.style.overflowY = "auto";
    const item = document.createElement("p");
    box.append(item);
    document.body.append(box);
    box.scrollBy = vi.fn();
    const page = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    vi.spyOn(box, "getBoundingClientRect").mockReturnValue(at(0, 100));
    vi.spyOn(item, "getBoundingClientRect").mockReturnValue(at(140, 20));

    expect(scrollerOf(item)).toBe(box);
    bringIntoView(item, "nearest");

    // Just into view: its bottom at the box's bottom.
    expect(box.scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ top: 60 }),
    );
    expect(page).not.toHaveBeenCalled();
  });

  it("leaves the page alone when nothing but the page scrolls the element", () => {
    const item = document.createElement("p");
    document.body.append(item);
    const page = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    const into = vi.fn();
    item.scrollIntoView = into;

    expect(scrollerOf(item)).toBeNull();
    bringIntoView(item, "nearest");

    expect(page).not.toHaveBeenCalled();
    expect(into).not.toHaveBeenCalled();
  });
});
