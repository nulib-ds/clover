import { GOTTINGEN_V2_1, GOTTINGEN_V3 } from "../../fixtures/iiif-image/info";
import { CanvasRenderer } from "./CanvasRenderer";
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

/** Answer every tile request with a bitmap of the size its URL asks for. */
function serveTiles() {
  mockedLoad.mockImplementation(async (url: string) => {
    const size = url.match(/\/(\d+),(\d*)\/0\//);
    const w = size ? Number(size[1]) : 512;
    const h = size && size[2] ? Number(size[2]) : w;
    return bitmap(w, h);
  });
}

function host() {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 800, height: 600 }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

describe("CanvasRenderer", () => {
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
    // Landscape image in a 4:3 stage: the width fits exactly.
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
    expect(renderer.getItemRect(1)).toEqual({
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
    // Uneven, to show the picture centres in what is left, not in the stage.
    el.style.padding = "16px 16px 16px 48px";
    const renderer = new CanvasRenderer(el, { animationTime: 0 });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);

    // 736 × 568 left of 800 × 600: the width fits, centred between 48 and 784.
    const topLeft = renderer.worldToScreenPoint({ x: 0, y: 0 });
    const bottomRight = renderer.worldToScreenPoint({ x: 1000, y: 500 });
    expect(topLeft.x).toBeCloseTo(48, 6);
    expect(bottomRight.x).toBeCloseTo(784, 6);
    expect((topLeft.y + bottomRight.y) / 2).toBeCloseTo(300, 6);
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

  it("knows when it is zoomed in as far as it goes, or on its way there", async () => {
    mockedLoad.mockResolvedValue(bitmap(1000, 1000));
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    await renderer.setImages([{ id: "a", url: "a.jpg" }]);
    expect(renderer.atMaxZoom()).toBe(false);

    // At home 0.6 (the stage's 600px over the image's 1000), at most 1.1.
    renderer.zoomBy(1.5, undefined, false);
    expect(renderer.atMaxZoom()).toBe(false);
    renderer.zoomBy(1000);
    expect(renderer.atMaxZoom()).toBe(true);
    renderer.home(true);
    expect(renderer.atMaxZoom()).toBe(false);
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
    await frames();

    const item = el.querySelector(".clover-canvas-dom-item") as HTMLElement;
    expect(item).not.toBeNull();
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

  it("falls back to Canvas2D without WebGL2", async () => {
    webgl = false;
    const el = host();
    const renderer = new CanvasRenderer(el);
    expect(renderer.backendKind).toBe("canvas2d");
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

  it("tiles an Image API 3 service: the thumbnail first, then the level that fits", async () => {
    serveInfo(GOTTINGEN_V3);
    serveTiles();
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    await renderer.setImages([
      {
        id: "g",
        service:
          "https://iiif.io/api/image/3.0/example/reference/918ecd18c2592080851777620de9bcb5-gottingen",
      },
    ]);
    // Opening waited for the 512px whole-image thumbnail.
    expect(mockedLoad.mock.calls[0][0]).toMatch(
      /\/full\/512,384\/0\/default\.jpg$/,
    );
    expect(renderer.getHomeBounds()).toEqual({
      x: 0,
      y: 0,
      width: 4032,
      height: 3024,
    });

    await frames(4);
    const urls = mockedLoad.mock.calls.map(([url]) => url);
    // 800px wide stage at 1x: scale factor 4, all four of its tiles.
    expect(urls.filter((u) => /\/512,512\/0\//.test(u))).toHaveLength(1);
    expect(
      urls.filter((u) => /,\d+\/0\/default/.test(u)).length,
    ).toBeGreaterThanOrEqual(4);
    expect(fake.count("drawArrays")).toBeGreaterThan(0);
    renderer.dispose();
  });

  it("spells Image API 2 tiles with w,", async () => {
    serveInfo(GOTTINGEN_V2_1);
    serveTiles();
    const renderer = new CanvasRenderer(host(), { animationTime: 0 });
    await renderer.setImages([
      {
        id: "g",
        service:
          "https://iiif.io/api/image/2.1/example/reference/918ecd18c2592080851777620de9bcb5-gottingen",
      },
    ]);
    await frames(4);
    const urls = mockedLoad.mock.calls.map(([url]) => url);
    expect(
      urls.some((u) => /\/0,0,2048,2048\/512,\/0\/default\.jpg$/.test(u)),
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
