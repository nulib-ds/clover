/**
 * Fetch and decode an image the backends can draw.
 *
 * The preferred path is `fetch` → `createImageBitmap`: abortable, decoded off the main
 * thread, and CORS-clean so WebGL may upload it.
 *
 * IIIF recommends CORS but does not require it. When `fetch` rejects without an HTTP
 * response — what a missing `Access-Control-Allow-Origin` looks like from script — the
 * image is loaded as a plain `<img>` instead. That element is *opaque*: it displays, and
 * Canvas2D can draw it, but WebGL cannot upload it, so the renderer presents it as a DOM
 * layer. The verdict is remembered per origin so later images skip a fetch the browser
 * is guaranteed to block.
 */

import {
  type CloverRequest,
  cloverFetch,
  sendsCredentials,
} from "../../../core/request";

export type LoadedImage =
  | {
      /**
       * A video element, playing: drawn from its current frame. `opaque` here means
       * "present as a DOM layer" — a positioned `<video>` the browser composites itself —
       * rather than uploading frames to the GPU.
       */
      kind: "media";
      source: HTMLVideoElement;
      width: number;
      height: number;
      naturalWidth: number;
      naturalHeight: number;
      opaque: boolean;
    }
  | {
      kind: "bitmap";
      source: ImageBitmap;
      /** Pixel size of `source`, which may be smaller than the image if it was resized. */
      width: number;
      height: number;
      naturalWidth: number;
      naturalHeight: number;
      opaque: false;
    }
  | {
      kind: "element";
      source: HTMLImageElement;
      width: number;
      height: number;
      naturalWidth: number;
      naturalHeight: number;
      /** True when loaded without CORS: drawable as an element, not as a texture. */
      opaque: boolean;
    };

export interface LoadImageOptions {
  signal?: AbortSignal;
  /** Credentials and headers (sent on the `fetch` path only) and a custom `fetch`. */
  request?: CloverRequest;
  /** Largest texture the backend accepts; a bigger bitmap is resized to fit. */
  maxTextureSize?: number;
}

export class ImageLoadError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ImageLoadError";
  }
}

const opaqueOrigins = new Set<string>();

export async function loadImage(
  url: string,
  options: LoadImageOptions = {},
): Promise<LoadedImage> {
  const { signal, maxTextureSize, request } = options;
  const withCredentials = sendsCredentials(request);
  const origin = originOf(url);

  if (typeof createImageBitmap !== "function" || typeof fetch !== "function") {
    return loadElement(url, { signal, cors: true, withCredentials });
  }

  if (origin && opaqueOrigins.has(origin)) {
    return loadElement(url, { signal, cors: false, withCredentials });
  }

  let response: Response;
  try {
    response = await cloverFetch(request, url, { mode: "cors", signal });
  } catch (error) {
    if (isAbort(error, signal)) throw error;
    // No response at all: a CORS refusal (or the network). Try it as a plain element.
    const loaded = await loadElement(url, {
      signal,
      cors: false,
      withCredentials,
    });
    if (origin) opaqueOrigins.add(origin);
    return loaded;
  }

  if (!response.ok) {
    throw new ImageLoadError(
      `Image request failed with ${response.status}`,
      url,
      response.status,
    );
  }

  const blob = await response.blob();
  let bitmap = await decodeBitmap(blob);
  const naturalWidth = bitmap.width;
  const naturalHeight = bitmap.height;

  if (
    maxTextureSize &&
    (bitmap.width > maxTextureSize || bitmap.height > maxTextureSize)
  ) {
    const ratio = maxTextureSize / Math.max(bitmap.width, bitmap.height);
    const resized = await createImageBitmap(bitmap, {
      resizeWidth: Math.max(1, Math.floor(bitmap.width * ratio)),
      resizeHeight: Math.max(1, Math.floor(bitmap.height * ratio)),
      resizeQuality: "high",
    });
    bitmap.close();
    bitmap = resized;
  }

  if (signal?.aborted) {
    bitmap.close();
    throw abortError();
  }

  return {
    kind: "bitmap",
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    naturalWidth,
    naturalHeight,
    opaque: false,
  };
}

async function decodeBitmap(blob: Blob): Promise<ImageBitmap> {
  const options: ImageBitmapOptions = {
    // Honor EXIF orientation, as an <img> would.
    imageOrientation: "from-image",
    premultiplyAlpha: "premultiply",
    colorSpaceConversion: "default",
  };
  try {
    return await createImageBitmap(blob, options);
  } catch (error) {
    // Older engines reject "from-image"; their default already honors EXIF.
    if (error instanceof TypeError) return createImageBitmap(blob);
    throw error;
  }
}

function loadElement(
  url: string,
  {
    signal,
    cors,
    withCredentials,
  }: { signal?: AbortSignal; cors: boolean; withCredentials: boolean },
): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const img = new Image();
    img.decoding = "async";
    if (cors)
      img.crossOrigin = withCredentials ? "use-credentials" : "anonymous";

    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      img.src = "";
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort);

    img.onload = () => {
      cleanup();
      const finish = () =>
        resolve({
          kind: "element",
          source: img,
          width: img.naturalWidth,
          height: img.naturalHeight,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          opaque: !cors,
        });
      // Decode before handing it over, so the first draw doesn't stall the frame.
      if (typeof img.decode === "function") {
        img.decode().then(finish, finish);
      } else {
        finish();
      }
    };
    img.onerror = () => {
      cleanup();
      reject(new ImageLoadError("Image failed to load", url));
    };
    img.src = url;
  });
}

function originOf(url: string): string | null {
  try {
    return new URL(url, globalThis.location?.href).origin;
  } catch {
    return null;
  }
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return (
    Boolean(signal?.aborted) ||
    (typeof error === "object" &&
      error !== null &&
      (error as { name?: string }).name === "AbortError")
  );
}

function abortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

/** Test seam: forget which origins were found to lack CORS. */
export function resetOpaqueOrigins(): void {
  opaqueOrigins.clear();
}

/** Release a loaded image's memory. Elements are left to GC. */
export function releaseImage(image: LoadedImage): void {
  if (image.kind === "bitmap") image.source.close();
}
