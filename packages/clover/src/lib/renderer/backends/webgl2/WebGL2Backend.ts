import {
  type Backend,
  type BackendCallbacks,
  type DrawCommand,
  type DrawResult,
  bleedInSourcePixels,
  hasPixels,
} from "../backend";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shaders";
import { compose, scale, toClipMat3, translate } from "../../math/affine";

interface TextureEntry {
  texture: WebGLTexture;
  width: number;
  height: number;
}

/**
 * The primary backend: every drawable is a textured unit quad.
 *
 * Uploads are cached by key, so a still image or tile is uploaded once and then costs one
 * draw call per frame. Video never comes here: it is shown as itself, in the DOM layer.
 *
 * Cross-origin pixels without CORS cannot be uploaded at all — `texImage2D` throws a
 * `SecurityError` — so `draw` reports `"tainted"` and the renderer presents that item as a
 * DOM layer instead. That decision is per item, never per instance.
 */
export class WebGL2Backend implements Backend {
  readonly kind = "webgl2" as const;
  readonly canvas: HTMLCanvasElement;
  readonly maxTextureSize: number;

  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject | null;
  private uniforms: {
    matrix: WebGLUniformLocation | null;
    crop: WebGLUniformLocation | null;
  };
  private textures = new Map<string, TextureEntry>();
  private cssWidth = 1;
  private cssHeight = 1;
  private pixelRatio = 1;
  private matrixScratch = new Float32Array(9);
  private isLost = false;
  private callbacks: BackendCallbacks;

  /** Returns null when WebGL2 is unavailable, so the caller can fall back. */
  static create(
    canvas: HTMLCanvasElement,
    callbacks: BackendCallbacks = {},
  ): WebGL2Backend | null {
    let gl: WebGL2RenderingContext | null = null;
    try {
      // The rest as WebGL's defaults are: alpha, premultiplied, no stencil, not preserved.
      gl = canvas.getContext("webgl2", {
        antialias: false,
        depth: false,
      }) as WebGL2RenderingContext | null;
    } catch {
      gl = null;
    }
    // jsdom and some stubs hand back a non-context; check for the API, not just truthiness.
    if (!gl || typeof gl.createShader !== "function") return null;
    try {
      return new WebGL2Backend(canvas, gl, callbacks);
    } catch {
      return null;
    }
  }

  private constructor(
    canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    callbacks: BackendCallbacks,
  ) {
    this.canvas = canvas;
    this.gl = gl;
    this.callbacks = callbacks;
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
    const program = linkProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    this.program = program;
    // The sampler reads texture unit 0, as a linked program's samplers start out.
    this.uniforms = {
      matrix: gl.getUniformLocation(program, "u_matrix"),
      crop: gl.getUniformLocation(program, "u_crop"),
    };

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const location = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.vao = vao;

    /*
     * Premultiplied throughout, so edges of transparent PNGs don't fringe. The rest of the
     * unpacking (unflipped, the browser's color conversion) and the clear color, the texture
     * unit and each texture's magnifying filter (linear) are a new context's own, which
     * nothing changes: this backend's context is its canvas's alone.
     */
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    canvas.addEventListener("webglcontextlost", this.handleLost);
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.cssWidth = Math.max(1, width);
    this.cssHeight = Math.max(1, height);
    this.pixelRatio = pixelRatio;
    const w = Math.max(1, Math.round(width * pixelRatio));
    const h = Math.max(1, Math.round(height * pixelRatio));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    /*
     * Its shown size the one it is drawn for, in pixels, never left to `100%`: iOS Safari
     * kept an absolutely placed canvas at its old height as its host grew (Document's live
     * page as it loads), its picture squeezed into it over the page's still (Mat,
     * 2026-11-11: "the canvases being drawn multiple times as it scrolls").
     */
    this.canvas.style.width = `${Math.max(1, width)}px`;
    this.canvas.style.height = `${Math.max(1, height)}px`;
  }

  begin(): void {
    if (this.isLost) return;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
  }

  draw(command: DrawCommand): DrawResult {
    if (this.isLost) return "skipped";
    if (!hasPixels(command.source)) return "skipped";

    const gl = this.gl;
    const entry = this.upload(command);
    if (entry === "tainted") return "tainted";
    if (!entry) return "skipped";

    const crop = command.crop ?? {
      x: 0,
      y: 0,
      width: command.width,
      height: command.height,
    };

    // Unit quad → crop rect in source pixels → the Body's CSS pixels → clip space. A
    // bleed stretches the quad, not the texture coordinates.
    const bleed = bleedInSourcePixels(command, this.pixelRatio);
    const quad = compose(
      command.transform,
      translate(crop.x, crop.y),
      scale(crop.width + bleed.x, crop.height + bleed.y),
    );
    gl.uniformMatrix3fv(
      this.uniforms.matrix,
      false,
      toClipMat3(quad, this.cssWidth, this.cssHeight, this.matrixScratch),
    );
    gl.uniform4f(
      this.uniforms.crop,
      crop.x / command.width,
      crop.y / command.height,
      crop.width / command.width,
      crop.height / command.height,
    );
    gl.bindTexture(gl.TEXTURE_2D, entry.texture);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return "drawn";
  }

  end(): void {
    if (this.isLost) return;
    this.gl.bindVertexArray(null);
  }

  has(key: string): boolean {
    return !this.isLost && this.textures.has(key);
  }

  release(key: string): void {
    const entry = this.textures.get(key);
    if (!entry) return;
    if (!this.isLost) this.gl.deleteTexture(entry.texture);
    this.textures.delete(key);
  }

  dispose(): void {
    this.canvas.removeEventListener("webglcontextlost", this.handleLost);
    if (!this.isLost) {
      for (const key of [...this.textures.keys()]) this.release(key);
      this.gl.deleteProgram(this.program);
      this.gl.deleteVertexArray(this.vao);
    }
    this.textures.clear();
    /*
     * Give the context back now rather than waiting for GC. Browsers cap live WebGL
     * contexts per page (about 16 on desktop, 8 on Android) and silently kill the oldest
     * beyond that, which a page of Scroll figures would otherwise hit.
     */
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.isLost = true;
  }

  private upload(command: DrawCommand): TextureEntry | "tainted" | null {
    const gl = this.gl;
    const existing = this.textures.get(command.key);

    if (
      existing &&
      existing.width === command.width &&
      existing.height === command.height
    ) {
      return existing;
    }

    const texture = existing?.texture ?? gl.createTexture();
    if (!texture) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);

    try {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        command.source,
      );
    } catch (error) {
      if (!existing) gl.deleteTexture(texture);
      if (isSecurityError(error)) return "tainted";
      throw error;
    }

    // Mipmaps, so a zoomed-out view is filtered rather than aliased.
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const entry: TextureEntry = {
      texture,
      width: command.width,
      height: command.height,
    };
    this.textures.set(command.key, entry);
    return entry;
  }

  /*
   * The browser took the context. Nothing waits for it back: the renderer lets this
   * backend and its canvas go at once (`onLost`), and draws on another.
   */
  private handleLost = () => {
    this.isLost = true;
    this.textures.clear();
    this.callbacks.onLost?.();
  };
}

/*
 * The one program, linked, or a throw, which `create` turns into no backend: a shader that
 * does not compile fails the link, and a lost context's null objects throw in the next
 * call. Nothing reads the logs, so none are kept.
 */
function linkProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const program = gl.createProgram()!;
  const shaders = (
    [
      [gl.VERTEX_SHADER, vertexSource],
      [gl.FRAGMENT_SHADER, fragmentSource],
    ] as const
  ).map(([type, source]) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    return shader;
  });
  gl.linkProgram(program);
  shaders.forEach((shader) => gl.deleteShader(shader));
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error();
  return program;
}

function isSecurityError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "SecurityError"
  );
}
