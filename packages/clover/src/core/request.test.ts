import { CloverRequestError, fetchJson, isCorsError } from "./request";

const URL = "https://example.org/manifest.json";

describe("fetchJson", () => {
  it("names CORS where the server answers only in no-cors mode", async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.mode === "no-cors") return new Response(null);
      throw new TypeError("Failed to fetch");
    });
    const error = (await fetchJson({ fetch }, URL).catch(
      (each) => each,
    )) as CloverRequestError;
    expect(error).toBeInstanceOf(CloverRequestError);
    expect(isCorsError(error)).toBe(true);
    expect(error.url).toBe(URL);
    expect(error.message).toBe(
      "There was an issue with the provider's CORS headers.",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the browser's own error where the server does not answer at all", async () => {
    const failure = new TypeError("Failed to fetch");
    const fetch = vi.fn(async () => {
      throw failure;
    });
    await expect(fetchJson({ fetch }, URL)).rejects.toBe(failure);
    expect(isCorsError(failure)).toBe(false);
  });

  it("asks nothing more once the request is cancelled", async () => {
    const controller = new AbortController();
    const fetch = vi.fn(async () => {
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    });
    await expect(fetchJson({ fetch }, URL, controller.signal)).rejects.toThrow(
      "Aborted",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects a status that is not ok, with no second request", async () => {
    const fetch = vi.fn(async () => new Response("nope", { status: 404 }));
    const error = (await fetchJson({ fetch }, URL).catch(
      (each) => each,
    )) as CloverRequestError;
    expect(error.status).toBe(404);
    expect(isCorsError(error)).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
