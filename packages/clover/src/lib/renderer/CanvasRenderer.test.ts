import { GOTTINGEN_V2_1, GOTTINGEN_V3 } from "../../fixtures/iiif-image/info";
import { CanvasRenderer } from "./CanvasRenderer";
import { MAX_CONTEXTS } from "./backends/contexts";
import { clearInfoCache } from "./sources/imageService";
import { loadImage } from "./io/decode";
import { createFakeGl, type FakeGl } from "./testing/fakeGl";

vi.mock("./io/decode", () => ({
  loadImage: vi.fn(),
  releaseImage: vi.fn(),
}));

const mockedLoad = vi.mocked(loadImage);

function bitmap(width: number, height: number) {
  return {
    kind: "bitmap" as const,
    source: { width, height, close: vi.fn() } as unknown as ImageBitmap,
    width,
    height,
    naturalWidth: width,
    naturalHeight: height,
    opaque: false as const,
  };
}

function element(width: number, height: number, opaque: boolean) {
  const img = document.createElement("img");
  Object.defineProperty(img, "complete", { value: true });
  Object.defineProperty(img, "naturalWidth", { value: width });
  return {
    kind: "element" as const,
    source: img,
    width,
    height,
    naturalWidth: width,
    naturalHeight: height,
    opaque,
  };
}

/** Frames run on timers here; wait out a few of them. */
const frames = (n = 3) =>
  new Promise<void>((resolve) => {
    let left = n;
    const step = () => (--left <= 0 ? resolve() : setTimeout(step, 0));
    setTimeout(step, 0);
  });

let fake: FakeGl;
let webgl = true;

beforeEach(() => {
  fake = createFakeGl();
  webgl = true;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((
    type: string,
  ) => {
    if (type === "webgl2") return webgl ? fake.gl : null;
    if (type === "2d") {
      return {
        drawImage: vi.fn(),
        setTransform: vi.fn(),
        clearRect: vi.fn(),
      };
    }
    return null;
  }) as any);
  mockedLoad.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearInfoCache();
});

function serveInfo(json: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(json) }),
  );
}

/** Answer every `info.json` with Göttingen's, its `id` the service asked for. */
function serveInfos() {
  const fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    json: () =>
      Promise.resolve({
        ...GOTTINGEN_V3,
        id: String(url).replace(/\/info\.json$/, ""),
      }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** A Göttingen-sized page of a continuous scene: `index` places it, side by side. */
const page = (name: string, index: number) => ({
  id: name,
  service: `https://example.org/iiif/${name}`,
  width: 4032,
  height: 3024,
  placement: { x: index * 4032, y: 0, width: 4032, height: 3024 },
});

/** The page a request is for, by its service's name. */
const pageOf = (url: string) => String(url).match(/\/iiif\/(\w+)\//)?.[1];

/** Answer every tile request with a bitmap of the size its URL asks for. */
function serveTiles() {
  mockedLoad.mockImplementation(async (url: string) => {
    const size = url.match(/\/(\d+),(\d*)\/0\//);
    const w = size ? Number(size[1]) : 512;
    const h = size && size[2] ? Number(size[2]) : w;
    return bitmap(w, h);
  });
}

function host(width = 800, height = 600) {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

describe("CanvasRenderer", () => {
  it("lets a release glide on only where the system allows motion", () => {
    // Every move is made at once under reduced motion, so a glide would jump the image.
    const glide = () => {
      const renderer = new CanvasRenderer(host(), {});
      const { options } = (
        renderer as unknown as {
          gestures: { options: { flickMomentum: number } };
        }
      ).gestures;
      renderer.dispose();
      return options.flickMomentum;
    };
    expect(glide()).toBe(0.25);
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    try {
      expect(glide()).toBe(0);
    } finally {
      window.matchMedia = matchMedia;
    }
  });

  it("opens on the first images, fitted, in the image's own pixels", async () => {
    mockedLoad.mockResolvedValue(bitmap(2048, 1306));
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    const opened = vi.fn();
    renderer.on("open", opened);

    await renderer.setImages([
      { id: "a", url: "a.jpg", width: 8949, height: 5709 },
    ]);
    await frames();

    expect(opened).toHaveBeenCalledTimes(1);
    expect(renderer.backendKind).toBe("webgl2");
    expect(renderer.getHomeBounds()).toEqual({
      x: 0,
      y: 0,
      width: 8949,
      height: 5709,
    });
    // Landscape image in a 4:3 Body: the width fits exactly.
    const bounds = renderer.getBounds();
    expect(bounds.x).toBeCloseTo(0, 6);
    expect(bounds.width).toBeCloseTo(8949, 6);
    expect(fake.count("drawArrays")).toBeGreaterThan(0);
    renderer.dispose();
  });

  it("lays several images side by side at the first one's height", async () => {
    mockedLoad
      .mockResolvedValueOnce(bitmap(1000, 500))
      .mockResolvedValueOnce(bitmap(400, 400));
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    await renderer.setImages([
      { id: "a", url: "a.jpg" },
      { id: "b", url: "b.jpg" },
    ]);
    // The second, 400 square, placed in the world beside the first, scaled to its height.
    expect(
      renderer.itemRectToWorld(1, { x: 0, y: 0, width: 400, height: 400 }),
    ).toEqual({
      x: 1000,
      y: 0,
      width: 500,
      height: 500,
    });
    expect(renderer.getHomeBounds()).toEqual({
      x: 0,
      y: 0,
      width: 1500,
      height: 500,
    });
    renderer.dispose();
  });

  it("keeps its host's padding clear at home, as the placeholder does", async () => {
    mockedLoad.mockResolvedValue(bitmap(1000, 500));
    const el = host();
    // Uneven, to show the picture centers in what is left, not in the Body.
    el.style.padding = "16px 16px 16px 48px";
    const renderer = new CanvasRenderer(el, { animationTime: 0 });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);

    // 736 × 568 left of 800 × 600: the width fits, centered between 48 and 784.
    const topLeft = renderer.worldToScreenPoint({ x: 0, y: 0 });
    const bottomRight = renderer.worldToScreenPoint({ x: 1000, y: 500 });
    expect(topLeft.x).toBeCloseTo(48, 6);
    expect(bottomRight.x).toBeCloseTo(784, 6);
    expect((topLeft.y + bottomRight.y) / 2).toBeCloseTo(300, 6);
    renderer.dispose();
  });

  it("frames an annotation clear of the controls over the view, turned too", async () => {
    mockedLoad.mockResolvedValue(bitmap(1000, 1000));
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);
    // What the controls cover: the hotspots' layer's scroll padding (`Annotations.css`).
    const layer = document.createElement("div");
    layer.style.scrollPaddingTop = "60px";
    layer.style.scrollPaddingBottom = "100px";
    renderer.overlays = { container: layer } as never;

    for (const turns of [0, 1]) {
      if (turns) renderer.rotateBy(90);
      // 300 × 300 with its padding of a tenth of the image each side: 500 × 500, in the
      // 440 left between 60 and 160 from the 600px Body's foot.
      renderer.fitAnnotation({ x: 400, y: 400, width: 300, height: 300 }, true);
      const corners = [
        renderer.worldToScreenPoint({ x: 300, y: 300 }),
        renderer.worldToScreenPoint({ x: 800, y: 800 }),
      ];
      const ys = corners.map((point) => point.y).sort((a, b) => a - b);
      expect(ys[0]).toBeCloseTo(60, 6);
      expect(ys[1]).toBeCloseTo(500, 6);
    }
    renderer.overlays = null;
    renderer.dispose();
  });

  it("keeps zoom within its limits", async () => {
    mockedLoad.mockResolvedValue(bitmap(1000, 1000));
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);

    renderer.zoomBy(1000, undefined, false);
    expect(renderer.getCamera().zoom).toBe(1.1);

    renderer.zoomBy(0.0001, undefined, false);
    const { home, min } = renderer.getZoomLimits();
    expect(renderer.getCamera().zoom).toBe(min);
    expect(min).toBeCloseTo(home * 0.9);
    renderer.dispose();
  });

  it("enlarges a small image to fill the box at home, unless upscale is off", async () => {
    mockedLoad.mockResolvedValue(bitmap(200, 100));
    const renderer = new CanvasRenderer(host(), {
      animationTime: 0,
      maxZoomPixelRatio: 1,
    });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);
    renderer.home(true);
    expect(renderer.getCamera().zoom).toBeGreaterThan(1);
    renderer.dispose();
  });

  it("holds home at maxZoomPixelRatio, centered, with upscale off", async () => {
    mockedLoad.mockResolvedValue(bitmap(200, 100));
    const renderer = new CanvasRenderer(host(), {
      animationTime: 0,
      maxZoomPixelRatio: 1,
      upscale: false,
    });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);
    renderer.home(true);
    const { home, min, max } = renderer.getZoomLimits();
    expect(home).toBe(1);
    expect(max).toBe(1);
    expect(min).toBeCloseTo(0.9);
    expect(renderer.getCamera().zoom).toBe(1);
    expect(renderer.getCamera().x).toBeCloseTo(100);
    expect(renderer.getCamera().y).toBeCloseTo(50);
    expect(renderer.viewLimits()).toEqual({
      atMax: true,
      atMin: false,
      atHome: true,
    });
    renderer.dispose();
  });

  it("still fits a large image to the box with upscale off", async () => {
    mockedLoad.mockResolvedValue(bitmap(4000, 3000));
    const renderer = new CanvasRenderer(host(), {
      animationTime: 0,
      upscale: false,
    });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);
    renderer.home(true);
    const { home, max } = renderer.getZoomLimits();
    expect(home).toBeLessThan(1);
    expect(max).toBe(1.1);
    expect(renderer.viewLimits().atMax).toBe(false);
    renderer.dispose();
  });

  it("knows when it is zoomed in as far as it goes, or on its way there", async () => {
    mockedLoad.mockResolvedValue(bitmap(1000, 1000));
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);
    expect(renderer.atMaxZoom()).toBe(false);

    // At home 0.6 (the Body's 600px over the image's 1000), at most 1.1.
    renderer.zoomBy(1.5, undefined, false);
    expect(renderer.atMaxZoom()).toBe(false);
    renderer.zoomBy(1000);
    expect(renderer.atMaxZoom()).toBe(true);
    renderer.home(true);
    expect(renderer.atMaxZoom()).toBe(false);
    renderer.dispose();
  });

  it("knows which of zoom in, zoom out and home would change nothing", async () => {
    mockedLoad.mockResolvedValue(bitmap(1000, 1000));
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);
    expect(renderer.viewLimits()).toEqual({
      atMax: false,
      atMin: false,
      atHome: true,
    });

    renderer.zoomBy(1000, undefined, false);
    expect(renderer.viewLimits()).toEqual({
      atMax: true,
      atMin: false,
      atHome: false,
    });
    renderer.zoomBy(0.0001, undefined, false);
    expect(renderer.viewLimits()).toMatchObject({ atMin: true, atHome: false });

    // Back to the same view by hand is not home: only `home` is (`isAtHome`), and a
    // reader who is not home keeps reset, which brings the Document's sheets back.
    renderer.home(true);
    renderer.zoomBy(1.5, undefined, false);
    expect(renderer.viewLimits().atHome).toBe(false);
    renderer.zoomBy(1 / 1.5, undefined, false);
    expect(renderer.viewLimits().atHome).toBe(false);
    expect(renderer.isAtHome).toBe(false);
    // Framed as home already, `home` moves nothing, so it says so itself.
    const told = vi.fn();
    renderer.on("viewport", told);
    renderer.home(true);
    expect(told).toHaveBeenCalled();
    expect(renderer.viewLimits().atHome).toBe(true);
    renderer.rotateBy(90);
    expect(renderer.viewLimits().atHome).toBe(false);
    renderer.dispose();
  });

  it("judges the limits where the camera is heading, before a frame draws", async () => {
    mockedLoad.mockResolvedValue(bitmap(1000, 1000));
    const renderer = new CanvasRenderer(host(), { animationTime: 1000 });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);
    renderer.zoomBy(1000);
    expect(renderer.getCamera().zoom).toBeLessThan(1.1);
    expect(renderer.viewLimits().atMax).toBe(true);
    renderer.dispose();
  });

  it("says its view changed when a resize moves what it may zoom to", async () => {
    mockedLoad.mockResolvedValue(bitmap(1000, 1000));
    const element = host();
    const renderer = new CanvasRenderer(element, { animationTime: 0 });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);
    renderer.zoomBy(1.2, undefined, false);
    // A frame drawn, so the one a resize draws has no move of its own to report.
    (renderer as unknown as { loop: { drawNow(): void } }).loop.drawNow();
    const moved = vi.fn();
    renderer.on("viewport", moved);
    element.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 300 }) as DOMRect;
    // Its observer is what notices it; the camera itself stays where it was.
    (renderer as unknown as { measure(now: boolean): void }).measure(true);
    expect(moved).toHaveBeenCalled();
    renderer.dispose();
  });

  it("comes home by the shortest way upright, never spinning a whole turn back", async () => {
    mockedLoad.mockResolvedValue(bitmap(1000, 1000));
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);
    const homeAfter = (quarters: number) => {
      for (let i = 0; i < Math.abs(quarters); i++) {
        renderer.rotateBy(Math.sign(quarters) * 90);
      }
      renderer.home();
      return renderer.getRotation();
    };
    // Each call goes on from where the last came home.
    expect(homeAfter(4)).toBeCloseTo(360); // 360°: already upright, no turn at all
    expect(homeAfter(-4)).toBeCloseTo(0); // 0°: upright again
    expect(homeAfter(1)).toBeCloseTo(0); // 90°: a quarter back
    expect(homeAfter(3)).toBeCloseTo(360); // 270°: a quarter on, not three back
    expect(homeAfter(-1)).toBeCloseTo(360); // 270°: a quarter on again
    renderer.dispose();
  });

  it("holds a drag at the image's edge by default", async () => {
    mockedLoad.mockResolvedValue(bitmap(1000, 1000));
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);

    renderer.setInteracting(true);
    renderer.panBy(5000, 0, false);
    expect(renderer.getCamera().x).toBe(0);
    renderer.dispose();
  });

  it("without constrainDuringPan, lets a drag carry the image past its edge, then springs it back", async () => {
    mockedLoad.mockResolvedValue(bitmap(1000, 1000));
    const renderer = new CanvasRenderer(host(), {
      animationTime: 0,
      constrainDuringPan: false,
    });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);
    const home = renderer.getCamera();

    renderer.setInteracting(true);
    renderer.panBy(5000, 0, false);
    expect(renderer.getCamera().x).toBeLessThan(0);

    renderer.setInteracting(false);
    expect(renderer.getCamera().x).toBe(0);
    expect(renderer.getCamera().y).toBeCloseTo(home.y);
    renderer.dispose();
  });

  it("stops a glide in flight when a pointer goes down", async () => {
    mockedLoad.mockResolvedValue(bitmap(1000, 1000));
    const renderer = new CanvasRenderer(host(), { animationTime: 10 });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);
    renderer.zoomBy(4, undefined, false);

    renderer.panBy(200, 0, true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    renderer.setInteracting(true);
    const caught = renderer.getCamera();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(renderer.getCamera()).toEqual(caught);
    renderer.dispose();
  });

  it("keeps the reader's view when the images are swapped", async () => {
    mockedLoad.mockResolvedValue(bitmap(1000, 1000));
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);
    renderer.zoomBy(1.05, { x: 100, y: 100 }, false);
    const before = renderer.getCamera();

    const changed = vi.fn();
    renderer.on("change", changed);
    await renderer.setImages([{ id: "b", url: "b.jpg" }]);

    expect(changed).toHaveBeenCalled();
    expect(renderer.getCamera()).toEqual(before);
    renderer.dispose();
  });

  it("shows pixels WebGL refuses as a DOM layer, placed by the same camera", async () => {
    fake.taint();
    mockedLoad.mockResolvedValue(element(1000, 500, false));
    const el = host();
    const renderer = new CanvasRenderer(el, { animationTime: 0 });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);
    // The DOM layer's code loads with the first frame that needs it.
    await vi.waitFor(() =>
      expect(el.querySelector(".clover-canvas-dom-item")).not.toBeNull(),
    );

    const item = el.querySelector(".clover-canvas-dom-item") as HTMLElement;
    expect(item.style.transform).toMatch(/^matrix\(/);
    expect(item.querySelector("img")).not.toBeNull();
    renderer.dispose();
  });

  it("sends an image already known to lack CORS straight to the DOM layer", async () => {
    mockedLoad.mockResolvedValue(element(1000, 500, true));
    const el = host();
    const renderer = new CanvasRenderer(el, { animationTime: 0 });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);
    await frames();

    expect(fake.count("texImage2D")).toBe(0);
    expect(el.querySelectorAll(".clover-canvas-dom-item")).toHaveLength(1);
    renderer.dispose();
  });

  it("falls back to Canvas2D without WebGL2, once its code has loaded", async () => {
    webgl = false;
    const el = host();
    const renderer = new CanvasRenderer(el);
    // Meanwhile its canvas waits, drawing nothing: the host's background shows.
    await vi.waitFor(() => expect(renderer.backendKind).toBe("canvas2d"));
    expect(el.dataset.backend).toBe("canvas2d");
    renderer.dispose();
  });

  it("reports a failed load without opening", async () => {
    mockedLoad.mockRejectedValue(new Error("404"));
    const renderer = new CanvasRenderer(host());
    const errored = vi.fn();
    const opened = vi.fn();
    renderer.on("error", errored);
    renderer.on("open", opened);
    await renderer.setImages([{ id: "a", url: "missing.jpg" }]);
    expect(errored).toHaveBeenCalled();
    expect(opened).not.toHaveBeenCalled();
    renderer.dispose();
  });

  it("says when nothing it paints can be loaded, and again once something draws", async () => {
    mockedLoad.mockRejectedValue(new Error("400"));
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    const unloadable = vi.fn();
    renderer.on("unloadable", unloadable);
    // A Canvas's world, as the Canvas gives it: the renderer opens on it all the same.
    const world = { x: 0, y: 0, width: 400, height: 300 };
    await renderer.setImages([{ id: "a", url: "missing.jpg" }], { world });
    expect(unloadable).toHaveBeenLastCalledWith(true);

    mockedLoad.mockResolvedValue(bitmap(400, 300));
    await renderer.setImages([{ id: "b", url: "found.jpg" }], { world });
    expect(unloadable).toHaveBeenLastCalledWith(false);
    renderer.dispose();
  });

  it("says so too when every tile an image service is asked for fails for good", async () => {
    serveInfo(GOTTINGEN_V3);
    mockedLoad.mockRejectedValue(
      Object.assign(new Error("404"), { status: 404 }),
    );
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    const unloadable = vi.fn();
    renderer.on("unloadable", unloadable);
    await renderer
      .setImages([
        {
          id: "g",
          service:
            "https://iiif.io/api/image/3.0/example/reference/918ecd18c2592080851777620de9bcb5-gottingen",
        },
      ])
      .catch(() => undefined);
    await frames(6);
    expect(unloadable).toHaveBeenLastCalledWith(true);
    renderer.dispose();
  });

  it("gives the context back and cleans up on dispose", async () => {
    mockedLoad.mockResolvedValue(bitmap(100, 100));
    const el = host();
    const renderer = new CanvasRenderer(el);
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);
    renderer.dispose();

    expect(fake.loseContext).toHaveBeenCalled();
    expect(el.querySelector("canvas")).toBeNull();
    expect(el.querySelector(".clover-canvas-dom-layer")).toBeNull();
  });

  it("tiles an Image API 3 service: its coarsest level first, then the level that fits", async () => {
    serveInfo(GOTTINGEN_V3);
    serveTiles();
    const renderer = new CanvasRenderer(host(1600, 1200), { animationTime: 0 });
    await renderer.setImages([
      {
        id: "g",
        service:
          "https://iiif.io/api/image/3.0/example/reference/918ecd18c2592080851777620de9bcb5-gottingen",
      },
    ]);
    // Its 512 px tiles joined two by two: the quarter-resolution level is one 1008 px
    // tile, the whole image, which opening waited for.
    expect(mockedLoad.mock.calls[0][0]).toMatch(
      /\/full\/1008,756\/0\/default\.jpg$/,
    );
    expect(renderer.getHomeBounds()).toEqual({
      x: 0,
      y: 0,
      width: 4032,
      height: 3024,
    });

    await frames(4);
    const urls = mockedLoad.mock.calls.map(([url]) => url);
    // A 1600 px wide Body at 1x: scale factor 2, its four tiles of up to 1024 px.
    expect(
      urls.filter((u) => /\/0,0,2048,2048\/1024,1024\//.test(u)),
    ).toHaveLength(1);
    expect(
      urls.filter((u) => /\/\d+,\d+,\d+,\d+\/\d+,\d+\//.test(u)),
    ).toHaveLength(4);
    expect(fake.count("drawArrays")).toBeGreaterThan(0);
    renderer.dispose();
  });

  it("asks for a new scene's view while its coarsest tile is still on its way", async () => {
    serveInfo(GOTTINGEN_V3);
    let release = () => {};
    const coarsest = new Promise<void>((resolve) => (release = resolve));
    mockedLoad.mockImplementation(async (url: string) => {
      if (/\/full\//.test(url)) await coarsest;
      return bitmap(1024, 1024);
    });
    const renderer = new CanvasRenderer(host(1600, 1200), { animationTime: 0 });
    const opened = vi.fn();
    renderer.on("open", opened);
    const setting = renderer.setImages([
      {
        id: "g",
        service:
          "https://iiif.io/api/image/3.0/example/reference/918ecd18c2592080851777620de9bcb5-gottingen",
      },
    ]);
    await frames(4);
    // Not open yet, but the four half-resolution tiles of its home view are asked for.
    expect(opened).not.toHaveBeenCalled();
    const urls = mockedLoad.mock.calls.map(([url]) => url);
    expect(urls[0]).toMatch(/\/full\/1008,756\//);
    expect(
      urls.filter((u) => /\/\d+,\d+,\d+,\d+\/\d+,\d+\//.test(u)),
    ).toHaveLength(4);

    release();
    await setting;
    expect(opened).toHaveBeenCalledTimes(1);
    renderer.dispose();
  });

  it("puts a continuous scene up a page at a time on an empty Body", async () => {
    serveInfos();
    const held = new Map<string, () => void>();
    mockedLoad.mockImplementation(async (url: string) => {
      const name = pageOf(url)!;
      if (/\/full\//.test(url) && name !== "a") {
        await new Promise<void>((resolve) => held.set(name, resolve));
      }
      return bitmap(512, 384);
    });
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    const opened = vi.fn();
    renderer.on("open", opened);
    const setting = renderer.setImages(["a", "b", "c"].map(page));
    await frames(4);
    // The first page is up, framed for all three, while the others' coarsest are away.
    expect(["a", "b", "c"].map((id) => renderer.isReady(id))).toEqual([
      true,
      false,
      false,
    ]);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(renderer.getHomeBounds()).toEqual({
      x: 0,
      y: 0,
      width: 3 * 4032,
      height: 3024,
    });
    // Each one as it comes, whatever the order.
    held.get("c")!();
    await frames(2);
    expect(renderer.isReady("c")).toBe(true);
    expect(renderer.isReady("b")).toBe(false);
    held.get("b")!();
    await setting;
    expect(["a", "b", "c"].map((id) => renderer.isReady(id))).toEqual([
      true,
      true,
      true,
    ]);
    expect(opened).toHaveBeenCalledTimes(1);
    renderer.dispose();
  });

  it("replaces a scene on screen whole, never a page at a time", async () => {
    serveInfos();
    serveTiles();
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    await renderer.setImages([page("old", 0)]);
    let release = () => {};
    const hold = new Promise<void>((resolve) => (release = resolve));
    mockedLoad.mockImplementation(async (url: string) => {
      if (pageOf(url) === "b" && /\/full\//.test(url)) await hold;
      return bitmap(512, 384);
    });
    const setting = renderer.setImages(["a", "b"].map(page), { fit: true });
    await frames(4);
    // The old page stays until every new one can be drawn.
    expect(renderer.isReady("old")).toBe(true);
    expect(renderer.isReady("a")).toBe(false);
    release();
    await setting;
    expect(renderer.isReady("old")).toBe(false);
    expect(renderer.isReady("a") && renderer.isReady("b")).toBe(true);
    renderer.dispose();
  });

  it("prepares a scene's images in order, six at a time", async () => {
    const fetchMock = serveInfos();
    const held: Array<() => void> = [];
    mockedLoad.mockImplementation(async (url: string) => {
      if (/\/full\//.test(url)) await new Promise<void>((r) => held.push(r));
      return bitmap(512, 384);
    });
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    void renderer.setImages("abcdefgh".split("").map(page));
    await frames(4);
    const asked = () => fetchMock.mock.calls.map(([url]) => pageOf(url));
    // Six `info.json`, each followed at once by its coarsest; the seventh waits its turn.
    expect(asked()).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(held).toHaveLength(6);
    held[0]();
    await frames(2);
    expect(asked()).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    renderer.dispose();
  });

  it("reads the next scene ahead once every tile of the one on screen is in", async () => {
    const fetchMock = serveInfos();
    let release = () => {};
    const hold = new Promise<void>((resolve) => (release = resolve));
    mockedLoad.mockImplementation(async (url: string) => {
      // The scene on screen's sharp tiles (its coarsest is one whole picture), held.
      if (pageOf(url) === "a" && /\/\d+,\d+,\d+,\d+\//.test(url)) await hold;
      return bitmap(1024, 1024);
    });
    const renderer = new CanvasRenderer(host(1600, 1200), { animationTime: 0 });
    await renderer.setImages([page("a", 0)], { fit: true });
    renderer.prefetch([page("b", 0)]);
    await frames(4);
    const asked = () => fetchMock.mock.calls.map(([url]) => String(url));
    // Nothing of the next while this one still sharpens.
    expect(asked().some((url) => pageOf(url) === "b")).toBe(false);

    release();
    await frames(6);
    expect(asked().filter((url) => pageOf(url) === "b")).toEqual([
      "https://example.org/iiif/b/info.json",
    ]);
    const loads = () =>
      mockedLoad.mock.calls
        .map(([url]) => url)
        .filter((url) => pageOf(url) === "b");
    // Its coarsest, never its sharp tile.
    expect(loads()).toEqual([
      "https://example.org/iiif/b/full/1008,756/0/default.jpg",
    ]);

    // The turn to it reads neither again.
    await renderer.setImages([page("b", 0)], { fit: true });
    expect(asked().filter((url) => pageOf(url) === "b")).toHaveLength(1);
    expect(
      loads().filter((url) => /\/full\/1008,756\//.test(url)),
    ).toHaveLength(1);
    expect(renderer.isReady("b")).toBe(true);
    renderer.dispose();
  });

  it("drops what it was to read ahead when the scene changes first", async () => {
    const fetchMock = serveInfos();
    let release = () => {};
    const hold = new Promise<void>((resolve) => (release = resolve));
    mockedLoad.mockImplementation(async (url: string) => {
      if (pageOf(url) === "a" && /\/\d+,\d+,\d+,\d+\//.test(url)) await hold;
      return bitmap(1024, 1024);
    });
    const renderer = new CanvasRenderer(host(1600, 1200), { animationTime: 0 });
    await renderer.setImages([page("a", 0)], { fit: true });
    renderer.prefetch([page("b", 0)]);
    serveTiles();
    await renderer.setImages([page("c", 0)], { fit: true });
    release();
    await frames(6);
    expect(
      fetchMock.mock.calls.some(([url]) => pageOf(String(url)) === "b"),
    ).toBe(false);
    renderer.dispose();
  });

  it("spells Image API 2 tiles with w,", async () => {
    serveInfo(GOTTINGEN_V2_1);
    serveTiles();
    const renderer = new CanvasRenderer(host(1600, 1200), { animationTime: 0 });
    await renderer.setImages([
      {
        id: "g",
        service:
          "https://iiif.io/api/image/2.1/example/reference/918ecd18c2592080851777620de9bcb5-gottingen",
      },
    ]);
    await frames(4);
    const urls = mockedLoad.mock.calls.map(([url]) => url);
    expect(urls[0]).toMatch(/\/full\/1008,\/0\/default\.jpg$/);
    expect(
      urls.some((u) => /\/0,0,2048,2048\/1024,\/0\/default\.jpg$/.test(u)),
    ).toBe(true);
    renderer.dispose();
  });

  it("falls back to the static image when the service cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    mockedLoad.mockResolvedValue(bitmap(600, 400));
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    const opened = vi.fn();
    renderer.on("open", opened);
    await renderer.setImages([
      {
        id: "g",
        service: "https://example.org/iiif/down",
        url: "https://example.org/full.jpg",
      },
    ]);
    expect(opened).toHaveBeenCalled();
    expect(mockedLoad).toHaveBeenCalledWith(
      "https://example.org/full.jpg",
      expect.anything(),
    );
    renderer.dispose();
  });

  it("shows only a body's region, which becomes the whole world", async () => {
    serveInfo(GOTTINGEN_V3);
    serveTiles();
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    await renderer.setImages([
      {
        id: "g",
        service: "https://example.org/iiif/g",
        width: 4032,
        height: 3024,
        region: "pct:50,50,50,50",
      },
    ]);
    expect(renderer.getHomeBounds()).toEqual({
      x: 0,
      y: 0,
      width: 2016,
      height: 1512,
    });
    // An annotation at the region's corner lands at the world's origin.
    expect(
      renderer.itemRectToWorld(0, { x: 2016, y: 1512, width: 10, height: 10 }),
    ).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    renderer.dispose();
  });
});

describe("the page's WebGL contexts", () => {
  /** Each host's observer callback, to say when it comes into view or leaves it. */
  let observed: Map<Element, IntersectionObserverCallback>;
  const inView = (el: Element, isIntersecting: boolean) =>
    observed.get(el)!(
      [{ target: el, isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

  beforeEach(() => {
    observed = new Map();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(private callback: IntersectionObserverCallback) {}
        observe(el: Element) {
          observed.set(el, this.callback);
        }
        unobserve() {}
        disconnect() {}
      },
    );
  });

  /** A host far down the page, out of the window. */
  function below() {
    const el = document.createElement("div");
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 5000, width: 800, height: 600 }) as DOMRect;
    document.body.appendChild(el);
    return el;
  }

  it("takes none for a host out of view, until it comes into view", () => {
    const el = below();
    const renderer = new CanvasRenderer(el);
    expect(renderer.backendKind).toBe("none");
    expect(el.querySelector("canvas")).toBeNull();
    inView(el, true);
    expect(renderer.backendKind).toBe("webgl2");
    renderer.dispose();
  });

  it("holds a few: one out of view gives its back to one in view, and past them all in view, Canvas2D", async () => {
    const shown = Array.from(
      { length: MAX_CONTEXTS },
      () => new CanvasRenderer(host()),
    );
    expect(shown.map((each) => each.backendKind)).toEqual(
      Array(MAX_CONTEXTS).fill("webgl2"),
    );
    // The first leaves the view: the next one in view takes its context at once.
    inView(shown[0].host, false);
    const next = new CanvasRenderer(host());
    expect(next.backendKind).toBe("webgl2");
    expect(shown[0].backendKind).toBe("none");
    expect(shown[0].host.dataset.backend).toBe("released");
    // Every one in view: one more draws with Canvas2D.
    const more = new CanvasRenderer(host());
    await vi.waitFor(() => expect(more.backendKind).toBe("canvas2d"));
    [...shown, next, more].forEach((each) => each.dispose());
  });

  it("drops a lost context's canvas at once, draws on with Canvas2D, and tries WebGL again back in view", async () => {
    const el = host();
    const renderer = new CanvasRenderer(el, { releaseAfterMs: 0 });
    const lost = el.querySelector("canvas")!;
    lost.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    // Never the browser's picture of a lost context: that canvas is gone.
    expect(lost.isConnected).toBe(false);
    await vi.waitFor(() => expect(renderer.backendKind).toBe("canvas2d"));
    inView(el, false);
    await frames(1);
    expect(el.dataset.backend).toBe("released");
    inView(el, true);
    expect(renderer.backendKind).toBe("webgl2");
    renderer.dispose();
  });
});
