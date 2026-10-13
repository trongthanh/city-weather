import * as THREE from 'three';
import { P, hipRoof } from '../core/MeshBuilder.js';
import { officeWindowRow } from './officeWindows.js';
import { facadeRows } from './facades.js';

// Procedural building generators. Each draws in a local frame:
// footprint centred at origin, base at y=0, FRONT facing +z.

export const FLOOR = 0.62;

const DARK = '#3a342f';
const GLASS_DARK = '#46535e';

function windowAt(B, x, y, z, w, h, litProb, rng, ry = 0) {
  const lit = rng.chance(litProb);
  (lit ? B.lit : B.glass).quad(x, y, z, w, h, lit ? '#4b5763' : GLASS_DARK, ry);
}

/** Add windows on one face. face: 'front'|'back'|'left'|'right' */
function faceWindows(B, rng, w, d, face, floors, startFloor, opts) {
  const { cols, ww = 0.3, wh = 0.34, lit = 0.35, frame = null, shutter = null } = opts;
  const span = face === 'front' || face === 'back' ? w : d;
  const n = cols ?? Math.max(1, Math.floor(span / 0.62));
  for (let f = startFloor; f < floors; f++) {
    const y = f * FLOOR + FLOOR * 0.55;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n * span - span / 2;
      let x, z, ry;
      if (face === 'front') { x = u; z = d / 2 + 0.006; ry = 0; }
      else if (face === 'back') { x = -u; z = -d / 2 - 0.006; ry = Math.PI; }
      else if (face === 'right') { x = w / 2 + 0.006; z = -u; ry = Math.PI / 2; }
      else { x = -w / 2 - 0.006; z = u; ry = -Math.PI / 2; }
      windowAt(B, x, y, z, ww, wh, lit, rng, ry);
      if (frame) B.main.put(P.box(), frame, { x, y: y - wh / 2 - 0.02, z, sx: ww + 0.08, sy: 0.04, sz: 0.05, ry });
      if (shutter && face === 'front') {
        B.main.box(x - ww / 2 - 0.06, y - wh / 2, z, 0.1, wh, 0.03, shutter);
        B.main.box(x + ww / 2 + 0.06, y - wh / 2, z, 0.1, wh, 0.03, shutter);
      }
    }
  }
}

function waterTank(B, x, y, z) {
  B.main.box(x, y, z, 0.24, 0.1, 0.24, '#8a8f94');
  B.main.put(P.cyl(10), '#dfe4e8', { x, y: y + 0.24, z, sx: 0.24, sy: 0.32, sz: 0.24, rz: Math.PI / 2 });
}

function plants(B, rng, x, y, z, w) {
  const n = Math.max(1, Math.floor(w / 0.35));
  for (let i = 0; i < n; i++) {
    if (!rng.chance(0.7)) continue;
    const px = x - w / 2 + (i + 0.5) * (w / n);
    B.main.box(px, y, z, 0.1, 0.08, 0.1, '#a0563a');
    B.foliage.sphere(px, y + 0.13, z, 0.09, rng.pick(['#5f9a3c', '#77b043', '#e0457b', '#f2a33a']), 1, 6);
  }
}

// ------------------------------------------------------------ tube house
export function tubeHouse(B, s, rng, pal) {
  const { w, d, floors } = s;
  const H = floors * FLOOR + 0.12;
  const wall = s.wall || rng.pick(pal.walls);
  B.main.box(0, 0, 0, w, H, d, wall);
  // ground floor shop
  B.main.quad(0, 0.24, d / 2 + 0.005, w * 0.82, 0.46, DARK);
  const signC = rng.pick(pal.awnings);
  B.main.box(0, 0.5, d / 2, w * 0.86, 0.12, 0.05, signC);
  if (rng.chance(0.75)) B.main.put(P.box(), rng.pick(pal.awnings), { x: 0, y: 0.47, z: d / 2 + 0.17, sx: w * 0.92, sy: 0.025, sz: 0.34, rx: 0.32 });
  const shutter = rng.chance(0.55) ? rng.pick(pal.shutters) : null;
  const balcony = floors > 1 && rng.chance(0.6);
  const cols = w > 1.45 ? 2 : 1;
  faceWindows(B, rng, w, d, 'front', floors, 1, { cols, ww: 0.32, wh: 0.36, lit: s.lit ?? 0.45, shutter });
  if (balcony) {
    const railC = rng.pick(['#f4f1ea', '#3b3b3b', '#e8e0cf']);
    for (let f = 1; f < floors; f++) {
      const y = f * FLOOR;
      B.main.box(0, y, d / 2 + 0.11, w * 0.92, 0.04, 0.22, '#d8d2c6');
      B.main.box(0, y + 0.04, d / 2 + 0.21, w * 0.92, 0.18, 0.02, railC);
      if (rng.chance(0.45)) plants(B, rng, 0, y + 0.04, d / 2 + 0.12, w * 0.8);
    }
  }
  if (floors > 2 && rng.chance(0.35)) faceWindows(B, rng, w, d, 'right', floors, 1, { cols: 1, lit: 0.3 });
  const info = roof(B, s, rng, pal, w, d, H);
  // Extra elevations use their own stream: do not rearrange buildings/roofs/trees.
  facadeRows(B, { w, d, levels: Array.from({ length: floors - 1 }, (_, f) => (f + 1) * FLOOR + 0.34),
    faces: ['back', 'left', 'right'], ww: 0.24, wh: 0.33, shutter }, rng.fork('tube-secondary-facades'));
  facadeRows(B, { w, d, levels: [0.30], faces: ['back', 'left', 'right'], ww: 0.22, wh: 0.30 }, rng.fork('tube-ground-facades'));
  return info;
}

function roof(B, s, rng, pal, w, d, H) {
  const tile = s.roof === 'tile' || (s.roof !== 'flat' && rng.chance(pal.tileRoof ?? 0.5));
  const rc = rng.pick(pal.roofs);
  if (tile) {
    const rh = rng.range(0.32, 0.5);
    if (rng.chance(0.65)) {
      B.main.put(P.prism(), rc, { y: H + rh / 2, sx: d + 0.16, sy: rh, sz: w + 0.06, ry: Math.PI / 2 });
    } else {
      const g = hipRoof(w + 0.16, d + 0.16, rh);
      B.main.put(g, rc, { y: H }, true);
    }
    return { top: H + rh, tin: false };
  } else {
    // parapet
    const pc = '#e9e3d8';
    B.main.box(0, H, d / 2 - 0.03, w, 0.14, 0.06, pc);
    B.main.box(0, H, -d / 2 + 0.03, w, 0.14, 0.06, pc);
    B.main.box(w / 2 - 0.03, H, 0, 0.06, 0.14, d, pc);
    B.main.box(-w / 2 + 0.03, H, 0, 0.06, 0.14, d, pc);
    if (rng.chance(0.55)) waterTank(B, rng.range(-w / 4, w / 4), H, -d / 4);
    const room = rng.chance(0.45);
    if (room) {
      // rooftop room with small tiled roof
      const rw = w * 0.7, rd = d * 0.4;
      B.main.box(0, H, -d / 2 + rd / 2 + 0.1, rw, 0.42, rd, rng.pick(pal.walls));
      B.main.put(P.prism(), rc, { y: H + 0.42 + 0.13, z: -d / 2 + rd / 2 + 0.1, sx: rd + 0.12, sy: 0.26, sz: rw + 0.1, ry: Math.PI / 2 });
    }
    if (rng.chance(0.4)) plants(B, rng, 0, H, d / 2 - 0.2, w * 0.8);
    return { top: H, tin: !room };
  }
}

// ------------------------------------------------------------ colonial villa
export function villa(B, s, rng, pal) {
  const { w, d, floors } = s;
  const H = floors * FLOOR * 1.15 + 0.1;
  const wall = s.wall || rng.pick(pal.colonial || ['#efcd6e', '#f3d88a', '#f1e2b8']);
  B.main.box(0, 0, 0, w, H, d, wall);
  for (let f = 1; f <= floors; f++) B.main.box(0, f * FLOOR * 1.15 - 0.05, 0, w + 0.06, 0.07, d + 0.06, '#f7f3ea');
  const sh = rng.pick(pal.shutters);
  for (const face of ['front', 'left', 'right', 'back']) {
    const span = face === 'front' || face === 'back' ? w : d;
    const n = Math.max(1, Math.floor(span / 0.7));
    for (let f = 0; f < floors; f++) {
      const y = f * FLOOR * 1.15 + 0.38;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n * span - span / 2;
        const set = { front: [u, d / 2 + 0.01, 0], back: [-u, -d / 2 - 0.01, Math.PI], right: [w / 2 + 0.01, -u, Math.PI / 2], left: [-w / 2 - 0.01, u, -Math.PI / 2] }[face];
        windowAt(B, set[0], y, set[1], 0.26, 0.4, 0.4, rng, set[2]);
        B.main.push(set[0], 0, set[1], set[2]);
        for (const side of [-1, 1]) B.main.box(side * 0.19, y - 0.2, 0.01, 0.09, 0.4, 0.025, sh);
        B.main.box(0, y - 0.25, 0.01, 0.40, 0.04, 0.04, '#f7f3ea');
        B.main.box(0, y + 0.22, 0.01, 0.40, 0.04, 0.04, '#f7f3ea');
        B.main.pop();
      }
    }
  }
  // portico
  B.main.box(0, 0, d / 2 + 0.3, w * 0.4, 0.06, 0.6, '#f7f3ea');
  for (const sx of [-1, 1]) B.main.cyl(sx * w * 0.17, 0, d / 2 + 0.55, 0.05, FLOOR * 1.15, '#f7f3ea', 8);
  B.main.box(0, FLOOR * 1.15, d / 2 + 0.3, w * 0.42, 0.08, 0.64, '#f7f3ea');
  const g = hipRoof(w + 0.25, d + 0.25, Math.min(w, d) * 0.32);
  B.main.put(g, rng.pick(pal.roofs), { y: H }, true);
  return { top: H + Math.min(w, d) * 0.32, tin: false };
}

// ------------------------------------------------------------ mid-rise apartment / hotel
export function midrise(B, s, rng, pal) {
  const { w, d, floors } = s;
  const H = floors * FLOOR + 0.15;
  const wall = s.wall || rng.pick(pal.modern || pal.walls);
  B.main.box(0, 0, 0, w, H, d, wall);
  B.main.quad(0, 0.26, d / 2 + 0.005, w * 0.85, 0.48, '#4c4640');
  B.main.box(0, 0.54, d / 2, w * 0.7, 0.14, 0.05, rng.pick(pal.awnings));
  const lit = rng.range(0.15, 0.55);
  for (const face of ['front', 'back', 'left', 'right']) faceWindows(B, rng, w, d, face, floors, 1, { lit, ww: 0.3, wh: 0.32 });
  if (s.balconies ?? rng.chance(0.55)) {
    const gc = rng.chance(0.5) ? '#9fc3d6' : '#f6f4ef';
    for (let f = 1; f < floors; f++) {
      B.main.box(0, f * FLOOR, d / 2 + 0.1, w + 0.02, 0.05, 0.2, '#ece8e0');
      (gc === '#9fc3d6' ? B.glass : B.main).box(0, f * FLOOR + 0.05, d / 2 + 0.19, w + 0.02, 0.17, 0.02, gc);
    }
  }
  // roof
  B.main.box(0, H, 0, w, 0.12, d, '#d9d4cb');
  for (let i = 0; i < rng.int(1, 3); i++) waterTank(B, rng.range(-w / 3, w / 3), H + 0.12, rng.range(-d / 3, d / 3));
  if (rng.chance(0.4)) B.main.cyl(w / 3, H, -d / 3, 0.02, 0.9, '#888', 4);
  if (s.pool) B.glass.box(0, H + 0.12, d / 6, w * 0.5, 0.03, d * 0.3, '#3fb6d8');
  if (s.sign) B.lamp.box(0, H + 0.12, d / 2 - 0.1, w * 0.7, 0.3, 0.06, s.sign);
  return { top: H + 0.12, tin: !s.pool };
}

// ------------------------------------------------------------ glass tower
export function tower(B, s, rng, pal) {
  const { w, d, floors } = s;
  const H = floors * FLOOR;
  const glass = s.glass || rng.pick(pal.towerGlass || ['#5e8193', '#4f7385', '#6c8f9b', '#5a7a8c', '#3f6a6f']);
  const trim = rng.pick(['#e8ebee', '#cfd6dc', '#b8c2ca']);
  const podH = rng.range(1.0, 1.8);
  B.main.box(0, 0, 0, w + 0.5, podH, d + 0.5, rng.pick(['#d8d2c4', '#c9c4bb', '#e2ddd3']));
  B.glass.box(0, 0.08, 0, w + 0.52, podH * 0.5, d + 0.52, '#556a78');
  B.glass.box(0, podH, 0, w, H - podH, d, glass);
  // floor bands
  for (let f = 2; f * FLOOR < H - 0.2; f += 2) {
    if (f * FLOOR < podH) continue;
    B.main.box(0, f * FLOOR, 0, w + 0.03, 0.05, d + 0.03, trim);
  }
  // vertical fins on corners
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) B.main.box(sx * w / 2, podH, sz * d / 2, 0.12, H - podH, 0.12, trim);
  // Individually occupied office bays, not entire glowing floor-width strips.
  const lit = rng.range(0.15, 0.4);
  const windows = rng.fork('office-window-bays');
  for (let f = Math.ceil(podH / FLOOR); f < floors - 1; f++) {
    const y = f * FLOOR + FLOOR * 0.5;
    for (const face of ['front', 'back', 'right', 'left']) {
      // Retain the parent RNG sequence (including crown/building placement choices).
      const probability = rng.chance(lit) ? 0.5 : 0.18;
      officeWindowRow(B, windows, { face, w, d, y, height: FLOOR * 0.5, probability });
    }
  }
  // crown
  const crown = s.crown || rng.pick(['setback', 'spire', 'helipad', 'slant', 'flat']);
  if (crown === 'setback') {
    B.glass.box(0, H, 0, w * 0.7, 1.4, d * 0.7, glass);
    B.main.box(0, H + 1.4, 0, w * 0.72, 0.1, d * 0.72, trim);
    B.main.cyl(0, H + 1.5, 0, 0.04, 1.2, '#d0d0d0', 4);
  } else if (crown === 'spire') {
    B.main.box(0, H, 0, w * 0.5, 0.5, d * 0.5, trim);
    B.main.cyl(0, H + 0.5, 0, 0.08, 2.2, '#e5e7ea', 6, 0.02);
    B.lamp.sphere(0, H + 2.75, 0, 0.07, '#ff6b5a');
  } else if (crown === 'helipad') {
    B.main.box(0, H, 0, w, 0.25, d, trim);
    B.main.cyl(0, H + 0.25, 0, Math.min(w, d) * 0.42, 0.06, '#7d858c', 16);
    B.main.flat(0, H + 0.32, 0, 0.35, 0.06, '#f2f2f2');
  } else if (crown === 'slant') {
    B.glass.put(P.prism(), glass, { y: H + 0.8, sx: w, sy: 1.6, sz: d });
  } else {
    B.main.box(0, H, 0, w, 0.2, d, trim);
    B.main.box(w * 0.15, H + 0.2, 0, w * 0.4, 0.4, d * 0.4, '#a9b0b6');
  }
}

// ------------------------------------------------------------ beach hotel
export function hotel(B, s, rng, pal) {
  const { w, d, floors } = s;
  const H = floors * FLOOR + 0.15;
  const wall = rng.pick(['#f6f4ee', '#eef3f5', '#f4ece0']);
  B.main.box(0, 0, 0, w, H, d, wall);
  const bg = rng.pick(['#6fb4d2', '#4f97b8', '#8cc6dc', '#5aa8a5']);
  const lit = rng.range(0.2, 0.5);
  for (let f = 1; f < floors; f++) {
    const y = f * FLOOR;
    B.glass.quad(0, y + FLOOR * 0.55, d / 2 + 0.005, w * 0.9, FLOOR * 0.62, GLASS_DARK);
    if (rng.chance(lit)) B.lit.quad(rng.range(-w / 4, w / 4), y + FLOOR * 0.55, d / 2 + 0.008, w * 0.3, FLOOR * 0.55, '#4b5763');
    B.main.box(0, y, d / 2 + 0.14, w, 0.05, 0.28, '#f8f8f6');
    B.glass.box(0, y + 0.05, d / 2 + 0.27, w, 0.2, 0.02, bg);
  }
  faceWindows(B, rng, w, d, 'left', floors, 1, { lit });
  faceWindows(B, rng, w, d, 'right', floors, 1, { lit });
  faceWindows(B, rng, w, d, 'back', floors, 1, { lit });
  B.main.box(0, H, 0, w + 0.1, 0.12, d + 0.1, '#e4e0d8');
  B.glass.box(0, H + 0.12, 0, w * 0.6, 0.04, d * 0.45, '#3fb6d8');
  B.main.box(-w / 2 + 0.3, H + 0.12, -d / 2 + 0.3, 0.5, 0.45, 0.5, wall);
  if (rng.chance(0.6)) B.lamp.box(0, H + 0.13, -d / 2 + 0.06, w * 0.6, 0.28, 0.06, rng.pick(['#ff6f61', '#38b6ff', '#ffd25c']));
  return { top: H + 0.12, tin: false };
}

// ------------------------------------------------------------ small kiosk / pavilion
export function kiosk(B, s, rng, pal) {
  const { w, d } = s;
  B.main.box(0, 0, 0, w, 0.5, d, rng.pick(pal.walls));
  B.main.quad(0, 0.24, d / 2 + 0.005, w * 0.6, 0.36, DARK);
  B.glass.quad(0, 0.26, d / 2 + 0.012, w * 0.42, 0.24, GLASS_DARK);
  const g = hipRoof(w + 0.2, d + 0.2, 0.3);
  B.main.put(g, rng.pick(pal.roofs), { y: 0.5 }, true);
  facadeRows(B, { w, d, levels: [0.27], faces: ['back', 'left', 'right'], ww: 0.20, wh: 0.22 }, rng.fork('kiosk-secondary-facades'));
  return { top: 0.8, tin: false };
}


// ------------------------------------------------------------ French-colonial shophouse (phố cổ)
export function shophouse(B, s, rng, pal) {
  const { w, d, floors } = s;
  const FH = FLOOR * 1.15;
  const H = floors * FH + 0.1;
  const wall = s.wall || rng.pick(pal.colonial || ['#efcd6e', '#f3d88a', '#f1e2b8']);
  const trim = rng.pick(['#fbf6ea', '#f4ecd8', '#efe6d2']);
  const shutter = rng.pick(['#4f7d5a', '#3f6b5a', '#5d8c6e', '#7a5a3c', '#3f6b7a']);
  const iron = '#2f3132';
  B.main.box(0, 0, 0, w, H, d, wall);
  // pilasters + floor cornices
  for (const sx of [-1, 1]) B.main.box(sx * (w / 2 - 0.07), 0, d / 2 + 0.03, 0.14, H, 0.07, trim);
  for (let f = 1; f <= floors; f++) B.main.box(0, f * FH - 0.06, d / 2 + 0.04, w + 0.08, 0.11, 0.14, trim);
  const bays = w > 1.9 ? 3 : w > 1.35 ? 2 : 1;
  const bw = (w - 0.2) / bays;
  // ground floor: arched shop openings with awning
  for (let i = 0; i < bays; i++) {
    const x = -w / 2 + 0.1 + bw * (i + 0.5);
    B.main.quad(x, 0.25, d / 2 + 0.006, bw * 0.7, 0.5, '#3a2f27');
    B.main.put(P.disc(12), '#3a2f27', { x, y: 0.5, z: d / 2 + 0.006, sx: bw * 0.7, sy: bw * 0.7 });
  }
  if (rng.chance(0.6)) B.main.put(P.box(), rng.pick(pal.awnings), { y: 0.66, z: d / 2 + 0.15, sx: w * 0.9, sy: 0.025, sz: 0.3, rx: 0.3 });
  // upper floors: tall windows with louvred shutters + wrought-iron balcony
  for (let f = 1; f < floors; f++) {
    const y = f * FH;
    for (let i = 0; i < bays; i++) {
      const x = -w / 2 + 0.1 + bw * (i + 0.5);
      const lit = rng.chance(s.lit ?? 0.35);
      (lit ? B.lit : B.glass).quad(x, y + 0.3, d / 2 + 0.007, bw * 0.38, 0.42, lit ? '#4b5763' : '#46535e');
      B.main.box(x - bw * 0.31, y + 0.07, d / 2 + 0.01, bw * 0.24, 0.48, 0.04, shutter);
      B.main.box(x + bw * 0.31, y + 0.07, d / 2 + 0.01, bw * 0.24, 0.48, 0.04, shutter);
      B.main.box(x, y + 0.53, d / 2 + 0.02, bw * 0.55, 0.05, 0.05, trim); // window hood
    }
    if (rng.chance(0.8)) {
      B.main.box(0, y, d / 2 + 0.13, w * 0.92, 0.05, 0.26, trim);
      B.main.box(0, y + 0.05, d / 2 + 0.25, w * 0.92, 0.18, 0.025, iron);
      B.main.box(0, y + 0.23, d / 2 + 0.25, w * 0.92, 0.03, 0.04, iron);
      if (rng.chance(0.5)) plants(B, rng, 0, y + 0.04, d / 2 + 0.1, w * 0.8);
    }
  }
  // parapet with central pediment, tiled roof behind
  B.main.box(0, H, d / 2 - 0.04, w + 0.06, 0.26, 0.12, trim);
  if (rng.chance(0.6)) B.main.put(P.disc(14), trim, { y: H + 0.2, z: d / 2 - 0.04, sx: Math.min(0.7, w * 0.4), sy: 0.36 });
  else B.main.put(P.prism(), trim, { y: H + 0.3, z: d / 2 - 0.04, sx: Math.min(0.8, w * 0.45), sy: 0.2, sz: 0.08 });
  const rc = rng.pick(pal.roofs);
  B.main.put(P.prism(), rc, { y: H + 0.22, z: -0.05, sx: d * 0.92, sy: 0.44, sz: w + 0.04, ry: Math.PI / 2 });
  facadeRows(B, { w, d, levels: Array.from({ length: floors }, (_, f) => f * FH + 0.33),
    faces: ['back', 'left', 'right'], spacing: 0.72, ww: 0.23, wh: 0.34, trim, shutter, arched: true }, rng.fork('shop-secondary-facades'));
  return { top: H + 0.44, tin: false };
}

export const BUILDERS = { tube: tubeHouse, villa, midrise, tower, hotel, kiosk, shop: shophouse };
