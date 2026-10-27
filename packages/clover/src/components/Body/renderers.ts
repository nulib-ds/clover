import type React from "react";

import { paintedBodies } from "../../core/painted-bodies";
import type { Container } from "../../core/presentation";

/**
 * Renderers of your own for some views, drawn by `Body` in place of `Canvas`: a 3D
 * model, a PDF, a map, anything a Canvas paints that Clover does not draw, or draws
 * differently than you want. The successor to 3.x's `customDisplays`.
 */

export interface BodyRendererProps {
  /** The view's Canvases, in Presentation 4: one, or two for a spread. */
  canvases: Container[];
  /**
   * The bodies the view's Canvases paint, unwrapped: a `Choice` as its first item, a
   * `SpecificResource` as its `source`, Presentation 4's groups as their items.
   */
  bodies: Array<Record<string, any>>;
  /** `Body`'s children (its controls), to place if the renderer wants them. */
  children?: React.ReactNode;
}

export interface BodyRenderer {
  /** Draws a view showing one of these Canvases… */
  canvasId?: string[];
  /** …or painting a body of one of these formats (`model/gltf-binary`, `application/pdf`)… */
  format?: string[];
  /** …or any view this says yes to. */
  match?: (view: Omit<BodyRendererProps, "children">) => boolean;
  /**
   * What draws it. It renders inside the Root, so Clover's hooks work in it
   * (`useActiveCanvas`, `useNavigation`, `useClover`…), as 3.x's `hooks` prop gave.
   */
  component: React.ComponentType<BodyRendererProps>;
}

/** Every body the Canvases paint, unwrapped, in painting order. */
export function paintingBodies(
  canvases: Container[],
): Array<Record<string, any>> {
  return canvases.flatMap((canvas) =>
    paintedBodies(canvas).map(({ body }) => body),
  );
}

/** The first renderer that draws this view, or null for `Canvas` to draw it. */
export function pickRenderer(
  renderers: BodyRenderer[] | undefined,
  view: Omit<BodyRendererProps, "children">,
): BodyRenderer | null {
  if (!renderers?.length || !view.canvases.length) return null;
  const ids = view.canvases.map((canvas) => canvas.id);
  const formats = view.bodies.map((body) => body?.format).filter(Boolean);
  return (
    renderers.find(
      (renderer) =>
        renderer.canvasId?.some((id) => ids.includes(id)) ||
        renderer.format?.some((format) => formats.includes(format)) ||
        Boolean(renderer.match?.(view)),
    ) ?? null
  );
}

/** Whether two lists of renderers are the same, item by item: what an inline array is. */
export function sameRenderers(
  a: BodyRenderer[] | undefined,
  b: BodyRenderer[] | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every(
    (renderer, index) =>
      renderer.component === b[index].component &&
      renderer.match === b[index].match &&
      JSON.stringify([renderer.canvasId, renderer.format]) ===
        JSON.stringify([b[index].canvasId, b[index].format]),
  );
}
