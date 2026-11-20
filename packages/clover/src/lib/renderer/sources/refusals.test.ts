import {
  isSizeRefusal,
  noteRefusal,
  refusesDerivedTiles,
  resetRefusals,
  sameHost,
} from "./refusals";

afterEach(() => resetRefusals());

describe("refusals", () => {
  it("counts a refused size, not a missing image or a busy server", () => {
    expect([400, 403, 413, 414].every(isSizeRefusal)).toBe(true);
    expect([404, 408, 410, 429, 500, undefined].some(isSizeRefusal)).toBe(
      false,
    );
  });

  it("remembers the host, so every service on it is asked for its own grid", () => {
    expect(refusesDerivedTiles("https://www.artic.edu/iiif/2/a")).toBe(false);
    noteRefusal(
      "https://www.artic.edu/iiif/2/a/0,0,4096,4096/1024,/0/default.jpg",
    );
    expect(refusesDerivedTiles("https://www.artic.edu/iiif/2/b")).toBe(true);
    expect(refusesDerivedTiles("https://iiif.example.org/iiif/2/a")).toBe(
      false,
    );
    resetRefusals();
    expect(refusesDerivedTiles("https://www.artic.edu/iiif/2/b")).toBe(false);
  });

  it("matches a tile to its service by host", () => {
    expect(
      sameHost(
        "https://a.org/iiif/x",
        "https://a.org/iiif/x/full/max/0/default.jpg",
      ),
    ).toBe(true);
    expect(
      sameHost(
        "https://a.org/iiif/x",
        "https://b.org/iiif/x/full/max/0/default.jpg",
      ),
    ).toBe(false);
    expect(sameHost(undefined, "https://a.org/x")).toBe(false);
  });
});
