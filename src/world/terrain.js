import * as THREE from 'three';
import { TILE, HALF, WATER_LEVEL } from './Field.js';
import { normalizeGeometry } from '../core/MeshBuilder.js';

const BOTTOM = -3.4;
const BANDS = [ // [topY, colour] from top down (relative to 0)
  [0.0, '#7c6a4f'],
  [-0.22, '#e7cfa6'],
  [-1.15, '#d4b083'],
  [-2.15, '#bf9468'],
];

export function buildGround(field, segments = 176) {
  const geo = new THREE.PlaneGeometry(TILE, TILE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const heights = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = field.height(x, z);
    heights[i] = h;
    pos.setY(i, h);
    field.groundColor(x, z, h, c);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.deleteAttribute('uv');
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  mesh.matrixAutoUpdate = false;
  return { mesh, heights, segments };
}

/** Layered earth sides of the diorama slab. */
export function buildSkirt(field, waterColor, segments = 176) {
  const pos = [], col = [], c = new THREE.Color();
  const step = TILE / segments;
  const edges = [
    (t) => [-HALF + t, HALF, 0, 1],   // south (+z)
    (t) => [HALF, HALF - t, 1, 0],    // east (+x)
    (t) => [HALF - t, -HALF, 0, -1],  // north
    (t) => [-HALF, -HALF + t, -1, 0], // west
  ];
  const quad = (p0, p1, y0a, y1a, y0b, y1b, color) => {
    // p0,p1 = [x,z]; bottom y0, top y1 at each end
    if (y1a - y0a < 1e-4 && y1b - y0b < 1e-4) return;
    const v = [[p0[0], y0a, p0[1]], [p1[0], y0b, p1[1]], [p1[0], y1b, p1[1]], [p0[0], y1a, p0[1]]];
    for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...v[k]); col.push(color.r, color.g, color.b); }
  };
  for (const edge of edges) {
    for (let i = 0; i < segments; i++) {
      const [x0, z0] = edge(i * step), [x1, z1] = edge((i + 1) * step);
      const h0 = field.height(x0, z0), h1 = field.height(x1, z1);
      for (let b = 0; b < BANDS.length; b++) {
        const top = BANDS[b][0];
        const bot = b + 1 < BANDS.length ? BANDS[b + 1][0] : BOTTOM;
        c.set(BANDS[b][1]);
        const ya0 = Math.min(bot, h0), ya1 = Math.min(top, h0);
        const yb0 = Math.min(bot, h1), yb1 = Math.min(top, h1);
        quad([x0, z0], [x1, z1], ya0, Math.max(ya0, ya1), yb0, Math.max(yb0, yb1), c);
      }
      // grass/top lip when ground above 0
      // water section
      if (h0 < WATER_LEVEL || h1 < WATER_LEVEL) {
        const segC = new THREE.Color(field.waterColorAt((x0 + x1) / 2, (z0 + z1) / 2, waterColor)).multiplyScalar(0.8);
        quad([x0, z0], [x1, z1], Math.min(h0, WATER_LEVEL), WATER_LEVEL, Math.min(h1, WATER_LEVEL), WATER_LEVEL, segC);
      }
    }
  }
  // bottom
  c.set('#9c7552');
  const b = BOTTOM;
  const v = [[-HALF, b, -HALF], [HALF, b, -HALF], [HALF, b, HALF], [-HALF, b, HALF]];
  for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...v[k]); col.push(c.r, c.g, c.b); }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'skirt';
  return mesh;
}

// ---------------------------------------------------------------- water

export const waveUniforms = {
  uFlood: { value: 0 },
  uMud: { value: new THREE.Color('#8a7a5c') },
  uTime: { value: 0 },
  uWave: { value: 0.04 },
  uLevel: { value: WATER_LEVEL },
};

/** Same function as in the shader, for bobbing boats. */
export function waveHeight(x, z, t, amp) {
  return amp * (0.5 * Math.sin(0.9 * x + 1.3 * t) + 0.35 * Math.sin(1.1 * z - 1.7 * t + 0.3 * x) + 0.15 * Math.sin(2.3 * (x + z) + 2.9 * t));
}

export function buildWater(color, field) {
  const geo = new THREE.PlaneGeometry(TILE, TILE, 110, 110);
  geo.rotateX(-Math.PI / 2);
  geo.deleteAttribute('uv');
  // per-vertex colour = colour of the nearest water body
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.set(field ? field.waterColorAt(pos.getX(i), pos.getZ(i), color) : color);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.9,
  });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, waveUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uWave; uniform float uLevel;
        varying float vWaveH; varying vec2 vWP;
        float wv(vec2 p){ return uWave*(0.5*sin(0.9*p.x+1.3*uTime)+0.35*sin(1.1*p.y-1.7*uTime+0.3*p.x)+0.15*sin(2.3*(p.x+p.y)+2.9*uTime)); }`)
      .replace('#include <beginnormal_vertex>', `
        vec2 wp = position.xz;
        float e = 0.08;
        float hC = wv(wp);
        float dx = (wv(wp + vec2(e,0.0)) - hC) / e;
        float dz = (wv(wp + vec2(0.0,e)) - hC) / e;
        vec3 objectNormal = normalize(vec3(-dx, 1.0, -dz));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position.x, uLevel + hC, position.z); vWaveH = hC / max(uWave, 0.001); vWP = position.xz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vWaveH; varying vec2 vWP; uniform float uFlood; uniform vec3 uMud; uniform float uTime;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, uMud, uFlood);
        // drifting ripple glints + darker troughs (reads as water even when the colour is earthy)
        float r1 = sin(vWP.x * 2.3 + vWP.y * 0.9 + uTime * 1.1) * sin(vWP.y * 3.1 - vWP.x * 0.7 - uTime * 0.8);
        float r2 = sin((vWP.x - vWP.y) * 5.7 + uTime * 2.1);
        float glint = smoothstep(0.55, 0.95, r1) * (0.55 + 0.45 * r2);
        // sky sheen + stronger glints so earthy rivers (sông Hồng) still read as water
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.88, 0.95), 0.14);
        diffuseColor.rgb = mix(diffuseColor.rgb * (0.82 + 0.18 * r1), vec3(1.0), glint * 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), smoothstep(0.7, 1.0, vWaveH) * 0.22);`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'water';
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

export { normalizeGeometry };
