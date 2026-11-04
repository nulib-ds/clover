// The worker Clover brings: in source the placeholder is empty, so it is filled here as the
// package's build fills it (`build/maplibre-worker.mjs`).
vi.mock("./maplibre-worker", () => ({
  source: "self.onmessage = () => {};",
  version: "6.11.1",
}));

beforeEach(() => {
  vi.resetModules();
  URL.createObjectURL = vi.fn(() => "blob:clover-worker");
});

describe("bundledWorkerUrl", () => {
  it("makes one blob URL for every map, from the bundled source", async () => {
    const { bundledWorkerUrl } = await import("./worker");
    expect(bundledWorkerUrl("6.11.1")).toBe("blob:clover-worker");
    expect(bundledWorkerUrl("6.11.1")).toBe("blob:clover-worker");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("gives none for another MapLibre, and says once how to serve its worker", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { bundledWorkerUrl } = await import("./worker");
    expect(bundledWorkerUrl("6.16.0")).toBeUndefined();
    expect(bundledWorkerUrl("6.16.0")).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("setMapWorkerUrl");
    warn.mockRestore();
  });
});

/*
 * A strict Content Security Policy refuses a worker from a `blob:` URL (`worker-src`), or
 * from a string at all (Trusted Types): the map asks first, once, of a worker of nothing.
 */
describe("blobWorkersAllowed", () => {
  const workers = (start: (worker: Record<string, any>) => void) =>
    vi.stubGlobal(
      "Worker",
      class {
        terminate = vi.fn();
        constructor() {
          queueMicrotask(() => start(this as Record<string, any>));
        }
      },
    );
  beforeEach(() => {
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is yes where the worker starts, asked once", async () => {
    workers((worker) => worker.onmessage());
    const { blobWorkersAllowed } = await import("./worker");
    await expect(blobWorkersAllowed()).resolves.toBe(true);
    await expect(blobWorkersAllowed()).resolves.toBe(true);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:clover-worker");
  });

  it("is no where the page refuses it, and says how to serve the worker", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    workers((worker) => worker.onerror());
    const { blobWorkersAllowed } = await import("./worker");
    await expect(blobWorkersAllowed()).resolves.toBe(false);
    expect(warn.mock.calls[0][0]).toContain("setMapWorkerUrl");
    warn.mockRestore();
  });

  it("is no where Trusted Types refuse a worker from a string", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new TypeError("This document requires 'TrustedScriptURL'");
        }
      },
    );
    const { blobWorkersAllowed } = await import("./worker");
    await expect(blobWorkersAllowed()).resolves.toBe(false);
    warn.mockRestore();
  });
});
