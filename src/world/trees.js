import * as THREE from 'three';
import { P } from '../core/MeshBuilder.js';

const GREENS = ['#7fae3f', '#6a9e3a', '#8dbb45', '#a4c24a', '#5f9440', '#b5c94e', '#79a843'];
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

/** t: {x,y,z,kind,s} */
export function addTree(B, t, rng, greens = GREENS) {
  const { x, z } = t;
  const y = t.y ?? 0;
  const s = t.s ?? 1;
  const H = { palm: 2.5, big: 1.7, bush: 0.45, pine: 1.3 }[t.kind] ?? 1.3;
  B.foliage.sway = [x, y, z, H * s];
  switch (t.kind) {
    case 'palm': palm(B, x, y, z, s, rng); break;
    case 'big': bigTree(B, x, y, z, s, rng, greens); break;
    case 'bush': bush(B, x, y, z, s, rng, greens); break;
    case 'pine': pine(B, x, y, z, s, rng); break;
    case 'flame': roundTree(B, x, y, z, s, rng, ['#e2552d', '#ea6a34', '#d9452a', '#f07d3a']); break;
    case 'yellow': roundTree(B, x, y, z, s, rng, ['#d9c13c', '#e3cc4a', '#c8b236', '#b9c24a']); break;
    default: roundTree(B, x, y, z, s, rng, greens);
  }
  B.foliage.sway = null;
}

function roundTree(B, x, y, z, s, rng, greens) {
  const th = 0.55 * s;
  B.foliage.cyl(x, y, z, 0.065 * s, th + 0.2 * s, '#7a5536', 6);
  const col = rng.pick(greens);
  const n = rng.int(3, 5);
  const cy = y + th + 0.32 * s;
  B.foliage.sphere(x, cy + 0.12 * s, z, 0.42 * s, col, 0.95, 8);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(0, 1);
    const r = 0.26 * s;
    const c2 = rng.chance(0.6) ? col : rng.pick(greens);
    B.foliage.sphere(x + Math.cos(a) * r, cy + rng.range(-0.06, 0.18) * s, z + Math.sin(a) * r, rng.range(0.24, 0.32) * s, c2, 0.9, 7);
  }
}

function bigTree(B, x, y, z, s, rng, greens) {
  const th = 0.75 * s;
  B.foliage.cyl(x, y, z, 0.13 * s, th + 0.25, '#6b4a30', 7, 0.09 * s);
  // aerial roots / branches
  for (let i = 0; i < 3; i++) {
    const a = rng.range(0, Math.PI * 2);
    _a.set(x, y + th * 0.8, z);
    _b.set(x + Math.cos(a) * 0.45 * s, y + th + 0.25 * s, z + Math.sin(a) * 0.45 * s);
    B.foliage.beam(_a, _b, 0.045 * s, '#6b4a30', 5);
  }
  const col = rng.pick(greens);
  const n = rng.int(6, 9);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(0, 0.5);
    const r = rng.range(0.3, 0.62) * s;
    B.foliage.sphere(x + Math.cos(a) * r, y + th + rng.range(0.25, 0.55) * s, z + Math.sin(a) * r, rng.range(0.32, 0.45) * s, rng.chance(0.7) ? col : rng.pick(greens), 0.8, 8);
  }
  B.foliage.sphere(x, y + th + 0.65 * s, z, 0.5 * s, col, 0.8, 8);
}

function bush(B, x, y, z, s, rng, greens) {
  const col = rng.pick(greens);
  for (let i = 0; i < 3; i++) {
    B.foliage.sphere(x + rng.range(-0.15, 0.15) * s, y + 0.14 * s, z + rng.range(-0.15, 0.15) * s, rng.range(0.15, 0.22) * s, col, 0.85, 6);
  }
}

function pine(B, x, y, z, s, rng) {
  B.foliage.cyl(x, y, z, 0.05 * s, 0.35 * s, '#6b4a30', 5);
  const col = rng.pick(['#3f7a3e', '#4a8a45', '#356e3a']);
  for (let i = 0; i < 3; i++) {
    B.foliage.cone(x, y + (0.25 + i * 0.32) * s, z, (0.4 - i * 0.1) * s, 0.55 * s, col, 7);
  }
}

function palm(B, x, y, z, s, rng) {
  const h = rng.range(1.9, 2.6) * s;
  const lean = rng.range(0, 0.35) * s, la = rng.range(0, Math.PI * 2);
  const seg = 5;
  let prev = new THREE.Vector3(x, y, z);
  for (let i = 1; i <= seg; i++) {
    const t = i / seg;
    const cur = new THREE.Vector3(x + Math.cos(la) * lean * t * t, y + h * t, z + Math.sin(la) * lean * t * t);
    B.foliage.beam(prev, cur, (0.07 - 0.02 * t) * s, i % 2 ? '#8a6a48' : '#7c5d3e', 6);
    prev = cur;
  }
  const top = prev;
  const fronds = 8;
  const col = rng.pick(['#5d9a3a', '#6aa83f', '#4f8c36']);
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const ca = Math.cos(a), sa = Math.sin(a);
    const p1 = new THREE.Vector3(top.x + ca * 0.45 * s, top.y + 0.12 * s, top.z + sa * 0.45 * s);
    const p2 = new THREE.Vector3(top.x + ca * 0.85 * s, top.y - 0.25 * s, top.z + sa * 0.85 * s);
    leaf(B, top, p1, 0.16 * s, col, a);
    leaf(B, p1, p2, 0.13 * s, col, a);
  }
  for (let i = 0; i < 3; i++) B.foliage.sphere(top.x + Math.cos(i * 2.1) * 0.08, top.y - 0.06, top.z + Math.sin(i * 2.1) * 0.08, 0.055 * s, '#6b5a2a', 1, 6);
}

const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);
function leaf(B, a, b, width, col) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  dir.normalize();
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  // box with length along dir, wide horizontally, flat
  const side = new THREE.Vector3().crossVectors(dir, _up).normalize();
  const nrm = new THREE.Vector3().crossVectors(side, dir).normalize();
  _m.makeBasis(side, nrm, dir);
  _q.setFromRotationMatrix(_m);
  _m.compose(mid, _q, new THREE.Vector3(width * 2, 0.03, len));
  B.foliage.add(P.box(), col, _m);
}
