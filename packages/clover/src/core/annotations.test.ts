import { parseAnnotationTarget } from "./annotations";
import { annotationTargets } from "../components/Canvas/track";

const canvas = "https://example.org/canvas/1";

describe("parseAnnotationTarget", () => {
  it("reads a URI with and without a fragment", () => {
    expect(parseAnnotationTarget(canvas)).toEqual({ id: canvas });
    expect(parseAnnotationTarget(`${canvas}#xywh=10,20,30,40`)).toEqual({
      id: canvas,
      rect: { x: 10, y: 20, w: 30, h: 40 },
    });
    expect(parseAnnotationTarget(`${canvas}#t=5,10`)).toEqual({
      id: canvas,
      t: "5,10",
    });
    expect(parseAnnotationTarget(`${canvas}&t=5`)).toEqual({
      id: canvas,
      t: "5",
    });
  });

  it("reads a Presentation 4 reference, whose id carries the fragment", () => {
    expect(
      parseAnnotationTarget({
        id: `${canvas}#xywh=pixel:1,2,3,4`,
        type: "Canvas",
      }),
    ).toEqual({ id: canvas, rect: { x: 1, y: 2, w: 3, h: 4 } });
  });

  it("reads a SpecificResource's selectors", () => {
    const source = { id: canvas, type: "Canvas" };
    expect(
      parseAnnotationTarget({
        type: "SpecificResource",
        source,
        selector: { type: "FragmentSelector", value: "xywh=1,2,3,4" },
      }),
    ).toEqual({ id: canvas, rect: { x: 1, y: 2, w: 3, h: 4 } });
    expect(
      parseAnnotationTarget({
        type: "SpecificResource",
        source,
        selector: [{ type: "PointSelector", x: 5, y: 6 }],
      }),
    ).toEqual({ id: canvas, point: { x: 5, y: 6 } });
    // A point in time: Presentation 3's `t`, Presentation 4's `instant` (Cookbook 0015).
    expect(
      parseAnnotationTarget({
        type: "SpecificResource",
        source: canvas,
        selector: { type: "PointSelector", t: 120.5 },
      }),
    ).toEqual({ id: canvas, t: "120.5" });
    expect(
      parseAnnotationTarget({
        type: "SpecificResource",
        source: canvas,
        selector: { type: "PointSelector", instant: 120.5 },
      }),
    ).toEqual({ id: canvas, t: "120.5" });
    expect(
      parseAnnotationTarget({
        type: "SpecificResource",
        source: canvas,
        selector: { type: "PointSelector", x: 5, y: 6, t: 2 },
      }),
    ).toEqual({ id: canvas, point: { x: 5, y: 6 }, t: "2" });
    expect(
      parseAnnotationTarget({
        type: "SpecificResource",
        source: canvas,
        selector: { type: "SvgSelector", value: "<svg/>" },
      }),
    ).toEqual({ id: canvas, svg: "<svg/>" });
  });

  it("falls back to the source when no selector applies", () => {
    expect(
      parseAnnotationTarget({
        type: "SpecificResource",
        source: { id: `${canvas}&t=12` },
      }),
    ).toEqual({ id: canvas, t: "12" });
  });
});

/*
 * Both dimensions of a Media Fragment at once, `xywh=…&t=…`: a region through a stretch
 * of a recording, as a person followed through a film is marked (the docs'
 * `rudolf-hess-nuremberg` mock).
 */
describe("a region and a time together", () => {
  const source = { id: canvas, type: "Canvas" };
  const fragment = (value: string) => ({
    type: "SpecificResource",
    source,
    selector: {
      type: "FragmentSelector",
      conformsTo: "http://www.w3.org/TR/media-frags/",
      value,
    },
  });

  it("reads both, in either order", () => {
    const both = { id: canvas, rect: { x: 1, y: 2, w: 3, h: 4 }, t: "5,6" };
    expect(parseAnnotationTarget(fragment("xywh=1,2,3,4&t=5,6"))).toEqual(both);
    expect(parseAnnotationTarget(fragment("t=5,6&xywh=1,2,3,4"))).toEqual(both);
    expect(parseAnnotationTarget(`${canvas}#xywh=1,2,3,4&t=5,6`)).toEqual(both);
  });

  it("reads the first of several targets, however they are grouped", () => {
    const targets = [
      fragment("xywh=1,2,3,4&t=5,6"),
      fragment("xywh=7,8,9,10&t=6,7"),
    ];
    const first = { id: canvas, rect: { x: 1, y: 2, w: 3, h: 4 }, t: "5,6" };
    // A Presentation 3 array, and the groups Presentation 4 has (the upgrader makes an
    // array `Independents`).
    expect(parseAnnotationTarget(targets as never)).toEqual(first);
    for (const type of ["Independents", "List", "Composite"])
      expect(parseAnnotationTarget({ type, items: targets } as never)).toEqual(
        first,
      );
    expect(parseAnnotationTarget({ type: "Independents" } as never)).toEqual({
      id: "",
    });
  });

  it("lists every target, in the order given", () => {
    expect(
      annotationTargets({
        type: "Independents",
        items: [
          fragment("xywh=1,2,3,4&t=5,6"),
          `${canvas}#xywh=7,8,9,10&t=6,7`,
        ],
      }),
    ).toEqual([
      { id: canvas, rect: { x: 1, y: 2, w: 3, h: 4 }, t: "5,6" },
      { id: canvas, rect: { x: 7, y: 8, w: 9, h: 10 }, t: "6,7" },
    ]);
    expect(annotationTargets(canvas)).toEqual([{ id: canvas }]);
    expect(annotationTargets(undefined)).toEqual([]);
  });
});
