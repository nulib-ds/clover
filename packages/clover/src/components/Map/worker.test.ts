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
