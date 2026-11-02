"use client";

import CloverCanvas from "docs/components/DynamicImports/Canvas";
import { Fragment, useEffect, useId, useRef, useState } from "react";
import type { CanvasHandle } from "@nulib/clover";
import styles from "./CanvasHandleDemo.module.css";

/**
 * Zoom levels to jump to. World units are the image's own pixels, so the camera's
 * `zoom` is screen pixels per image pixel: 1 is the image at 100%.
 */
const LEVELS = [0.25, 0.5, 1];

/**
 * A Canvas driven by controls of the page's own, through the handle `onReady` passes:
 * zoom by a step or to a level, turn, reset and frame an `xywh` region, each animated or
 * not, and the region in view as `onViewportChange` reports it. Its code on the Canvas
 * page ("Canvas handles and callbacks") is this, written plainly: keep the two in step.
 */
const CanvasHandleDemo = ({
  src,
  isTiledImage,
  label,
  region: start,
}: {
  src: string;
  isTiledImage?: boolean;
  /** The viewport's accessible name: what the image shows. */
  label: string;
  /** The region the field starts with, in the image's pixels. */
  region: string;
}) => {
  const id = useId();
  const [canvas, setCanvas] = useState<CanvasHandle | null>(null);
  const [animate, setAnimate] = useState(true);
  const [region, setRegion] = useState(start);
  const [invalid, setInvalid] = useState(false);
  const [inView, setInView] = useState("");
  /*
   * The region in view, written once the view settles: the readout is a live region
   * (`output`), and a pan or zoom moves the view every frame.
   */
  const settle = useRef(0);
  useEffect(() => () => window.clearTimeout(settle.current), []);

  const zoomTo = (level: number) =>
    canvas?.zoomBy(level / canvas.getCamera().zoom, undefined, animate);
  const rotate = (degrees: number) =>
    canvas?.setRotation(canvas.getRotation() + degrees, !animate);
  const goTo = () => {
    const [x, y, width, height] = region
      .replace("xywh=", "")
      .split(",")
      .map(Number);
    const valid =
      [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0;
    setInvalid(!valid);
    if (valid) canvas?.fitBounds({ x, y, width, height }, !animate);
  };

  const button = (text: string, action: () => void, name?: string) => (
    <button
      type="button"
      className={styles.button}
      disabled={!canvas}
      aria-label={name}
      onClick={action}
    >
      {text}
    </button>
  );

  return (
    <div className={styles.demo}>
      <div className={styles.view}>
        <CloverCanvas
          src={src}
          isTiledImage={isTiledImage}
          label={label}
          onReady={setCanvas}
          onViewportChange={({ x, y, width, height }) => {
            window.clearTimeout(settle.current);
            settle.current = window.setTimeout(
              () => setInView([x, y, width, height].map(Math.round).join(",")),
              250,
            );
          }}
        />
      </div>
      <div className={styles.controls}>
        <div className={styles.group}>
          {button("Zoom in", () => canvas?.zoomBy(2, undefined, animate))}
          {button("Zoom out", () => canvas?.zoomBy(0.5, undefined, animate))}
        </div>
        <div
          className={styles.group}
          role="group"
          aria-labelledby={`${id}-level`}
        >
          <span id={`${id}-level`} className={styles.name}>
            Zoom to
          </span>
          {LEVELS.map((level) => (
            <Fragment key={level}>
              {button(
                `${level * 100}%`,
                () => zoomTo(level),
                `Zoom to ${level * 100}%`,
              )}
            </Fragment>
          ))}
        </div>
        <div className={styles.group}>
          {button("Rotate left", () => rotate(-90))}
          {button("Rotate right", () => rotate(90))}
          {button("Reset", () => canvas?.home(!animate))}
        </div>
        <form
          className={styles.group}
          onSubmit={(event) => {
            event.preventDefault();
            goTo();
          }}
        >
          <label htmlFor={`${id}-region`} className={styles.name}>
            Region (xywh)
          </label>
          <input
            id={`${id}-region`}
            className={styles.field}
            value={region}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={invalid}
            aria-describedby={invalid ? `${id}-error` : undefined}
            onChange={(event) => {
              setRegion(event.target.value);
              setInvalid(false);
            }}
          />
          <button type="submit" className={styles.button} disabled={!canvas}>
            Go to region
          </button>
          {invalid && (
            <p id={`${id}-error`} className={styles.error}>
              Give four numbers: x, y, width and height.
            </p>
          )}
        </form>
        <label className={styles.switch}>
          <input
            type="checkbox"
            checked={animate}
            onChange={(event) => setAnimate(event.target.checked)}
          />
          Animate
        </label>
      </div>
      <output className={styles.readout}>
        {canvas ? `In view: xywh=${inView}` : "Loading…"}
      </output>
    </div>
  );
};

export default CanvasHandleDemo;
