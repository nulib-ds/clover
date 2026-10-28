import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

import modelJson from "../../fixtures/iiif-cookbook/0608-mvm-3d-v4.json";
import { stubViewport } from "../Canvas/testing/viewport";
import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";
import type { Orbit } from "./orbit";
import { registerThreeEngine } from "../../three";

/** The 3D drawing, without WebGL: what the Scene asks of it is recorded. */
const engine = vi.hoisted(() => ({
  load: vi.fn(),
  draw: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
}));
// Clover's own drawing, the default; three.js's, the same engine by another name.
const createEngine = vi.hoisted(() => vi.fn(() => engine));
vi.mock("./cloverEngine", () => ({ createEngine }));
const createThreeEngine = vi.hoisted(() => vi.fn(() => engine));
vi.mock("./engine", () => ({ createEngine: createThreeEngine }));

const scene = modelJson.items[0] as unknown as Record<string, unknown> & {
  id: string;
};

/*
 * jsdom has no PointerEvent: a mouse event that carries the pointer's id and type stands
 * in, so a drag has its `clientX` and `clientY` (as `Split.test.tsx` does).
 */
class PointerEventStandIn extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? "mouse";
  }
}
const nativePointerEvent = window.PointerEvent;
beforeAll(() => {
  window.PointerEvent ??= PointerEventStandIn as typeof PointerEvent;
});
afterAll(() => {
  window.PointerEvent = nativePointerEvent;
});

let viewport: ReturnType<typeof stubViewport>;
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  viewport = stubViewport();
  engine.load.mockResolvedValue({ center: [0, 1, 0], radius: 1 });
  engine.draw.mockClear();
  engine.dispose.mockClear();
  createEngine.mockClear();
  createThreeEngine.mockClear();
});
afterEach(() => viewport.restore());

/** The orbit of the last drawing. */
const lastOrbit = () => engine.draw.mock.calls.at(-1)?.[0] as Orbit;

describe("Scene", () => {
  it("draws Cookbook 0608's model, named by the Scene, with its keys said", async () => {
    render(<Clover.Scene scene={scene as never} />);
    const view = screen.getByRole("img", { name: "A Scene" });
    expect(view).toHaveAttribute("aria-roledescription", "rotatable 3D model");
    expect(view).toHaveAttribute(
      "aria-keyshortcuts",
      expect.stringContaining("ArrowLeft"),
    );
    expect(view).toHaveAccessibleDescription(/arrow keys to rotate the model/);
    await waitFor(() => expect(engine.draw).toHaveBeenCalled());
    expect(engine.load).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          src: "https://fixtures.iiif.io/3d/google/astronaut.glb",
          position: [0, 0, 0],
        }),
      ],
      undefined,
    );
    expect(lastOrbit().theta).toBe(0);
    expect(screen.getByTestId("clover-scene")).toHaveAttribute(
      "data-status",
      "ready",
    );
  });

  it("turns and zooms from its controls, and from the keyboard on the view", async () => {
    render(<Clover.Scene scene={scene as never} />);
    await waitFor(() => expect(engine.draw).toHaveBeenCalled());
    const home = lastOrbit();
    for (const name of [
      "Zoom in",
      "Zoom out",
      "Full screen",
      "Rotate right",
      "Rotate left",
      "Rotate up",
      "Rotate down",
      "Reset view",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
    await waitFor(() => expect(lastOrbit().theta).toBeLessThan(0));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await waitFor(() =>
      expect(lastOrbit().distance).toBeLessThan(home.distance),
    );
    const view = screen.getByRole("img", { name: "A Scene" });
    fireEvent.keyDown(view, { key: "ArrowUp" });
    await waitFor(() => expect(lastOrbit().phi).toBeGreaterThan(home.phi));
    fireEvent.keyDown(view, { key: "0" });
    await waitFor(() => expect(lastOrbit()).toEqual(home));
    // A control's key works from the control too, as its popover says.
    fireEvent.keyDown(screen.getByRole("button", { name: "Reset view" }), {
      key: "r",
    });
    await waitFor(() => expect(lastOrbit().theta).toBeLessThan(0));
  });

  it("turns from a pad in its corner, each way on its side, home in its last corner, zoom beside it", async () => {
    render(<Clover.Scene scene={scene as never} />);
    await waitFor(() => expect(engine.draw).toHaveBeenCalled());
    const pad = screen.getByRole("group", { name: "Rotate" });
    const names = Array.from(pad.querySelectorAll("button")).map((button) =>
      button.getAttribute("aria-label"),
    );
    // In reading order: up, left, right, down, then home in the last corner.
    expect(names).toEqual([
      "Rotate up",
      "Rotate left",
      "Rotate right",
      "Rotate down",
      "Reset view",
    ]);
    // Zoom and full screen sit beside the pad, in the same corner, outside its group.
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    expect(pad).not.toContainElement(zoomIn);
    expect(zoomIn.closest(".clover-scene-navigation")).toContainElement(pad);
    // The disc's globe shows where the view is: turned right, the front's dot goes right.
    // The globe's front: its one circle, on its lines.
    const dot = screen
      .getByTestId("clover-scene-rotate-disc")
      .querySelector("circle")!;
    const before = Number(dot.getAttribute("cx"));
    fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
    await waitFor(() =>
      expect(Number(dot.getAttribute("cx"))).toBeGreaterThan(before),
    );
  });

  it("turns as its disc is dragged, as the view does, the disc hidden from assistive technology", async () => {
    render(<Clover.Scene scene={scene as never} />);
    await waitFor(() => expect(engine.draw).toHaveBeenCalled());
    const disc = screen.getByTestId("clover-scene-rotate-disc");
    expect(disc).toHaveAttribute("aria-hidden", "true");
    // Dragged left, past a tap's slop: the models' front turns left (theta grows).
    fireEvent.pointerDown(disc, { pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(disc, { pointerId: 2, clientX: 80, clientY: 100 });
    fireEvent.pointerMove(disc, { pointerId: 2, clientX: 60, clientY: 100 });
    fireEvent.pointerUp(disc, { pointerId: 2, clientX: 60, clientY: 100 });
    await waitFor(() => expect(lastOrbit().theta).toBeGreaterThan(0));
  });

  it("turns on while a direction is held, and only a step for a press", async () => {
    render(<Clover.Scene scene={scene as never} />);
    await waitFor(() => expect(engine.draw).toHaveBeenCalled());
    const left = screen.getByRole("button", { name: "Rotate left" });
    fireEvent.click(left);
    await waitFor(() => expect(lastOrbit().theta).toBeCloseTo(Math.PI / 4));
    fireEvent.pointerDown(left, { pointerId: 1 });
    // Held past the moment a press becomes a hold, it keeps turning.
    await waitFor(
      () => expect(lastOrbit().theta).toBeGreaterThan(Math.PI / 2),
      {
        timeout: 3000,
      },
    );
    fireEvent.pointerUp(left, { pointerId: 1 });
    const held = lastOrbit().theta;
    // The click a held press ends with is not another step.
    fireEvent.click(left, { detail: 1 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(lastOrbit().theta).toBeLessThan(held + Math.PI / 8);
  });

  it("leaves its controls out on request, keeping a host's own", async () => {
    render(
      <Clover.Scene scene={scene as never} controls={false}>
        <button type="button">Mine</button>
      </Clover.Scene>,
    );
    expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Rotate" })).toBeNull();
    expect(screen.getByRole("button", { name: "Mine" })).toBeInTheDocument();
  });

  it("fetches nothing, its drawing included, until it comes near the window", async () => {
    viewport.restore();
    viewport = stubViewport({ onScreen: false });
    render(<Clover.Scene scene={scene as never} />);
    await act(async () => undefined);
    expect(createEngine).not.toHaveBeenCalled();
    act(() => viewport.scrollIntoView(screen.getByTestId("clover-scene")));
    await waitFor(() => expect(createEngine).toHaveBeenCalled());
  });

  it("says a model could not be loaded, in the middle of the Body, and never shows a broken view", async () => {
    engine.load.mockRejectedValue(new Error("Unexpected end of GLB"));
    render(<Clover.Scene scene={scene as never} />);
    expect(
      await screen.findByText("This model could not be loaded."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This model could not be loaded.").closest("[role]"),
    ).toHaveAttribute("role", "status");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(engine.dispose).toHaveBeenCalled();
  });

  it("loads a Scene of its own from a Manifest, its first Scene", async () => {
    render(<Clover.Scene iiifContent={modelJson as never} />);
    expect(
      await screen.findByRole("img", { name: "A Scene" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(engine.draw).toHaveBeenCalled());
  });

  it("draws with Clover's own renderer, or with three.js once the page registers it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { unmount } = render(<Clover.Scene scene={scene as never} />);
    await waitFor(() => expect(createEngine).toHaveBeenCalled());
    expect(createThreeEngine).not.toHaveBeenCalled();
    unmount();

    // Asked for three.js before it is registered: Clover's own draws, and says so.
    createEngine.mockClear();
    const first = render(
      <Clover.Scene scene={scene as never} engine="three" />,
    );
    await waitFor(() => expect(createEngine).toHaveBeenCalled());
    expect(createThreeEngine).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"three"'));
    first.unmount();

    // Registered, as `@nulib/clover/three` does it.
    registerThreeEngine();
    createEngine.mockClear();
    render(<Clover.Scene scene={scene as never} engine="three" />);
    await waitFor(() => expect(createThreeEngine).toHaveBeenCalled());
    expect(createEngine).not.toHaveBeenCalled();
    await waitFor(() => expect(engine.draw).toHaveBeenCalled());
    warn.mockRestore();
  });

  it("gives the graphics back when it goes", async () => {
    const { unmount } = render(<Clover.Scene scene={scene as never} />);
    await waitFor(() => expect(engine.draw).toHaveBeenCalled());
    unmount();
    expect(engine.dispose).toHaveBeenCalled();
  });
});

describe("Body, for a Scene", () => {
  it("draws a Scene view with Scene, its controls among the Scene's", async () => {
    render(
      <Clover.Root iiifContent={modelJson as never}>
        <Clover.Body>
          <button type="button">A control</button>
        </Clover.Body>
      </Clover.Root>,
    );
    expect(
      await screen.findByRole("img", { name: "A Scene" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".clover-body")).toHaveAttribute(
      "data-renderer",
      "scene",
    );
    expect(
      screen.getByRole("button", { name: "A control" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(engine.draw).toHaveBeenCalled());
  });

  it("lets a renderer of the host's draw it instead, by its format", async () => {
    function Mine() {
      return <div data-testid="mine" />;
    }
    render(
      <Clover.Root iiifContent={modelJson as never}>
        <Clover.Body
          renderers={[{ format: ["model/gltf-binary"], component: Mine }]}
        />
      </Clover.Root>,
    );
    expect(await screen.findByTestId("mine")).toBeInTheDocument();
    expect(createEngine).not.toHaveBeenCalled();
    expect(createThreeEngine).not.toHaveBeenCalled();
  });
});
