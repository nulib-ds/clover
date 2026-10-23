import { type Box, emptyBox, growBox } from "./bounds";
import {
  type GltfAsset,
  type GltfMaterial,
  type GltfTextureInfo,
  componentsOf,
} from "./load";
import { type Mat4, type Vec3, compose, multiply, normalMatrix } from "./mat4";
import { ATTRIBUTES, FLAGS, FRAGMENT, TEXTURES, VERTEX } from "./shaders";

/**
 * Clover's own glTF renderer: models drawn with WebGL2 and one program (`shaders.ts`), on
 * demand, never in a loop. It draws glTF 2.0's core: every node of the default scene,
 * every primitive's mode, attribute layouts as stored (interleaved, normalized integers),
 * metal and roughness materials with their five textures, alpha masks and blending, and
 * double sides. Not yet: skins, morph targets, animations, cameras and lights in the file,
 * sparse accessors, a texture's second set of coordinates, and the extensions it lists as
 * its own (`EXTENSIONS`). Framework-free, as Canvas's renderer is.
 */

export interface ModelRenderer {
  /** Upload a model, placed in the Scene by `placement`. */
  add(asset: GltfAsset, placement: Mat4): void;
  /** Everything added, as a box: what the camera frames. Null before anything is. */
  bounds(): Box | null;
  /** Draw it all from `eye`, through `viewProjection`, into a canvas `width` × `height`. */
  draw(viewProjection: Mat4, eye: Vec3, width: number, height: number): void;
  /** Free everything on the graphics card. */
  dispose(): void;
}

interface Draw {
  vao: WebGLVertexArrayObject;
  mode: number;
  count: number;
  /** Indices' type, and where they start; drawn as arrays without. */
  index?: { type: number; offset: number };
  model: Mat4;
  normal: Float32Array;
  /** The model turns inside out (a mirror's scale): its front faces wind the other way. */
  mirrored: boolean;
  material: Material;
}

interface Material {
  base: number[];
  /** A dielectric's reflectance at normal incidence: its IOR's, by its specular color. */
  specular: number[];
  metallic: number;
  roughness: number;
  normalScale: number;
  occlusion: number;
  emissive: number[];
  cutoff: number;
  flags: number;
  doubleSided: boolean;
  blend: boolean;
  textures: Array<WebGLTexture | null>;
}

const REPEAT = 10497;
const LINEAR = 9729;
const MIPMAPS = new Set([9984, 9985, 9986, 9987]);

function compile(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram()!;
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(
      `The 3D view's shaders would not build: ${gl.getProgramInfoLog(program)}`,
    );
  return program;
}

export function createModelRenderer(gl: WebGL2RenderingContext): ModelRenderer {
  const program = compile(gl);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const u = Object.fromEntries(
    [
      "uModel",
      "uViewProjection",
      "uNormalMatrix",
      "uCamera",
      "uBaseColor",
      "uSpecular",
      "uMetallic",
      "uRoughness",
      "uNormalScale",
      "uOcclusionStrength",
      "uEmissive",
      "uAlphaCutoff",
      "uFlags",
      ...TEXTURES,
    ].map((name) => [name, uniform(name)]),
  );
  gl.useProgram(program);
  TEXTURES.forEach((name, unit) => gl.uniform1i(u[name], unit));

  const buffers: WebGLBuffer[] = [];
  const textures: WebGLTexture[] = [];
  const draws: Draw[] = [];
  const box = emptyBox();

  /** One white pixel, for a texture a material does not have: its factor alone shows. */
  const white = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, white);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA8,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([255, 255, 255, 255]),
  );
  // No mipmaps to it: without this filter, it would sample as black.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  textures.push(white);
  // Vertex colors a primitive does not have are white, as glTF's default is.
  gl.vertexAttrib4f(ATTRIBUTES.COLOR_0, 1, 1, 1, 1);

  function add(asset: GltfAsset, placement: Mat4) {
    const { json } = asset;
    const views = new Map<string, WebGLBuffer>();
    const images = new Map<string, WebGLTexture>();
    const materials = new Map<number, Material>();

    /** A buffer view on the card, once per target it is bound to. */
    const viewBuffer = (index: number, target: number) => {
      const key = `${index}|${target}`;
      let buffer = views.get(key);
      if (!buffer) {
        const view = json.bufferViews![index];
        buffer = gl.createBuffer()!;
        gl.bindBuffer(target, buffer);
        gl.bufferData(
          target,
          new Uint8Array(
            asset.buffers[view.buffer],
            view.byteOffset ?? 0,
            view.byteLength,
          ),
          gl.STATIC_DRAW,
        );
        views.set(key, buffer);
        buffers.push(buffer);
      }
      return buffer;
    };

    const texture = (info: GltfTextureInfo | undefined, srgb: boolean) => {
      const definition = info ? json.textures?.[info.index] : undefined;
      const image =
        definition?.source !== undefined
          ? asset.images[definition.source]
          : null;
      if (!info || !image) return null;
      const key = `${info.index}|${srgb}`;
      let made = images.get(key);
      if (!made) {
        made = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, made);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          image,
        );
        const sampler =
          definition?.sampler !== undefined
            ? json.samplers?.[definition.sampler]
            : undefined;
        const min = sampler?.minFilter ?? gl.LINEAR_MIPMAP_LINEAR;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MAG_FILTER,
          sampler?.magFilter ?? LINEAR,
        );
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_WRAP_S,
          sampler?.wrapS ?? REPEAT,
        );
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_WRAP_T,
          sampler?.wrapT ?? REPEAT,
        );
        if (MIPMAPS.has(min)) gl.generateMipmap(gl.TEXTURE_2D);
        images.set(key, made);
        textures.push(made);
      }
      return made;
    };

    const material = (index: number | undefined): Material => {
      const key = index ?? -1;
      let made = materials.get(key);
      if (made) return made;
      const definition: GltfMaterial =
        index !== undefined ? (json.materials?.[index] ?? {}) : {};
      const pbr = definition.pbrMetallicRoughness ?? {};
      const normalMap = texture(definition.normalTexture, false);
      // `KHR_materials_ior` and `KHR_materials_specular`: how much a dielectric reflects.
      const ior = Number(
        (definition.extensions?.KHR_materials_ior as { ior?: number })?.ior ??
          1.5,
      );
      const specular = definition.extensions?.KHR_materials_specular as
        | { specularFactor?: number; specularColorFactor?: number[] }
        | undefined;
      const reflectance = ((ior - 1) / (ior + 1)) ** 2;
      made = {
        base: pbr.baseColorFactor ?? [1, 1, 1, 1],
        specular: (specular?.specularColorFactor ?? [1, 1, 1]).map(
          (channel) =>
            Math.min(reflectance * channel, 1) *
            (specular?.specularFactor ?? 1),
        ),
        metallic: pbr.metallicFactor ?? 1,
        roughness: pbr.roughnessFactor ?? 1,
        normalScale: definition.normalTexture?.scale ?? 1,
        occlusion: definition.occlusionTexture
          ? (definition.occlusionTexture.strength ?? 1)
          : 0,
        emissive: definition.emissiveFactor ?? [0, 0, 0],
        cutoff: definition.alphaCutoff ?? 0.5,
        flags:
          (normalMap ? FLAGS.normalMap : 0) |
          (definition.extensions?.KHR_materials_unlit ? FLAGS.unlit : 0) |
          (definition.alphaMode === "MASK" ? FLAGS.mask : 0),
        doubleSided: Boolean(definition.doubleSided),
        blend: definition.alphaMode === "BLEND",
        textures: [
          texture(pbr.baseColorTexture, true),
          texture(pbr.metallicRoughnessTexture, false),
          normalMap,
          texture(definition.occlusionTexture, false),
          texture(definition.emissiveTexture, true),
        ],
      };
      materials.set(key, made);
      return made;
    };

    const visit = (index: number, parent: Mat4) => {
      const node = json.nodes?.[index];
      if (!node) return;
      const world = multiply(
        parent,
        node.matrix
          ? new Float32Array(node.matrix)
          : compose(
              node.translation ?? [0, 0, 0],
              node.rotation ?? [0, 0, 0, 1],
              node.scale ?? [1, 1, 1],
            ),
      );
      const mesh =
        node.mesh !== undefined ? json.meshes?.[node.mesh] : undefined;
      for (const primitive of mesh?.primitives ?? []) {
        const position = primitive.attributes.POSITION;
        if (position === undefined) continue;
        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);
        let flags = 0;
        for (const [name, location] of Object.entries(ATTRIBUTES)) {
          const accessorIndex = primitive.attributes[name];
          const accessor =
            accessorIndex !== undefined
              ? json.accessors?.[accessorIndex]
              : undefined;
          // Missing, it reads the constant: white, or texture coordinates of 0.
          if (!accessor || accessor.bufferView === undefined || accessor.sparse)
            continue;
          const view = json.bufferViews![accessor.bufferView];
          gl.bindBuffer(
            gl.ARRAY_BUFFER,
            viewBuffer(accessor.bufferView, gl.ARRAY_BUFFER),
          );
          gl.enableVertexAttribArray(location);
          gl.vertexAttribPointer(
            location,
            componentsOf(accessor.type),
            accessor.componentType,
            Boolean(accessor.normalized),
            view.byteStride ?? 0,
            accessor.byteOffset ?? 0,
          );
          if (name === "NORMAL") flags |= FLAGS.normals;
        }
        const indices =
          primitive.indices !== undefined
            ? json.accessors?.[primitive.indices]
            : undefined;
        if (indices?.bufferView !== undefined)
          gl.bindBuffer(
            gl.ELEMENT_ARRAY_BUFFER,
            viewBuffer(indices.bufferView, gl.ELEMENT_ARRAY_BUFFER),
          );
        gl.bindVertexArray(null);
        const model = multiply(placement, world);
        const own = material(primitive.material);
        draws.push({
          vao,
          mode: primitive.mode ?? gl.TRIANGLES,
          count: indices ? indices.count : json.accessors![position].count,
          ...(indices?.bufferView !== undefined
            ? {
                index: {
                  type: indices.componentType,
                  offset: indices.byteOffset ?? 0,
                },
              }
            : {}),
          model,
          normal: normalMatrix(model),
          mirrored: determinant(model) < 0,
          material: { ...own, flags: own.flags | flags },
        });
        growBox(box, asset, position, model);
      }
      for (const child of node.children ?? []) visit(child, world);
    };
    const scene = json.scenes?.[json.scene ?? 0];
    // A file with no scene draws its nodes that are no node's child.
    const roots =
      scene?.nodes ??
      (json.nodes ?? [])
        .map((_, index) => index)
        .filter(
          (index) =>
            !json.nodes!.some((node) => node.children?.includes(index)),
        );
    const start = new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]);
    roots.forEach((index) => visit(index, start));
    // Blended surfaces after the rest, so what is behind them is drawn first.
    draws.sort((a, b) => Number(a.material.blend) - Number(b.material.blend));
  }

  function draw(
    viewProjection: Mat4,
    eye: Vec3,
    width: number,
    height: number,
  ) {
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(program);
    gl.uniformMatrix4fv(u.uViewProjection, false, viewProjection);
    gl.uniform3fv(u.uCamera, eye);
    for (const each of draws) {
      const { material } = each;
      if (material.doubleSided) gl.disable(gl.CULL_FACE);
      else gl.enable(gl.CULL_FACE);
      gl.frontFace(each.mirrored ? gl.CW : gl.CCW);
      if (material.blend) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
      } else {
        gl.disable(gl.BLEND);
        gl.depthMask(true);
      }
      material.textures.forEach((texture, unit) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture ?? white);
      });
      gl.uniformMatrix4fv(u.uModel, false, each.model);
      gl.uniformMatrix3fv(u.uNormalMatrix, false, each.normal);
      gl.uniform4fv(u.uBaseColor, material.base);
      gl.uniform3fv(u.uSpecular, material.specular);
      gl.uniform1f(u.uMetallic, material.metallic);
      gl.uniform1f(u.uRoughness, material.roughness);
      gl.uniform1f(u.uNormalScale, material.normalScale);
      gl.uniform1f(u.uOcclusionStrength, material.occlusion);
      gl.uniform3fv(u.uEmissive, material.emissive);
      gl.uniform1f(u.uAlphaCutoff, material.cutoff);
      gl.uniform1i(u.uFlags, material.flags);
      gl.bindVertexArray(each.vao);
      if (each.index)
        gl.drawElements(
          each.mode,
          each.count,
          each.index.type,
          each.index.offset,
        );
      else gl.drawArrays(each.mode, 0, each.count);
    }
    gl.bindVertexArray(null);
    gl.depthMask(true);
  }

  return {
    add,
    bounds: () => (draws.length ? box : null),
    draw,
    dispose() {
      draws.forEach((each) => gl.deleteVertexArray(each.vao));
      buffers.forEach((buffer) => gl.deleteBuffer(buffer));
      textures.forEach((texture) => gl.deleteTexture(texture));
      gl.deleteProgram(program);
      draws.length = 0;
    },
  };
}

/** The sign that tells a mirrored placement: its upper 3×3's determinant. */
function determinant(m: Mat4): number {
  return (
    m[0] * (m[5] * m[10] - m[6] * m[9]) -
    m[4] * (m[1] * m[10] - m[2] * m[9]) +
    m[8] * (m[1] * m[6] - m[2] * m[5])
  );
}
