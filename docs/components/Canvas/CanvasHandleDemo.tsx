import CloverCanvas from "docs/components/DynamicImports/Canvas";
import { useRef, useState } from "react";
import type { CanvasHandle } from "@nulib/clover";

/**
 * Drives a Canvas through the handle `onReady` returns, and reports the visible region
 * as an `xywh=` fragment — the value a content-state link would carry.
 */
const CanvasHandleDemo = ({
  id,
  body,
  src,
  isTiledImage,
  annotations,
  label = "Göttingen market square, IIIF Image API reference image",
}: {
  id?: string;
  body?: any;
  src?: any;
  isTiledImage?: boolean;
  annotations?: any[];
  /** The viewport's accessible name: what the image shows. */
  label?: string;
}) => {
  const handle = useRef<CanvasHandle | null>(null);
  const [backend, setBackend] = useState("");
  const [region, setRegion] = useState("");

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
          isTiledImage={isTiledImage}
          annotations={annotations}
          label={label}
          onReady={(h: CanvasHandle) => {
            handle.current = h;
            setBackend(h.backendKind);
          }}
          onViewportChange={(bounds) =>
            setRegion(
              `xywh=${[bounds.x, bounds.y, bounds.width, bounds.height]
                .map(Math.round)
                .join(",")}`,
            )
          }
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
