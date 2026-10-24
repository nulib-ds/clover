import React, { useEffect, useRef } from "react";

import { attachOrbitGestures } from "./gestures";
import type { Orbit } from "./orbit";
import { type ControlSpec, renderControl } from "../../ui/ControlCluster";
import type { ControlButtons } from "../../ui/controlButtons";

/*
 * A Scene's rotate pad (Mat, 2026-10-23: "rotate controls on scene are not intuitive …
 * a compound control larger than existing controls … in the lower right"), drawn from
 * what other 3D viewers and maps do: one round group in the corner, each way to turn on
 * the side it turns toward, Clover's caret pointing its way, around a disc that is a
 * handle to drag, whose ring shows where the view is, as a map's compass does, and in its
 * last corner the way home, as Canvas's.
 *
 * Its cells are the controls' own buttons (`renderControl`, so `controlButtons` still
 * replaces any of them), over the disc (`Scene.css`). A press turns one step; held, a
 * direction turns on until it is let go. The keyboard has every button, and the view's
 * own keys besides.
 */

/** A direction's place on the pad, and which way, held, it turns: radians a second. */
const DIRECTIONS = {
  rotateUp: { place: "up", rate: [0, Math.PI / 6] },
  rotateLeft: { place: "left", rate: [Math.PI / 2, 0] },
  rotateRight: { place: "right", rate: [-Math.PI / 2, 0] },
  rotateDown: { place: "down", rate: [0, -Math.PI / 6] },
} as const;

type Direction = keyof typeof DIRECTIONS;

/** How long a press lasts before it turns on, as a key held repeats. */
const HOLD_MS = 400;

/**
 * A way to turn's glyph: Clover's caret, the pager's and Items' (`Pager.tsx`'s `Chevron`,
 * in the controls' 512 box), pointing the way it turns: 0° right, then clockwise (Mat,
 * 2026-10-23: "the same as our carets").
 */
export const Caret = ({ rotate }: { rotate: number }) => (
  <path
    fill="none"
    strokeWidth="64"
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M192 96l160 160-160 160"
    transform={`rotate(${rotate} 256 256)`}
  />
);

/** The globe's radius in its 512 box: the svg fills the disc, so nearly to its edge. */
const GLOBE = 236;

/** A coordinate as the glyph writes it. */
const n = (value: number) => value.toFixed(1);

/** Half an ellipse around the globe's center, from one end of an axis around one side. */
function half(rx: number, ry: number, upright: boolean, sweep: 0 | 1) {
  const [from, to] = upright
    ? [`256 ${n(256 - ry)}`, `256 ${n(256 + ry)}`]
    : [`${n(256 - rx)} 256`, `${n(256 + rx)} 256`];
  return `M${from}A${n(rx)} ${n(ry)} 0 0 ${sweep} ${to}`;
}

/**
 * Where the view is, for the disc's glyph (Mat, 2026-10-23: "this ring that rotates …
 * more obviously a sphere"): lines on the ball's own face, as on a globe the models stand
 * at the heart of: its equator as flat as the view is level, its meridian through their
 * front as open as they are turned from the reader, and a dot where their front is. Each
 * line is drawn as two halves, the one around the ball's far side fainter (Mat,
 * 2026-10-23: "the lines in the back should be more translucent"): the equator's far half
 * is above it while the view looks down, the meridian's on the side away from the front
 * while the front faces the reader. Facing the reader, the dot is on the equator's near
 * side, and solid; turned away, on its far side, hollow and faint. Turning right takes
 * the front, and the dot, to the right.
 */
export function orientationOf({ theta, phi }: Pick<Orbit, "theta" | "phi">) {
  const above = Math.PI / 2 - phi;
  const ry = Math.max(1, GLOBE * Math.abs(Math.sin(above)));
  const rx = Math.max(1, GLOBE * Math.abs(Math.sin(theta)));
  const down = above >= 0;
  // The meridian's near half is right of center when sin 2θ is under 0.
  const nearRight = Math.sin(2 * theta) < 0;
  return {
    equator: {
      front: half(GLOBE, ry, false, down ? 0 : 1),
      back: half(GLOBE, ry, false, down ? 1 : 0),
    },
    meridian: {
      front: half(rx, GLOBE, true, nearRight ? 1 : 0),
      back: half(rx, GLOBE, true, nearRight ? 0 : 1),
    },
    x: 256 - GLOBE * Math.sin(theta),
    y: 256 + (down ? 1 : -1) * ry * Math.cos(theta),
    facing: Math.cos(theta) > 0,
  };
}

/** The view's place drawn onto the disc's globe, by hand: no render for a turn. */
export function showOrientation(glyph: SVGGElement | null, orbit: Orbit) {
  const [equatorFront, equatorBack, meridianFront, meridianBack, dot] =
    glyph?.children ?? [];
  if (!dot) return;
  const { equator, meridian, x, y, facing } = orientationOf(orbit);
  equatorFront.setAttribute("d", equator.front);
  equatorBack.setAttribute("d", equator.back);
  meridianFront.setAttribute("d", meridian.front);
  meridianBack.setAttribute("d", meridian.back);
  dot.setAttribute("cx", x.toFixed(1));
  dot.setAttribute("cy", y.toFixed(1));
  dot.setAttribute("fill", facing ? "currentColor" : "none");
  dot.setAttribute("opacity", facing ? "1" : String(BACK));
}

/** How strong the far side's lines are beside the near side's. */
const BACK = 0.3;

/** The disc's globe, as the view stands at home until it is first drawn. */
export const Orientation = React.forwardRef<SVGGElement>(
  function Orientation(_, ref) {
    const home = orientationOf({ theta: 0, phi: (75 * Math.PI) / 180 });
    return (
      <g ref={ref} fill="none" strokeWidth="14" strokeLinecap="round">
        <path d={home.equator.front} />
        <path d={home.equator.back} strokeOpacity={BACK} />
        <path d={home.meridian.front} />
        <path d={home.meridian.back} strokeOpacity={BACK} />
        <circle
          cx={home.x.toFixed(1)}
          cy={home.y.toFixed(1)}
          r="34"
          fill="currentColor"
        />
      </g>
    );
  },
);

export interface RotatePadProps {
  /** Its controls, each in its place around the disc, the way home in the last corner. */
  controls: Partial<Record<Direction | "reset", ControlSpec>>;
  controlButtons?: ControlButtons;
  /** Turns the view, radians about the up axis and across it, while one is held. */
  turn: (dTheta: number, dPhi: number) => void;
  /** Zooms the view, for a pinch on the disc. */
  zoom: (factor: number) => void;
  /** The height a drag on the disc is measured against: the Scene's, as its own drag. */
  span: () => number;
  /** The disc's ring, where the Scene writes the view's place on each draw. */
  indicator: React.Ref<SVGGElement>;
  /** The group's name, as `useContainerName` gives it. */
  name: {
    props: { "aria-label"?: string; "aria-labelledby"?: string };
    node: React.ReactNode;
  };
}

export function RotatePad({
  controls,
  controlButtons,
  turn,
  zoom,
  span,
  indicator,
  name,
}: RotatePadProps) {
  const holding = useRef<{
    timer: number;
    frame: number;
    held: boolean;
  } | null>(null);
  // A press held long enough to turn is not also a click, which would turn a step more.
  const swallow = useRef(false);
  const turning = useRef(turn);
  turning.current = turn;
  const zooming = useRef(zoom);
  zooming.current = zoom;

  /*
   * The disc is the handle (Mat, 2026-10-23: "something you can hold onto and drag to
   * rotate … the button is the disk"): a drag on it turns the models as a drag on the
   * Scene does, and a pinch zooms. A pointer's convenience, hidden from assistive
   * technology as Canvas's navigator is: the arrows and the view's keys reach all it does.
   */
  const disc = useRef<HTMLSpanElement>(null);
  const turns = Boolean(
    controls.rotateUp ||
      controls.rotateLeft ||
      controls.rotateRight ||
      controls.rotateDown,
  );
  useEffect(() => {
    const element = disc.current;
    if (!element) return;
    return attachOrbitGestures(
      element,
      {
        turn: (dTheta, dPhi) => turning.current(dTheta, dPhi),
        zoom: (factor) => zooming.current(factor),
      },
      span,
    );
  }, [span, turns]);

  const stop = (released: boolean) => {
    const hold = holding.current;
    if (!hold) return;
    window.clearTimeout(hold.timer);
    cancelAnimationFrame(hold.frame);
    holding.current = null;
    if (hold.held && released) swallow.current = true;
  };
  useEffect(() => () => stop(false), []);

  const start = (event: React.PointerEvent, direction: Direction) => {
    // The main button, a finger or a pen: not a right click.
    if (event.button > 0) return;
    stop(false);
    swallow.current = false;
    const [dTheta, dPhi] = DIRECTIONS[direction].rate;
    const hold = { timer: 0, frame: 0, held: false };
    hold.timer = window.setTimeout(() => {
      hold.held = true;
      let last = performance.now();
      const step = (now: number) => {
        // A frame's share of a second, never more than a tenth if the page stalled.
        const seconds = Math.min(0.1, Math.max(0, now - last) / 1000);
        last = now;
        turning.current(dTheta * seconds, dPhi * seconds);
        hold.frame = requestAnimationFrame(step);
      };
      hold.frame = requestAnimationFrame(step);
    }, HOLD_MS);
    holding.current = hold;
  };

  const cell = (direction: Direction) => {
    const spec = controls[direction];
    if (!spec) return null;
    return (
      <span
        key={direction}
        className="clover-scene-rotate-cell"
        data-place={DIRECTIONS[direction].place}
        onPointerDown={(event) => start(event, direction)}
        onPointerUp={() => stop(true)}
        onPointerLeave={() => stop(false)}
        onPointerCancel={() => stop(false)}
        // A held Enter repeats a press: one step a press, not a spin.
        onKeyDown={(event) => {
          if (event.repeat && event.key === "Enter") event.preventDefault();
        }}
        onClickCapture={(event) => {
          // A keyboard's click (no pointer, `detail` 0) always counts.
          if (swallow.current && event.detail > 0) {
            event.stopPropagation();
            event.preventDefault();
          }
          swallow.current = false;
        }}
      >
        {renderControl(spec, controlButtons)}
      </span>
    );
  };

  return (
    <div
      className="clover-scene-rotate"
      role="group"
      {...name.props}
      data-testid="clover-scene-rotate"
    >
      {name.node}
      {turns && (
        <span
          ref={disc}
          className="clover-scene-rotate-disc"
          aria-hidden="true"
          data-testid="clover-scene-rotate-disc"
        >
          <svg viewBox="0 0 512 512" width="16" height="16" focusable="false">
            <Orientation ref={indicator} />
          </svg>
        </span>
      )}
      {cell("rotateUp")}
      {cell("rotateLeft")}
      {cell("rotateRight")}
      {cell("rotateDown")}
      {controls.reset && (
        <span className="clover-scene-rotate-cell" data-place="corner">
          {renderControl(controls.reset, controlButtons)}
        </span>
      )}
    </div>
  );
}
