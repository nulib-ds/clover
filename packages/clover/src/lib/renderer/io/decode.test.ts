import { loadImage } from "./decode";

describe("loadImage", () => {
  const original = globalThis.createImageBitmap;
  beforeEach(() => {
    globalThis.createImageBitmap = vi.fn(async () => ({
      width: 4,
      height: 3,
      close: vi.fn(),
    })) as any;
  });
  afterEach(() => {
    globalThis.createImageBitmap = original;
  });

  it("asks for a tile with the request's credentials, headers and fetch", async () => {
    const fetch = vi.fn(
      async () => new Response(new Blob(["x"], { type: "image/jpeg" })),
    );
    await loadImage("https://example.org/tile.jpg", {
      request: {
        fetch,
        credentials: "include",
        headers: { Authorization: "Bearer t" },
      },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.org/tile.jpg");
    expect(init).toMatchObject({
      mode: "cors",
      credentials: "include",
      headers: { Authorization: "Bearer t" },
    });
  });

  it("lets a refused tile's body go, so the browser closes its request", async () => {
    // A restricted image's tiles answer 403 (Northwestern's do, 2026-11-06).
    const response = new Response("Forbidden", { status: 403 });
    const cancel = vi.spyOn(response.body!, "cancel");
    await expect(
      loadImage("https://example.org/tile.jpg", {
        request: { fetch: vi.fn(async () => response) },
      }),
    ).rejects.toMatchObject({ name: "ImageLoadError", status: 403 });
    expect(cancel).toHaveBeenCalled();
  });
});
