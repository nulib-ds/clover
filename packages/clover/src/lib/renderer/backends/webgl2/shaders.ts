/**
 * One program draws everything: a unit quad, placed by a 3×3 matrix that already ends in
 * clip space, sampling a sub-rectangle of a premultiplied-alpha texture.
 */

export const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
uniform mat3 u_matrix;
uniform vec4 u_crop;
out vec2 v_uv;

void main() {
  vec3 clip = u_matrix * vec3(a_position, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_uv = u_crop.xy + a_position * u_crop.zw;
}
`;

/**
 * How far toward the sharper mip level each sample leans. The planner draws a level at one
 * to two of its pixels to a device pixel, where trilinear filtering blends in the level
 * half as sharp, so text and print came out softer than OpenSeadragon or Atlas draw them:
 * 62–80% of the edge energy of an ideal (Lanczos) downscale, where they had 75–88%
 * (measured 2026-11-06). Half a level sharper matches them on text and print, and keeps
 * the blend near 2×, where the full level alone would shimmer on a halftone.
 */
const LOD_BIAS = -0.5;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_opacity;
out vec4 outColor;

void main() {
  outColor = texture(u_texture, v_uv, ${LOD_BIAS.toFixed(1)}) * u_opacity;
}
`;
