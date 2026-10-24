"use client";

import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import styles from "docs/components/Playground/Playground.module.css";

/*
 * The golden ratio and its powers, which every proportion below is (Mat, 2026-10-23: "use
 * gr rules"): 0.618, 0.382, 0.236.
 */
const G = 2 / (1 + Math.sqrt(5));
const G2 = G * G;
const G3 = G2 * G;
/** The golden angle's complement, 42.5°: how far each barb opens from the shaft. */
const SPREAD = ((180 - 137.5) * Math.PI) / 180;
/** How far into the window a title must come before its arrow draws, as a stroke's words. */
const POINT = "0px 0px -25% 0px";

type Point = { x: number; y: number };
/** A point on a line drawn by hand: where it is, which way it goes, and how wide it is there. */
type Sample = { p: Point; angle: number; width: number };
type Arrow = {
  /** The shaft and the head's two barbs, each a shape, tapered as a brush's stroke is. */
  shaft: string;
  head: string[];
  /** The lines the pen follows, which draw them in (their masks). */
  shaftLine: string;
  headLine: string;
  from: Point;
  to: Point;
  /** The widest the pen goes, which the masks cover. */
  weight: number;
};

const at = ({ x, y }: Point) => `${x.toFixed(1)} ${y.toFixed(1)}`;

/** A cubic's point, and its direction, at `t`. */
function cubic(p: Point[], t: number): { p: Point; angle: number } {
  const u = 1 - t;
  const x =
    u * u * u * p[0].x +
    3 * u * u * t * p[1].x +
    3 * u * t * t * p[2].x +
    t * t * t * p[3].x;
  const y =
    u * u * u * p[0].y +
    3 * u * u * t * p[1].y +
    3 * u * t * t * p[2].y +
    t * t * t * p[3].y;
  const dx =
    3 * u * u * (p[1].x - p[0].x) +
    6 * u * t * (p[2].x - p[1].x) +
    3 * t * t * (p[3].x - p[2].x);
  const dy =
    3 * u * u * (p[1].y - p[0].y) +
    6 * u * t * (p[2].y - p[1].y) +
    3 * t * t * (p[3].y - p[2].y);
  return { p: { x, y }, angle: Math.atan2(dy, dx) };
}

/**
 * A line of varying width as a shape (Mat, 2026-10-23: "allow tapering like we do for the
 * underline swoosh"): along one side, around its end, back along the other, and around its
 * start, its ends round as the swoosh's are.
 */
function outline(samples: Sample[]): string {
  const side = (s: Sample, turn: number) => ({
    x: s.p.x + (Math.cos(s.angle + turn) * s.width) / 2,
    y: s.p.y + (Math.sin(s.angle + turn) * s.width) / 2,
  });
  const round = (s: Sample, from: number) =>
    Array.from({ length: 7 }, (_, step) =>
      side(s, from - (Math.PI * (step + 1)) / 8),
    );
  const first = samples[0];
  const last = samples[samples.length - 1];
  const points = [
    ...samples.map((s) => side(s, Math.PI / 2)),
    ...round(last, Math.PI / 2),
    ...[...samples].reverse().map((s) => side(s, -Math.PI / 2)),
    ...round(first, -Math.PI / 2),
  ];
  return `M${points.map(at).join("L")}Z`;
}

/**
 * A shaft along a cubic, as a kid's marker draws it (Mat, 2026-10-23: "think kids marker.
 * taper should not go to fine point"): coming down a golden share of its weight, never a
 * point, and swelling to its full weight by the line's golden section.
 */
function shaftOf(points: Point[], weight: number): string {
  const steps = 40;
  return outline(
    Array.from({ length: steps + 1 }, (_, step) => {
      const t = step / steps;
      const press = Math.min(1, t / G);
      const ease = press * press * (3 - 2 * press);
      return { ...cubic(points, t), width: weight * (G + (1 - G) * ease) };
    }),
  );
}

/**
 * A head at `tip`, its barbs either side of the way back along the shaft (toward `back`),
 * each full where they meet and easing off a little as the marker lifts, never to a point
 * (Mat, 2026-10-23: "same for endpoint"), as a hand draws one: one barb a little shorter
 * and a little wider than the other, and the marker coming back down a hair off the
 * shaft's end.
 */
function headAt(tip: Point, back: Point, length: number, weight: number) {
  const angle = Math.atan2(back.y - tip.y, back.x - tip.x);
  const vertex = { x: tip.x + length * 0.04, y: tip.y - length * 0.03 };
  const barb = (turn: number, scale: number) => ({
    x: vertex.x + Math.cos(angle + turn) * length * scale,
    y: vertex.y + Math.sin(angle + turn) * length * scale,
  });
  const ends = [barb(-SPREAD, 1), barb(SPREAD + 0.12, 1 - G3 * G2)];
  const stroke = (end: Point) => {
    const way = Math.atan2(end.y - vertex.y, end.x - vertex.x);
    return outline([
      { p: vertex, angle: way, width: weight },
      { p: end, angle: way, width: weight * (1 - G3) },
    ]);
  };
  return {
    head: ends.map(stroke),
    headLine: `M${at(ends[0])}L${at(vertex)}L${at(ends[1])}`,
  };
}

/** Its widest, by the size of the words it comes from: a kid's marker's, chunky. */
const weightOf = (em: number) => Math.max(5, em * 0.2);

/**
 * From the end of "Use a template…" up to the Viewer: in a golden rectangle, its rise the
 * long side, leaving along the line of the words, drifting up a little as it goes, widest
 * at the rectangle's golden section, and turning back as it rises to its tip.
 */
function upTo(start: Point, top: number, em: number): Arrow {
  const rise = start.y - top;
  const reach = rise * G;
  const tip = { x: start.x + reach * G, y: top };
  const leave = { x: start.x + reach * G, y: start.y - rise * 0.03 };
  const turn = { x: start.x + reach, y: start.y - rise * G };
  const weight = weightOf(em);
  return {
    shaft: shaftOf([start, leave, turn, tip], weight),
    shaftLine: `M${at(start)}C${at(leave)} ${at(turn)} ${at(tip)}`,
    ...headAt(tip, turn, em * G, weight),
    from: start,
    to: tip,
    weight,
  };
}

/**
 * From the end of "…or build your own." around past the end of its note and down to the
 * tiles: as wide as clearing what is under it needs (`clear`, its note's end and its call
 * to action's) and never narrower than a golden share of its drop, nor past `limit`; its
 * tip back at a golden share of that width, pointing down to the tiles, and the way down a
 * hair wider than the way out, as a hand's would be.
 */
function downTo(
  start: Point,
  bottom: number,
  clear: number,
  limit: number,
  em: number,
): Arrow {
  const drop = bottom - start.y;
  const room = clear + em * G - start.x;
  const width = Math.min(
    limit - start.x,
    Math.max(room / (G + G3 * G2), drop * G2),
  );
  const tip = { x: start.x + width * G3, y: bottom };
  const out = { x: start.x + width, y: start.y + drop * 0.02 };
  const down = { x: start.x + width * 1.02, y: bottom - drop * G2 };
  const weight = weightOf(em);
  return {
    shaft: shaftOf([start, out, down, tip], weight),
    shaftLine: `M${at(start)}C${at(out)} ${at(down)} ${at(tip)}`,
    ...headAt(tip, down, em * G, weight),
    from: start,
    to: tip,
    weight,
  };
}

/**
 * The choice's two arrows (Mat, 2026-10-23: "make more natural … drawn like our stroke.
 * but gray and faint"), each from the end of its half's title (`data-arrow`), drawn by
 * hand in the choice's own room, faint where the pen comes down and the full gray where it
 * lifts, and drawn once, as the strokes are, when the title comes into view. Measured from
 * the page and drawn again only when the choice's size changes, never as it scrolls, so
 * they fit every window: up from the template to the room under the Viewer, down from the
 * building blocks to the room over the tiles. Decoration, never read.
 */
export function ChoiceArrows() {
  const [drawn, setDrawn] = useState<{
    width: number;
    height: number;
    up: Arrow;
    down: Arrow;
  } | null>(null);
  const upInk = useId();
  const downInk = useId();
  // The layer's own ref: the choice it draws in is its parent, there before the layer is.
  const layer = useRef<SVGSVGElement>(null);
  const upGroup = useRef<SVGGElement>(null);
  const downGroup = useRef<SVGGElement>(null);

  useLayoutEffect(() => {
    const node = layer.current?.parentElement;
    if (!node) return;
    const measure = () => {
      const from = (name: string) =>
        node.querySelector<HTMLElement>(`[data-arrow="${name}"]`);
      const upFrom = from("up");
      const downFrom = from("down");
      if (!upFrom || !downFrom) return;
      const box = node.getBoundingClientRect();
      const above = parseFloat(getComputedStyle(node).marginTop) || 0;
      const parts = node.nextElementSibling;
      const below = parts
        ? parseFloat(getComputedStyle(parts).marginTop) || 0
        : above;
      // The layer's origin: the choice's start, the room over it at its top.
      const local = (x: number, y: number) => ({
        x: x - box.left,
        y: y - box.top + above,
      });
      const startOf = (mark: HTMLElement) => {
        const em = parseFloat(getComputedStyle(mark).fontSize) || 16;
        const rect = mark.getBoundingClientRect();
        // Just past the words' end, at the middle of their lowercase letters.
        return {
          em,
          start: local(rect.left + em * G3, rect.bottom - em * 0.36),
        };
      };
      const up = startOf(upFrom);
      const down = startOf(downFrom);
      const half = downFrom.closest<HTMLElement>(`.${styles.choice} > *`);
      // Where the words and the button under the title end, not their boxes, which run the column's width.
      const ends = [
        ...(half?.querySelectorAll<HTMLElement>("[data-arrow-clear]") ?? []),
      ].map((element) => {
        const words = document.createRange();
        words.selectNodeContents(element);
        return local(words.getBoundingClientRect().right, 0).x;
      });
      const clear = Math.max(...ends, down.start.x);
      const limit = half
        ? local(half.getBoundingClientRect().right, 0).x
        : box.width;
      setDrawn({
        width: box.width,
        height: above + box.height + below,
        up: upTo(up.start, above * (1 - G), up.em),
        down: downTo(
          down.start,
          above + box.height + below * 0.5,
          clear,
          limit,
          down.em,
        ),
      });
    };
    measure();
    const resized = new ResizeObserver(measure);
    resized.observe(node);
    document.fonts?.ready.then(measure);
    return () => resized.disconnect();
  }, []);

  // Each drawn once its title comes into view, and drawn from then on.
  const shown = Boolean(drawn);
  useEffect(() => {
    const node = layer.current?.parentElement;
    if (!shown || !node) return;
    const pairs: [string, SVGGElement | null][] = [
      ["up", upGroup.current],
      ["down", downGroup.current],
    ];
    const observers = pairs.map(([name, group]) => {
      const title = node
        .querySelector(`[data-arrow="${name}"]`)
        ?.closest("h2, h3");
      if (!title || !group) return null;
      const draw = () => group.setAttribute("data-drawn", "");
      if (typeof IntersectionObserver === "undefined") {
        draw();
        return null;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          draw();
          observer.disconnect();
        },
        { rootMargin: POINT, threshold: 1 },
      );
      observer.observe(title);
      return observer;
    });
    return () => observers.forEach((observer) => observer?.disconnect());
  }, [shown]);

  /*
   * Each arrow its shaft and head, shapes filled with its gray (`ink`), each drawn in by a
   * mask that the pen's line uncovers, tail to head, as a marker would draw it
   * (`Playground.module.css`).
   */
  const arrow = (
    key: string,
    ink: string,
    path: Arrow,
    group: React.Ref<SVGGElement>,
  ) => (
    <g key={key} ref={group}>
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={ink}
          x1={path.from.x}
          x2={path.to.x}
          y1={path.from.y}
          y2={path.to.y}
        >
          <stop className={styles.arrowNone} offset="0" />
          <stop className={styles.arrowFaint} offset={G3} />
          <stop className={styles.arrowFull} offset="1" />
        </linearGradient>
        <mask id={`${ink}shaft`} maskUnits="userSpaceOnUse">
          <path
            className={styles.arrowShaftLine}
            d={path.shaftLine}
            pathLength={1}
            strokeWidth={path.weight * 2}
          />
        </mask>
        <mask id={`${ink}head`} maskUnits="userSpaceOnUse">
          <path
            className={styles.arrowHeadLine}
            d={path.headLine}
            pathLength={1}
            strokeWidth={path.weight * 2}
          />
        </mask>
      </defs>
      <path d={path.shaft} fill={`url(#${ink})`} mask={`url(#${ink}shaft)`} />
      {/*
       * The barbs apart, so where they cross each other and the shaft the ink builds up
       * as a marker's does; together, popping a little as the marker lifts, about the tip.
       */}
      <g
        className={styles.arrowTip}
        mask={`url(#${ink}head)`}
        style={{ transformOrigin: `${path.to.x}px ${path.to.y}px` }}
      >
        {path.head.map((barb, index) => (
          <path key={index} d={barb} fill={`url(#${ink})`} />
        ))}
      </g>
    </g>
  );
  return (
    <svg
      ref={layer}
      aria-hidden="true"
      className={styles.arrows}
      focusable="false"
      height={drawn?.height ?? 0}
      viewBox={drawn ? `0 0 ${drawn.width} ${drawn.height}` : undefined}
      width={drawn?.width ?? 0}
    >
      {drawn && arrow("up", upInk, drawn.up, upGroup)}
      {drawn && arrow("down", downInk, drawn.down, downGroup)}
    </svg>
  );
}
