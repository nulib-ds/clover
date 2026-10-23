import {
  type GltfAsset,
  type GltfJson,
  loadGltf,
  parseGlb,
  readAccessor,
} from "./load";

/** A GLB of `json` and `bin`, as a file has them: header, JSON chunk, binary chunk. */
function glb(
  json: GltfJson,
  bin = new Uint8Array(0),
  version = 2,
): ArrayBuffer {
  const pad = (bytes: Uint8Array, fill: number) => {
    const length = Math.ceil(bytes.length / 4) * 4;
    const out = new Uint8Array(length).fill(fill);
    out.set(bytes);
    return out;
  };
  const text = pad(new TextEncoder().encode(JSON.stringify(json)), 0x20);
  const data = pad(bin, 0);
  const total = 12 + 8 + text.length + (data.length ? 8 + data.length : 0);
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, version, true);
  view.setUint32(8, total, true);
  view.setUint32(12, text.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(out, 20, text.length).set(text);
  if (data.length) {
    const at = 20 + text.length;
    view.setUint32(at, data.length, true);
    view.setUint32(at + 4, 0x004e4942, true);
    new Uint8Array(out, at + 8, data.length).set(data);
  }
  return out;
}

/** Every request answered with these bytes. */
const serve = (bytes: ArrayBuffer) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(bytes, { status: 200 })),
  );

afterEach(() => vi.unstubAllGlobals());

describe("parseGlb", () => {
  it("reads a GLB's JSON and binary chunk", () => {
    const bin = new Uint8Array([1, 2, 3, 4, 5]);
    const { json, bin: read } = parseGlb(
      glb({ asset: { version: "2.0" }, buffers: [{ byteLength: 5 }] }, bin),
    );
    expect(json.asset?.version).toBe("2.0");
    expect(Array.from(new Uint8Array(read!)).slice(0, 5)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("refuses what is not glTF 2.0's binary", () => {
    expect(() => parseGlb(new ArrayBuffer(16))).toThrow("This is not a GLB.");
    expect(() => parseGlb(glb({}, undefined, 1))).toThrow("Only glTF 2.0");
  });
});

describe("loadGltf", () => {
  it("says which extension a model needs that it cannot draw", async () => {
    serve(
      glb({
        asset: { version: "2.0" },
        extensionsUsed: ["KHR_draco_mesh_compression"],
        extensionsRequired: ["KHR_draco_mesh_compression"],
      }),
    );
    await expect(loadGltf("https://example.org/a.glb")).rejects.toThrow(
      "requires KHR_draco_mesh_compression",
    );
  });

  it("reads a .gltf's buffer from a data URI, and draws an image that will not decode by its factor", async () => {
    const original = globalThis.fetch;
    const json: GltfJson = {
      asset: { version: "2.0" },
      buffers: [
        { uri: "data:application/octet-stream;base64,AAECAw==", byteLength: 4 },
      ],
      images: [{ uri: "texture.png" }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("data:")
          ? original(url)
          : url.endsWith(".gltf")
            ? new Response(JSON.stringify(json), { status: 200 })
            : new Response(new Uint8Array([0]), { status: 200 }),
      ),
    );
    const asset = await loadGltf("https://example.org/models/a.gltf");
    expect(Array.from(new Uint8Array(asset.buffers[0]))).toEqual([0, 1, 2, 3]);
    expect(asset.images).toEqual([null]);
    // Its image, by its address beside the model.
    expect(fetch).toHaveBeenCalledWith(
      "https://example.org/models/texture.png",
      expect.anything(),
    );
  });

  it("shares one load of a model under way, and asks again once it settles", async () => {
    serve(glb({ asset: { version: "2.0" } }));
    const url = "https://example.org/a.glb";
    const [first, second] = await Promise.all([loadGltf(url), loadGltf(url)]);
    expect(first).toBe(second);
    expect(fetch).toHaveBeenCalledTimes(1);
    // Asked with other settings, or once the first has settled, it is fetched again.
    await Promise.all([
      loadGltf(url),
      loadGltf(url, { credentials: "include" }),
    ]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("says what answered when a model will not load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    await expect(loadGltf("https://example.org/gone.glb")).rejects.toThrow(
      "https://example.org/gone.glb answered 404",
    );
  });
});

describe("readAccessor", () => {
  /** An asset with one buffer and these accessors over it. */
  const asset = (bytes: Uint8Array, accessor: object, byteStride?: number) =>
    ({
      json: {
        bufferViews: [
          {
            buffer: 0,
            byteLength: bytes.length,
            ...(byteStride ? { byteStride } : {}),
          },
        ],
        accessors: [{ bufferView: 0, ...accessor }],
      },
      buffers: [bytes.buffer],
      images: [],
    }) as unknown as GltfAsset;

  it("reads floats, interleaved by the view's stride", () => {
    const data = new Float32Array([1, 2, 3, 99, 4, 5, 6, 99]);
    const values = readAccessor(
      asset(
        new Uint8Array(data.buffer),
        { componentType: 5126, count: 2, type: "VEC3" },
        16,
      ),
      0,
    );
    expect(Array.from(values)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("scales normalized integers as WebGL does", () => {
    expect(
      Array.from(
        readAccessor(
          asset(new Uint8Array([0, 255, 51]), {
            componentType: 5121,
            normalized: true,
            count: 3,
            type: "SCALAR",
          }),
          0,
        ),
      ).map((value) => +value.toFixed(2)),
    ).toEqual([0, 1, 0.2]);
    const shorts = new Int16Array([-32768, 32767]);
    expect(
      Array.from(
        readAccessor(
          asset(new Uint8Array(shorts.buffer), {
            componentType: 5122,
            normalized: true,
            count: 2,
            type: "SCALAR",
          }),
          0,
        ),
      ),
    ).toEqual([-1, 1]);
  });
});
