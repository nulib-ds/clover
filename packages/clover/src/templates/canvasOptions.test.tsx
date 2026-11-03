import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import bookJson from "../fixtures/iiif-cookbook/0009-book-1.json";
import { stubViewport } from "../components/Canvas/testing/viewport";
import { initCloverI18n } from "../i18n";
import { CanvasRenderer } from "../lib/renderer";
import * as Templates from "./index";

vi.mock("../lib/renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/renderer")>()),
  CanvasRenderer: vi.fn().mockImplementation(() => ({
    host: document.createElement("div"),
    setImages: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
    setGestures: vi.fn(),
    setDismiss: vi.fn(),
    dispose: vi.fn(),
    isOpen: false,
    backendKind: "webgl2",
    getBounds: () => ({ x: 0, y: 0, width: 1, height: 1 }),
    invalidate: vi.fn(),
    attachNavigator: vi.fn(() => vi.fn()),
    overlays: { container: document.createElement("div"), add: vi.fn() },
    on: () => () => {},
  })),
}));

let viewport: ReturnType<typeof stubViewport>;
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  viewport = stubViewport();
  vi.mocked(CanvasRenderer).mockClear();
});
afterEach(() => viewport.restore());

const canvasOptions = { animationDuration: 1.2, constrainDuringPan: false };
const rendererOptions = () =>
  vi.mocked(CanvasRenderer).mock.calls.map(([, options]) => options);

describe("canvasOptions", () => {
  it.each([
    ["Default", Templates.Default],
    ["Document", Templates.Document],
  ])("%s hands them to its Body's Canvas", async (_, Template) => {
    render(<Template iiifContent={bookJson} canvasOptions={canvasOptions} />);
    await waitFor(() =>
      expect(rendererOptions()).toContainEqual(
        expect.objectContaining(canvasOptions),
      ),
    );
  });

  it("Gallery hands them to its lightbox's Canvas", async () => {
    render(
      <Templates.Gallery
        iiifContent={bookJson}
        canvasOptions={canvasOptions}
      />,
    );
    fireEvent.click((await screen.findAllByRole("option"))[0]);
    await waitFor(() =>
      expect(rendererOptions()).toContainEqual(
        expect.objectContaining(canvasOptions),
      ),
    );
  });
});
