import { MAX_CONTEXTS, claimContext, returnContext } from "./contexts";

const holder = (hiddenSince: number | null = null) => ({
  hiddenSince,
  release: vi.fn(),
});

describe("claimContext", () => {
  it("frees the one out of view longest, and none in view", () => {
    const held = Array.from({ length: MAX_CONTEXTS }, () => holder());
    held.forEach((each) => expect(claimContext(each)).toBe(true));
    // Every one in view: no room.
    expect(claimContext(holder())).toBe(false);
    held[2].hiddenSince = 20;
    held[4].hiddenSince = 10;
    const next = holder();
    expect(claimContext(next)).toBe(true);
    expect(held[4].release).toHaveBeenCalled();
    expect(held[2].release).not.toHaveBeenCalled();
    // Held already: no more room needed.
    expect(claimContext(next)).toBe(true);
    [...held, next].forEach(returnContext);
  });
});
