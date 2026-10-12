import * as THREE from 'three';

// Shared materials — created once so switching cities never recompiles shaders.

export const swayUniforms = {
  uTime: { value: 0 },
  uWind: { value: 0.1 },
  uWindDir: { value: new THREE.Vector2(1, 0.3).normalize() },
};

// Each tree bends from its own root (quadratic along its height) with independent,
// size-dependent gust timing. Strong wind adds a steady downwind lean. No more city-wide wave.
const SWAY_PARS = `uniform float uTime; uniform float uWind; uniform vec2 uWindDir; attribute vec4 aSway;`;
const SWAY_MAIN = `
  if (aSway.w > 0.0) {
    vec3 base = aSway.xyz; float H = aSway.w;
    float h = max(transformed.y - base.y, 0.0);
    float hn = clamp(h / H, 0.0, 1.25);
    float seed = fract(sin(dot(base.xz, vec2(12.9898, 78.233))) * 43758.5453);
    float t = uTime * 6.2831 * (0.75 / sqrt(H)) * (0.9 + 0.2 * seed);
    float osc = 0.55 * sin(t + seed * 6.28) + 0.3 * sin(t * 2.13 + seed * 19.0) + 0.15 * sin(t * 3.71 + seed * 41.0);
    // slow, broad gust envelope with per-tree jitter (barely spatially coherent)
    float gust = 0.6 + 0.4 * sin(uTime * 0.37 + seed * 6.28) * sin(uTime * 0.21 + seed * 3.1);
    float w = uWind;
    float lean = w * w * gust * 0.42;
    float sway = (0.02 + 0.15 * w) * osc;
    float k = hn * hn;
    float bend = (lean + sway) * k * H;
    vec2 perp = vec2(-uWindDir.y, uWindDir.x);
    float side = (0.01 + 0.045 * w) * sin(t * 1.37 + seed * 13.0) * k * H;
    transformed.xz += uWindDir * bend + perp * side;
    transformed.y -= (bend * bend + side * side) / (2.0 * max(h, 0.25)); // keep trunk length
    float fl = (0.003 + 0.022 * w * w) * sin(uTime * (9.0 + 9.0 * w) + dot(position, vec3(7.1, 5.3, 6.7)));
    transformed += vec3(fl, fl * 0.7, -fl) * smoothstep(0.45, 0.9, hn);
  }`;

function patchSway(m, key) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, swayUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${SWAY_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SWAY_MAIN}`);
  };
  m.customProgramCacheKey = () => key;
  return m;
}

function makeFoliage() {
  return patchSway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }), 'foliage-sway-v2');
}

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const radialTex = radialTexture();

export const M = {
  main: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }),
  glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.16, metalness: 0.5 }),
  lit: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.3, emissive: new THREE.Color('#ffc472'), emissiveIntensity: 0 }),
  lamp: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: new THREE.Color('#ffe2a0'), emissiveIntensity: 0 }),
  neon: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.45, emissive: new THREE.Color('#ffb43a'), emissiveIntensity: 0 }),
  foliage: makeFoliage(),
  foliageDepth: patchSway(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), 'foliage-depth-v2'),
  pool: new THREE.MeshBasicMaterial({ map: radialTex, color: '#ffc77a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
};

/** Additive ground light pools under street lamps. */
export function buildLightPools(points, radius = 1.2) {
  const pos = [], uv = [], idx = [];
  points.forEach((p, i) => {
    const y = p.y + 0.02;
    pos.push(p.x - radius, y, p.z - radius, p.x + radius, y, p.z - radius, p.x + radius, y, p.z + radius, p.x - radius, y, p.z + radius);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    const k = i * 4;
    idx.push(k, k + 2, k + 1, k, k + 3, k + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, M.pool);
  mesh.renderOrder = 2;
  mesh.name = 'lightPools';
  return mesh;
}
