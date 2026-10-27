import { WebGL2Backend } from "./WebGL2Backend";
import { IDENTITY } from "../../math/affine";
import { canvasWithFakeGl, createFakeGl } from "../../testing/fakeGl";

const bitmap = { width: 100, height: 50 } as unknown as ImageBitmap;

function command(overrides = {}) {
  return {
    key: "a",
    source: bitmap,
    width: 100,
    height: 50,
    transform: { ...IDENTITY },
    opacity: 1,
    ...overrides,
  };
}

describe("WebGL2Backend", () => {
  it("returns null where WebGL2 is unavailable", () => {
    const canvas = document.createElement("canvas");
    canvas.getContext = (() => null) as HTMLCanvasElement["getContext"];
    expect(WebGL2Backend.create(canvas)).toBeNull();
  });

  it("uploads a still image once and draws it every frame", () => {
    const fake = createFakeGl();
    const backend = WebGL2Backend.create(canvasWithFakeGl(fake))!;
    backend.resize(200, 100, 2);

    for (let frame = 0; frame < 3; frame++) {
      backend.begin();
      expect(backend.draw(command())).toBe("drawn");
      backend.end();
    }

    expect(fake.count("texImage2D")).toBe(1);
    expect(fake.count("generateMipmap")).toBe(1);
    expect(fake.count("drawArrays")).toBe(3);
    expect(backend.canvas.width).toBe(400);
  });

  it("reports cross-origin pixels as tainted rather than throwing", () => {
    const fake = createFakeGl();
    const backend = WebGL2Backend.create(canvasWithFakeGl(fake))!;
    fake.taint();
    backend.begin();
    expect(backend.draw(command())).toBe("tainted");
    backend.end();
    expect(fake.count("drawArrays")).toBe(0);
  });

  it("frees textures on release and gives the context back on dispose", () => {
    const fake = createFakeGl();
    const backend = WebGL2Backend.create(canvasWithFakeGl(fake))!;
    backend.begin();
    backend.draw(command());
    backend.end();
    // Held, for the renderer's upload budget, until released.
    expect(backend.has("a")).toBe(true);
    backend.release("a");
    expect(fake.count("deleteTexture")).toBe(1);
    expect(backend.has("a")).toBe(false);

    backend.dispose();
    expect(fake.loseContext).toHaveBeenCalled();
    expect(backend.draw(command())).toBe("skipped");
  });

  it("skips drawing once the context is lost, and tells the renderer, which lets it go", () => {
    const fake = createFakeGl();
    const onLost = vi.fn();
    const backend = WebGL2Backend.create(canvasWithFakeGl(fake), { onLost })!;
    backend.begin();
    backend.draw(command());
    backend.end();

    backend.canvas.dispatchEvent(new Event("webglcontextlost"));
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(backend.draw(command())).toBe("skipped");
    expect(backend.has("a")).toBe(false);
  });
});
