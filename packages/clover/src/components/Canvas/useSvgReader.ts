import { useEffect, useMemo, useState } from "react";

import type { CanvasAnnotation } from "./Annotations";
import { parseAnnotationTarget } from "../../core/annotations";
import type { SvgShape } from "../../core/svg-shape";

/** Reads an SvgSelector's shapes: `core/svg-shape.ts`, loaded when a shape needs it. */
export type SvgReader = (svg: string) => SvgShape | null;

let svgReader: SvgReader | null = null;

/**
 * The SVG reader, once loaded. It loads the first time an annotation in view has an
 * SvgSelector, and not before: rectangles and points need none of it (1.3 kB). The Canvas
 * calls it on every draw, so it lives apart from the hotspot layer, which loads only for a
 * Canvas with annotations.
 */
export function useSvgReader(
  annotations: CanvasAnnotation[] | undefined,
): SvgReader | null {
  const needed = useMemo(
    () =>
      Boolean(
        annotations?.some(
          ({ annotation }) =>
            parseAnnotationTarget(annotation?.target as any)?.svg,
        ),
      ),
    [annotations],
  );
  const [reader, setReader] = useState<SvgReader | null>(() => svgReader);
  useEffect(() => {
    if (!needed || reader) return;
    let live = true;
    void import("../../core/svg-shape").then((module) => {
      svgReader = module.readSvgShape;
      if (live) setReader(() => module.readSvgShape);
    });
    return () => {
      live = false;
    };
  }, [needed, reader]);
  return reader;
}
