import { describe, expect, it } from "vitest";

import { headingTag, titleTag, titled } from "./heading";

describe("headingTag", () => {
  it("is HTML's heading to h6, and none past it", () => {
    expect([1, 2, 3, 4, 5, 6].map(headingTag)).toEqual([
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
    ]);
    expect(headingTag(7)).toBeNull();
    expect(headingTag(9)).toBeNull();
  });
});

describe("titleTag", () => {
  it("falls back past 6, to a paragraph or the element given", () => {
    expect(titleTag(4)).toBe("h4");
    expect(titleTag(7)).toBe("p");
    expect(titleTag(7, "div")).toBe("div");
  });
});

describe("titled", () => {
  it("is a heading to h6, with nothing to add to its group", () => {
    expect(titled(6, "t")).toEqual({ as: "h6", title: {}, group: {} });
  });

  it("past 6, names the group it heads instead of being a heading", () => {
    expect(titled(7, "t")).toEqual({
      as: "p",
      title: { id: "t" },
      group: { role: "group", "aria-labelledby": "t" },
    });
  });
});
