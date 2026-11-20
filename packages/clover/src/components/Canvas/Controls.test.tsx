import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

import Canvas from ".";
import { initCloverI18n } from "../../i18n";
import { stubViewport } from "./testing/viewport";

/*
 * The Canvas's annotations menu loads its code as its control is first pointed at,
 * focused or pressed, never just as the Canvas has annotations (Mat, 2026-11-20: "do
 * both"), so a page that never opens it never loads it.
 */
const menu = vi.hoisted(() => ({ loads: 0 }));
vi.mock("./AnnotationMenu", async (importOriginal) => {
  menu.loads++;
  return importOriginal();
});

const listeners: Record<string, (detail?: unknown) => void> = {};
let renderer: Record<string, any>;

vi.mock("../../lib/renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/renderer")>()),
  CanvasRenderer: vi.fn().mockImplementation(() => renderer),
}));

let viewport: ReturnType<typeof stubViewport>;
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  viewport = stubViewport();
  const overlays = document.createElement("div");
  document.body.appendChild(overlays);
  renderer = {
    host: document.createElement("div"),
    setImages: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
    setGestures: vi.fn(),
    setDismiss: vi.fn(),
    dispose: vi.fn(),
    isOpen: false,
    backendKind: "webgl2",
    getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    zoomBy: vi.fn(),
    viewLimits: () => ({ atMax: false, atMin: false, atHome: false }),
    rotateBy: vi.fn(),
    home: vi.fn(),
    invalidate: vi.fn(),
    fitItemRect: vi.fn(),
    fitAnnotation: vi.fn(),
    attachNavigator: vi.fn(() => vi.fn()),
    itemRectToWorld: vi.fn((_: number, rect: any) => rect),
    overlays: { container: overlays, add: vi.fn(() => vi.fn()) },
    on: (event: string, listener: (detail?: unknown) => void) => {
      listeners[event] = listener;
      return () => delete listeners[event];
    },
  };
});
afterEach(() => {
  viewport.restore();
  document.body.innerHTML = "";
});

it("asks for the annotations menu's code only as its control is first used", async () => {
  render(
    <Canvas
      src="a.jpg"
      annotations={[
        {
          targetIndex: 0,
          annotation: {
            id: "https://example.org/1",
            type: "Annotation",
            body: { type: "TextualBody", value: "A fountain", language: "en" },
            target: "https://example.org/canvas#xywh=10,20,30,40",
          } as any,
        },
      ]}
    />,
  );
  // The image opens and its hotspots arrive, with the control that opens their menu.
  act(() => listeners.open());
  await act(async () => {
    await import("./AnnotationState");
  });
  const control = await screen.findByRole("button", { name: "Annotations" });
  expect(
    await screen.findByRole("button", { name: "A fountain" }),
  ).toBeTruthy();
  expect(menu.loads).toBe(0);

  fireEvent.pointerEnter(control);
  await waitFor(() => expect(menu.loads).toBe(1));
  fireEvent.click(control);
  expect(
    await screen.findByTestId("clover-canvas-annotation-menu"),
  ).toBeTruthy();
  expect(control).toHaveAttribute("aria-expanded", "true");
});
