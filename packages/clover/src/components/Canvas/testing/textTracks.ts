/**
 * Test helper: a video's text tracks, which jsdom leaves out. The list fires `addtrack`
 * as a track is added, as a browser's does; a test fires `change` itself where a browser
 * (or the system's player) would change a track's mode.
 */
export interface FakeTrack {
  kind: string;
  label: string;
  language: string;
  mode: TextTrackMode;
  activeCues: Array<{ text: string }>;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
  /** Fire `cuechange`, as the track's cues change. */
  cuechange: () => void;
}

export type FakeTrackInit = Partial<
  Pick<FakeTrack, "kind" | "label" | "language" | "mode">
> & {
  cues?: string[];
};

/** A track as a `<track>` element makes it: `disabled` unless `mode` says otherwise. */
export function fakeTrack(init: FakeTrackInit = {}): FakeTrack {
  const listeners = new Set<() => void>();
  return {
    kind: init.kind ?? "captions",
    label: init.label ?? "",
    language: init.language ?? "",
    mode: init.mode ?? "disabled",
    activeCues: (init.cues ?? []).map((text) => ({ text })),
    addEventListener: (type, listener) => {
      if (type === "cuechange") listeners.add(listener);
    },
    removeEventListener: (type, listener) => {
      if (type === "cuechange") listeners.delete(listener);
    },
    cuechange: () => listeners.forEach((listener) => listener()),
  };
}

export class FakeTrackList extends EventTarget {
  readonly items: FakeTrack[];

  constructor(items: FakeTrack[] = []) {
    super();
    this.items = [...items];
  }

  get length() {
    return this.items.length;
  }

  [Symbol.iterator]() {
    return this.items[Symbol.iterator]();
  }

  /**
   * Add a track, as the media (or hls.js) adds one. It starts `hidden`, as
   * `addTextTrack` makes it, and fires `addtrack` but no `change`.
   */
  add(init: FakeTrackInit = {}): FakeTrack {
    const track = fakeTrack({ mode: "hidden", ...init });
    this.items.push(track);
    this.dispatchEvent(new Event("addtrack"));
    return track;
  }

  /** What a browser fires once something changes a track's mode. */
  change() {
    this.dispatchEvent(new Event("change"));
  }

  modes() {
    return this.items.map((track) => track.mode);
  }
}
