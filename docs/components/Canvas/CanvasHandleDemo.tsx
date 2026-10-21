"use client";

import CloverCanvas from "docs/components/DynamicImports/Canvas";
import { useEffect, useRef, useState } from "react";
import { useMock } from "docs/lib/useMock";
import type { CanvasHandle } from "@nulib/clover";

/**
 * Drives a Canvas through the handle `onReady` returns, and reports the visible region
 * as an `xywh=` fragment — the value a content-state link would carry.
 */
const CanvasHandleDemo = ({
  id,
  body,
  src,
  iiifContent,
  mock,
  isTiledImage,
  annotations,
  label,
}: {
  id?: string;
  body?: any;
  src?: any;
  /** A Canvas (or Manifest) for the Canvas to load itself. */
  iiifContent?: string;
  /** Or one of this site's mocks, by its path under `/mocks/`. */
  mock?: string;
  isTiledImage?: boolean;
  annotations?: any[];
  /**
   * The viewport's accessible name: what the image shows. Loading its own, the Canvas
   * takes its label, as it does each Canvas a link leads it to.
   */
  label?: string;
}) => {
  const mockUrl = useMock(mock ?? "");
  const content = mock ? (mockUrl ?? undefined) : iiifContent;
  const handle = useRef<CanvasHandle | null>(null);
  const [backend, setBackend] = useState("");
  const [region, setRegion] = useState("");
  /*
   * The view's region, written once it settles: the readout is a live region (`output`),
   * and a pan or zoom changes the view every frame, which would be read out as it goes.
   */
  const settle = useRef(0);
  useEffect(() => () => window.clearTimeout(settle.current), []);

  const button = (label: string, action: (h: CanvasHandle) => void) => (
    <button
      type="button"
      onClick={() => handle.current && action(handle.current)}
      style={{
        padding: "0.25rem 0.75rem",
        borderRadius: "999px",
        border: "1px solid currentColor",
        background: "transparent",
        cursor: "pointer",
        font: "inherit",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{ display: "grid", gap: "0.75rem", margin: "1.5rem 0" }}
      data-demo={id ?? "main"}
    >
      <div
        style={{
          position: "relative",
          height: "450px",
          backgroundColor: "#f0f0f0",
        }}
      >
        <CloverCanvas
          body={body}
          src={src}
          iiifContent={content}
          isTiledImage={isTiledImage}
          annotations={annotations}
          label={
            label ??
            (iiifContent || mock
              ? undefined
              : "Göttingen market square, IIIF Image API reference image")
          }
          onReady={(h: CanvasHandle) => {
            handle.current = h;
            setBackend(h.backendKind);
            // Another when a context is lost, or taken anew back in view.
            h.on("backend", () => setBackend(h.backendKind));
          }}
          onViewportChange={(bounds) => {
            window.clearTimeout(settle.current);
            settle.current = window.setTimeout(
              () =>
                setRegion(
                  `xywh=${[bounds.x, bounds.y, bounds.width, bounds.height]
                    .map(Math.round)
                    .join(",")}`,
                ),
              250,
            );
          }}
        />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {button("Zoom in", (h) => h.zoomBy(2))}
        {button("Zoom out", (h) => h.zoomBy(0.5))}
        {button("Rotate", (h) => h.rotateBy(90))}
        {button("Home", (h) => h.home())}
      </div>
      <output
        style={{
          display: "block",
          minHeight: "1.5rem",
          fontFamily: "monospace",
          fontSize: "0.875rem",
        }}
      >
        {backend ? `backend: ${backend} · ${region}` : "Loading…"}
      </output>
    </div>
  );
};

export default CanvasHandleDemo;
