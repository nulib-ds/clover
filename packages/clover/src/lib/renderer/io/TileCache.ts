import type { LoadedImage } from "./decode";

/**
 * Tiles: asked for, decoded, held and let go.
 *
 * Scheduling *is* the perceived performance of a deep-zoom viewer. Drawing was never the
 * bottleneck; the network and decode are. The renderer hands `update` the **required
 * set** — the tiles the current frame wants, in priority order — once per frame, and the
 * cache does exactly what that list says:
 *
 * 1. **Abort on supersede.** A tile that leaves the required set while in flight is
 *    aborted at once. A zoom generates far more requests than it consumes, and stale ones
 *    would hold the connection pool ahead of the tiles actually wanted.
 * 2. **Priority, not arrival order.** A bounded window of requests is fed from the front
 *    of the list — coarse tiles first, then nearest the center of view.
 * 3. **One retry, then a negative cache.** A tile that fails twice is remembered as failed,
 *    so a 404 is not re-requested on every frame it stays in view. The retry goes to the
 *    tile's alternate spelling when it has one.
 * 4. **A byte budget.** Tiles that drop out of the required set stay cached, least
 *    recently used first out, until decoded pixels exceed the budget. The required set
 *    itself is never evicted — bounding that is the planner's job.
 *
 * Keyed by URL, so two items showing the same service (animation frames that differ only
 * in their region) share every tile.
 */
export interface TileWant {
  url: string;
  fallbackUrl?: string;
  /** Lower loads first. */
  priority: number;
}

export type TileLoader = (
  url: string,
  signal: AbortSignal,
) => Promise<LoadedImage>;

export interface TileCacheOptions {
  load: TileLoader;
  /** A tile finished loading (or failed for good): the picture can improve. */
  onSettled: () => void;
  /** Decoded pixels left memory; drop anything derived from them (a texture). */
  onEvict: (url: string) => void;
  /** Decoded bytes to keep, across required and cached tiles. */
  byteBudget?: number;
  maxInFlight?: number;
}

interface Entry {
  url: string;
  state: "loading" | "ready" | "failed";
  image?: LoadedImage;
  bytes: number;
  lastUsed: number;
  attempts: number;
  controller?: AbortController;
  /** A prefetch: a new scene is waiting on it, so frames may not abort it. */
  pinned: boolean;
  waiters: Array<() => void>;
}

const DEFAULT_BUDGET = 192 * 1024 * 1024;
const DEFAULT_IN_FLIGHT = 6;
const MAX_ATTEMPTS = 2;

export class TileCache {
  private entries = new Map<string, Entry>();
  private inFlight = 0;
  private frame = 0;
  private bytes = 0;
  private wanted: TileWant[] = [];
  private disposed = false;
  private readonly budget: number;
  private readonly maxInFlight: number;

  constructor(private readonly options: TileCacheOptions) {
    this.budget = options.byteBudget ?? DEFAULT_BUDGET;
    this.maxInFlight = options.maxInFlight ?? DEFAULT_IN_FLIGHT;
  }

  /** The decoded tile, if ready. Marks it used this frame. */
  get(url: string): LoadedImage | undefined {
    const entry = this.entries.get(url);
    if (entry?.state !== "ready") return undefined;
    entry.lastUsed = this.frame;
    return entry.image;
  }

  has(url: string): boolean {
    return this.entries.get(url)?.state === "ready";
  }

  failed(url: string): boolean {
    return this.entries.get(url)?.state === "failed";
  }

  get byteSize(): number {
    return this.bytes;
  }

  get pending(): number {
    return this.inFlight;
  }

  /** Put an already-decoded image in the cache (a static image loaded to learn its size). */
  seed(url: string, image: LoadedImage): void {
    const existing = this.entries.get(url);
    if (existing?.state === "ready") return;
    existing?.controller?.abort();
    this.entries.set(url, {
      url,
      state: "ready",
      image,
      bytes: bytesOf(image),
      lastUsed: this.frame,
      attempts: 0,
      pinned: false,
      waiters: existing?.waiters ?? [],
    });
    this.bytes += bytesOf(image);
    this.flushWaiters(url);
  }

  /**
   * Resolve once each tile is ready or has failed for good — how a new scene waits for
   * its coarsest tiles before replacing the old one, so a swap never shows a blank.
   * These loads are not tied to the required set, so a frame cannot abort them.
   */
  prefetch(tiles: Array<Omit<TileWant, "priority">>): Promise<void> {
    return Promise.all(
      tiles.map(
        (tile) =>
          new Promise<void>((resolve) => {
            const entry = this.entries.get(tile.url);
            if (entry && entry.state !== "loading") return resolve();
            if (entry) {
              entry.waiters.push(resolve);
              return;
            }
            this.start({ ...tile, priority: -1 }, resolve);
          }),
      ),
    ).then(() => undefined);
  }

  /** Called once per frame with what this frame wants, highest priority first. */
  update(wants: TileWant[]): void {
    if (this.disposed) return;
    this.frame++;
    const wanted = new Set(wants.map((w) => w.url));
    this.wanted = [...wants].sort((a, b) => a.priority - b.priority);

    // Abort what the view no longer needs — except prefetches a new scene is waiting on.
    for (const entry of this.entries.values()) {
      if (
        entry.state === "loading" &&
        !entry.pinned &&
        !wanted.has(entry.url) &&
        entry.controller
      ) {
        entry.controller.abort();
        this.entries.delete(entry.url);
        this.inFlight--;
      }
    }

    for (const want of this.wanted) {
      const entry = this.entries.get(want.url);
      if (entry) entry.lastUsed = this.frame;
    }

    this.pump();
    this.evict(wanted);
  }

  dispose(): void {
    this.disposed = true;
    for (const entry of this.entries.values()) {
      entry.controller?.abort();
      this.flushWaiters(entry.url);
    }
    this.entries.clear();
    this.bytes = 0;
  }

  /** Every ready tile, for a context restore or a consumer clearing memory. */
  forEachReady(callback: (url: string, image: LoadedImage) => void): void {
    for (const entry of this.entries.values()) {
      if (entry.state === "ready" && entry.image)
        callback(entry.url, entry.image);
    }
  }

  private pump(): void {
    for (const want of this.wanted) {
      if (this.inFlight >= this.maxInFlight) break;
      if (!this.entries.has(want.url)) this.start(want);
    }
  }

  private start(want: TileWant, waiter?: () => void): void {
    const controller = new AbortController();
    const entry: Entry = {
      url: want.url,
      state: "loading",
      bytes: 0,
      lastUsed: this.frame,
      attempts: 0,
      controller,
      pinned: Boolean(waiter),
      waiters: waiter ? [waiter] : [],
    };
    this.entries.set(want.url, entry);
    this.inFlight++;
    this.attempt(entry, want, controller, want.url);
  }

  private attempt(
    entry: Entry,
    want: TileWant,
    controller: AbortController,
    url: string,
  ): void {
    entry.attempts++;
    this.options.load(url, controller.signal).then(
      (image) => {
        if (this.disposed || this.entries.get(entry.url) !== entry) {
          // Superseded while decoding: never cache what nobody asked to keep.
          if (image.kind === "bitmap") image.source.close();
          return;
        }
        entry.state = "ready";
        entry.image = image;
        entry.bytes = bytesOf(image);
        entry.controller = undefined;
        entry.pinned = false;
        this.bytes += entry.bytes;
        this.settle(entry);
      },
      (error) => {
        if (controller.signal.aborted || this.disposed) return;
        if (this.entries.get(entry.url) !== entry) return;
        if (entry.attempts < MAX_ATTEMPTS && !isPermanent(error, want)) {
          // The retry goes to the alternate spelling when there is one.
          this.attempt(entry, want, controller, want.fallbackUrl ?? want.url);
          return;
        }
        entry.state = "failed";
        entry.controller = undefined;
        entry.pinned = false;
        this.settle(entry);
      },
    );
  }

  private settle(entry: Entry): void {
    this.inFlight--;
    this.flushWaiters(entry.url);
    this.options.onSettled();
    this.pump();
  }

  private flushWaiters(url: string): void {
    const entry = this.entries.get(url);
    if (!entry) return;
    const waiters = entry.waiters;
    entry.waiters = [];
    waiters.forEach((resolve) => resolve());
  }

  private evict(required: Set<string>): void {
    if (this.bytes <= this.budget) return;
    const candidates = [...this.entries.values()]
      .filter((e) => e.state === "ready" && !required.has(e.url))
      .sort((a, b) => a.lastUsed - b.lastUsed);
    for (const entry of candidates) {
      if (this.bytes <= this.budget) break;
      this.entries.delete(entry.url);
      this.bytes -= entry.bytes;
      if (entry.image?.kind === "bitmap") entry.image.source.close();
      this.options.onEvict(entry.url);
    }
  }
}

function bytesOf(image: LoadedImage): number {
  return image.width * image.height * 4;
}

/** A 4xx other than 408/429 will not change on retry — unless there is another spelling. */
function isPermanent(error: unknown, want: TileWant): boolean {
  if (want.fallbackUrl) return false;
  const status = (error as { status?: number })?.status;
  return (
    typeof status === "number" &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  );
}
