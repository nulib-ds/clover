import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import modelJson from "../../fixtures/iiif-cookbook/0608-mvm-3d-v4.json";
import { stubViewport } from "../Canvas/testing/viewport";
import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";

/*
 * Canvas (and so Timeline) and Scene each write the Body's frame themselves: on a page,
 * only one of them loads, so a shared frame component would add its props to every page
 * and take no copy away (measured 2026-10-27). This holds the two frames to
 * one another instead: the figure, the viewport's name, role, keys and focus, the way
 * out of full screen, and the caption, last, closed by Escape where focus is.
 */

vi.mock("../../lib/renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/renderer")>()),
  CanvasRenderer: vi.fn().mockImplementation(() => ({
    host: document.createElement("div"),
    setImages: vi.fn().mockResolvedValue(undefined),
    setGestures: vi.fn(),
    setDismiss: vi.fn(),
    dispose: vi.fn(),
    isOpen: false,
    backendKind: "webgl2",
    getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    invalidate: vi.fn(),
    attachNavigator: vi.fn(() => vi.fn()),
    overlays: { container: document.createElement("div"), add: vi.fn() },
    on: () => () => undefined,
  })),
}));
const engine = vi.hoisted(() => ({
  load: vi.fn(),
  draw: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock("../Scene/cloverEngine", () => ({ createEngine: () => engine }));

const summary = { en: ["What it shows."] };
const VIEWS = {
  Canvas: () => (
    <Clover.Canvas
      canvases={[{ ...(bookJson.items[0] as object), summary } as never]}
    />
  ),
  Scene: () => (
    <Clover.Scene
      scene={{ ...(modelJson.items[0] as object), summary } as never}
    />
  ),
};

let viewport: ReturnType<typeof stubViewport>;
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  viewport = stubViewport();
  engine.load.mockResolvedValue({ center: [0, 1, 0], radius: 1 });
});
afterEach(() => viewport.restore());

/** What the frame of the view drawn holds, for comparing one view's with the other's. */
async function frameOf(View: () => React.ReactElement) {
  const { unmount } = render(<View />);
  const figure = (await screen.findByRole("figure")) as HTMLElement;
  const view = figure.querySelector<HTMLElement>(
    ":scope > .clover-canvas-viewport",
  )!;
  const described = document.getElementById(
    view.getAttribute("aria-describedby") ?? "",
  );
  const exit = figure.querySelector<HTMLButtonElement>(
    ":scope > .clover-canvas-exit-full-screen",
  );
  const shape = {
    figure: {
      classes: figure.classList.contains("clover-canvas"),
      status: figure.hasAttribute("data-status"),
      fullscreen: figure.getAttribute("data-fullscreen"),
      controls: figure.getAttribute("data-controls"),
      navigable: figure.getAttribute("data-navigable"),
      style: figure.getAttribute("style"),
    },
    viewport: {
      tabIndex: view.tabIndex,
      named: Boolean(view.getAttribute("aria-label")),
      roleDescription: Boolean(view.getAttribute("aria-roledescription")),
      keys: Boolean(view.getAttribute("aria-keyshortcuts")),
      describedInWords: Boolean(described?.textContent),
      describedLang: described?.querySelector("[lang]")
        ? "en"
        : described?.getAttribute("lang"),
      style: [
        view.style.position,
        view.style.inset,
        view.style.overflow,
        view.style.zIndex,
      ],
    },
    exit: { shown: Boolean(exit), hidden: exit?.hidden },
  };
  // The caption: opened from the `i`, last in the figure, closed by Escape anywhere in it.
  const about = screen.getByRole("button", { name: "About" });
  fireEvent.click(about);
  const caption = screen.getByTestId("clover-canvas-caption");
  await waitFor(() => expect(caption).toHaveAttribute("data-open", "true"));
  const last = figure.lastElementChild === caption;
  const labelledBy = Boolean(figure.getAttribute("aria-labelledby"));
  view.focus();
  fireEvent.keyDown(view, { key: "Escape" });
  const closed = caption.getAttribute("data-open") === "false";
  const focusKept = document.activeElement === view;
  unmount();
  return {
    ...shape,
    caption: {
      last,
      labelledBy,
      closed,
      focusKept,
      expanded: about.getAttribute("aria-expanded"),
    },
  };
}

describe("the Body's frame, written by Canvas and by Scene", () => {
  it("is the same frame in each", async () => {
    const canvas = await frameOf(VIEWS.Canvas);
    const scene = await frameOf(VIEWS.Scene);
    expect(scene).toEqual(canvas);
    // And what it is in each.
    expect(canvas.viewport).toMatchObject({
      tabIndex: 0,
      named: true,
      roleDescription: true,
      keys: true,
      describedInWords: true,
      style: ["absolute", "0", "hidden", "-1"],
    });
    expect(canvas.exit).toEqual({ shown: true, hidden: true });
    expect(canvas.caption).toMatchObject({
      last: true,
      labelledBy: true,
      closed: true,
      focusKept: true,
    });
  });
});
