import { act, render, screen, waitFor } from "@testing-library/react";
import React, { useEffect } from "react";

import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import { stubViewport } from "../Canvas/testing/viewport";
import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";

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

/** A Manifest of a 3D model and a picture, as a host might want them drawn. */
const model = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.org/things",
  type: "Manifest",
  label: { en: ["Things"] },
  items: [
    {
      id: "https://example.org/things/canvas/model",
      type: "Canvas",
      label: { en: ["A teapot"] },
      width: 1000,
      height: 1000,
      items: [
        {
          id: "https://example.org/things/canvas/model/page",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.org/things/canvas/model/page/1",
              type: "Annotation",
              motivation: "painting",
              body: {
                id: "https://example.org/teapot.glb",
                type: "Model",
                format: "model/gltf-binary",
              },
              target: "https://example.org/things/canvas/model",
            },
          ],
        },
      ],
    },
  ],
};

function ModelViewer({ bodies, children }: Clover.BodyRendererProps) {
  const { total } = Clover.useNavigation();
  return (
    <div data-testid="model" data-total={total}>
      {bodies.map((body) => body.id).join(" ")}
      {children}
    </div>
  );
}

let viewport: ReturnType<typeof stubViewport>;
beforeEach(() => {
  initCloverI18n({ lng: "en" });
  viewport = stubViewport();
});
afterEach(() => viewport.restore());

describe("Body renderers", () => {
  it("draw a view by its painting format, with its bodies, children and Clover's hooks", async () => {
    render(
      <Clover.Root
        iiifContent={model}
        renderers={[{ format: ["model/gltf-binary"], component: ModelViewer }]}
      >
        <Clover.Body>
          <button type="button">A control</button>
        </Clover.Body>
      </Clover.Root>,
    );
    const drawn = await screen.findByTestId("model");
    expect(drawn).toHaveTextContent("https://example.org/teapot.glb");
    expect(drawn).toHaveAttribute("data-total", "1");
    expect(
      screen.getByRole("button", { name: "A control" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".clover-body")).toHaveAttribute(
      "data-renderer",
      "custom",
    );
  });

  it("match by Canvas id, or by a test of their own", async () => {
    const byId = render(
      <Clover.Root
        iiifContent={bookJson}
        renderers={[
          { canvasId: [bookJson.items[0].id], component: ModelViewer },
        ]}
      >
        <Clover.Body />
      </Clover.Root>,
    );
    expect(await screen.findByTestId("model")).toBeInTheDocument();
    byId.unmount();

    render(
      <Clover.Root
        iiifContent={bookJson}
        renderers={[
          {
            match: ({ canvases }) => canvases.length === 1,
            component: ModelViewer,
          },
        ]}
      >
        <Clover.Body />
      </Clover.Root>,
    );
    expect(await screen.findByTestId("model")).toBeInTheDocument();
  });

  it("leave every other view to the Canvas; a Body's own list wins", async () => {
    render(
      <Clover.Root
        iiifContent={bookJson}
        renderers={[
          { canvasId: [bookJson.items[0].id], component: ModelViewer },
        ]}
      >
        <Clover.Body renderers={[]} />
      </Clover.Root>,
    );
    await waitFor(() =>
      expect(document.querySelector(".clover-body")).toHaveAttribute(
        "data-renderer",
        "canvas",
      ),
    );
    expect(screen.queryByTestId("model")).toBeNull();
  });

  it("are not remounted when a host passes an equal list inline on each render", async () => {
    const mounts = vi.fn();
    function Counted(props: Clover.BodyRendererProps) {
      useEffect(() => mounts(), []);
      return <ModelViewer {...props} />;
    }
    function Host({ tick }: { tick: number }) {
      return (
        <Clover.Root
          iiifContent={model}
          data-tick={tick}
          renderers={[{ format: ["model/gltf-binary"], component: Counted }]}
        >
          <Clover.Body />
        </Clover.Root>
      );
    }
    const { rerender } = render(<Host tick={0} />);
    await screen.findByTestId("model");
    act(() => rerender(<Host tick={1} />));
    act(() => rerender(<Host tick={2} />));
    expect(mounts).toHaveBeenCalledTimes(1);
  });
});
