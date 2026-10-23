/**
 * The one program Clover's glTF renderer draws with (WebGL2, GLSL ES 3.00): glTF's metal
 * and roughness shading, a little of it approximated, lit by a neutral room that stays put
 * as the camera turns (a sky above, a ground below, three lights), then tone mapped as
 * Khronos's PBR Neutral maps it (three.js's `NeutralToneMapping`, ported) and written in
 * sRGB. What a material lacks (a texture, normals, vertex colors) is a flag, not another
 * program.
 */

/** Flags, `uFlags`: what the primitive and its material have. */
export const FLAGS = {
  normals: 1,
  normalMap: 2,
  unlit: 4,
  mask: 8,
} as const;

/** The attributes' locations. */
export const ATTRIBUTES: Record<string, number> = {
  POSITION: 0,
  NORMAL: 1,
  TEXCOORD_0: 2,
  COLOR_0: 3,
};

/** The textures' units, in this order. */
export const TEXTURES = [
  "uBaseTexture",
  "uMetalRoughTexture",
  "uNormalTexture",
  "uOcclusionTexture",
  "uEmissiveTexture",
] as const;

export const VERTEX = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
layout(location = 3) in vec4 aColor;
uniform mat4 uModel;
uniform mat4 uViewProjection;
uniform mat3 uNormalMatrix;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUv;
out vec4 vColor;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vNormal = uNormalMatrix * aNormal;
  vUv = aUv;
  vColor = aColor;
  gl_Position = uViewProjection * world;
}`;

export const FRAGMENT = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUv;
in vec4 vColor;
uniform vec3 uCamera;
uniform vec4 uBaseColor;
uniform vec3 uSpecular;
uniform float uMetallic;
uniform float uRoughness;
uniform float uNormalScale;
uniform float uOcclusionStrength;
uniform vec3 uEmissive;
uniform float uAlphaCutoff;
uniform int uFlags;
uniform sampler2D uBaseTexture;
uniform sampler2D uMetalRoughTexture;
uniform sampler2D uNormalTexture;
uniform sampler2D uOcclusionTexture;
uniform sampler2D uEmissiveTexture;
out vec4 outColor;

const float PI = 3.14159265;
const float LAMP = 3.0;
// The room: a sky and a ground for the light all round, and three lights in it.
const vec3 SKY = vec3(0.73);
const vec3 GROUND = vec3(0.58);
const vec3 LIGHTS[3] = vec3[3](
  normalize(vec3(0.3, 0.7, 0.9)),
  normalize(vec3(-0.8, 0.35, 0.5)),
  normalize(vec3(0.2, 0.4, -1.0))
);
const vec3 RADIANCE[3] = vec3[3](vec3(1.2), vec3(0.3), vec3(0.4));

vec3 room(vec3 direction) {
  return mix(GROUND, SKY, direction.y * 0.5 + 0.5);
}

// What a surface reflects of the room: its sky and ground, and its lamps, soft panels a
// glossy surface mirrors and a rough one only glows with.
const vec3 LAMPS[3] = vec3[3](
  normalize(vec3(0.0, 1.0, 0.3)),
  normalize(vec3(-1.0, 0.5, 0.4)),
  normalize(vec3(1.0, 0.35, -0.3))
);
vec3 reflected(vec3 direction, float roughness) {
  vec3 color = room(direction);
  float spread = mix(0.04, 0.9, roughness);
  for (int i = 0; i < 3; i++) {
    float c = dot(direction, LAMPS[i]);
    color += vec3(LAMP) * smoothstep(1.0 - spread, 1.0 - spread * 0.35, c) * (1.0 - 0.85 * roughness);
  }
  return color;
}

// A normal map's normal, in the frame its texture coordinates make (no tangents read).
vec3 mapped(vec3 n) {
  vec3 tangentNormal = texture(uNormalTexture, vUv).xyz * 2.0 - 1.0;
  tangentNormal.xy *= vec2(uNormalScale, -uNormalScale);
  vec3 dp1 = dFdx(vWorld);
  vec3 dp2 = dFdy(vWorld);
  vec2 duv1 = dFdx(vUv);
  vec2 duv2 = dFdy(vUv);
  vec3 dp2perp = cross(dp2, n);
  vec3 dp1perp = cross(n, dp1);
  vec3 t = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 b = dp2perp * duv1.y + dp1perp * duv2.y;
  float scale = inversesqrt(max(dot(t, t), dot(b, b)) + 1e-12);
  return normalize(mat3(t * scale, b * scale, n) * tangentNormal);
}

vec3 neutral(vec3 color) {
  const float start = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < start) return color;
  float d = 1.0 - start;
  float newPeak = 1.0 - d * d / (peak + d - start);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}

vec3 srgb(vec3 linear) {
  return mix(
    linear * 12.92,
    1.055 * pow(linear, vec3(1.0 / 2.4)) - 0.055,
    step(0.0031308, linear)
  );
}

void main() {
  vec4 base = uBaseColor * texture(uBaseTexture, vUv) * vColor;
  if ((uFlags & ${FLAGS.mask}) != 0 && base.a < uAlphaCutoff) discard;
  if ((uFlags & ${FLAGS.unlit}) != 0) {
    outColor = vec4(srgb(base.rgb) * base.a, base.a);
    return;
  }
  // No normals given: the face's own, as glTF asks.
  vec3 n = (uFlags & ${FLAGS.normals}) != 0
    ? normalize(vNormal)
    : normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (!gl_FrontFacing) n = -n;
  if ((uFlags & ${FLAGS.normalMap}) != 0) n = mapped(n);
  vec3 v = normalize(uCamera - vWorld);
  vec4 metalRough = texture(uMetalRoughTexture, vUv);
  float roughness = clamp(uRoughness * metalRough.g, 0.045, 1.0);
  float metallic = clamp(uMetallic * metalRough.b, 0.0, 1.0);
  vec3 diffuse = base.rgb * (1.0 - metallic);
  vec3 f0 = mix(uSpecular, base.rgb, metallic);
  float a = roughness * roughness;
  float nv = clamp(dot(n, v), 1e-4, 1.0);
  vec3 color = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec3 l = LIGHTS[i];
    float nl = clamp(dot(n, l), 0.0, 1.0);
    if (nl <= 0.0) continue;
    vec3 h = normalize(l + v);
    float nh = clamp(dot(n, h), 0.0, 1.0);
    float vh = clamp(dot(v, h), 0.0, 1.0);
    float a2 = a * a;
    float dd = nh * nh * (a2 - 1.0) + 1.0;
    float distribution = a2 / (PI * dd * dd);
    float viewed = nl * sqrt(nv * nv * (1.0 - a2) + a2);
    float lit = nv * sqrt(nl * nl * (1.0 - a2) + a2);
    float visibility = 0.5 / (viewed + lit + 1e-5);
    vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
    vec3 specular = fresnel * distribution * visibility;
    color += ((1.0 - fresnel) * diffuse + PI * specular) * RADIANCE[i] * nl;
  }
  // The room's light all round: diffuse, and what a rough or smooth surface reflects of it.
  vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
  vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
  vec4 r = roughness * c0 + c1;
  float a004 = min(r.x * r.x, exp2(-9.28 * nv)) * r.x + r.y;
  vec2 ab = vec2(-1.04, 1.04) * a004 + r.zw;
  float occlusion = mix(1.0, texture(uOcclusionTexture, vUv).r, uOcclusionStrength);
  color += (diffuse * room(n) + (f0 * ab.x + ab.y) * reflected(reflect(-v, n), roughness)) * occlusion;
  color += uEmissive * texture(uEmissiveTexture, vUv).rgb;
  outColor = vec4(srgb(neutral(color)) * base.a, base.a);
}`;
