import * as THREE from 'three';
import { P, hipRoof, normalizeGeometry } from '../core/MeshBuilder.js';
import { WATER_LEVEL, BED } from './Field.js';
import { addTree } from './trees.js';
import { officeWindowRow, curvedOfficeWindowRow } from './officeWindows.js';
import { tower } from './buildings.js';
import { RNG } from '../core/rng.js';
import { facadeWindow, facadeRows } from './facades.js';

// Hand-modelled (but still fully procedural) city icons.
// Signature: fn(B, ctx) with ctx = { x, z, ry, rng, field, ...extra }

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function arches(B, w, d, y, h, nFront, nSide, color = '#4a463d') {
  const put = (n, span, fn) => { for (let i = 0; i < n; i++) fn((i + 0.5) / n * span - span / 2); };
  const aw = Math.min(0.24, (w / nFront) * 0.5), as = Math.min(0.24, (d / nSide) * 0.5);
  put(nFront, w, (u) => {
    for (const s of [1, -1]) {
      B.main.quad(u, y + h / 2, s * (d / 2 + 0.006), aw, h, color, s > 0 ? 0 : Math.PI);
      B.main.put(P.disc(10), color, { x: u, y: y + h, z: s * (d / 2 + 0.006), sx: aw, sy: aw, ry: s > 0 ? 0 : Math.PI });
    }
  });
  put(nSide, d, (u) => {
    for (const s of [1, -1]) {
      B.main.quad(s * (w / 2 + 0.006), y + h / 2, u, as, h, color, s * Math.PI / 2);
      B.main.put(P.disc(10), color, { x: s * (w / 2 + 0.006), y: y + h, z: u, sx: as, sy: as, ry: s * Math.PI / 2 });
    }
  });
}

// ===================================================================== HÀ NỘI

export function turtleTower(B, { x, z, ry = 0, rng }) {
  const stone = '#d6ccae', ledge = '#c4b998', moss = '#7d8a5c';
  B.main.push(x, 0, z, ry);
  B.main.cyl(0, -0.05, 0, 0.95, 0.12, '#b9b19a', 16);
  const tiers = [[1.5, 1.12, 0.95, 3, 2], [1.16, 0.88, 0.72, 3, 2], [0.86, 0.64, 0.58, 1, 1]];
  let y = 0.07;
  for (const [w, d, h, nf, ns] of tiers) {
    B.main.box(0, y, 0, w, h, d, stone);
    arches(B, w, d, y + 0.08, h * 0.45, nf, ns);
    B.main.box(0, y + h, 0, w + 0.12, 0.06, d + 0.12, ledge);
    // moss
    B.main.box(w / 2 - 0.05, y, d / 2 - 0.05, 0.12, h * 0.6, 0.12, moss);
    y += h + 0.06;
  }
  B.main.box(0, y, 0, 0.48, 0.34, 0.4, stone);
  arches(B, 0.48, 0.4, y + 0.04, 0.16, 1, 1);
  B.main.put(P.flaredRoof(), '#8f8a72', { y: y + 0.34, sx: 0.78, sy: 0.4, sz: 0.7 });
  B.main.cyl(0, y + 0.7, 0, 0.03, 0.22, '#8f8a72', 6);
  B.main.pop();
}

export function ngocSonTemple(B, { x, z, ry = 0, rng }) {
  B.main.push(x, 0, z, ry);
  const wall = '#b9553a', col = '#8e2f22', roof = '#c66a3c';
  const hall = (hx, hz, w, d, h) => {
    B.main.box(hx, 0, hz, w + 0.2, 0.1, d + 0.2, '#cfc7b6');
    B.main.box(hx, 0.1, hz, w, h, d, wall);
    // Wooden shutter panels, rather than office glazing, on the temple elevations.
    for (const face of [-1, 1]) for (const u of [-0.3, 0.3]) B.main.quad(hx + u, 0.1 + h * 0.48, hz + face * (d / 2 + 0.008), 0.18, h * 0.65, col, face > 0 ? 0 : Math.PI);
    for (const face of [-1, 1]) B.main.quad(hx + face * (w / 2 + 0.008), 0.1 + h * 0.48, hz, 0.22, h * 0.65, col, face * Math.PI / 2);
    for (let i = 0; i < 4; i++) B.main.cyl(hx - w / 2 + 0.1 + (i * (w - 0.2)) / 3, 0.1, hz + d / 2 + 0.1, 0.035, h, col, 6);
    B.main.put(P.flaredRoof(), roof, { x: hx, y: 0.1 + h, z: hz, sx: w + 0.6, sy: 0.55, sz: d + 0.5 });
    B.main.put(P.box(), '#e0b04a', { x: hx, y: 0.1 + h + 0.2, z: hz, sx: w * 0.9, sy: 0.05, sz: 0.05 });
  };
  hall(-0.2, 0.25, 1.4, 0.75, 0.55);
  hall(-0.2, -0.75, 1.3, 0.7, 0.6);
  // Đắc Nguyệt gate
  B.main.box(0.95, 0, 0.6, 0.55, 0.9, 0.5, '#d9c8a6');
  B.main.put(P.flaredRoof(), roof, { x: 0.95, y: 0.9, z: 0.6, sx: 0.8, sy: 0.35, sz: 0.75 });
  B.main.pop();
  addTree(B, { x: x + 0.9, z: z - 0.9, kind: 'big', s: 0.95 }, rng);
  addTree(B, { x: x - 1.1, z: z + 0.9, kind: 'round', s: 0.7 }, rng);
  addTree(B, { x: x - 1.2, z: z - 0.4, kind: 'yellow', s: 0.65 }, rng);
}

export function hucBridge(B, { from, to, rng }) {
  const red = '#d1352b';
  const a = V(from[0], 0, from[1]), b = V(to[0], 0, to[1]);
  const n = 16;
  const pts = [];
  const side = V(-(b.z - a.z), 0, b.x - a.x).normalize();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t).addScaledVector(side, Math.sin(Math.PI * t) * 0.5);
    p.y = WATER_LEVEL + 0.45 + Math.sin(Math.PI * t) * 0.55;
    pts.push(p);
  }
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[i + 1];
    B.main.slab(p, q, 0.62, 0.07, red);
    const dir = V(q.x - p.x, 0, q.z - p.z).normalize();
    const s = V(-dir.z, 0, dir.x);
    for (const k of [-0.29, 0.29]) {
      const pp = p.clone().addScaledVector(s, k), qq = q.clone().addScaledVector(s, k);
      B.main.beam(pp.clone().setY(pp.y + 0.3), qq.clone().setY(qq.y + 0.3), 0.025, red, 4);
      B.main.beam(pp, pp.clone().setY(pp.y + 0.3), 0.025, red, 4);
      if (i % 3 === 1) B.main.beam(V(pp.x, BED, pp.z), pp, 0.04, '#8a2a22', 5);
    }
  }
  B.main.beam(pts[n].clone(), pts[n].clone().setY(pts[n].y + 0.3), 0.025, red, 4);
}

export function penTower(B, { x, z, rng }) {
  B.main.push(x, 0, z, 0);
  for (let i = 0; i < 4; i++) B.main.put(P.ico(0), '#9a958a', { x: Math.cos(i * 1.7) * 0.35, y: 0.1, z: Math.sin(i * 1.7) * 0.35, sx: 0.5, sy: 0.35, sz: 0.5 });
  B.main.box(0, 0, 0, 0.62, 0.3, 0.62, '#bdb4a2');
  B.main.box(0, 0.3, 0, 0.46, 0.18, 0.46, '#c9c0ad');
  const g = normalizeGeometry(new THREE.CylinderGeometry(0.1, 0.17, 2.4, 4, 1).toNonIndexed());
  g.computeVertexNormals();
  B.main.put(g, '#cfc6b2', { y: 1.68, ry: Math.PI / 4 }, true);
  B.main.put(P.cone(4), '#8f8774', { y: 3.05, sx: 0.2, sy: 0.32, sz: 0.2, ry: Math.PI / 4 });
  B.main.pop();
}

export function lakePavilion(B, { x, z, ry = 0 }) {
  B.main.push(x, 0, z, ry);
  for (const [sx, sz] of [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5], [0, 0.5], [0, -0.5]]) B.main.cyl(sx, BED, sz, 0.06, 0.15 - BED, '#7c6a58', 6);
  B.main.box(0, 0.15, 0, 2.0, 0.1, 1.3, '#a0522d');
  for (const [sx, sz] of [[-0.85, -0.55], [0.85, -0.55], [-0.85, 0.55], [0.85, 0.55]]) B.main.cyl(sx, 0.25, sz, 0.05, 0.7, '#8e2f22', 6);
  B.main.box(0, 0.25, -0.2, 1.6, 0.6, 0.6, '#e9d6b0');
  B.main.put(P.flaredRoof(), '#d4733f', { y: 0.95, sx: 2.6, sy: 0.6, sz: 1.9 });
  B.main.pop();
}

// ===================================================================== ĐÀ NẴNG

export function dragonBridge(B, { x0, x1, z, deckY }) {
  const gold = '#f0b323', red = '#d9452f';
  const pts = [];
  const humps = 5;
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const x = x0 + (x1 - x0) * t;
    let y = deckY + 0.25 + 1.5 * Math.pow(Math.abs(Math.sin(Math.PI * humps * t * 0.92)), 0.75);
    if (t > 0.92) y = deckY + 0.25 + (t - 0.92) / 0.08 * 2.0;
    pts.push(V(x, y, z));
  }
  // tail curl
  const tail = [];
  for (let i = 0; i < 10; i++) {
    const a = i * 0.6;
    tail.push(V(x0 - 0.1 - Math.sin(a) * (0.5 - i * 0.04), deckY + 0.6 + Math.cos(a) * (0.5 - i * 0.04), z));
  }
  const curve = new THREE.CatmullRomCurve3([...tail.reverse(), ...pts]);
  const tube = new THREE.TubeGeometry(curve, 260, 0.2, 8, false);
  B.neon.put(normalizeGeometry(tube), gold, {}, true);
  // spines
  for (let i = 2; i < 115; i += 3) {
    const p = pts[i];
    B.neon.cone(p.x, p.y + 0.12, p.z, 0.06, 0.22, red, 5);
  }
  // supports at troughs
  for (let k = 0; k < humps; k++) {
    const t = k / (humps * 0.92);
    const x = x0 + (x1 - x0) * t;
    B.main.box(x, deckY - 0.02, z, 0.3, 0.3, 0.5, '#c2bcae');
  }
  // head
  const h = pts[pts.length - 1];
  B.neon.push(h.x, h.y, h.z, Math.PI / 2);
  B.neon.box(0, -0.18, 0.1, 0.45, 0.38, 0.55, gold);
  B.neon.box(0, -0.2, 0.5, 0.32, 0.18, 0.45, gold);
  B.neon.box(0, -0.38, 0.45, 0.28, 0.08, 0.45, red);
  for (const s of [-1, 1]) {
    B.neon.beam(V(s * 0.12, 0.18, 0), V(s * 0.3, 0.6, -0.35), 0.035, gold, 4);
    B.neon.sphere(s * 0.14, 0.02, 0.38, 0.05, '#222');
  }
  for (let i = 0; i < 6; i++) B.neon.cone(0, -0.1 - i * 0.05, -0.25 - i * 0.06, 0.08, 0.3, red, 4);
  B.neon.pop();
}

export function hanRiverBridge(B, { x, z, deckY }) {
  const white = '#eef0f2';
  B.main.box(x, BED, z, 1.0, deckY - BED - 0.2, 1.0, '#cfc9bf');
  for (const s of [-1, 1]) {
    B.main.beam(V(x, deckY, z + s * 0.4), V(x, deckY + 3.2, z + s * 0.12), 0.09, white, 6);
  }
  B.main.box(x, deckY + 3.1, z, 0.2, 0.25, 0.4, white);
  for (let k = 1; k <= 6; k++) {
    for (const dir of [-1, 1]) {
      for (const s of [-1, 1]) {
        B.main.beam(V(x, deckY + 3.1 - k * 0.12, z + s * 0.15), V(x + dir * (0.6 + k * 0.6), deckY + 0.05, z + s * 0.95), 0.012, '#f6f6f6', 3);
      }
    }
  }
}

export function goldenBridge(B, { x, z, y, rng, field }) {
  y = y ?? field.height(x, z);
  const gold = '#dca83c', stone = '#8d9180', stone2 = '#7a7f6e';
  const R = 2.5, a0 = -0.6, a1 = Math.PI + 0.9;
  const deck = y + 1.25;
  const n = 30;
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    const p = V(x + Math.cos(a) * R, deck, z + Math.sin(a) * R);
    if (prev) {
      B.neon.slab(prev, p, 0.5, 0.08, gold);
      for (const k of [-0.24, 0.24]) {
        const sd = V(Math.cos(a), 0, Math.sin(a)).multiplyScalar(k);
        B.neon.beam(prev.clone().add(sd).setY(deck + 0.28), p.clone().add(sd).setY(deck + 0.28), 0.02, '#e9c25a', 4);
        if (i % 2 === 0) B.neon.beam(p.clone().add(sd), p.clone().add(sd).setY(deck + 0.28), 0.015, '#e9c25a', 3);
      }
    }
    prev = p;
  }
  // two giant hands
  for (const a of [0.55, 2.35]) {
    const hx = x + Math.cos(a) * (R + 0.15), hz = z + Math.sin(a) * (R + 0.15);
    const gy = field.height(hx, hz);
    const out = V(Math.cos(a), 0, Math.sin(a));
    const tan = V(-Math.sin(a), 0, Math.cos(a));
    B.main.beam(V(hx, gy - 0.3, hz).addScaledVector(out, 0.4), V(hx, deck - 0.35, hz), 0.32, stone, 8);
    B.main.sphere(hx, deck - 0.25, hz, 0.42, stone2, 0.6, 8);
    for (let f = 0; f < 4; f++) {
      const along = (f - 1.5) * 0.17;
      const base = V(hx, deck - 0.2, hz).addScaledVector(tan, along).addScaledVector(out, 0.1);
      const mid = base.clone().addScaledVector(out, -0.55).setY(deck - 0.15);
      const tip = mid.clone().addScaledVector(out, -0.3).setY(deck + 0.15);
      B.main.beam(base, mid, 0.075, f % 2 ? stone : stone2, 6);
      B.main.beam(mid, tip, 0.065, stone, 6);
    }
    for (let f = 0; f < 4; f++) {
      const along = (f - 1.5) * 0.17;
      const base = V(hx, deck - 0.2, hz).addScaledVector(tan, along).addScaledVector(out, -0.1);
      const mid = base.clone().addScaledVector(out, -0.4).setY(deck - 0.25);
      B.main.beam(base, mid, 0.07, stone2, 6);
    }
  }
}

export function ladyBuddha(B, { x, z, y, field }) {
  y = y ?? field.height(x, z);
  const white = '#f5f2ea';
  B.main.push(x, y - 0.1, z, -Math.PI / 4);
  B.main.cyl(0, 0, 0, 0.75, 0.3, '#d9d4c8', 12);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    B.main.put(P.sphere(6, 4), white, { x: Math.cos(a) * 0.48, y: 0.38, z: Math.sin(a) * 0.48, sx: 0.28, sy: 0.22, sz: 0.4, ry: -a });
  }
  const prof = [[0.45, 0], [0.42, 0.4], [0.36, 1.2], [0.33, 1.8], [0.3, 2.05], [0.12, 2.2], [0.09, 2.3], [0.0001, 2.3]].map(([r, h]) => new THREE.Vector2(r, h));
  const lathe = normalizeGeometry(new THREE.LatheGeometry(prof, 14));
  B.main.put(lathe, white, { y: 0.4 }, true);
  B.main.sphere(0, 2.9, 0, 0.2, white, 1.1, 10);
  B.main.sphere(0, 3.12, -0.03, 0.09, white, 1, 8);
  B.main.beam(V(0.2, 2.3, 0), V(0.22, 1.85, 0.25), 0.06, white, 6);
  B.main.sphere(0.2, 1.8, 0.27, 0.08, white);
  B.main.pop();
}

export function danangCathedral(B, { x, z, ry = 0 }) {
  const pink = '#ef9fb5', trim = '#fbe9ee', roof = '#d67b93';
  B.main.push(x, 0, z, ry);
  B.glass.push(x, 0, z, ry);
  B.lit.push(x, 0, z, ry);
  B.main.box(0, 0, -0.6, 1.6, 1.3, 3.2, pink);
  B.main.put(P.prism(), roof, { y: 1.3 + 0.32, z: -0.6, sx: 1.75, sy: 0.64, sz: 3.3 });
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    B.main.quad(s * 0.81, 0.7, -1.8 + i * 0.75, 0.22, 0.6, trim, s * Math.PI / 2);
    B.glass.quad(s * 0.815, 0.68, -1.8 + i * 0.75, 0.14, 0.5, '#7d6b8f', s * Math.PI / 2);
  }
  B.main.box(0, 0, 1.15, 0.8, 2.4, 0.8, pink);
  B.main.box(0, 2.4, 1.15, 0.86, 0.08, 0.86, trim);
  B.main.box(0, 2.48, 1.15, 0.6, 0.6, 0.6, pink);
  B.main.put(P.pyramid(), roof, { y: 3.08 + 0.75, z: 1.15, sx: 0.62, sy: 1.5, sz: 0.62 });
  B.main.cyl(0, 4.58, 1.15, 0.02, 0.3, '#d9b440', 4);
  B.main.quad(0, 0.4, 1.56, 0.36, 0.8, '#5a3d48');
  B.main.put(P.disc(16), trim, { y: 1.5, z: 1.56, sx: 0.4, sy: 0.4 });
  facadeRows(B, { w: 1.6, d: 3.2, z: -0.6, levels: [0.65], faces: ['back'], ww: 0.22, wh: 0.52, trim, glass: '#7d6b8f', arched: true });
  facadeRows(B, { w: 0.6, d: 0.6, z: 1.15, levels: [2.72], ww: 0.18, wh: 0.24, trim, glass: '#5a3d48', arched: true });
  B.lit.pop();
  B.glass.pop();
  B.main.pop();
}

export function beachUmbrella(B, { x, z, y, rng }) {
  const c = rng.pick(['#e94e3c', '#f2b134', '#2f8fd8', '#ffffff', '#3cb371', '#ff7eb6']);
  B.main.cyl(x, y, z, 0.02, 0.62, '#e8e2d2', 4);
  B.main.cone(x, y + 0.5, z, 0.42, 0.2, c, 8);
  if (rng.chance(0.7)) B.main.box(x + 0.35, y, z + 0.1, 0.22, 0.06, 0.55, '#f6f2ea');
}

// ===================================================================== TP. HỒ CHÍ MINH

export function landmark81(B, { x, z, rng }) {
  const glass = '#76919f', fin = '#ced9de', mullion = '#596e7a';
  B.main.box(x, 0, z, 5.4, 1.1, 5.4, '#d6d1c7');
  B.glass.box(x, 0.1, z, 5.42, 0.5, 5.42, '#5a6e7c');
  // A single bundled tower: low outer shafts, intermediate shoulders and a
  // slender, much taller square core, rather than nine almost equal towers.
  const c = 1.1;
  const H = [[10.2, 18.2, 12.4], [15.2, 26.5, 20.8], [9.0, 16.6, 11.2]];
  const windows = rng.fork('landmark81-office-windows');
  // Retain the old parent draw sequence; facade edits must not rearrange the city.
  for (const row of [[17, 21, 18.5], [22, 26.5, 23], [19, 22.5, 16]]) {
    for (const h of row) for (let f = 2; f < h - 0.5; f += 0.62) rng.chance(0.22);
  }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const cx = x + (i - 1) * c, cz = z + (j - 1) * c, h = H[j][i];
    B.glass.box(cx, 1.1, cz, c - 0.04, h - 1.1, c - 0.04, glass);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) B.main.box(cx + sx * (c / 2 - 0.025), 1.1, cz + sz * (c / 2 - 0.025), 0.045, h - 1.1, 0.045, fin);
    B.main.box(cx, h, cz, c - 0.01, 0.1, c - 0.01, fin);
    // Fine, non-emissive curtain-wall floor lines and continuous vertical ribs.
    for (let f = 1.52; f < h - 0.1; f += 0.42) B.main.box(cx, f, cz, c - 0.015, 0.025, c - 0.015, mullion);
    for (const s of [-1, 1]) for (const u of [-0.17, 0.17]) {
      B.main.box(cx + u, 1.1, cz + s * (c / 2 - 0.012), 0.018, h - 1.1, 0.025, fin);
      B.main.box(cx + s * (c / 2 - 0.012), 1.1, cz + u, 0.025, h - 1.1, 0.018, fin);
    }
    B.lit.push(cx, 0, cz);
    B.glass.push(cx, 0, cz);
    const neighbours = { front: H[j + 1]?.[i] ?? 0, back: H[j - 1]?.[i] ?? 0,
      right: H[j]?.[i + 1] ?? 0, left: H[j]?.[i - 1] ?? 0 };
    for (let f = 1.7; f < h - 0.2; f += 0.42) {
      const probability = windows.chance(0.22) ? 0.5 : 0.22;
      for (const face of ['front', 'back', 'right', 'left']) {
        if (f - 0.14 <= neighbours[face] + 0.1) continue; // skip buried/roof-intersecting panes
        officeWindowRow(B, windows, { face, w: c - 0.04, d: c - 0.04, y: f, height: 0.28, probability });
      }
    }
    B.glass.pop();
    B.lit.pop();
  }
  // Rectilinear stepped crown and long square mast, as in the reference photo.
  B.glass.box(x, 26.6, z, 0.86, 0.25, 0.86, glass);
  B.main.box(x, 26.85, z, 0.9, 0.06, 0.9, fin);
  B.glass.box(x - 0.06, 26.91, z, 0.68, 0.3, 0.68, glass);
  B.main.box(x - 0.06, 27.21, z, 0.72, 0.06, 0.72, fin);
  B.main.box(x - 0.14, 27.27, z, 0.22, 2.35, 0.22, mullion);
  for (const s of [-1, 1]) B.main.box(x - 0.14 + s * 0.105, 27.27, z, 0.025, 2.35, 0.24, fin);
  for (let y = 27.5; y < 29.6; y += 0.24) B.main.box(x - 0.14, y, z, 0.24, 0.025, 0.24, fin);
  B.main.cyl(x - 0.14, 29.62, z, 0.02, 0.25, fin, 4);
  B.lamp.sphere(x - 0.14, 29.88, z, 0.045, '#ff6b5a');
}

// A pinned procedural office tower, used when a specific skyline building moves.
export function officeTower(B, { x, z, ry = 0, w, d, floors, seed, palette }) {
  for (const b of Object.values(B)) b.push(x, 0, z, ry);
  tower(B, { w, d, floors }, new RNG(seed), palette);
  for (const b of Object.values(B)) b.pop();
}

export function bitexco(B, { x, z, rng }) {
  const glass = '#8fb0bd';
  const prof = [[1.35, 0], [1.55, 3], [1.62, 6], [1.5, 10], [1.18, 13.5], [0.78, 16], [0.36, 17.6], [0.0001, 18.3]];
  const pts = prof.map(([r, h]) => new THREE.Vector2(r, h));
  const lathe = normalizeGeometry(new THREE.LatheGeometry(pts, 24));
  B.main.box(x, 0, z, 4, 0.9, 3.6, '#d3cec5');
  B.glass.put(lathe, glass, { x, y: 0, z, sz: 0.78 }, true);
  const rAt = (h) => { for (let i = 1; i < prof.length; i++) if (h <= prof[i][1]) { const t = (h - prof[i - 1][1]) / (prof[i][1] - prof[i - 1][1]); return prof[i - 1][0] + (prof[i][0] - prof[i - 1][0]) * t; } return 0; };
  const windows = rng.fork('bitexco-office-windows');
  for (let h = 1.2; h < 17; h += 0.62) {
    const r = rAt(h) + 0.02;
    const band = Math.round(h / 0.62) % 3 === 0;
    if (band) B.main.put(P.cyl(24), '#e8eef1', { x, y: h, z, sx: r * 2, sy: 0.05, sz: r * 2 * 0.78 });
    const probability = band ? 0.3 : rng.chance(0.25) ? 0.5 : 0.2;
    curvedOfficeWindowRow(B, windows, { x, z, y: h + 0.25, radiusAt: rAt,
      profileHeights: prof.map(p => p[1]), zScale: 0.78, segments: 24, probability });
  }
  // Exaggerated cantilevered helipad: recognizable even at full-city/mobile scale.
  const hy = 12.4, hx = x + 1.75, padR = 1.7, top = hy + 0.19;
  B.main.cyl(hx, hy, z, padR, 0.18, '#626e75', 32);
  B.main.cyl(hx, hy - 0.45, z, 0.65, 0.45, '#a6aeb3', 20, 1.4);
  B.main.put(normalizeGeometry(new THREE.TorusGeometry(padR * 0.82, 0.025, 4, 32)), '#edf1e8',
    { x: hx, y: top + 0.008, z, rx: -Math.PI / 2 }, true);
  B.main.flat(hx, top, z, 0.9, 0.14, '#ffffff');
  B.main.flat(hx - 0.38, top, z, 0.14, 1.02, '#ffffff');
  B.main.flat(hx + 0.38, top, z, 0.14, 1.02, '#ffffff');
}

export function notreDame(B, { x, z, ry = 0, rng }) {
  const brick = '#b9573d', trim = '#ead9c4', roof = '#c86a43', spire = '#7c8a93';
  B.main.push(x, 0, z, ry);
  B.glass.push(x, 0, z, ry);
  B.lit.push(x, 0, z, ry);
  B.main.box(0, 0, -0.5, 1.5, 1.6, 4.0, brick);
  B.main.put(P.prism(), roof, { y: 1.6 + 0.33, z: -0.5, sx: 1.65, sy: 0.66, sz: 4.1 });
  for (const s of [-1, 1]) {
    B.main.box(s * 1.0, 0, -0.5, 0.5, 1.0, 3.8, brick);
    for (let i = 0; i < 5; i++) B.main.quad(s * 1.252, 0.55, -2.1 + i * 0.75, 0.16, 0.45, trim, s * Math.PI / 2);
  }
  B.main.box(0, 0, -1.4, 2.8, 1.6, 0.9, brick);
  B.main.put(P.prism(), roof, { y: 1.93, z: -1.4, sx: 1.0, sy: 0.66, sz: 2.9, ry: Math.PI / 2 });
  B.main.cyl(0, 0, -2.5, 0.75, 1.6, brick, 12);
  B.main.cone(0, 1.6, -2.5, 0.8, 0.6, roof, 12);
  for (const s of [-1, 1]) {
    const tx = s * 0.58;
    B.main.box(tx, 0, 1.55, 0.66, 3.2, 0.66, brick);
    for (let k = 1; k <= 3; k++) B.main.box(tx, k * 0.95, 1.55, 0.7, 0.06, 0.7, trim);
    B.main.quad(tx, 2.75, 1.885, 0.22, 0.45, '#4a3a33');
    B.main.quad(tx + 0.335 * s, 2.75, 1.55, 0.22, 0.45, '#4a3a33', s * Math.PI / 2);
    B.main.put(P.pyramid(), spire, { x: tx, y: 3.2 + 1.0, z: 1.55, sx: 0.66, sy: 2.0, sz: 0.66 });
    B.main.box(tx, 5.2, 1.55, 0.03, 0.3, 0.03, '#ddd');
    B.main.box(tx, 5.35, 1.55, 0.16, 0.03, 0.03, '#ddd');
  }
  B.main.box(0, 0, 1.55, 0.5, 2.2, 0.55, brick);
  B.main.put(P.disc(16), trim, { y: 1.65, z: 1.83, sx: 0.36, sy: 0.36 });
  B.glass.put(P.disc(16), '#5d6f9a', { y: 1.65, z: 1.835, sx: 0.26, sy: 0.26 });
  for (const s of [-1, 0, 1]) B.main.quad(s * 0.55, 0.38, 1.886, 0.26, 0.6, '#4a3a33');
  for (const s of [-1, 1]) {
    for (const wz of [-2.05, -0.65, 0.15, 0.9]) facadeWindow(B, { x: s * 1.255, z: wz, ry: s * Math.PI / 2, y: 0.53, w: 0.18, h: 0.40, trim, glass: '#596b7f', arched: true });
    facadeWindow(B, { x: s * 1.405, z: -1.4, ry: s * Math.PI / 2, y: 0.9, w: 0.30, h: 0.6, trim, glass: '#596b7f', arched: true });
    facadeWindow(B, { x: s * 0.58, z: 1.215, ry: Math.PI, y: 2.75, w: 0.22, h: 0.4, trim, glass: '#4a3a33', arched: true });
  }
  // Tangent-mounted apse windows stay on the curved rear wall.
  for (const a of [Math.PI * 0.65, Math.PI, Math.PI * 1.35]) facadeWindow(B, {
    x: Math.sin(a) * 0.758, z: -2.5 + Math.cos(a) * 0.758, ry: a,
    y: 0.85, w: 0.18, h: 0.62, trim, glass: '#596b7f', arched: true });
  B.lit.pop();
  B.glass.pop();
  // statue garden
  B.main.cyl(0, 0, 3.1, 0.75, 0.08, '#7fb04a', 16);
  B.main.box(0, 0.08, 3.1, 0.25, 0.35, 0.25, '#e9e4da');
  B.main.cyl(0, 0.43, 3.1, 0.07, 0.38, '#f6f3ec', 8, 0.04);
  B.main.pop();
}

export function postOffice(B, { x, z, ry = 0 }) {
  const yellow = '#f0cd72', trim = '#fbf4e2', green = '#4c7a5d', roof = '#c65d3b';
  B.main.push(x, 0, z, ry);
  B.glass.push(x, 0, z, ry);
  B.lit.push(x, 0, z, ry);
  B.main.box(0, 0, 0, 5.8, 1.5, 2.1, yellow);
  B.main.box(0, 1.5, 0, 5.9, 0.08, 2.2, trim);
  B.main.put(hipRoof(5.9, 2.2, 0.45), roof, { y: 1.58 }, true);
  B.main.box(0, 0, 0.15, 1.6, 2.1, 2.1, yellow);
  B.main.box(0, 2.1, 0.15, 1.7, 0.1, 2.2, trim);
  B.main.put(hipRoof(1.7, 2.2, 0.55), roof, { y: 2.2, z: 0.15 }, true);
  B.main.put(P.disc(16), '#ffffff', { y: 1.65, z: 1.215, sx: 0.4, sy: 0.4 });
  B.main.box(0, 1.58, 1.22, 0.02, 0.15, 0.01, '#222');
  B.main.quad(0, 0.55, 1.205, 0.6, 1.0, '#5a4a3d');
  for (let f = 0; f < 2; f++) for (let i = -6; i <= 6; i++) {
    if (Math.abs(i) <= 1) continue;
    facadeWindow(B, { x: i * 0.4, z: 1.05, y: 0.35 + f * 0.65, w: 0.20, h: 0.42, trim, glass: green, arched: true });
  }
  facadeRows(B, { w: 5.8, d: 2.1, levels: [0.35, 1.0], faces: ['back', 'left', 'right'], ww: 0.25, wh: 0.34, trim, glass: green, arched: true });
  B.lit.pop();
  B.glass.pop();
  B.main.pop();
}

export function cityHall(B, { x, z, ry = 0 }) {
  const yellow = '#efda9c', trim = '#fff4dc', roof = '#b95734', green = '#354e41';
  for (const b of [B.main, B.glass, B.lit, B.lamp]) b.push(x, 0, z, ry);
  // Smaller architectural modules, with longer wings filling the same frontage.
  // Keep this separate from the landmark frame so the statue is NOT scaled/moved.
  const moduleScale = 0.68;
  for (const b of [B.main, B.glass, B.lit, B.lamp]) b.push(0, 0, 0, 0, moduleScale);

  // A single long two-storey façade, not a collection of detached little towers.
  const w = 11.5 / moduleScale, d = 2.35, front = d / 2;
  B.main.box(0, 0, 0, w + 0.12, 0.14, d + 0.12, '#ad9480');
  B.main.box(0, 0.14, 0, w, 2.38, d, yellow);
  for (const y of [0.18, 1.35, 2.48]) B.main.box(0, y, 0, w + 0.12, 0.09, d + 0.12, trim);
  B.main.put(hipRoof(w, d, 0.25), roof, { y: 2.57 }, true);
  // Orbit views see the long rear wing and both end walls, too.
  facadeRows(B, { w, d, levels: [0.65, 1.93], faces: ['back', 'left', 'right'], spacing: 0.70,
    ww: 0.36, wh: 0.53, trim, glass: green, arched: true });

  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0); shape.lineTo(0.5, 0); shape.lineTo(0.5, 0.5);
  shape.absarc(0, 0.5, 0.5, 0, Math.PI, false); shape.closePath();
  const arch = normalizeGeometry(new THREE.ShapeGeometry(shape, 12));
  const opening = (u, bottom, face, aw, ah, glowing = true) => {
    B.main.put(arch, trim, { x: u, y: bottom - 0.035, z: face, sx: aw + 0.10, sy: ah + 0.07 });
    const builder = glowing ? B.lit : B.main;
    builder.put(arch, green, { x: u, y: bottom, z: face + 0.008, sx: aw, sy: ah });
    B.main.box(u, bottom, face + 0.02, 0.025, ah * 0.87, 0.018, '#657461');
    B.main.box(u, bottom + ah * 0.48, face + 0.02, aw * 0.95, 0.025, 0.018, '#657461');
    B.main.box(u, bottom - 0.065, face, aw + 0.16, 0.055, 0.13, trim);
  };
  const pilaster = (u, face, bottom = 0.2, h = 2.27) => {
    B.main.box(u, bottom, face, 0.10, h, 0.12, trim);
    for (const y of [bottom, bottom + h - 0.12]) B.main.box(u, y, face + 0.015, 0.19, 0.12, 0.15, trim);
  };
  const railing = (cx, y, face, span) => {
    B.main.box(cx, y, face, span, 0.045, 0.12, trim);
    B.main.box(cx, y + 0.24, face, span, 0.055, 0.13, trim);
    const n = Math.round(span / 0.16);
    for (let i = 0; i <= n; i++) B.main.cyl(cx - span / 2 + span * i / n, y + 0.04, face, 0.022, 0.20, trim, 6);
  };
  const pediment = (cx, y, face, span, h) => {
    B.main.put(P.prism(), trim, { x: cx, y: y + h / 2, z: face, sx: span, sy: h, sz: 0.16 });
    B.main.put(P.prism(), yellow, { x: cx, y: y + h * 0.43, z: face + 0.09, sx: span * 0.79, sy: h * 0.66, sz: 0.035 });
    B.main.box(cx, y - 0.04, face, span + 0.15, 0.09, 0.24, trim);
  };

  // Outer wings: green arched shutters, white pilasters and flat balustraded crowns.
  const wingStart = 3.58, wingEnd = w / 2 - 0.05, bays = 7;
  const bayWidth = (wingEnd - wingStart) / bays;
  for (const s of [-1, 1]) {
    for (let i = 0; i < bays; i++) {
      const u = wingStart + (i + 0.5) * bayWidth;
      opening(s * u, 0.30, front + 0.015, 0.44, 0.87);
      opening(s * u, 1.55, front + 0.015, 0.44, 0.77);
    }
    for (let i = 0; i <= bays; i++) pilaster(s * (wingStart + i * bayWidth), front + 0.055);
    railing(s * (wingStart + wingEnd) / 2, 2.58, front + 0.015, wingEnd - wingStart);
  }

  // Five-bay central loggia and its raised sculptural pediment.
  B.main.box(0, 0.14, 0.14, 3.45, 2.55, 2.52, yellow);
  const cf = 1.41;
  for (let i = -2; i <= 2; i++) {
    opening(i * 0.67, 0.26, cf, 0.45, 0.95);
    opening(i * 0.67, 1.52, cf, 0.48, 0.91, false);
    // Small recessed warm panes behind the dark upper arcade.
    B.lit.quad(i * 0.67, 1.76, cf + 0.02, 0.20, 0.40, green);
  }
  for (let i = 0; i <= 5; i++) {
    const u = -1.675 + i * 0.67;
    pilaster(u, cf + 0.075, 1.45, 1.05);
    B.main.sphere(u, 1.29, cf + 0.06, 0.075, trim, 0.7);
  }
  B.main.box(0, 1.40, cf, 3.6, 0.075, 0.25, trim);
  railing(0, 1.46, cf + 0.12, 3.37);
  B.main.box(0, 2.65, 0.14, 3.6, 0.12, 2.66, trim);
  pediment(0, 2.96, cf, 2.65, 0.56);
  for (const s of [-1, 1]) {
    B.main.put(P.ico(1), trim, { x: s * 0.34, y: 3.36, z: cf + 0.15, sx: 0.28, sy: 0.48, sz: 0.15 });
    B.main.sphere(s * 0.34, 3.64, cf + 0.15, 0.09, trim);
    railing(s * 1.12, 2.81, 0.34, 1.05);
  }
  B.main.put(P.disc(12), trim, { y: 3.29, z: cf + 0.19, sx: 0.33, sy: 0.42 });

  // The reference's twin red trapezoidal roofs belong on the INNER pavilions.
  for (const s of [-1, 1]) {
    const px = s * 2.65, pf = 1.34;
    B.main.box(px, 0.14, 0.06, 1.88, 3.0, 2.53, yellow);
    for (const y of [0.2, 1.36, 2.65, 3.08]) B.main.box(px, y, 0.06, 2.02, 0.085, 2.65, trim);
    opening(px, 0.30, pf, 0.62, 0.91);
    opening(px, 1.53, pf, 0.93, 1.01, false);
    B.lit.quad(px, 1.76, pf + 0.02, 0.28, 0.40, green);
    for (const off of [-0.70, 0.70]) pilaster(px + off, pf + 0.07, 1.44, 1.14);
    railing(px, 1.47, pf + 0.16, 1.28);
    pediment(px, 2.61, pf + 0.06, 1.48, 0.40);
    B.main.put(P.ico(1), trim, { x: px, y: 2.99, z: pf + 0.19, sx: 0.29, sy: 0.40, sz: 0.17 });
    for (let i = -3; i <= 3; i++) {
      B.main.box(px + i * 0.24, 2.94, pf, 0.07, 0.13, 0.12, trim);
    }
    const rw = 2.05, rd = 2.72, rh = 0.87, base = 3.18, topScale = 0.55;
    const g = normalizeGeometry(new THREE.CylinderGeometry(Math.SQRT1_2 * topScale, Math.SQRT1_2, 1, 4));
    g.rotateY(Math.PI / 4);
    B.main.put(g, roof, { x: px, y: base + rh / 2, z: 0.06, sx: rw, sy: rh, sz: rd }, true);
    // Pale roof edges and restrained horizontal tile courses.
    for (const k of [-1, 1]) {
      B.main.beam(V(px + k * rw / 2, base, 0.06 + rd / 2), V(px + k * rw * topScale / 2, base + rh, 0.06 + rd * topScale / 2), 0.026, trim, 5);
    }
    for (let i = 1; i < 8; i++) {
      const t = i / 8, scale = 1 - (1 - topScale) * t;
      B.main.box(px, base + rh * t, 0.06 + rd * scale / 2 + 0.007, rw * scale, 0.014, 0.014, '#d07c50');
    }
    B.main.box(px, base + rh, 0.06, rw * topScale + 0.08, 0.055, rd * topScale + 0.08, trim);
    railing(px, base + rh + 0.03, 0.06 + rd * topScale / 2, rw * topScale);
    for (const off of [-0.52, 0, 0.52]) {
      B.main.cone(px + off, 4.30, 0.06 + rd * topScale / 2, 0.04, 0.21, trim, 6);
    }
  }

  // Square clock tower, open lantern, slender crown and Vietnamese flag.
  const tz = -0.06;
  B.main.box(0, 2.77, tz, 0.91, 2.13, 0.95, yellow);
  for (const y of [3.55, 4.55, 4.86]) B.main.box(0, y, tz, 1.06, 0.10, 1.10, trim);
  for (const u of [-0.39, 0.39]) pilaster(u, tz + 0.49, 3.65, 0.88);
  for (const side of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    B.main.push(0, 0, tz, side);
    B.main.put(P.disc(24), '#c4af83', { y: 4.19, z: 0.489, sx: 0.59, sy: 0.59 });
    B.main.put(P.disc(24), trim, { y: 4.19, z: 0.495, sx: 0.48, sy: 0.48 });
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      B.main.put(P.box(), '#6b6456', { x: Math.sin(a) * 0.195, y: 4.19 + Math.cos(a) * 0.195, z: 0.505, sx: 0.022, sy: 0.043, sz: 0.012, rz: -a });
    }
    B.main.box(0, 4.18, 0.517, 0.027, 0.16, 0.012, '#514a40');
    B.main.put(P.box(), '#514a40', { x: 0.053, y: 4.16, z: 0.517, sx: 0.12, sy: 0.025, sz: 0.012, rz: -0.5 });
    B.main.pop();
  }
  B.main.box(0, 4.99, tz, 0.64, 0.54, 0.65, green);
  for (const a of [-0.38, 0.38]) for (const b of [-0.38, 0.38]) B.main.cyl(a, 4.96, tz + b, 0.043, 0.64, trim, 8);
  B.main.box(0, 5.57, tz, 0.96, 0.10, 1.0, trim);
  B.main.put(hipRoof(0.82, 0.86, 0.28), '#a69976', { y: 5.67, z: tz }, true);
  B.main.box(0, 5.91, tz, 0.26, 0.36, 0.28, trim);
  B.main.put(P.pyramid(), trim, { y: 6.36, z: tz, sx: 0.3, sy: 0.22, sz: 0.3 });
  B.main.cyl(0, 6.42, tz, 0.018, 0.67, '#eee8d6', 6);
  B.main.box(0.22, 6.75, tz, 0.43, 0.27, 0.02, '#da251d');
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.035 : 0.08;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) star.moveTo(px, py); else star.lineTo(px, py);
  }
  star.closePath();
  const sg = normalizeGeometry(new THREE.ShapeGeometry(star));
  for (const s of [-1, 1]) B.main.put(sg, '#ffde00', { x: 0.22, y: 6.885, z: tz + s * 0.012, ry: s < 0 ? Math.PI : 0 });
  sg.dispose();

  // Front steps stay behind the original statue position (local z = 2.2).
  for (let i = 0; i < 3; i++) B.main.box(0, i * 0.05, 1.48 - i * 0.08, 3.65, 0.05, 0.32, trim);
  for (const u of [-1.40, 1.40]) {
    B.main.box(u, 0.3, 1.53, 0.09, 0.30, 0.08, '#8f7957');
    B.lamp.sphere(u, 0.65, 1.53, 0.065, '#ffe1a0', 1, 6);
  }
  arch.dispose();
  for (const b of [B.main, B.glass, B.lit, B.lamp]) b.pop();
  // Uncle Hồ statue
  B.main.box(0, 0, 2.2, 0.6, 0.45, 0.45, '#e2ddd2');
  B.main.cyl(0, 0.45, 2.2, 0.09, 0.42, '#a88b5c', 8, 0.07);
  B.main.sphere(0, 0.95, 2.2, 0.07, '#a88b5c');
  for (const b of [B.main, B.glass, B.lit, B.lamp]) b.pop();
}

export function benThanh(B, { x, z, ry = 0, w = 5.4, d = 4.4 }) {
  const cream = '#efe1c1', roof = '#c4553b', trim = '#fbf5e6';
  B.main.push(x, 0, z, ry);
  const H = 1.15;
  B.main.box(0, 0, 0, w, H, d, cream);
  B.main.box(0, H, 0, w + 0.08, 0.07, d + 0.08, trim);
  // saw-tooth market halls (gables along z)
  const halls = Math.max(3, Math.round(w / 1.9));
  const hw = w / halls;
  for (let i = 0; i < halls; i++) B.main.put(P.prism(), roof, { x: -w / 2 + hw * (i + 0.5), y: H + 0.35, sx: hw + 0.04, sy: 0.7, sz: d + 0.1 });
  // corner pavilions
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    B.main.box(sx * (w / 2 - 0.4), 0, sz * (d / 2 - 0.4), 0.95, H + 0.35, 0.95, cream);
    B.main.put(hipRoof(1.05, 1.05, 0.45), roof, { x: sx * (w / 2 - 0.4), y: H + 0.35, z: sz * (d / 2 - 0.4) }, true);
  }
  // arched openings on all four sides
  const n = Math.floor((w - 2) / 0.48);
  for (let i = 0; i < n; i++) {
    const u = -((n - 1) * 0.48) / 2 + i * 0.48;
    B.main.quad(u, 0.45, d / 2 + 0.005, 0.24, 0.5, '#6b4e3a');
    B.main.quad(-u, 0.45, -d / 2 - 0.005, 0.24, 0.5, '#6b4e3a', Math.PI);
  }
  const m = Math.floor((d - 2) / 0.48);
  for (let i = 0; i < m; i++) {
    const u = -((m - 1) * 0.48) / 2 + i * 0.48;
    B.main.quad(w / 2 + 0.005, 0.45, -u, 0.24, 0.5, '#6b4e3a', Math.PI / 2);
    B.main.quad(-w / 2 - 0.005, 0.45, u, 0.24, 0.5, '#6b4e3a', -Math.PI / 2);
  }
  // south gate with the iconic clock tower (enlarged)
  const gz = d / 2 + 0.2, k = 1.35;
  B.main.box(0, 0, gz, 1.0 * k, 2.6 * k, 0.6 * k, cream);
  B.main.box(0, 2.6 * k, gz, 1.1 * k, 0.08, 0.7 * k, trim);
  B.main.put(hipRoof(1.1 * k, 0.7 * k, 0.55 * k), roof, { y: 2.6 * k + 0.08, z: gz }, true);
  const cz = gz + 0.3 * k + 0.006;
  B.main.put(P.disc(16), '#ffffff', { y: 2.1 * k, z: cz, sx: 0.5 * k, sy: 0.5 * k });
  B.main.box(0, 2.1 * k - 0.02, cz + 0.004, 0.03, 0.2 * k, 0.01, '#222');
  B.main.box(0.06 * k, 2.1 * k, cz + 0.004, 0.14 * k, 0.03, 0.01, '#222');
  B.main.quad(0, 0.5 * k, cz, 0.5 * k, 1.0 * k, '#4d3a2c');
  B.main.pop();
}

export function thuThiemBridge(B, { px, z, deckY, dir = 1 }) {
  const white = '#f2f3f4';
  const base = V(px, deckY, z);
  const top = V(px - dir * 1.6, deckY + 6.2, z);
  B.main.beam(V(px, BED, z), base, 0.35, '#cfc9bf', 8);
  B.main.beam(base, top, 0.18, white, 8);
  for (let k = 0; k < 9; k++) {
    const t = 0.45 + k * 0.06;
    const a = base.clone().lerp(top, t);
    for (const s of [-1, 1]) {
      B.main.beam(a, V(px + dir * (0.8 + k * 0.75), deckY + 0.08, z + s * 0.12), 0.014, '#fafafa', 3);
    }
  }
  for (let k = 0; k < 3; k++) {
    const a = base.clone().lerp(top, 0.8 + k * 0.07);
    B.main.beam(a, V(px - dir * (2.8 + k * 0.5), 0.1, z), 0.025, '#fafafa', 3);
  }
  B.main.box(px - dir * 3.3, 0, z, 1.2, 0.25, 0.6, '#cfc9bf');
}

export function fountain(B, { x, z }) {
  B.main.cyl(x, 0, z, 0.8, 0.18, '#d8d2c8', 18);
  B.glass.cyl(x, 0.12, z, 0.7, 0.07, '#7ec9e4', 18);
  B.glass.cyl(x, 0.12, z, 0.06, 0.7, '#cdeefa', 6);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    B.glass.beam(V(x + Math.cos(a) * 0.15, 0.2, z + Math.sin(a) * 0.15), V(x + Math.cos(a) * 0.45, 0.55, z + Math.sin(a) * 0.45), 0.02, '#e0f6ff', 3);
  }
}


const toWorld = (x, z, ry, lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];

function tieredGate(B, z, w, h, wall, roof, tiers = 2) {
  B.main.box(0, 0, z, w, h, 0.55, wall);
  B.main.quad(0, h * 0.35, z + 0.28, w * 0.28, h * 0.7, '#3b2b22');
  B.main.quad(0, h * 0.35, z - 0.28, w * 0.28, h * 0.7, '#3b2b22', Math.PI);
  for (const sx of [-1, 1]) {
    B.main.box(sx * (w / 2 + 0.35), 0, z, 0.7, h * 0.7, 0.5, wall);
    B.main.put(P.flaredRoof(), roof, { x: sx * (w / 2 + 0.35), y: h * 0.7, z, sx: 1.0, sy: 0.3, sz: 0.8 });
  }
  B.main.put(P.flaredRoof(), roof, { y: h, z, sx: w + 0.5, sy: 0.32, sz: 0.95 });
  if (tiers > 1) {
    B.main.box(0, h + 0.18, z, w * 0.6, 0.3, 0.4, wall);
    B.main.put(P.flaredRoof(), roof, { y: h + 0.48, z, sx: w * 0.85, sy: 0.3, sz: 0.75 });
  }
}

/** Văn Miếu – Quốc Tử Giám, simplified to its icons: front gate, a large Khuê Văn Các,
 *  Thiên Quang well with stele houses and the main hall. Front (gate) faces +z. Size ~6 x 15. */
export function vanMieu(B, { x, z, ry = 0, rng }) {
  const wall = '#b9653f', roof = '#7a5641', plaster = '#e9dcc0', red = '#a93a2a', lawn = '#79a94b';
  B.main.push(x, 0, z, ry);
  B.glass.push(x, 0, z, ry);
  B.main.box(0, 0, 0, 6.0, 0.04, 15.0, lawn);
  B.main.box(0, 0.04, 0, 0.7, 0.02, 14.6, '#d9ccb2');
  const wh = 0.38, wt = 0.12;
  B.main.box(-2.95, 0, 0, wt, wh, 15, wall); B.main.box(2.95, 0, 0, wt, wh, 15, wall);
  B.main.box(0, 0, -7.45, 6, wh, wt, wall);
  B.main.box(-2.2, 0, 7.45, 1.5, wh, wt, wall); B.main.box(2.2, 0, 7.45, 1.5, wh, wt, wall);

  // Văn Miếu Môn (front gate), enlarged
  B.main.push(0, 0, 7.0, 0, 1.8);
  tieredGate(B, 0, 1.1, 0.75, wall, roof, 2);
  B.main.pop();

  // Khuê Văn Các — the emblem of Hà Nội, drawn ~2.3x
  B.main.push(0, 0, 2.0, 0, 3.0);
  B.main.box(0, 0, 0, 1.3, 0.05, 1.3, '#cfc6b2');
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.main.box(sx * 0.36, 0.05, sz * 0.36, 0.2, 0.65, 0.2, '#eee8da');
  B.main.box(0, 0.7, 0, 1.05, 0.06, 1.05, '#cfc6b2');
  B.main.put(P.flaredRoof(), roof, { y: 0.66, sx: 1.5, sy: 0.18, sz: 1.5 });
  B.main.box(0, 0.78, 0, 0.72, 0.5, 0.72, red);
  for (let k = 0; k < 4; k++) {
    const an = (k * Math.PI) / 2;
    B.main.put(P.disc(16), '#f3e7c9', { x: Math.sin(an) * 0.365, y: 1.03, z: Math.cos(an) * 0.365, sx: 0.32, sy: 0.32, ry: an });
    B.main.put(P.disc(12), '#3b2b22', { x: Math.sin(an) * 0.368, y: 1.03, z: Math.cos(an) * 0.368, sx: 0.2, sy: 0.2, ry: an });
  }
  B.main.put(P.flaredRoof(), roof, { y: 1.28, sx: 1.25, sy: 0.42, sz: 1.25 });
  B.main.cyl(0, 1.66, 0, 0.03, 0.12, '#d9b440', 5);
  B.main.pop();

  // Thiên Quang Tỉnh (square well) flanked by stele houses
  B.main.box(0, 0, -2.6, 2.4, 0.08, 2.0, '#9e9a8c');
  B.glass.box(0, 0.02, -2.6, 2.1, 0.07, 1.7, '#4f9b8a');
  for (const sx of [-1, 1]) {
    B.main.box(sx * 2.15, 0, -2.6, 0.9, 0.55, 2.8, plaster);
    B.main.put(P.prism(), roof, { x: sx * 2.15, y: 0.72, z: -2.6, sx: 1.15, sy: 0.34, sz: 3.0 });
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) B.main.quad(sx * 2.15 + side * 0.455, 0.28, -3.65 + i * 0.70, 0.30, 0.38, '#776856', side * Math.PI / 2);
    for (const side of [-1, 1]) B.main.quad(sx * 2.15, 0.28, -2.6 + side * 1.405, 0.38, 0.38, '#776856', side > 0 ? 0 : Math.PI);
  }

  // Đại Bái Đường (main hall), double roof, enlarged
  B.main.push(0, 0, -5.8, 0, 1.25);
  B.main.box(0, 0, 0, 4.2, 0.08, 1.7, '#cfc6b2');
  B.main.box(0, 0.08, 0, 3.7, 0.6, 1.2, red);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) B.main.quad(-1.5 + i * 0.5, 0.38, side * 0.606, 0.28, 0.45, '#5e2a22', side > 0 ? 0 : Math.PI);
    B.main.quad(side * 1.855, 0.38, 0, 0.4, 0.45, '#5e2a22', side * Math.PI / 2);
  }
  for (let i = 0; i < 8; i++) B.main.cyl(-1.75 + i * 0.5, 0.08, 0.68, 0.045, 0.6, '#7d2a20', 6);
  B.main.put(P.flaredRoof(), roof, { y: 0.65, sx: 4.8, sy: 0.28, sz: 2.0 });
  B.main.box(0, 0.85, 0, 2.9, 0.25, 0.85, red);
  B.main.put(P.flaredRoof(), roof, { y: 1.08, sx: 3.9, sy: 0.45, sz: 1.6 });
  B.main.pop();
  B.glass.pop();
  B.main.pop();

  for (const [lx, lz, kind] of [[-2.0, 5.0, 'big'], [2.0, 4.8, 'big'], [-2.2, -0.4, 'round'], [2.2, -0.2, 'round'], [-2.3, -7.0, 'yellow'], [2.3, -7.0, 'round']]) {
    const [wx, wz] = toWorld(x, z, ry, lx, lz);
    addTree(B, { x: wx, z: wz, kind, s: rng.range(0.75, 0.9) }, rng);
  }
}

/** Lăng Chủ tịch Hồ Chí Minh (enlarged) with a compact Ba Đình square in front. Local front = +z.
 *  Size ~9.6 (x) x 9.2 (z). */
export function hcmMausoleum(B, { x, z, ry = 0, rng }) {
  B.main.push(x, 0, z, ry);
  B.lamp.push(x, 0, z, ry);
  // compact square: 7 x 2 grass tiles
  B.main.box(0, 0, 3.1, 8.0, 0.03, 3.0, '#dcd7cc');
  for (let lx = -3.125; lx <= 3.2; lx += 1.25) for (const lz of [2.45, 3.7]) B.main.box(lx, 0.03, lz, 1.0, 0.04, 1.0, '#6fae45');
  // mausoleum, ~1.9x the previous size
  B.main.push(0, 0, -2.05, 0, 2.35);
  B.main.box(0, 0, 0, 3.6, 0.12, 3.0, '#8d9096');
  B.main.box(0, 0.12, 0, 3.1, 0.14, 2.6, '#7c8086');
  B.main.box(0, 0.26, 0, 2.6, 0.24, 2.2, '#a7abb0');
  B.main.box(0, 0, 1.55, 1.4, 0.26, 0.5, '#9a9ea3');
  B.main.box(0, 0.5, 0, 1.7, 0.85, 1.4, '#62676d');
  for (let i = 0; i < 6; i++) for (const sz of [-1, 1]) B.main.box(-1.0 + i * 0.4, 0.5, sz * 0.88, 0.13, 0.85, 0.13, '#c9ccd0');
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) B.main.box(sx * 1.08, 0.5, -0.6 + i * 0.4, 0.13, 0.85, 0.13, '#c9ccd0');
  B.main.box(0, 1.35, 0, 2.35, 0.13, 1.95, '#b9bcc0');
  B.main.box(0, 1.37, 0.985, 1.3, 0.09, 0.02, '#8e2a26');
  B.main.box(0, 1.48, 0, 2.0, 0.1, 1.6, '#9fa3a8');
  B.main.box(0, 1.58, 0, 1.6, 0.1, 1.25, '#b3b6ba');
  B.main.box(0, 1.68, 0, 1.2, 0.08, 0.9, '#c4c7ca');
  B.main.pop();
  // flagpole at the front of the square
  B.main.box(0, 0, 4.4, 0.6, 0.15, 0.6, '#c9c4b8');
  B.main.cyl(0, 0.15, 4.4, 0.03, 3.0, '#e4e4e4', 6);
  B.main.box(0.28, 2.7, 4.4, 0.55, 0.36, 0.02, '#da251d');
  B.lamp.box(0.28, 2.82, 4.41, 0.12, 0.12, 0.012, '#ffde00');
  B.lamp.pop();
  B.main.pop();
  for (const [lx, lz] of [[-4.6, -4.6], [4.6, -4.6], [-4.6, 0.6], [4.6, 0.6]]) {
    const [wx, wz] = toWorld(x, z, ry, lx, lz);
    addTree(B, { x: wx, z: wz, kind: 'round', s: 0.85 }, rng);
  }
}

/** Chùa Linh Ứng (Sơn Trà): giant white Lady Buddha facing the sea + pagoda halls and tower. */
export function linhUng(B, { x, z, ry = Math.PI / 2, rng, field }) {
  const y = field.height(x, z);
  const white = '#f6f3ec';
  const S = 1.7;
  B.main.push(x, y - 0.2, z, ry);
  B.main.box(0, -0.6, 0, 3.2, 0.8, 3.2, '#cfc8ba');
  B.main.cyl(0, 0.2, 0, 1.25, 0.35, '#e2ddd2', 16);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    B.main.put(P.sphere(6, 4), white, { x: Math.cos(a) * 0.85, y: 0.62, z: Math.sin(a) * 0.85, sx: 0.42, sy: 0.32, sz: 0.62, ry: -a });
  }
  const prof = [[0.48, 0], [0.45, 0.4], [0.38, 1.2], [0.35, 1.8], [0.32, 2.05], [0.13, 2.2], [0.1, 2.3], [0.0001, 2.3]].map(([r, h]) => new THREE.Vector2(r * S, h * S));
  B.main.put(normalizeGeometry(new THREE.LatheGeometry(prof, 16)), white, { y: 0.6 }, true);
  const hy = 0.6 + 2.3 * S;
  B.main.sphere(0, hy + 0.32, 0, 0.32, white, 1.1, 10);
  B.main.sphere(0, hy + 0.66, -0.04, 0.15, white, 1, 8);
  B.main.put(P.disc(20), '#f3e3b0', { y: hy + 0.35, z: -0.36, sx: 1.1, sy: 1.1, ry: Math.PI });
  B.main.beam(V(0.36, hy - 0.3, 0.05), V(0.38, hy - 1.0, 0.45), 0.1, white, 6);
  B.main.beam(V(-0.36, hy - 0.3, 0.05), V(-0.3, hy - 0.9, 0.45), 0.1, white, 6);
  B.main.cyl(0.36, hy - 1.15, 0.5, 0.08, 0.28, '#e7e1d2', 8, 0.05);
  B.main.pop();
  // pagoda complex behind the statue (west)
  const hall = (hx, hz, w, d, h, rot) => {
    const gy = field.height(hx, hz);
    B.main.push(hx, gy, hz, rot);
    B.main.box(0, -0.8, 0, w + 0.4, 0.95, d + 0.4, '#d8d0c0');
    B.main.box(0, 0.15, 0, w, h, d, '#f2e3c4');
    for (const side of [-1, 1]) {
      for (const u of [-0.5, 0, 0.5]) B.main.quad(u, 0.15 + h * 0.45, side * (d / 2 + 0.008), 0.25, h * 0.65, '#8e392a', side > 0 ? 0 : Math.PI);
      B.main.quad(side * (w / 2 + 0.008), 0.15 + h * 0.45, 0, 0.3, h * 0.65, '#8e392a', side * Math.PI / 2);
    }
    for (let i = 0; i < 5; i++) B.main.cyl(-w / 2 + 0.1 + (i * (w - 0.2)) / 4, 0.15, d / 2 + 0.12, 0.04, h, '#b23a2a', 6);
    B.main.put(P.flaredRoof(), '#d9822f', { y: 0.15 + h, sx: w + 0.7, sy: 0.4, sz: d + 0.6 });
    B.main.box(0, 0.15 + h + 0.25, 0, w * 0.55, 0.28, d * 0.5, '#f2e3c4');
    B.main.put(P.flaredRoof(), '#d9822f', { y: 0.15 + h + 0.53, sx: w * 0.8, sy: 0.4, sz: d * 0.75 });
    B.main.pop();
  };
  hall(x - 3.1, z + 1.3, 2.0, 1.3, 0.7, Math.PI / 2);
  // 5-tier stupa
  const tx = x - 2.3, tz = z - 2.5, ty = field.height(tx, tz);
  B.main.box(tx, ty - 0.8, tz, 1.1, 0.95, 1.1, '#d8d0c0');
  for (let k = 0; k < 5; k++) {
    const sz = 0.7 - k * 0.1, yy = ty + 0.15 + k * 0.42;
    B.main.box(tx, yy, tz, sz, 0.3, sz, '#f2e3c4');
    B.main.put(P.flaredRoof(), '#d9822f', { x: tx, y: yy + 0.3, z: tz, sx: sz + 0.35, sy: 0.14, sz: sz + 0.35 });
  }
  B.main.cyl(tx, ty + 2.35, tz, 0.03, 0.3, '#d9b440', 5);
}

/** Chùa Một Cột: small wooden shrine on a single stone pillar in a square lotus pond. */
export function oneLegPagoda(B, { x, z, ry = 0, rng, scale = 1.25 }) {
  B.main.push(x, 0, z, ry, scale);
  B.glass.push(x, 0, z, ry, scale);
  B.main.box(0, 0, 0, 2.5, 0.16, 2.5, '#efeae0');
  B.glass.box(0, 0.06, 0, 2.1, 0.11, 2.1, '#3fa7d6');
  for (let i = 0; i < 7; i++) {
    const a = i * 2.3, r = 0.55 + (i % 3) * 0.2;
    B.main.cyl(Math.cos(a) * r, 0.14, Math.sin(a) * r, 0.1, 0.02, '#6fae45', 8);
  }
  B.main.cyl(0, 0.1, 0, 0.11, 0.55, '#d9d2c2', 10);
  B.main.box(0, 0.65, 0, 0.62, 0.06, 0.62, '#7a3b2a');
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.main.beam(V(0, 0.45, 0), V(sx * 0.3, 0.66, sz * 0.3), 0.03, '#7a3b2a', 4);
  B.main.box(0, 0.71, 0, 0.48, 0.34, 0.48, '#8e3b28');
  B.main.quad(0, 0.86, 0.245, 0.2, 0.22, '#3b2b22');
  B.main.quad(0, 0.86, -0.245, 0.2, 0.22, '#3b2b22', Math.PI);
  for (const side of [-1, 1]) B.main.quad(side * 0.245, 0.86, 0, 0.18, 0.22, '#3b2b22', side * Math.PI / 2);
  B.main.put(P.flaredRoof(), '#7a5641', { y: 1.05, sx: 0.95, sy: 0.38, sz: 0.95 });
  B.main.put(P.cyl(8), '#e0b04a', { y: 1.45, sx: 0.06, sy: 0.12, sz: 0.06 });
  // stairway from the pond rim
  const a = V(0, 0.14, 1.15), b = V(0, 0.68, 0.32);
  B.main.slab(a, b, 0.24, 0.05, '#b9b2a2');
  B.glass.pop();
  B.main.pop();
  addTree(B, { x: x - 1.55 * scale, z: z - 0.9 * scale, kind: 'big', s: 0.95 }, rng);
  addTree(B, { x: x + 1.55 * scale, z: z - 0.9 * scale, kind: 'round', s: 0.85 }, rng);
}

/** Nhà Thờ Lớn Hà Nội (St Joseph's): dark grey neo-gothic, twin square flat-topped towers. Front +z. */
export function stJoseph(B, { x, z, ry = 0, scale = 1 }) {
  const wall = '#8c867b', dark = '#6b665d', roof = '#4f4d4a', trim = '#a9a397';
  B.main.push(x, 0, z, ry, scale);
  B.glass.push(x, 0, z, ry, scale);
  B.lit.push(x, 0, z, ry, scale);
  B.main.box(0, 0, -0.55, 1.6, 1.55, 2.6, wall);
  B.main.put(P.prism(), roof, { y: 1.55 + 0.38, z: -0.55, sx: 1.72, sy: 0.76, sz: 2.7 });
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) {
    facadeWindow(B, { x: sx * 0.805, z: -1.55 + i * 0.65, ry: sx * Math.PI / 2, y: 0.80, w: 0.16, h: 0.6, trim, glass: '#596779', arched: true });
    B.main.cone(sx * 0.8, 1.55, -1.55 + i * 0.65, 0.05, 0.25, trim, 4);
  }
  for (const sx of [-1, 1]) {
    const tx = sx * 0.62;
    B.main.box(tx, 0, 1.0, 0.72, 3.0, 0.72, wall);
    for (let k = 1; k <= 3; k++) B.main.box(tx, k * 0.8, 1.0, 0.76, 0.05, 0.76, trim);
    B.main.quad(tx, 2.55, 1.365, 0.2, 0.5, '#2f2c28');
    B.main.quad(tx + sx * 0.365, 2.55, 1.0, 0.2, 0.5, '#2f2c28', sx * Math.PI / 2);
    facadeWindow(B, { x: tx, z: 0.635, ry: Math.PI, y: 2.55, w: 0.20, h: 0.45, trim, glass: dark, arched: true });
    facadeWindow(B, { x: tx - sx * 0.365, z: 1.0, ry: -sx * Math.PI / 2, y: 2.55, w: 0.20, h: 0.45, trim, glass: dark, arched: true });
    B.main.box(tx, 3.0, 1.0, 0.8, 0.08, 0.8, trim);
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.main.cone(tx + px * 0.34, 3.08, 1.0 + pz * 0.34, 0.05, 0.3, trim, 4);
  }
  B.main.box(0, 0, 1.05, 0.55, 2.2, 0.6, wall);
  B.main.put(P.prism(), roof, { y: 2.38, z: 1.05, sx: 0.55, sy: 0.36, sz: 0.62 });
  B.main.cyl(0, 2.55, 1.05, 0.015, 0.35, '#d9d4c6', 4);
  B.main.box(0, 2.78, 1.05, 0.16, 0.025, 0.025, '#d9d4c6');
  B.main.put(P.disc(16), trim, { y: 1.6, z: 1.355, sx: 0.4, sy: 0.4 });
  B.glass.put(P.disc(16), '#5d6f9a', { y: 1.6, z: 1.36, sx: 0.28, sy: 0.28 });
  for (const sx of [-0.62, 0, 0.62]) B.main.quad(sx, 0.4, 1.37, 0.26, 0.7, '#3a2e26');
  B.main.box(0, 0, 1.9, 1.9, 0.04, 1.0, '#cfc8ba');
  facadeRows(B, { w: 1.6, d: 2.6, z: -0.55, levels: [0.75], faces: ['back'], spacing: 0.55, ww: 0.22, wh: 0.58, trim, glass: '#596779', arched: true });
  B.lit.pop();
  B.glass.pop();
  B.main.pop();
}

/** Nhà Hát Lớn Hà Nội (Opera House): cream French-colonial with colonnade, mansards and a central dome. Front +z. */
export function operaHouse(B, { x, z, ry = 0, scale = 1 }) {
  const cream = '#f2dfb2', white = '#fbf6ea', roof = '#7f8c95';
  B.main.push(x, 0, z, ry, scale);
  B.lit.push(x, 0, z, ry, scale);
  B.lamp.push(x, 0, z, ry, scale);
  // Recessed arched glazing, pale surrounds, sills and cross mullions.
  // Windows on every side matter: the default view sees the rear of this rotated landmark.
  const window = (wx, wy, wz, w = 0.26, h = 0.34, face = 0) => {
    B.main.push(wx, 0, wz, face);
    B.lit.push(wx, 0, wz, face);
    B.main.quad(0, wy, 0.006, w + 0.1, h + 0.08, white);
    B.main.put(P.disc(12), white, { y: wy + h / 2, z: 0.007, sx: w + 0.1, sy: w + 0.1 });
    B.lit.quad(0, wy, 0.014, w, h, '#536d76');
    B.lit.put(P.disc(12), '#536d76', { y: wy + h / 2, z: 0.015, sx: w, sy: w });
    B.main.box(0, wy - h / 2 - 0.045, 0.04, w + 0.14, 0.05, 0.08, white);
    B.main.box(0, wy - h / 2, 0.022, 0.024, h + w / 2, 0.015, white);
    B.main.box(0, wy + 0.025, 0.022, w, 0.022, 0.015, white);
    B.lit.pop();
    B.main.pop();
  };
  B.main.box(0, 0, 0, 4.2, 0.12, 2.9, '#e2d9c6');
  B.main.box(0, 0.12, -0.2, 4.0, 1.25, 2.3, cream);
  B.main.box(0, 1.37, -0.2, 4.1, 0.08, 2.4, white);
  B.main.put(hipRoof(4.0, 2.3, 0.45), roof, { y: 1.45, z: -0.2 }, true);
  // central pavilion with dome
  B.main.box(0, 0.12, 0.25, 1.7, 1.75, 2.2, cream);
  B.main.box(0, 1.87, 0.25, 1.8, 0.08, 2.3, white);
  B.main.box(0, 1.95, 0.25, 1.3, 0.35, 1.3, cream);
  B.main.put(P.hemi(14), roof, { y: 2.3, z: 0.25, sx: 1.25, sy: 1.0, sz: 1.25 });
  B.main.cyl(0, 2.78, 0.25, 0.05, 0.3, '#d9b440', 6);
  B.main.box(0.18, 2.95, 0.25, 0.3, 0.2, 0.015, '#da251d');
  // corner pavilions with small domes
  for (const sx of [-1, 1]) {
    B.main.box(sx * 1.65, 0.12, 0.05, 0.8, 1.5, 2.0, cream);
    B.main.put(hipRoof(0.9, 2.1, 0.55), roof, { x: sx * 1.65, y: 1.62, z: 0.05 }, true);
  }
  // colonnade + terrace
  B.main.box(0, 0.12, 1.45, 1.8, 0.1, 0.5, white);
  for (let i = 0; i < 6; i++) B.main.cyl(-0.75 + i * 0.3, 0.22, 1.55, 0.045, 0.85, white, 8);
  B.main.box(0, 1.07, 1.45, 1.85, 0.12, 0.55, white);
  for (let i = 0; i < 4; i++) window(-0.51 + i * 0.34, 1.42, 1.355, 0.23, 0.3);
  for (let f = 0; f < 2; f++) for (const sx of [-1, 1]) {
    for (let i = 0; i < 2; i++) window(sx * (1.44 + i * 0.4), 0.44 + f * 0.58, 1.055, 0.24, 0.32);
    for (const wz of [-0.58, 0.05, 0.68]) window(sx * 2.055, 0.44 + f * 0.58, wz, 0.28, 0.34, sx * Math.PI / 2);
  }
  // Two full rows on the otherwise blank rear wall, visible from the initial camera angle.
  for (let f = 0; f < 2; f++) for (let i = 0; i < 7; i++) {
    window(-1.68 + i * 0.56, 0.42 + f * 0.57, -1.355, 0.29, 0.3, Math.PI);
  }
  // Rear pilasters and side cornices break up the large solid walls.
  for (const wx of [-1.96, -1.4, -0.84, 0.84, 1.4, 1.96]) B.main.box(wx, 0.12, -1.37, 0.055, 1.25, 0.06, white);
  for (const sx of [-1, 1]) B.main.box(sx * 2.065, 0.74, 0.05, 0.055, 0.045, 2.02, white);
  // Tall glazed entrance doors behind the portico, plus glowing porch lanterns.
  for (const wx of [-0.48, 0, 0.48]) window(wx, 0.53, 1.356, 0.27, 0.62);
  for (const sx of [-1, 1]) {
    B.main.box(sx * 0.78, 0.68, 1.39, 0.08, 0.18, 0.08, '#4c4540');
    B.lamp.box(sx * 0.78, 0.71, 1.44, 0.055, 0.11, 0.055, '#ffe9bb');
  }
  B.main.box(0, 0, 1.95, 2.0, 0.06, 0.5, '#e2d9c6');
  B.lamp.pop();
  B.lit.pop();
  B.main.pop();
}

/** Cầu Trần Thị Lý: sail-shaped single inclined pylon mid-river with fanned stay cables (deck along x). */
export function tranThiLyBridge(B, { x, z, deckY }) {
  const white = '#f3f4f5';
  B.main.box(x, BED, z, 1.4, deckY - BED - 0.2, 1.6, '#cfc9bf');
  const top = V(x - 0.9, deckY + 6.0, z);
  const legs = [V(x + 0.35, deckY, z - 0.75), V(x + 0.35, deckY, z + 0.75)];
  for (const l of legs) B.main.beam(l, top, 0.13, white, 8);
  for (let k = 1; k <= 4; k++) {
    const t = k / 5;
    B.main.beam(legs[0].clone().lerp(top, t), legs[1].clone().lerp(top, t), 0.05, white, 5);
  }
  B.main.beam(top, top.clone().add(V(-0.2, 0.7, 0)), 0.06, white, 6);
  for (let k = 0; k < 9; k++) {
    const a = legs[0].clone().lerp(top, 0.45 + k * 0.06);
    const b2 = legs[1].clone().lerp(top, 0.45 + k * 0.06);
    for (const dir of [-1, 1]) {
      const dx = x + dir * (0.9 + k * 0.42);
      B.main.beam(a, V(dx, deckY + 0.08, z - 0.75), 0.012, '#fafafa', 3);
      B.main.beam(b2, V(dx, deckY + 0.08, z + 0.75), 0.012, '#fafafa', 3);
    }
  }
  B.lamp.sphere(top.x - 0.2, top.y + 0.75, top.z, 0.07, '#ff6b5a');
}

/** Cầu Chương Dương (partial): concrete box-girder bridge over the Red River running off the tile edge.
 *  Adds girder faces, rounded piers and lamp rows on top of the auto-generated road bridge. */
export function chuongDuongBridge(B, { x0, x1, z, roads, hw = 1.1 }) {
  const r = roads.find((q) => q.bridge && q.path.distance((x0 + x1) / 2, z) < 0.5);
  if (!r) return;
  const yAt = (x) => r.path.pointAt(r.path.nearest(x, z).s).y;
  const w = hw + 0.6;
  for (let x = x0; x < x1; x += 0.5) {
    const y = yAt(x + 0.25);
    if (y < 0.15) continue;
    for (const s of [-1, 1]) B.main.box(x + 0.25, y - 0.34, z + s * (w + 0.02), 0.52, 0.3, 0.06, s > 0 ? '#c9c4b8' : '#bdb8ac');
    B.main.box(x + 0.25, y - 0.36, z, 0.52, 0.06, w * 2, '#a9a49a');
  }
  let n = 0;
  for (let x = x0 + 0.6; x < x1; x += 1.6, n++) {
    const y = yAt(x);
    if (y < 0.2) continue;
    for (const s of [-1, 1]) {
      const lz = z + s * (w - 0.12);
      B.main.cyl(x, y + 0.04, lz, 0.025, 0.9, '#5c6670', 5);
      B.lamp.box(x, y + 0.92, lz - s * 0.1, 0.14, 0.05, 0.22, '#fff1cf');
    }
    if (n % 2 === 0) {
      B.main.cyl(x, BED, z, 0.38, y - 0.4 - BED, '#cfc9bf', 12);
      B.main.box(x, y - 0.48, z, 0.6, 0.14, w * 2, '#bdb8ac');
    }
  }
}

/** Cầu Khánh Hội (partial): road bridge over Bến Nghé canal mouth with low steel arch ribs (deck along z). */
export function khanhHoiBridge(B, { x, z0, z1, deckY, hw = 1.2 }) {
  const blue = '#2f74c9';
  const L = z1 - z0;
  const AH = 1.9;
  for (const s of [-1, 1]) {
    const xx = x + s * (hw + 0.62);
    let prev = null;
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const p = V(xx, deckY + 0.1 + Math.sin(Math.PI * t) * AH, z0 + L * t);
      if (prev) B.main.beam(prev, p, 0.12, blue, 6);
      if (i % 2 === 0 && i > 0 && i < 16) B.main.beam(p, V(xx, deckY + 0.1, p.z), 0.035, '#e8ecf0', 4);
      prev = p;
    }
    B.main.beam(V(xx, deckY + 0.1, z0), V(xx, deckY + 0.1, z1), 0.05, blue, 5);
  }
  for (const i of [5, 8, 11]) {
    const t = i / 16;
    B.main.beam(V(x - hw - 0.62, deckY + 0.1 + Math.sin(Math.PI * t) * AH, z0 + L * t), V(x + hw + 0.62, deckY + 0.1 + Math.sin(Math.PI * t) * AH, z0 + L * t), 0.06, blue, 5);
  }
}

/** Bến Nhà Rồng: colonial customs house with two green dragons facing a moon on the roof ridge. Front +z. */
export function nhaRong(B, { x, z, ry = 0, scale = 1 }) {
  const wall = '#f3dca2', white = '#fbf5e6', roof = '#c4482f', green = '#22b04f';
  B.main.push(x, 0, z, ry, scale);
  B.glass.push(x, 0, z, ry, scale);
  B.lit.push(x, 0, z, ry, scale);
  B.lamp.push(x, 0, z, ry, scale);
  B.main.box(0, 0, 0.2, 4.6, 0.1, 3.0, '#cfc8ba');
  B.main.box(0, 0.1, 0, 3.8, 1.25, 1.9, wall);
  B.main.box(0, 1.35, 0, 3.9, 0.07, 2.0, white);
  B.main.put(hipRoof(3.9, 2.0, 0.75), roof, { y: 1.42 }, true);
  // front pavilion
  B.main.box(0, 0.1, 1.15, 1.3, 1.1, 0.5, wall);
  for (let i = 0; i < 4; i++) B.main.cyl(-0.48 + i * 0.32, 0.1, 1.45, 0.04, 1.0, white, 8);
  B.main.box(0, 1.1, 1.25, 1.45, 0.1, 0.65, white);
  B.main.put(P.prism(), roof, { y: 1.38, z: 1.2, sx: 1.45, sy: 0.38, sz: 0.7, ry: Math.PI / 2 });
  for (let f = 0; f < 2; f++) for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const wx = sx * (0.95 + i * 0.4);
    facadeWindow(B, { x: wx, z: 0.95, y: 0.45 + f * 0.5, w: 0.20, h: 0.30, trim: white, glass: '#5f7f74', arched: true });
  }
  facadeRows(B, { w: 3.8, d: 1.9, levels: [0.45, 0.95], faces: ['back', 'left', 'right'], spacing: 0.52,
    ww: 0.22, wh: 0.30, trim: white, glass: '#5f7f74', arched: true,
    skip: ({ face, u, y }) => face === 'back' && Math.abs(u) < 0.2 && y < 0.5 });
  // Rear entrance and repeated pilasters make the default-facing land side legible.
  facadeWindow(B, { z: -0.95, ry: Math.PI, y: 0.38, w: 0.32, h: 0.48, trim: white, glass: '#415b4e', arched: true });
  facadeWindow(B, { z: 1.40, y: 0.46, w: 0.42, h: 0.60, trim: white, glass: '#415b4e', arched: true });
  for (const face of [-1, 1]) for (const wx of [-1.85, -1.3, -0.75, 0.75, 1.3, 1.85]) B.main.box(wx, 0.1, face * 0.955, 0.045, 1.25, 0.035, white);
  B.main.box(0, 0.72, 0, 3.85, 0.035, 1.95, white);
  // two dragons on the ridge facing a moon (lưỡng long chầu nguyệt)
  const ridgeY = 1.42 + 0.75;
  B.lamp.put(P.disc(16), '#ffe9a8', { y: ridgeY + 0.32, sx: 0.32, sy: 0.32 });
  B.lamp.put(P.disc(16), '#ffe9a8', { y: ridgeY + 0.32, sx: 0.32, sy: 0.32, ry: Math.PI });
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(V(s * (0.95 - t * 0.75), ridgeY + 0.05 + Math.sin(t * Math.PI * 1.5) * 0.18 + t * 0.2, 0)); }
    B.main.put(normalizeGeometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.09, 6)), green, {}, true);
    B.main.sphere(s * 0.2, ridgeY + 0.3, 0, 0.12, green);
  }
  // flag
  B.main.cyl(1.6, 1.42, 0, 0.02, 1.4, '#e4e4e4', 5);
  B.main.box(1.78, 2.55, 0, 0.36, 0.24, 0.015, '#da251d');
  B.lamp.box(1.76, 2.63, 0.01, 0.08, 0.08, 0.01, '#ffde00');
  // quay with bollards along the water side (front)
  B.main.box(0, 0, 1.95, 4.6, 0.12, 0.5, '#b9b2a2');
  for (let i = -4; i <= 4; i++) B.main.cyl(i * 0.5, 0.12, 2.1, 0.04, 0.1, '#3d4248', 6);
  B.lamp.pop();
  B.lit.pop();
  B.glass.pop();
  B.main.pop();
}

/** A row of narrow canal-front shophouses (Bến Vân Đồn style), facing north toward the water. */
export function canalRow(B, { x0, x1, z, rng }) {
  const walls = ['#f3d9a4', '#efc27a', '#f6e7c8', '#e9b77c', '#f2cf8e', '#dfe6d4', '#f1d1c4', '#bfe0d6', '#f7c8a8'];
  let x = x0;
  while (x < x1 - 0.9) {
    const w = rng.range(0.9, 1.4), d = 1.6, f = rng.int(2, 4), H = f * 0.62 + 0.1;
    const cx = x + w / 2;
    for (const b of [B.main, B.glass, B.lit]) b.push(cx, 0, z, Math.PI);
    B.main.box(0, 0, 0, w - 0.03, H, d, rng.pick(walls));
    B.main.quad(0, 0.24, d / 2 + 0.005, w * 0.75, 0.46, '#3a342f');
    B.main.put(P.box(), rng.pick(['#d8483b', '#2f7fbf', '#3aa36b', '#f0b13b']), { y: 0.5, z: d / 2 + 0.15, sx: w * 0.9, sy: 0.025, sz: 0.3, rx: 0.32 });
    for (let k = 1; k < f; k++) {
      (rng.chance(0.4) ? B.lit : B.glass).quad(0, k * 0.62 + 0.34, d / 2 + 0.006, w * 0.45, 0.34, '#46535e');
      B.main.box(0, k * 0.62, d / 2 + 0.09, w * 0.85, 0.04, 0.18, '#e8e0cf');
    }
    B.main.put(P.prism(), rng.pick(['#e0763a', '#d9692f', '#c95f2e']), { y: H + 0.17, sx: d + 0.1, sy: 0.34, sz: w, ry: Math.PI / 2 });
    facadeRows(B, { w: w - 0.03, d, levels: Array.from({ length: f - 1 }, (_, k) => (k + 1) * 0.62 + 0.34),
      faces: ['back', 'left', 'right'], spacing: 0.70, ww: 0.22, wh: 0.32, shutter: '#5c7865' }, rng.fork('canal-secondary-facades'));
    for (const b of [B.main, B.glass, B.lit]) b.pop();
    x += w;
  }
}

export const LANDMARKS = {
  canalRow, chuongDuongBridge, khanhHoiBridge, nhaRong,
  vanMieu, hcmMausoleum, linhUng, oneLegPagoda, stJoseph, operaHouse, tranThiLyBridge,
  turtleTower, ngocSonTemple, hucBridge, penTower, lakePavilion,
  dragonBridge, hanRiverBridge, goldenBridge, ladyBuddha, danangCathedral,
  landmark81, officeTower, bitexco, notreDame, postOffice, cityHall, benThanh, thuThiemBridge, fountain,
};
