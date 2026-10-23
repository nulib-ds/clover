import {
  type CloverRequest,
  cloverFetch,
  requestKey,
} from "../../core/request";

/**
 * A glTF 2.0 model, fetched and read: its JSON, its buffers and its images, decoded. Binary
 * (`.glb`) or JSON (`.gltf`) with its buffers and images by address or as data URIs, all
 * fetched with the request's settings.
 */

/** The parts of glTF 2.0's JSON this reader uses. */
export interface GltfJson {
  asset?: { version?: string };
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  scene?: number;
  scenes?: Array<{ nodes?: number[] }>;
  nodes?: Array<{
    children?: number[];
    mesh?: number;
    matrix?: number[];
    translation?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
  }>;
  meshes?: Array<{ primitives: GltfPrimitive[] }>;
  accessors?: Array<{
    bufferView?: number;
    byteOffset?: number;
    componentType: number;
    normalized?: boolean;
    count: number;
    type: "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT2" | "MAT3" | "MAT4";
    min?: number[];
    max?: number[];
    sparse?: unknown;
  }>;
  bufferViews?: Array<{
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
  }>;
  buffers?: Array<{ uri?: string; byteLength: number }>;
  materials?: GltfMaterial[];
  textures?: Array<{ sampler?: number; source?: number }>;
  images?: Array<{ uri?: string; bufferView?: number; mimeType?: string }>;
  samplers?: Array<{
    magFilter?: number;
    minFilter?: number;
    wrapS?: number;
    wrapT?: number;
  }>;
}

export interface GltfPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
}

export interface GltfTextureInfo {
  index: number;
  texCoord?: number;
  scale?: number;
  strength?: number;
}

export interface GltfMaterial {
  pbrMetallicRoughness?: {
    baseColorFactor?: [number, number, number, number];
    baseColorTexture?: GltfTextureInfo;
    metallicFactor?: number;
    roughnessFactor?: number;
    metallicRoughnessTexture?: GltfTextureInfo;
  };
  normalTexture?: GltfTextureInfo;
  occlusionTexture?: GltfTextureInfo;
  emissiveTexture?: GltfTextureInfo;
  emissiveFactor?: [number, number, number];
  alphaMode?: "OPAQUE" | "MASK" | "BLEND";
  alphaCutoff?: number;
  doubleSided?: boolean;
  extensions?: Record<string, unknown>;
}

export interface GltfAsset {
  json: GltfJson;
  /** By index: the binary chunk's, or fetched. */
  buffers: ArrayBuffer[];
  /** By index, decoded; null where one would not decode. */
  images: Array<ImageBitmap | null>;
}

/**
 * What this reader draws beyond the core: unlit materials, a material's IOR and specular
 * factors, and the integer attributes of a quantized mesh (read as WebGL reads them). A
 * model that requires anything else (Draco, Meshopt, KTX2) says so rather than drawing
 * wrong.
 */
export const EXTENSIONS = [
  "KHR_materials_unlit",
  "KHR_materials_ior",
  "KHR_materials_specular",
  "KHR_mesh_quantization",
];

const GLB = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

/** A `.glb`'s JSON and binary chunk. */
export function parseGlb(data: ArrayBuffer): {
  json: GltfJson;
  bin?: ArrayBuffer;
} {
  const view = new DataView(data);
  if (view.getUint32(0, true) !== GLB) throw new Error("This is not a GLB.");
  if (view.getUint32(4, true) !== 2) throw new Error("Only glTF 2.0 is drawn.");
  let json: GltfJson | undefined;
  let bin: ArrayBuffer | undefined;
  const length = Math.min(view.getUint32(8, true), data.byteLength);
  for (let offset = 12; offset + 8 <= length; ) {
    const size = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (type === JSON_CHUNK)
      json = JSON.parse(
        new TextDecoder().decode(new Uint8Array(data, start, size)),
      );
    else if (type === BIN_CHUNK) bin = data.slice(start, start + size);
    offset = start + size;
  }
  if (!json) throw new Error("The GLB has no JSON chunk.");
  return { json, bin };
}

async function fetchBytes(
  uri: string,
  base: string,
  request?: CloverRequest,
): Promise<ArrayBuffer> {
  const url = new URL(uri, base).href;
  // A data URI is read as it is; an address, with the request's settings.
  const response = url.startsWith("data:")
    ? await fetch(url)
    : await cloverFetch(request, url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.arrayBuffer();
}

/**
 * The loads under way, by the fetch they use, then by address and request settings, so
 * Scenes showing one model at once share one download, one read and one decoding of its
 * textures. Two downloads at once of a large file that Chrome cannot cache fail one of
 * them (`ERR_CACHE_WRITE_FAILURE`). Each is let go once it settles: a later load asks
 * again.
 */
const loading = new WeakMap<object, Map<string, Promise<GltfAsset>>>();

/** The model at `url`, read, its buffers and images with it. */
export function loadGltf(
  url: string,
  request?: CloverRequest,
): Promise<GltfAsset> {
  const run = request?.fetch ?? globalThis.fetch;
  const loads = loading.get(run) ?? new Map<string, Promise<GltfAsset>>();
  loading.set(run, loads);
  const key = `${requestKey(request)} ${url}`;
  let load = loads.get(key);
  if (!load) {
    load = readGltf(url, request).finally(() => loads.delete(key));
    loads.set(key, load);
  }
  return load;
}

async function readGltf(
  url: string,
  request?: CloverRequest,
): Promise<GltfAsset> {
  const data = await fetchBytes(url, location.href, request);
  const glb = new DataView(data).getUint32(0, true) === GLB;
  const { json, bin } = glb
    ? parseGlb(data)
    : { json: JSON.parse(new TextDecoder().decode(data)) as GltfJson };
  const missing = (json.extensionsRequired ?? []).filter(
    (name) => !EXTENSIONS.includes(name),
  );
  if (missing.length)
    throw new Error(
      `Clover's renderer cannot draw this model: it requires ${missing.join(", ")}.`,
    );
  const buffers = await Promise.all(
    (json.buffers ?? []).map((buffer, index) => {
      if (buffer.uri !== undefined) return fetchBytes(buffer.uri, url, request);
      if (index === 0 && bin) return bin;
      throw new Error("A buffer of the model has no data.");
    }),
  );
  const images = await Promise.all(
    (json.images ?? []).map(async (image) => {
      try {
        let blob: Blob;
        if (image.bufferView !== undefined) {
          const view = json.bufferViews![image.bufferView];
          blob = new Blob(
            [
              new Uint8Array(
                buffers[view.buffer],
                view.byteOffset ?? 0,
                view.byteLength,
              ),
            ],
            { type: image.mimeType },
          );
        } else if (image.uri !== undefined) {
          blob = new Blob([await fetchBytes(image.uri, url, request)], {
            type: image.mimeType,
          });
        } else return null;
        // As the file has it: no flip, no premultiplying, no color conversion.
        return await createImageBitmap(blob, {
          premultiplyAlpha: "none",
          colorSpaceConversion: "none",
        });
      } catch {
        // A texture that will not decode is drawn as its factor alone.
        return null;
      }
    }),
  );
  return { json, buffers, images };
}

const COMPONENTS = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

/** Bytes per component, by glTF's component type (WebGL's enum). */
export const COMPONENT_BYTES: Record<number, number> = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
};

/** How many numbers one element of an accessor holds. */
export const componentsOf = (type: keyof typeof COMPONENTS) => COMPONENTS[type];

/**
 * An accessor's elements as floats, normalized integers scaled as WebGL scales them: for
 * reading on the CPU (a model's bounds), never for drawing, which reads the buffers as they
 * are.
 */
export function readAccessor(asset: GltfAsset, index: number): Float32Array {
  const accessor = asset.json.accessors![index];
  const size = componentsOf(accessor.type);
  const out = new Float32Array(accessor.count * size);
  if (accessor.bufferView === undefined) return out;
  const view = asset.json.bufferViews![accessor.bufferView];
  const bytes = COMPONENT_BYTES[accessor.componentType];
  const stride = view.byteStride || bytes * size;
  const data = new DataView(
    asset.buffers[view.buffer],
    (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0),
  );
  const read: (offset: number) => number =
    {
      5120: (o: number) => data.getInt8(o),
      5121: (o: number) => data.getUint8(o),
      5122: (o: number) => data.getInt16(o, true),
      5123: (o: number) => data.getUint16(o, true),
      5125: (o: number) => data.getUint32(o, true),
      5126: (o: number) => data.getFloat32(o, true),
    }[accessor.componentType] ?? (() => 0);
  const scale = accessor.normalized
    ? (
        { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 } as Record<
          number,
          number
        >
      )[accessor.componentType]
    : undefined;
  for (let element = 0; element < accessor.count; element++) {
    for (let component = 0; component < size; component++) {
      const value = read(element * stride + component * bytes);
      out[element * size + component] = scale
        ? Math.max(value / scale, -1)
        : value;
    }
  }
  return out;
}
