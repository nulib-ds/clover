import type { LoadedImage } from "./decode";
import { TileCache } from "./TileCache";

interface Pending {
  url: string;
  signal: AbortSignal;
  resolve: (image: LoadedImage) => void;
  reject: (error: unknown) => void;
}

function image(size = 10): LoadedImage {
  return {
    kind: "bitmap",
    source: { width: size, height: size, close: vi.fn() } as any,
    width: size,
    height: size,
    naturalWidth: size,
    naturalHeight: size,
    opaque: false,
  };
}

function setup(options: { byteBudget?: number; maxInFlight?: number } = {}) {
  const pending: Pending[] = [];
  const onSettled = vi.fn();
  const onEvict = vi.fn();
  const cache = new TileCache({
    load: (url, signal) =>
      new Promise((resolve, reject) =>
        pending.push({ url, signal, resolve, reject }),
      ),
    onSettled,
    onEvict,
    ...options,
  });
  const settle = () => new Promise((r) => setTimeout(r, 0));
  return { cache, pending, onSettled, onEvict, settle };
}

const want = (url: string, priority = 0, fallbackUrl?: string) => ({
  url,
  priority,
  fallbackUrl,
});

describe("TileCache", () => {
  it("loads highest priority first, within the in-flight window", () => {
    const { cache, pending } = setup({ maxInFlight: 2 });
    cache.update([want("c", 3), want("a", 1), want("b", 2)]);
    expect(pending.map((p) => p.url)).toEqual(["a", "b"]);
  });

  it("aborts a tile the moment it leaves the required set", () => {
    const { cache, pending } = setup();
    cache.update([want("a"), want("b")]);
    cache.update([want("b")]);
    expect(pending.find((p) => p.url === "a")!.signal.aborted).toBe(true);
    expect(pending.find((p) => p.url === "b")!.signal.aborted).toBe(false);
  });

  it("hands over decoded tiles and reports each one settled", async () => {
    const { cache, pending, onSettled, settle } = setup();
    cache.update([want("a")]);
    pending[0].resolve(image());
    await settle();
    expect(cache.get("a")).toBeDefined();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("retries once at the alternate spelling, then remembers the failure", async () => {
    const { cache, pending, settle } = setup();
    cache.update([want("default.jpg", 0, "native.jpg")]);
    pending[0].reject({ status: 404 });
    await settle();
    expect(pending[1].url).toBe("native.jpg");
    pending[1].reject({ status: 404 });
    await settle();

    expect(cache.failed("default.jpg")).toBe(true);
    cache.update([want("default.jpg", 0, "native.jpg")]);
    expect(pending).toHaveLength(2);
  });

  it("reports a tile that failed for good, with its status, before it settles", async () => {
    const onFailed = vi.fn();
    const pending: Pending[] = [];
    const onSettled = vi.fn(() => expect(onFailed).toHaveBeenCalled());
    const cache = new TileCache({
      load: (url, signal) =>
        new Promise((resolve, reject) =>
          pending.push({ url, signal, resolve, reject }),
        ),
      onSettled,
      onEvict: vi.fn(),
      onFailed,
    });
    cache.update([want("a"), want("b")]);
    pending[0].reject({ status: 403 });
    // A server error is retried once before it fails for good.
    pending[1].reject({ status: 503 });
    await new Promise((r) => setTimeout(r, 0));
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledWith("a", 403);
    pending[2].reject({ status: 503 });
    await new Promise((r) => setTimeout(r, 0));
    expect(onFailed).toHaveBeenLastCalledWith("b", 503);
    expect(cache.failed("a")).toBe(true);
    expect(cache.failed("b")).toBe(true);
  });

  it("does not retry a 404 that has no other spelling", async () => {
    const { cache, pending, settle } = setup();
    cache.update([want("a")]);
    pending[0].reject({ status: 404 });
    await settle();
    expect(pending).toHaveLength(1);
    expect(cache.failed("a")).toBe(true);
  });

  it("evicts the least recently used tiles outside the required set, over budget", async () => {
    // 10×10×4 = 400 bytes a tile; room for two.
    const { cache, pending, onEvict, settle } = setup({ byteBudget: 800 });
    cache.update([want("a"), want("b"), want("c")]);
    pending.forEach((p) => p.resolve(image()));
    await settle();
    expect(cache.byteSize).toBe(1200);

    // Only "c" is still wanted: "a" (oldest) goes first, then "b" fits.
    cache.get("b");
    cache.update([want("c")]);
    expect(onEvict).toHaveBeenCalledWith("a");
    expect(cache.has("b")).toBe(true);
    expect(cache.byteSize).toBe(800);
  });

  it("never evicts a required tile, even over budget", async () => {
    const { cache, pending, onEvict, settle } = setup({ byteBudget: 100 });
    cache.update([want("a")]);
    pending[0].resolve(image());
    await settle();
    cache.update([want("a")]);
    expect(onEvict).not.toHaveBeenCalled();
  });

  it("lets a prefetch finish even when a frame no longer wants it", async () => {
    const { cache, pending, settle } = setup();
    const done = cache.prefetch([{ url: "thumb" }]);
    cache.update([]);
    expect(pending[0].signal.aborted).toBe(false);
    pending[0].resolve(image());
    await done;
    await settle();
    expect(cache.has("thumb")).toBe(true);
  });

  it("serves a seeded image without loading it", () => {
    const { cache, pending } = setup();
    cache.seed("static.jpg", image());
    cache.update([want("static.jpg")]);
    expect(pending).toHaveLength(0);
    expect(cache.get("static.jpg")).toBeDefined();
  });

  it("aborts everything on dispose", () => {
    const { cache, pending } = setup();
    cache.update([want("a")]);
    cache.prefetch([{ url: "b" }]);
    cache.dispose();
    expect(pending.every((p) => p.signal.aborted)).toBe(true);
  });
});
