import {
  GOTTINGEN_V2_0,
  GOTTINGEN_V2_1,
  GOTTINGEN_V3,
  LEVEL0_SIZES_ONLY,
  LEVEL2_UNTILED_V2,
  RECIPE_0005_MANIFEST,
} from "../../../fixtures/iiif-image/info";
import {
  clearInfoCache,
  fetchInfo,
  findImageServiceId,
  imageRequestUrl,
  parseInfo,
  serviceBase,
} from "./imageService";

const BASE = "https://iiif.io/api/image";
const IMAGE = "918ecd18c2592080851777620de9bcb5-gottingen";

describe("parseInfo", () => {
  it.each([
    ["3.0", GOTTINGEN_V3, 3],
    ["2.1.1", GOTTINGEN_V2_1, 2],
    ["2.0", GOTTINGEN_V2_0, 2],
  ])("reads the reference %s service", (_, json, version) => {
    const info = parseInfo(json);
    expect(info.version).toBe(version);
    expect(info.level).toBe(1);
    expect(info.width).toBe(4032);
    expect(info.height).toBe(3024);
    expect(info.tiles).toEqual([
      { width: 512, height: 512, scaleFactors: [1, 2, 4] },
    ]);
    expect(info.regionByPx).toBe(true);
    expect(info.format).toBe("jpg");
  });

  it("reads a level 0 sizes-only tree", () => {
    const info = parseInfo(LEVEL0_SIZES_ONLY);
    expect(info.level).toBe(0);
    expect(info.regionByPx).toBe(false);
    expect(info.sizes.map((s) => s.width)).toEqual([375, 750, 1500]);
  });

  it("finds 2.1 size limits in the profile object, and drops a trailing slash", () => {
    const info = parseInfo(LEVEL2_UNTILED_V2);
    expect(info.id).toBe("https://example.org/iiif/2/untiled");
    expect(info.level).toBe(2);
    expect(info.maxWidth).toBe(3000);
    // "maxHeight defaults to maxWidth."
    expect(info.maxHeight).toBe(3000);
  });

  it("prefers a decodable preferredFormat", () => {
    const info = parseInfo({
      ...GOTTINGEN_V3,
      preferredFormats: ["jp2", "webp"],
    });
    expect(info.format).toBe("webp");
  });

  it("rejects a document without dimensions", () => {
    expect(() => parseInfo({ id: "x" })).toThrow(/width or height/);
  });
});

describe("imageRequestUrl", () => {
  const v3 = parseInfo(GOTTINGEN_V3);
  const v2 = parseInfo(GOTTINGEN_V2_1);

  it("spells a 3.0 tile with the canonical w,h size", () => {
    expect(
      imageRequestUrl(v3, { x: 0, y: 0, width: 2048, height: 2048 }, 512, 512),
    ).toBe(
      `${BASE}/3.0/example/reference/${IMAGE}/0,0,2048,2048/512,512/0/default.jpg`,
    );
  });

  it("spells a 2.x tile with the canonical w, size", () => {
    expect(
      imageRequestUrl(
        v2,
        { x: 3584, y: 2560, width: 448, height: 464 },
        448,
        464,
      ),
    ).toBe(
      `${BASE}/2.1/example/reference/${IMAGE}/3584,2560,448,464/448,/0/default.jpg`,
    );
  });

  it("calls the whole image `full`, and its full size `max` (3.0) or `full` (2.x)", () => {
    const all = { x: 0, y: 0, width: 4032, height: 3024 };
    expect(imageRequestUrl(v3, all, 4032, 3024)).toMatch(
      /\/full\/max\/0\/default\.jpg$/,
    );
    expect(imageRequestUrl(v2, all, 4032, 3024)).toMatch(
      /\/full\/full\/0\/default\.jpg$/,
    );
    expect(imageRequestUrl(v3, all, 1008, 756)).toMatch(/\/full\/1008,756\//);
  });
});

describe("service discovery", () => {
  it("finds the service on the 0005 recipe's painting body", () => {
    const body = RECIPE_0005_MANIFEST.items[0].items[0].items[0].body;
    expect(findImageServiceId(body.service)).toBe(
      `${BASE}/3.0/example/reference/${IMAGE}`,
    );
  });

  it("accepts Presentation 2 shapes: a bare object with @id and a profile URI", () => {
    expect(
      findImageServiceId({
        "@id": "https://example.org/iiif/abc/",
        profile: "http://iiif.io/api/image/2/level2.json",
      }),
    ).toBe("https://example.org/iiif/abc");
  });

  it("skips services that are not image services", () => {
    expect(
      findImageServiceId([
        { id: "https://example.org/auth", type: "AuthProbeService2" },
        { id: "https://example.org/iiif/img", type: "ImageService3" },
      ]),
    ).toBe("https://example.org/iiif/img");
  });

  it("normalizes an info.json URI to the service base", () => {
    expect(serviceBase("https://example.org/iiif/abc/info.json")).toBe(
      "https://example.org/iiif/abc",
    );
  });
});

describe("fetchInfo", () => {
  afterEach(() => {
    clearInfoCache();
    vi.unstubAllGlobals();
  });

  it("fetches once per service, honouring credentials and headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(GOTTINGEN_V3),
    });
    vi.stubGlobal("fetch", fetchMock);

    const id = `${BASE}/3.0/example/reference/${IMAGE}`;
    const [a, b] = await Promise.all([
      fetchInfo(`${id}/info.json`, {
        request: {
          credentials: "include",
          headers: { Authorization: "Bearer t" },
        },
      }),
      fetchInfo(id),
    ]);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${id}/info.json`);
    expect(init.credentials).toBe("include");
    expect(init.headers.Authorization).toBe("Bearer t");
  });

  it("does not cache a failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(GOTTINGEN_V2_0),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchInfo("https://example.org/a")).rejects.toThrow(/503/);
    await expect(fetchInfo("https://example.org/a")).resolves.toMatchObject({
      version: 2,
    });
  });
});
