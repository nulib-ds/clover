import { type TrackKey, boxAt, orderKeys } from "./track";

const at = (x: number) => ({ x, y: 0, width: 10, height: 20 });
const key = (start: number, end: number, x: number): TrackKey => ({
  start,
  end,
  world: at(x),
});

describe("a track", () => {
  // Two keys that meet (one movement), a gap, then one alone.
  const keys = [key(10, 12, 0), key(12, 14, 100), key(20, 22, 500)];

  it("is nowhere before it starts, in a gap, or after it ends", () => {
    for (const time of [0, 9.99, 14, 17, 22, 30])
      expect(boxAt(keys, time), String(time)).toBeNull();
  });

  it("glides from one key's region to the next's where the two meet", () => {
    expect(boxAt(keys, 10)).toEqual(at(0));
    expect(boxAt(keys, 11)).toEqual(at(50));
    expect(boxAt(keys, 11.5)).toEqual(at(75));
    // The next key begins where it stands.
    expect(boxAt(keys, 12)).toEqual(at(100));
  });

  it("holds the last of a movement, and one alone, where they are", () => {
    expect(boxAt(keys, 13.9)).toEqual(at(100));
    expect(boxAt(keys, 21)).toEqual(at(500));
  });

  it("glides its width and height too", () => {
    const growing: TrackKey[] = [
      { start: 0, end: 1, world: { x: 0, y: 0, width: 10, height: 10 } },
      { start: 1, end: 2, world: { x: 10, y: 20, width: 30, height: 50 } },
    ];
    expect(boxAt(growing, 0.5)).toEqual({ x: 5, y: 10, width: 20, height: 30 });
  });

  it("is put in time order, a key with no end lasting until the next starts", () => {
    const ordered = orderKeys([
      key(5, Infinity, 50),
      key(0, Infinity, 0),
      key(9, Infinity, 90),
    ]);
    expect(ordered.map(({ start, end }) => [start, end])).toEqual([
      [0, 5],
      [5, 9],
      // The last lasts to the end of the recording.
      [9, Infinity],
    ]);
    // Moments in a run are one movement.
    expect(boxAt(ordered, 2.5)).toEqual(at(25));
    expect(boxAt(ordered, 600)).toEqual(at(90));
  });
});
