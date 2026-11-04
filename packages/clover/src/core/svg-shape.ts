/**
 * An SvgSelector's shapes, read for drawing over an image: their geometry, and the box
 * that holds them (in the target's own coordinates), so a hotspot can be placed, zoomed
 * to, and drawn as the shape itself.
 *
 * The markup is never injected. Only geometry elements are read — `path`, `polygon`,
 * `polyline`, `rect`, `circle`, `ellipse`, `line` — and only their numeric attributes, each
 * checked; anything else (scripts, `foreignObject`, styles, handlers, links) is dropped.
 */

import { trusted } from "./trusted";

export interface SvgShapeElement {
  tag: "path" | "polygon" | "polyline" | "rect" | "circle" | "ellipse" | "line";
  /** Geometry attributes only, validated. */
  attributes: Record<string, string>;
}

export interface SvgShape {
  /** The box the shapes fill, in the target's coordinates. */
  box: { x: number; y: number; width: number; height: number };
  shapes: SvgShapeElement[];
}

const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;
const POINTS = /^[\d\s.,eE+-]*$/;
const PATH = /^[\d\s.,eE+\-MmLlHhVvCcSsQqTtAaZz]*$/;

const GEOMETRY: Record<SvgShapeElement["tag"], string[]> = {
  path: ["d"],
  polygon: ["points"],
  polyline: ["points"],
  rect: ["x", "y", "width", "height", "rx", "ry"],
  circle: ["cx", "cy", "r"],
  ellipse: ["cx", "cy", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
};

/** The shapes of an SvgSelector's `value`, or null if it holds none Clover can draw. */
export function readSvgShape(svg: string): SvgShape | null {
  if (typeof DOMParser === "undefined" || !svg) return null;
  let doc: Document;
  try {
    // Read where nothing runs: through Clover's policy where Trusted Types are required.
    doc = new DOMParser().parseFromString(trusted(svg), "image/svg+xml");
  } catch {
    return null;
  }
  if (doc.querySelector("parsererror")) return null;

  const shapes: SvgShapeElement[] = [];
  const points: Array<[number, number]> = [];
  for (const element of Array.from(
    doc.querySelectorAll(Object.keys(GEOMETRY).join(",")),
  )) {
    const tag = element.localName as SvgShapeElement["tag"];
    const attributes: Record<string, string> = {};
    for (const name of GEOMETRY[tag]) {
      const value = element.getAttribute(name)?.trim();
      if (value == null || value === "") continue;
      const valid =
        name === "d"
          ? PATH.test(value)
          : name === "points"
            ? POINTS.test(value)
            : NUMBER.test(value);
      if (valid) attributes[name] = value;
    }
    const extent = extentOf(tag, attributes);
    if (!extent.length) continue;
    shapes.push({ tag, attributes });
    points.push(...extent);
  }
  if (!shapes.length) return null;

  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return { box: { x, y, width, height }, shapes };
}

const num = (attributes: Record<string, string>, name: string) =>
  Number(attributes[name] ?? 0);

/** The points that bound one element (control points included, for curves). */
function extentOf(
  tag: SvgShapeElement["tag"],
  attributes: Record<string, string>,
): Array<[number, number]> {
  switch (tag) {
    case "polygon":
    case "polyline": {
      const values = (attributes.points ?? "")
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);
      const pairs: Array<[number, number]> = [];
      for (let i = 0; i + 1 < values.length; i += 2) {
        pairs.push([values[i], values[i + 1]]);
      }
      return pairs.length >= 2 ? pairs : [];
    }
    case "rect": {
      const [x, y, w, h] = ["x", "y", "width", "height"].map((n) =>
        num(attributes, n),
      );
      return w > 0 && h > 0
        ? [
            [x, y],
            [x + w, y + h],
          ]
        : [];
    }
    case "circle": {
      const [cx, cy, r] = ["cx", "cy", "r"].map((n) => num(attributes, n));
      return r > 0
        ? [
            [cx - r, cy - r],
            [cx + r, cy + r],
          ]
        : [];
    }
    case "ellipse": {
      const [cx, cy, rx, ry] = ["cx", "cy", "rx", "ry"].map((n) =>
        num(attributes, n),
      );
      return rx > 0 && ry > 0
        ? [
            [cx - rx, cy - ry],
            [cx + rx, cy + ry],
          ]
        : [];
    }
    case "line":
      return [
        [num(attributes, "x1"), num(attributes, "y1")],
        [num(attributes, "x2"), num(attributes, "y2")],
      ];
    case "path":
      return pathExtent(attributes.d ?? "");
  }
}

/** Every point a path passes through or pulls towards, absolute, for its bounding box. */
export function pathExtent(d: string): Array<[number, number]> {
  const tokens = d.match(
    /[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi,
  );
  if (!tokens) return [];
  const out: Array<[number, number]> = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let command = "";
  let i = 0;
  const next = () => Number(tokens[i++]);
  const hasNumber = () => i < tokens.length && !/[a-z]/i.test(tokens[i]);
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i])) command = tokens[i++];
    else if (!command) return [];
    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();
    const at = (dx: number, dy: number): [number, number] =>
      relative ? [x + dx, y + dy] : [dx, dy];
    if (upper === "Z") {
      x = startX;
      y = startY;
      continue;
    }
    if (!hasNumber()) return out;
    switch (upper) {
      case "M":
      case "L":
      case "T": {
        [x, y] = at(next(), next());
        if (upper === "M") {
          startX = x;
          startY = y;
          // Further pairs after a moveto are linetos.
          command = relative ? "l" : "L";
        }
        out.push([x, y]);
        break;
      }
      case "H":
        x = relative ? x + next() : next();
        out.push([x, y]);
        break;
      case "V":
        y = relative ? y + next() : next();
        out.push([x, y]);
        break;
      case "C": {
        const c1 = at(next(), next());
        const c2 = at(next(), next());
        [x, y] = at(next(), next());
        out.push(c1, c2, [x, y]);
        break;
      }
      case "S":
      case "Q": {
        const c = at(next(), next());
        [x, y] = at(next(), next());
        out.push(c, [x, y]);
        break;
      }
      case "A": {
        const rx = Math.abs(next());
        const ry = Math.abs(next());
        i += 3; // rotation, large-arc and sweep flags
        const from: [number, number] = [x, y];
        [x, y] = at(next(), next());
        // The arc stays within its radii of both ends: a box that holds it.
        out.push(
          [Math.min(from[0], x) - rx, Math.min(from[1], y) - ry],
          [Math.max(from[0], x) + rx, Math.max(from[1], y) + ry],
        );
        break;
      }
      default:
        return out;
    }
    if (out.some(([px, py]) => !Number.isFinite(px) || !Number.isFinite(py))) {
      return [];
    }
  }
  return out;
}
