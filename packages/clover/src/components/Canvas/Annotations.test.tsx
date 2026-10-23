import { act, fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";

import {
  type CanvasAnnotation,
  maskUnder,
  placeAnnotations,
} from "./Annotations";
import { panClearOfControls } from "./panClearOfControls";
import { readSvgShape } from "../../core/svg-shape";
import { selectAnnotationSets } from "../../core/annotation-sets";
import pointJson from "../../fixtures/iiif-cookbook/0135-annotating-point-in-canvas.json";
import shapeJson from "../../fixtures/iiif-cookbook/0261-non-rectangular-commenting.json";
import hotspotJson from "../../fixtures/iiif-cookbook/0022-linking-with-a-hotspot.json";
import imageJson from "../../fixtures/iiif-cookbook/0377-image-in-annotation.json";
import hessJson from "../../fixtures/mocks/rudolf-hess-nuremberg/manifest.json";
import { p4 } from "../../fixtures/presentation4";

const canvas = "https://example.org/canvas/1";
const annotation = (id: string, target: unknown): CanvasAnnotation => ({
  annotation: {
    id,
    type: "Annotation",
    motivation: ["commenting"],
    body: { type: "TextualBody", value: `About ${id}` },
    target,
  } as never,
  targetIndex: 0,
});

/** World units are the target's own, shifted, so placement is visible in the result. */
const place = (rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}) => ({
  ...rect,
  x: rect.x + 1000,
});

describe("placeAnnotations", () => {
  it("places rectangles, points and SVG shapes", () => {
    const placed = placeAnnotations(
      [
        annotation("rect", `${canvas}#xywh=10,20,30,40`),
        annotation("point", {
          type: "SpecificResource",
          source: canvas,
          selector: { type: "PointSelector", x: 500, y: 600 },
        }),
        annotation("shape", {
          type: "SpecificResource",
          source: { id: canvas, type: "Canvas" },
          selector: {
            type: "SvgSelector",
            value: '<svg><polygon points="100,100 200,100 150,250" /></svg>',
          },
        }),
      ],
      place,
      readSvgShape,
    );
    expect(placed.map((entry) => [entry.id, entry.shape?.kind])).toEqual([
      ["rect", undefined],
      ["point", "point"],
      ["shape", "svg"],
    ]);
    expect(placed[0].world).toEqual({ x: 1010, y: 20, width: 30, height: 40 });
    // A point frames a 40-unit box around itself.
    expect(placed[1].world).toEqual({ x: 1480, y: 580, width: 40, height: 40 });
    // A shape is placed by its box.
    expect(placed[2].world).toEqual({
      x: 1100,
      y: 100,
      width: 100,
      height: 150,
    });
    expect(placed[2].label).toBe("About shape");
  });

  it("skips a shape with nothing to draw", () => {
    const placed = placeAnnotations(
      [
        annotation("empty", {
          type: "SpecificResource",
          source: canvas,
          selector: { type: "SvgSelector", value: "<svg><g /></svg>" },
        }),
      ],
      place,
      readSvgShape,
    );
    expect(placed).toEqual([]);
  });
});

describe("a shape's hotspot", () => {
  it("draws the shape from its read geometry, sized by its box", async () => {
    const { default: Annotations } = await import("./Annotations");
    const container = document.createElement("div");
    const renderer = {
      overlays: { container, add: () => () => undefined },
      invalidate: () => undefined,
    } as never;
    const [entry] = placeAnnotations(
      [
        annotation("shape", {
          type: "SpecificResource",
          source: canvas,
          selector: {
            type: "SvgSelector",
            value:
              '<svg><path d="M10 10 L 60 10 L 35 80 Z" onclick="x()" /></svg>',
          },
        }),
      ],
      place,
      readSvgShape,
    );
    render(
      <Annotations
        renderer={renderer}
        placed={[entry]}
        sceneVersion={1}
        active={null}
        selected={null}
        onActivate={() => undefined}
        onSelect={() => undefined}
      />,
    );
    const button = container.querySelector("button")!;
    expect(button).toHaveAttribute("data-shape", "svg");
    expect(button).toHaveAccessibleName("About shape");
    const svg = button.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("10 10 50 70");
    const path = svg.querySelector("path")!;
    expect(path.getAttribute("d")).toBe("M10 10 L 60 10 L 35 80 Z");
    expect(path.hasAttribute("onclick")).toBe(false);
  });
});

describe("the Cookbook's shapes and points, through Presentation 4", () => {
  it.each([
    ["0261 (SvgSelector)", shapeJson, "svg"],
    ["0135 (PointSelector)", pointJson, "point"],
  ])("%s places as its kind", (_, json, kind) => {
    const entries = selectAnnotationSets(p4(json), []).flatMap(
      (set) => set.entries,
    );
    const placed = placeAnnotations(
      entries.map((entry) => ({
        annotation: entry.annotation as never,
        targetIndex: 0,
      })),
      (rect) => rect,
      readSvgShape,
    );
    expect(placed.length).toBeGreaterThan(0);
    expect(placed[0].shape?.kind).toBe(kind);
    expect(placed[0].world.width).toBeGreaterThan(0);
  });
});

describe("the SVG reader", () => {
  it("waits for its reader: shapes are placed only once it has loaded", () => {
    const shape = annotation("shape", {
      type: "SpecificResource",
      source: canvas,
      selector: {
        type: "SvgSelector",
        value: '<svg><polygon points="0,0 10,0 10,10" /></svg>',
      },
    });
    expect(placeAnnotations([shape], place)).toEqual([]);
    expect(placeAnnotations([shape], place, readSvgShape)).toHaveLength(1);
  });
});

/** The hotspots, rendered into an overlay layer of their own, with a renderer stand-in. */
async function renderHotspots(
  placed: ReturnType<typeof placeAnnotations>,
  props: Partial<{
    active: string | null;
    selected: string | null;
    onActivate: (id: string | null) => void;
    onSelect: (annotation: unknown) => void;
    onFollow: (annotation: unknown) => void;
    media: HTMLMediaElement | null;
  }> = {},
  renderer: Record<string, unknown> = {},
) {
  const { default: Annotations } = await import("./Annotations");
  // The layer in its viewport, which takes focus a hotspot gives up.
  const viewport = document.createElement("div");
  viewport.tabIndex = 0;
  const container = document.createElement("div");
  viewport.appendChild(container);
  document.body.appendChild(viewport);
  const stand = {
    overlays: { container, add: () => () => undefined, move: vi.fn() },
    invalidate: () => undefined,
    ...renderer,
  };
  render(
    <Annotations
      renderer={stand as never}
      placed={placed}
      sceneVersion={1}
      active={props.active ?? null}
      selected={props.selected ?? null}
      onActivate={props.onActivate ?? (() => undefined)}
      onSelect={props.onSelect ?? (() => undefined)}
      onFollow={props.onFollow}
      {...("media" in props ? { media: props.media } : {})}
    />,
  );
  const buttons = () =>
    Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
  return { layer: container, viewport, buttons, renderer: stand };
}

const depth = (button: HTMLElement) =>
  Number(button.style.getPropertyValue("--clover-annotation-depth"));

describe("a hotspot's name", () => {
  it("is its number, as the menu lists it, when its annotation has no text", async () => {
    const image = (id: string, target: string): CanvasAnnotation => ({
      annotation: {
        id,
        type: "Annotation",
        motivation: ["commenting"],
        body: { id: `${id}.jpg`, type: "Image", format: "image/jpeg" },
        target,
      } as never,
      targetIndex: 0,
    });
    const placed = placeAnnotations(
      [
        annotation("text", `${canvas}#xywh=10,10,10,10`),
        image("image", `${canvas}#xywh=0,0,100,100`),
      ],
      place,
    );
    const { buttons } = await renderHotspots(placed);
    const [first, second] = buttons();
    expect(first).toHaveAccessibleName("About text");
    expect(second).toHaveAccessibleName("2");
  });

  it("is a Markdown body's text, without its syntax", () => {
    const placed = placeAnnotations(
      [
        {
          annotation: {
            id: "notes",
            type: "Annotation",
            motivation: ["commenting"],
            body: {
              type: "TextualBody",
              format: "text/markdown",
              value:
                "## Sources\n\n- A letter of *1849*\n- [The Gazette](https://example.org)",
            },
            target: `${canvas}#xywh=0,0,10,10`,
          } as never,
          targetIndex: 0,
        },
      ],
      place,
    );
    expect(placed[0].label).toBe("Sources\nA letter of 1849\nThe Gazette");
  });

  it("is an image's label, or its annotation's, when it has no text beside it", () => {
    const image = (
      id: string,
      body: Record<string, unknown>,
      label?: Record<string, string[]>,
    ): CanvasAnnotation => ({
      annotation: {
        id,
        type: "Annotation",
        motivation: ["commenting"],
        ...(label ? { label } : {}),
        body: { id: `${id}.jpg`, type: "Image", ...body },
        target: `${canvas}#xywh=0,0,10,10`,
      } as never,
      targetIndex: 0,
    });
    const placed = placeAnnotations(
      [
        image("own", { label: { fr: ["Une fontaine"] } }),
        image("annotation's", {}, { en: ["A fountain"] }),
      ],
      place,
    );
    expect(placed.map(({ label, lang }) => [label, lang])).toEqual([
      ["Une fontaine", "fr"],
      ["A fountain", "en"],
    ]);
  });
});

/*
 * WCAG 2.4.3 and 1.3.2: Tab and a screen reader follow the annotations' order, the
 * menu's; stacking alone keeps a hotspot inside another within reach of the pointer.
 */
describe("the hotspots' order", () => {
  const nested = () =>
    placeAnnotations(
      [
        annotation("line", `${canvas}#xywh=0,0,400,40`),
        annotation("word", `${canvas}#xywh=10,5,50,30`),
        annotation("page", `${canvas}#xywh=0,0,1000,1000`),
        annotation("other", `${canvas}#xywh=500,500,40,40`),
      ],
      place,
    );

  it("is the order the annotations were given, not their size", async () => {
    const { buttons } = await renderHotspots(nested());
    expect(buttons().map((button) => button.id)).toEqual([
      "line",
      "word",
      "page",
      "other",
    ]);
  });

  it("stacks smaller over larger", async () => {
    const { buttons } = await renderHotspots(nested());
    const [line, word, page, other] = buttons().map(depth);
    expect(page).toBeLessThan(line);
    expect(line).toBeLessThan(other);
    expect(other).toBeLessThan(word);
  });

  it("raises the active one over all, and those inside it over it in turn", async () => {
    const { buttons } = await renderHotspots(nested(), { active: "line" });
    const [line, word, page, other] = buttons().map(depth);
    expect(line).toBeGreaterThan(Math.max(page, other));
    // The word lies within the line, so it stays within reach.
    expect(word).toBeGreaterThan(line);
  });

  /*
   * Two on one region (a search hit on its word, a transcription and a translation): the
   * later stays on top whichever is active, or each, raised by the other, would take the
   * pointer back from it.
   */
  it("keeps the later of two on one region on top, whichever is active", async () => {
    const twins = () =>
      placeAnnotations(
        [
          annotation("tag", `${canvas}#xywh=600,300,400,200`),
          annotation("comment", `${canvas}#xywh=600,300,400,200`),
        ],
        place,
      );
    for (const active of [null, "tag", "comment"]) {
      const { buttons, layer } = await renderHotspots(twins(), { active });
      const [tag, comment] = buttons().map(depth);
      expect(comment, String(active)).toBeGreaterThan(tag);
      layer.remove();
    }
  });
});

/*
 * Beneath the active hotspot, another's lines stop where the active one lies, as a shape
 * in a vector editor hides what it covers; nothing is laid over the picture to do it.
 */
describe("beneath the active hotspot", () => {
  const placed = () =>
    placeAnnotations(
      [
        annotation("line", `${canvas}#xywh=0,0,400,40`),
        annotation("word", `${canvas}#xywh=10,5,50,30`),
        annotation("page", `${canvas}#xywh=0,0,1000,1000`),
        annotation("other", `${canvas}#xywh=500,500,40,40`),
        annotation("point", {
          type: "SpecificResource",
          source: canvas,
          selector: { type: "PointSelector", x: 200, y: 20 },
        }),
        annotation("shape", {
          type: "SpecificResource",
          source: { id: canvas, type: "Canvas" },
          selector: {
            type: "SvgSelector",
            value: '<svg><polygon points="100,100 200,100 150,250" /></svg>',
          },
        }),
      ],
      place,
      readSvgShape,
    );
  const mask = (button: HTMLElement) =>
    button.style.getPropertyValue("--clover-annotation-mask");
  /** The SVG a mask draws. */
  const drawn = (value: string | null) =>
    decodeURIComponent(value!.slice('url("data:image/svg+xml,'.length, -2));

  it("masks only those it lies over, never those over it", async () => {
    const { buttons } = await renderHotspots(placed(), { active: "line" });
    const [line, word, page, other, point, shape] = buttons();
    // The page crosses under the line; the word and the point lie within it, over it.
    expect(mask(page)).toMatch(/^url\("data:image\/svg\+xml,/);
    for (const whole of [line, word, other, point, shape])
      expect(mask(whole), whole.id).toBe("");
  });

  it("takes its rectangle out of the box beneath, in that box's own units", () => {
    const [line, , page] = placed();
    // The page's box, a tenth to spare each side, less the line's rectangle.
    expect(drawn(maskUnder(page, line))).toContain(
      'viewBox="-100 -100 1200 1200"',
    );
    expect(drawn(maskUnder(page, line))).toContain(
      'd="M-100 -100h1200v1200h-1200ZM0 0h400v40h-400Z"',
    );
  });

  it("takes a shape's own outline, not its box, and nothing for a point", () => {
    const [, , page, other, point, shape] = placed();
    const svg = drawn(maskUnder(page, shape));
    expect(svg).toContain('<polygon points="100,100 200,100 150,250"/>');
    expect(svg).toContain('x="100" y="100" width="100" height="150"');
    // A point's marker covers what it crosses; boxes that do not meet are left alone.
    expect(maskUnder(page, point)).toBeNull();
    expect(maskUnder(other, shape)).toBeNull();
  });
});

describe("the picked hotspot", () => {
  it("is current, and no other is (WCAG 4.1.2)", async () => {
    const placed = placeAnnotations(
      [
        annotation("a", `${canvas}#xywh=0,0,10,10`),
        annotation("b", `${canvas}#xywh=20,0,10,10`),
      ],
      place,
    );
    const { buttons } = await renderHotspots(placed, {
      active: "a",
      selected: "b",
    });
    const [a, b] = buttons();
    expect(a).not.toHaveAttribute("aria-current");
    expect(b).toHaveAttribute("aria-current", "true");
    // Active is how it looks: hovered or focused, else picked.
    expect(a).toHaveAttribute("data-active", "true");
    expect(b).toHaveAttribute("data-active", "false");
  });
});

/*
 * WCAG 1.4.13: a hotspot's name shows in its popover, `Tip`, which shows on hover and
 * focus, can be hovered, and hides on Escape.
 */
describe("a hotspot's popover", () => {
  const one = () =>
    placeAnnotations([annotation("a", `${canvas}#xywh=0,0,10,10`)], place);

  it("says what its accessible name says, and is read once", async () => {
    const { buttons } = await renderHotspots(one());
    const [button] = buttons();
    const tip = button.querySelector(".clover-tip")!;
    expect(tip).toHaveTextContent("About a");
    expect(tip).toHaveAttribute("aria-hidden", "true");
    expect(button).toHaveAccessibleName("About a");
    expect(button.querySelector("label")).toBeNull();
    expect(button).not.toHaveAttribute("title");
  });

  it("keeps the hotspot active while the pointer moves onto it", async () => {
    const onActivate = vi.fn();
    const { buttons } = await renderHotspots(one(), { onActivate });
    const [button] = buttons();
    const tip = button.querySelector(".clover-tip")!;
    fireEvent.mouseOver(button);
    expect(onActivate).toHaveBeenLastCalledWith("a");
    fireEvent.mouseOut(button, { relatedTarget: tip });
    fireEvent.mouseOver(tip, { relatedTarget: button });
    expect(onActivate).not.toHaveBeenCalledWith(null);
    fireEvent.mouseOut(tip, { relatedTarget: document.body });
    expect(onActivate).toHaveBeenLastCalledWith(null);
  });

  it("hides on Escape until focus leaves", async () => {
    const { buttons } = await renderHotspots(one());
    const [button] = buttons();
    button.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button).toHaveAttribute("data-tip-hidden");
    fireEvent.blur(button);
    expect(button).not.toHaveAttribute("data-tip-hidden");
  });

  it("zooms to its hotspot when pressed, as the hotspot does", async () => {
    const onSelect = vi.fn();
    const { buttons } = await renderHotspots(one(), { onSelect });
    fireEvent.click(buttons()[0].querySelector(".clover-tip")!);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  });
});

/*
 * WCAG 2.4.11: a hotspot reached by Tab is panned clear of the controls over the Body.
 * The camera is a stand-in whose screen is its world, so a pan's target is the screen
 * point the view's center goes to.
 */
describe("a hotspot reached by Tab", () => {
  type Box = { left: number; top: number; width: number; height: number };
  const rect = ({ left, top, width, height }: Box) =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
    }) as DOMRect;

  /** A 1000 × 600 Body, its controls, and one hotspot at `at`. */
  const setup = async (at: Box, controls: Record<string, Box> = {}) => {
    const panTo = vi.fn();
    const placed = placeAnnotations(
      [annotation("a", `${canvas}#xywh=0,0,10,10`)],
      place,
    );
    const figure = document.createElement("figure");
    figure.className = "clover-canvas";
    document.body.appendChild(figure);
    for (const [className, box] of Object.entries(controls)) {
      const piece = document.createElement("div");
      piece.className = className;
      if (className === "clover-canvas-caption") piece.dataset.open = "true";
      piece.getBoundingClientRect = () => rect(box);
      figure.appendChild(piece);
    }
    const { buttons, layer, renderer } = await renderHotspots(
      placed,
      {},
      {
        getCamera: () => ({ x: 500, y: 300, zoom: 1, rotation: 0 }),
        worldToScreenPoint: (point: { x: number; y: number }) => point,
        screenToWorldPoint: (point: { x: number; y: number }) => point,
        panTo,
      },
    );
    figure.appendChild(layer);
    layer.getBoundingClientRect = () =>
      rect({ left: 0, top: 0, width: 1000, height: 600 });
    const [button] = buttons();
    button.getBoundingClientRect = () => rect(at);
    return { button, panTo, renderer: renderer as never };
  };
  /** As a Tab to it does, at once: the hotspot loads it with its first focus. */
  const tab = ({ button, renderer }: Awaited<ReturnType<typeof setup>>) =>
    panClearOfControls(renderer, button);
  // The cluster along the top, at its end, as on a desktop.
  const cluster = {
    "clover-canvas-controls": { left: 700, top: 16, width: 284, height: 36 },
  };

  it("leaves the view alone when it is clear of the controls already", async () => {
    const hotspot = await setup(
      { left: 100, top: 300, width: 40, height: 20 },
      cluster,
    );
    tab(hotspot);
    expect(hotspot.panTo).not.toHaveBeenCalled();
  });

  it("is brought out from under the cluster, no further than needed", async () => {
    const hotspot = await setup(
      { left: 800, top: 20, width: 40, height: 20 },
      cluster,
    );
    tab(hotspot);
    // Down 32px, to the cluster's foot: the view's center goes up as far.
    expect(hotspot.panTo).toHaveBeenCalledWith({ x: 500, y: 268 });
  });

  it("clears the cluster from the side when it is a column, as on a phone", async () => {
    const hotspot = await setup(
      { left: 960, top: 200, width: 20, height: 20 },
      {
        "clover-canvas-controls": {
          left: 948,
          top: 16,
          width: 36,
          height: 300,
        },
      },
    );
    tab(hotspot);
    expect(hotspot.panTo).toHaveBeenCalledWith({ x: 532, y: 300 });
  });

  it("leaves one clear of an open caption alone, however far the caption reaches", async () => {
    const hotspot = await setup(
      { left: 100, top: 30, width: 40, height: 40 },
      {
        ...cluster,
        // Cut from the top, its nearest edge: but only over what lies under it.
        "clover-canvas-caption": {
          left: 632,
          top: 62,
          width: 352,
          height: 188,
        },
      },
    );
    tab(hotspot);
    expect(hotspot.panTo).not.toHaveBeenCalled();
  });

  it("clears a piece it is brought beside by clearing another", async () => {
    const hotspot = await setup(
      { left: 800, top: 20, width: 40, height: 20 },
      {
        ...cluster,
        "clover-canvas-caption": {
          left: 632,
          top: 62,
          width: 352,
          height: 500,
        },
      },
    );
    tab(hotspot);
    // Down to the cluster's foot, beside the caption, so left of it too.
    expect(hotspot.panTo).toHaveBeenCalledWith({ x: 708, y: 268 });
  });

  it("clears the navigator and an open caption too", async () => {
    const hotspot = await setup(
      { left: 820, top: 300, width: 40, height: 20 },
      {
        ...cluster,
        "clover-canvas-navigator": {
          left: 16,
          top: 16,
          width: 110,
          height: 68,
        },
        "clover-canvas-caption": {
          left: 632,
          top: 62,
          width: 352,
          height: 500,
        },
      },
    );
    tab(hotspot);
    // Left of the caption's edge, at 632.
    expect(hotspot.panTo).toHaveBeenCalledWith({ x: 728, y: 300 });
  });

  it("is brought into view from outside it", async () => {
    const hotspot = await setup({
      left: 1200,
      top: 700,
      width: 40,
      height: 20,
    });
    tab(hotspot);
    expect(hotspot.panTo).toHaveBeenCalledWith({ x: 740, y: 420 });
  });

  it("centers one larger than the part clear of the controls", async () => {
    const hotspot = await setup(
      { left: 0, top: 0, width: 1000, height: 100 },
      cluster,
    );
    tab(hotspot);
    // Too wide, so centered across; down to clear the cluster.
    expect(hotspot.panTo).toHaveBeenCalledWith({ x: 500, y: 248 });
  });

  it("leaves a lone video or sound alone, which is held fitted", async () => {
    const hotspot = await setup(
      { left: 800, top: 20, width: 40, height: 20 },
      cluster,
    );
    hotspot.button.closest("figure")!.dataset.navigable = "false";
    tab(hotspot);
    expect(hotspot.panTo).not.toHaveBeenCalled();
  });

  it("is panned once Tab has brought focus to it", async () => {
    const { button, panTo } = await setup(
      { left: 800, top: 20, width: 40, height: 20 },
      cluster,
    );
    button.focus();
    fireEvent.keyUp(button, { key: "Tab" });
    await waitFor(() => expect(panTo).toHaveBeenCalledWith({ x: 500, y: 268 }));
  });

  it("leaves the view alone when focused otherwise, as a click or the handle does", async () => {
    const { button, panTo } = await setup(
      { left: 800, top: 20, width: 40, height: 20 },
      cluster,
    );
    button.focus();
    fireEvent.keyUp(button, { key: "Enter" });
    // Once what pans it has loaded, had it been asked.
    await import("./panClearOfControls");
    await new Promise((resolve) => setTimeout(resolve));
    expect(panTo).not.toHaveBeenCalled();
  });
});

/*
 * Cookbook 0022: a linking hotspot follows its link. To a Canvas or a Manifest, it is a
 * button that asks for it (`onFollow`); to a page on the web, a link.
 */
describe("a linking hotspot", () => {
  const linked = () =>
    placeAnnotations(
      [
        {
          annotation: hotspotJson.items[0].annotations![0].items[0] as never,
          targetIndex: 0,
        },
      ],
      place,
    );

  it("follows its link to a Canvas when pressed, rather than zooming to it", async () => {
    const onFollow = vi.fn();
    const onSelect = vi.fn();
    const { buttons } = await renderHotspots(linked(), { onFollow, onSelect });
    const [button] = buttons();
    expect(button).toHaveAttribute("data-link", "true");
    expect(button).toHaveAccessibleName(
      "A link to a close up of Gänseliesel-Brunnen fountain.",
    );
    fireEvent.click(button);
    expect(onFollow).toHaveBeenCalledWith(
      expect.objectContaining({
        link: expect.objectContaining({
          canvasId: `${hotspotJson.items[1].id}`,
        }),
      }),
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("is picked as any other with nothing to follow it", async () => {
    const onSelect = vi.fn();
    const { buttons } = await renderHotspots(linked(), { onSelect });
    expect(buttons()[0]).not.toHaveAttribute("data-link");
    fireEvent.click(buttons()[0]);
    expect(onSelect).toHaveBeenCalled();
  });

  it("is a link to a page on the web", async () => {
    const placed = placeAnnotations(
      [
        {
          annotation: {
            id: "web",
            type: "Annotation",
            motivation: "linking",
            body: [
              { type: "TextualBody", value: "The fountain's page" },
              { id: "https://example.org/fountain", type: "Text" },
            ],
            target: `${canvas}#xywh=0,0,10,10`,
          } as never,
          targetIndex: 0,
        },
      ],
      place,
    );
    await renderHotspots(placed);
    const link = document.querySelector<HTMLAnchorElement>(
      "a.clover-canvas-annotation",
    )!;
    expect(link).toHaveAttribute("href", "https://example.org/fountain");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAccessibleName("The fountain's page");
  });
});

// Cookbook 0377: an image the annotation carries shows in its popover, over its text.
describe("an image in a hotspot's popover", () => {
  it("is above the words that name it, which say it for assistive technology", async () => {
    const placed = placeAnnotations(
      [
        {
          annotation: imageJson.items[0].annotations[0].items[0] as never,
          targetIndex: 0,
        },
      ],
      place,
    );
    const { buttons } = await renderHotspots(placed);
    const image = buttons()[0].querySelector(".clover-tip > img")!;
    expect(image).toHaveAttribute(
      "src",
      expect.stringContaining("fountain/full/300,/0/default.jpg"),
    );
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(buttons()[0]).toHaveAccessibleName(/Night picture/);
  });
});

/*
 * An annotation whose targets give a region and a time each (`xywh=…&t=…`) follows its
 * recording: the docs' `rudolf-hess-nuremberg` mock marks Rudolf Hess through a film so.
 */
describe("a hotspot that follows a recording", () => {
  const fragment = (value: string) => ({
    type: "SpecificResource",
    source: { id: canvas, type: "Canvas" },
    selector: { type: "FragmentSelector", value },
  });
  // Two stretches that meet, then a gap, then one more, as Presentation 4 groups them.
  const tracked = () =>
    placeAnnotations(
      [
        annotation("hess", {
          type: "Independents",
          items: [
            fragment("xywh=0,0,10,20&t=10,12"),
            fragment("xywh=100,0,10,20&t=12,14"),
            fragment("xywh=500,0,10,20&t=20,22"),
          ],
        }),
      ],
      place,
    );
  /** A recording as the hotspot reads one: its time, whether it plays, its events. */
  const recording = (extra: Record<string, unknown> = {}) =>
    Object.assign(new EventTarget(), {
      currentTime: 0,
      paused: true,
      videoWidth: 0,
      ...extra,
    }) as unknown as HTMLMediaElement;
  const seek = (media: HTMLMediaElement, time: number) =>
    act(() => {
      media.currentTime = time;
      media.dispatchEvent(new Event("seeked"));
    });
  const movedTo = (renderer: any) =>
    renderer.overlays.move.mock.lastCall?.[1]?.x as number | undefined;

  it("is placed by its keys, in time order, its first region its own", () => {
    const [entry] = tracked();
    expect(entry.world).toEqual({ x: 1000, y: 0, width: 10, height: 20 });
    expect(
      entry.track!.map(({ start, end, world }) => [start, end, world.x]),
    ).toEqual([
      [10, 12, 1000],
      [12, 14, 1100],
      [20, 22, 1500],
    ]);
  });

  it("reads the mock's Rudolf Hess, through Presentation 4", () => {
    const [film] = p4(hessJson).items as any[];
    const [page] = film.annotations;
    expect(page.label).toEqual({ en: ["Rudolf Hess"] });
    expect(page.items[0].target.type).toBe("Independents");
    const [hess, removal, back] = placeAnnotations(
      page.items.map((each: any) => ({ annotation: each, targetIndex: 0 })),
      (rect) => rect,
    );
    expect([hess, removal, back].map(({ label }) => label)).toEqual([
      "Hess shows distress",
      "Hess is led out of the dock",
      "Hess returns to the dock",
    ]);
    // Each takes up where the last left off.
    expect(removal.track![0].start).toBeGreaterThan(hess.track!.at(-1)!.end);
    expect(back.track![0].start).toBeGreaterThan(removal.track!.at(-1)!.end);
    expect(hess.track).toHaveLength(page.items[0].target.items.length);
    expect(hess.track![0]).toMatchObject({
      start: 12.62,
      world: { x: 262, y: 151, width: 128, height: 160 },
    });
    // Hidden behind the officer who leans over to him, he is not marked.
    expect(hess.track!.some(({ start, end }) => start < 30 && end > 30)).toBe(
      false,
    );
  });

  it("is there only while the recording is within it, where it is then", async () => {
    const media = recording();
    const { buttons, renderer } = await renderHotspots(tracked(), { media });
    const [hotspot] = buttons();
    // Not there at all, for the pointer, Tab or a screen reader.
    expect(hotspot).toHaveAttribute("hidden");
    seek(media, 11);
    expect(hotspot).not.toHaveAttribute("hidden");
    expect(hotspot).toHaveAttribute("data-track");
    // Halfway from the first region to the next, where the two meet.
    expect(movedTo(renderer)).toBe(1050);
    seek(media, 13);
    expect(movedTo(renderer)).toBe(1100);
    seek(media, 17);
    expect(hotspot).toHaveAttribute("hidden");
    seek(media, 21);
    expect(hotspot).not.toHaveAttribute("hidden");
    expect(movedTo(renderer)).toBe(1500);
  });

  it("moves with each frame of the recording shown while it plays", async () => {
    let onFrame: VideoFrameRequestCallback | undefined;
    const media = recording({
      currentTime: 10,
      videoWidth: 654,
      requestVideoFrameCallback: vi.fn((callback) => {
        onFrame = callback;
        return 1;
      }),
      cancelVideoFrameCallback: vi.fn(),
    });
    const { renderer } = await renderHotspots(tracked(), { media });
    act(() => {
      (media as any).paused = false;
      media.dispatchEvent(new Event("play"));
    });
    // The time of the frame shown, not the playback position, which runs ahead of it.
    media.currentTime = 13;
    act(() => onFrame!(0, { mediaTime: 11.5 } as VideoFrameCallbackMetadata));
    expect(movedTo(renderer)).toBe(1075);
    // Paused, it stops asking for frames.
    act(() => {
      (media as any).paused = true;
      media.dispatchEvent(new Event("pause"));
    });
    expect(
      (media as HTMLVideoElement).cancelVideoFrameCallback,
    ).toHaveBeenCalled();
    expect(movedTo(renderer)).toBe(1100);
  });

  it("follows sound, which has no frames, display frame by display frame", async () => {
    const media = recording({ currentTime: 10 });
    const { renderer } = await renderHotspots(tracked(), { media });
    act(() => {
      (media as any).paused = false;
      media.dispatchEvent(new Event("play"));
    });
    media.currentTime = 11;
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    expect(movedTo(renderer)).toBe(1050);
    act(() => media.dispatchEvent(new Event("ended")));
  });

  it("hands focus to the viewport as it goes, so focus is never lost (WCAG 2.4.3)", async () => {
    const media = recording({ currentTime: 11 });
    const onActivate = vi.fn();
    const { buttons, viewport } = await renderHotspots(tracked(), {
      media,
      onActivate,
    });
    const [hotspot] = buttons();
    act(() => hotspot.focus());
    expect(onActivate).toHaveBeenLastCalledWith("hess");
    seek(media, 17);
    expect(viewport).toHaveFocus();
    // Its highlight goes with it.
    expect(onActivate).toHaveBeenLastCalledWith(null);
  });

  it("waits for a recording on its way, and stands at its first region with none", async () => {
    const waiting = await renderHotspots(tracked(), { media: null });
    expect(waiting.buttons()[0]).toHaveAttribute("hidden");
    waiting.viewport.remove();
    const still = await renderHotspots(tracked());
    expect(still.buttons()[0]).not.toHaveAttribute("hidden");
    expect(still.renderer.overlays.move).not.toHaveBeenCalled();
  });

  /*
   * The active one always wins: whichever moves, each hotspot beneath the active one is
   * masked where the active one is now, and again each time either moves.
   */
  it("masks those beneath it where it is now, and is masked beneath another", async () => {
    const [bench] = placeAnnotations(
      [annotation("bench", `${canvas}#xywh=0,0,600,100`)],
      place,
    );
    const [hess] = tracked();
    const at = (x: number) => ({ ...hess, world: { ...hess.world, x } });
    const mask = (button: HTMLElement) =>
      button.style.getPropertyValue("--clover-annotation-mask");

    // Hess active, moving over the bench.
    const media = recording({ currentTime: 11 });
    const first = await renderHotspots([bench, hess], {
      media,
      active: "hess",
    });
    const [benchButton, hessButton] = first.buttons();
    expect(mask(benchButton)).toBe(maskUnder(bench, at(1050)));
    seek(media, 13);
    expect(mask(benchButton)).toBe(maskUnder(bench, at(1100)));
    expect(mask(hessButton)).toBe("");
    // Gone from the recording, it masks nothing.
    seek(media, 17);
    expect(mask(benchButton)).toBe("");
    first.viewport.remove();

    // The bench active: Hess, moving beneath it, is masked where it lies.
    const other = recording({ currentTime: 11 });
    const second = await renderHotspots([bench, hess], {
      media: other,
      active: "bench",
    });
    const [, moving] = second.buttons();
    expect(mask(moving)).toBe(maskUnder(at(1050), bench));
    seek(other, 13);
    expect(mask(moving)).toBe(maskUnder(at(1100), bench));
  });
});
