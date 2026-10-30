import { renderHook, waitFor } from "@testing-library/react";

import type { ThumbnailSource } from "../core/thumbnail";
import { useThumbnail } from "./EntryThumbnail";

const resolved = vi.hoisted(() => vi.fn());
vi.mock("../core/thumbnail", () => ({ resolveThumbnail: resolved }));

const service = (name: string): ThumbnailSource => ({
  service: `https://example.org/iiif/${name}`,
});

beforeEach(() => {
  resolved.mockReset();
  resolved.mockImplementation(
    async (source: ThumbnailSource, size: number) =>
      `${source.service}/full/${size},/0/default.jpg`,
  );
});

describe("useThumbnail", () => {
  it("gives an image of its own at once, with nothing to read", () => {
    const { result } = renderHook(() =>
      useThumbnail({ src: "https://example.org/a.jpg" }, 200),
    );
    expect(result.current).toBe("https://example.org/a.jpg");
    expect(resolved).not.toHaveBeenCalled();
  });

  it("makes a service's from its info.json, at the size asked for", async () => {
    const { result } = renderHook(() => useThumbnail(service("a"), 336));
    await waitFor(() =>
      expect(result.current).toBe(
        "https://example.org/iiif/a/full/336,/0/default.jpg",
      ),
    );
    expect(resolved).toHaveBeenCalledTimes(1);
  });

  it("holds the last picture while the next is made, or lets it go at once", async () => {
    const waiting: ((url: string) => void)[] = [];
    const held = renderHook(
      ({ source }) => useThumbnail(source, 200, undefined, true),
      { initialProps: { source: service("a") } },
    );
    const freed = renderHook(({ source }) => useThumbnail(source, 200), {
      initialProps: { source: service("a") },
    });
    await waitFor(() => expect(held.result.current).toMatch(/\/a\//));
    await waitFor(() => expect(freed.result.current).toMatch(/\/a\//));
    resolved.mockImplementation(
      () => new Promise<string>((resolve) => waiting.push(resolve)),
    );
    held.rerender({ source: service("b") });
    freed.rerender({ source: service("b") });
    // A player's artwork stays until the next arrives; an entry's goes with its words.
    expect(held.result.current).toMatch(/\/a\//);
    expect(freed.result.current).toBeUndefined();
    waiting.forEach((finish) =>
      finish("https://example.org/iiif/b/full/200,/0/default.jpg"),
    );
    await waitFor(() => expect(held.result.current).toMatch(/\/b\//));
  });
});
