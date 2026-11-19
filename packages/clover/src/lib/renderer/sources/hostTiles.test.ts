import { hostIdle, prefersGrid, resetHosts, timeLoad } from "./hostTiles";

afterEach(() => resetHosts());

/** A clock the test moves, and requests timed on it. */
function host(origin = "https://images.example.org") {
  let now = 0;
  const clock = () => now;
  const service = `${origin}/iiif/2/a`;
  const tile = `${service}/0,0,1024,1024/1024,/0/default.jpg`;
  /** One answer of `pixels`, `ms` after it was asked: a tile, or a whole image. */
  const answer = (pixels: number, ms: number, whole = false) => {
    const done = timeLoad(
      whole ? `${service}/full/max/0/default.jpg` : tile,
      clock,
    );
    now += ms;
    done(pixels);
  };
  return { service, tile, answer, clock, tick: (ms: number) => (now += ms) };
}

const SMALL = 512 * 384;
const BIG = 1024 * 1024;

describe("hostTiles", () => {
  it("decides nothing until a host has answered two small and two large", () => {
    const { service, answer } = host();
    answer(SMALL, 140);
    answer(BIG, 900);
    answer(BIG, 950);
    expect(prefersGrid(service, 2)).toBeUndefined();
    answer(SMALL, 150);
    expect(prefersGrid(service, 2)).toBe(true);
  });

  it("asks for the grid where joined tiles cost far more (a server that keeps its grid)", () => {
    // Yale's: its grid 0.1–0.15 s, a joined tile rendered fresh 0.7–4 s.
    const { service, answer } = host();
    [140, 150].forEach((ms) => answer(SMALL, ms));
    [700, 2200].forEach((ms) => answer(BIG, ms));
    expect(prefersGrid(service, 2)).toBe(true);
  });

  it("counts a large whole image as no tile it had to render", () => {
    // Yale's again: its listed sizes at once, even at a megapixel, as every viewer asks
    // for them; only its tiles tell what a joined one costs.
    const { service, answer } = host();
    [140, 150].forEach((ms) => answer(SMALL, ms));
    [150, 160, 170].forEach((ms) => answer(BIG, ms, true));
    [700, 2200].forEach((ms) => answer(BIG, ms));
    expect(prefersGrid(service, 2)).toBe(true);
  });

  it("keeps joined tiles where every request costs about the same", () => {
    // Princeton's: about half a second a request, whatever its size.
    const { service, answer } = host();
    [400, 430].forEach((ms) => answer(SMALL, ms));
    [520, 560].forEach((ms) => answer(BIG, ms));
    expect(prefersGrid(service, 2)).toBe(false);
  });

  it("asks more of a joined tile that saves sixteen requests than one that saves four", () => {
    const { service, answer } = host();
    [130, 130].forEach((ms) => answer(SMALL, ms));
    [900, 900].forEach((ms) => answer(BIG, ms));
    // Seven times a small answer: enough for 512 px tiles joined two by two, not for 256 px
    // tiles joined four by four (eight times, at least).
    expect(prefersGrid(service, 2)).toBe(true);
    expect(prefersGrid(service, 4)).toBe(false);
  });

  it("never leaves joined tiles that answer fast anyway", () => {
    const { service, answer } = host();
    [20, 20].forEach((ms) => answer(SMALL, ms));
    [200, 200].forEach((ms) => answer(BIG, ms));
    expect(prefersGrid(service, 2)).toBe(false);
  });

  it("times a request that waited for a connection from when it had one, and none that failed", () => {
    const { service, tile, answer, clock, tick } = host();
    const six = Array.from({ length: 6 }, () => timeLoad(tile, clock));
    const seventh = timeLoad(tile, clock);
    // Given up while it waited: it never takes a connection.
    const eighth = timeLoad(tile, clock);
    eighth();
    expect(hostIdle(service)).toBe(false);
    tick(5000);
    // The six fail, and the seventh is sent as the first of them comes back.
    six.forEach((done) => done());
    tick(700);
    seventh(BIG);
    expect(hostIdle(service)).toBe(true);
    [400, 420].forEach((ms) => answer(SMALL, ms));
    answer(BIG, 750);
    // Its 0.7 s on the wire, not the 5.7 s since it was asked: joined tiles stay.
    expect(prefersGrid(service, 2)).toBe(false);
  });

  it("counts neither a middling answer nor another host's", () => {
    const yale = host("https://images.collections.yale.edu");
    const other = host("https://iiif.example.org");
    [140, 150].forEach((ms) => yale.answer(SMALL, ms));
    yale.answer(450_000, 3000);
    yale.answer(BIG, 800);
    other.answer(BIG, 900);
    expect(prefersGrid(yale.service, 2)).toBeUndefined();
    yale.answer(BIG, 800);
    expect(prefersGrid(yale.service, 2)).toBe(true);
    expect(prefersGrid(other.service, 2)).toBeUndefined();
  });

  it("changes its mind twice at most, then holds", () => {
    const { service, answer } = host();
    [140, 140].forEach((ms) => answer(SMALL, ms));
    [900, 900].forEach((ms) => answer(BIG, ms));
    expect(prefersGrid(service, 2)).toBe(true);
    // On the grid, its tiles turn out slow too: back to joined tiles.
    Array.from({ length: 8 }, () => answer(SMALL, 600));
    expect(prefersGrid(service, 2)).toBe(false);
    // And quick again: once more to the grid, and there it stays.
    Array.from({ length: 8 }, () => answer(SMALL, 100));
    expect(prefersGrid(service, 2)).toBe(true);
    Array.from({ length: 8 }, () => answer(SMALL, 600));
    expect(prefersGrid(service, 2)).toBe(true);
  });
});
