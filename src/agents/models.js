import * as THREE from 'three';
import { MeshBuilder, P, normalizeGeometry } from '../core/MeshBuilder.js';

// Low-poly agent models (facing +z, base at y=0). White parts take the per-instance colour.

const W = '#ffffff';
const DARK = '#2b2b2e';
const SKIN = '#e9b48f';
const HAIR = '#2a211c';

function wheel(b, x, y, z, r, w) {
  b.put(P.cyl(10), DARK, { x, y, z, sx: r * 2, sy: w, sz: r * 2, rz: Math.PI / 2 });
}

function person(b, { seated = false, y0 = 0 } = {}) {
  if (!seated) {
    b.box(-0.035, y0, 0, 0.05, 0.17, 0.06, '#3b4660');
    b.box(0.035, y0, 0, 0.05, 0.17, 0.06, '#3b4660');
  } else {
    b.box(0, y0, 0.06, 0.12, 0.05, 0.14, '#3b4660');
  }
  const ty = seated ? y0 + 0.02 : y0 + 0.17;
  b.box(0, ty, 0, 0.15, 0.17, 0.09, W);
  b.box(-0.095, ty + 0.03, 0, 0.04, 0.13, 0.05, W);
  b.box(0.095, ty + 0.03, 0, 0.04, 0.13, 0.05, W);
  b.sphere(0, ty + 0.235, 0, 0.06, SKIN, 1, 8);
  b.sphere(0, ty + 0.255, -0.01, 0.062, HAIR, 0.75, 8);
}

export function buildModels() {
  const g = {};
  let b;

  // ---- motorbike (bike + rider separately so they tint differently)
  b = new MeshBuilder();
  wheel(b, 0, 0.07, 0.17, 0.07, 0.035);
  wheel(b, 0, 0.07, -0.17, 0.07, 0.035);
  b.box(0, 0.08, -0.02, 0.11, 0.1, 0.3, W);
  b.box(0, 0.18, -0.06, 0.12, 0.05, 0.2, DARK);
  b.box(0, 0.08, 0.14, 0.1, 0.18, 0.05, W);
  b.box(0, 0.26, 0.15, 0.2, 0.02, 0.02, DARK);
  b.box(0, 0.2, 0.17, 0.05, 0.04, 0.02, '#fff6c8');
  g.bike = b.toGeometry();

  b = new MeshBuilder();
  b.box(-0.04, 0.12, 0.02, 0.05, 0.08, 0.16, '#3b4660');
  b.box(0.04, 0.12, 0.02, 0.05, 0.08, 0.16, '#3b4660');
  b.box(0, 0.2, -0.04, 0.15, 0.17, 0.09, W);
  b.box(0, 0.26, 0.06, 0.18, 0.04, 0.12, W);
  b.sphere(0, 0.42, -0.03, 0.06, SKIN, 1, 8);
  b.sphere(0, 0.445, -0.035, 0.068, W, 0.8, 8); // helmet
  g.rider = b.toGeometry();

  b = new MeshBuilder();
  b.put(P.cone(10), W, { y: 0.27, z: 0.02, sx: 0.34, sy: 0.32, sz: 0.5 });
  g.poncho = b.toGeometry();

  // ---- car
  b = new MeshBuilder();
  for (const [x, z] of [[-0.22, 0.3], [0.22, 0.3], [-0.22, -0.3], [0.22, -0.3]]) wheel(b, x, 0.08, z, 0.08, 0.06);
  b.box(0, 0.06, 0, 0.48, 0.16, 0.98, W);
  b.box(0, 0.22, -0.06, 0.42, 0.15, 0.52, W);
  b.box(0, 0.235, -0.06, 0.435, 0.11, 0.42, '#38434d');
  b.box(0, 0.235, -0.06, 0.4, 0.11, 0.535, '#38434d');
  b.box(-0.16, 0.13, 0.495, 0.09, 0.04, 0.01, '#fff6d0');
  b.box(0.16, 0.13, 0.495, 0.09, 0.04, 0.01, '#fff6d0');
  b.box(-0.16, 0.13, -0.495, 0.09, 0.04, 0.01, '#d63a2f');
  b.box(0.16, 0.13, -0.495, 0.09, 0.04, 0.01, '#d63a2f');
  g.car = b.toGeometry();

  // ---- bus
  b = new MeshBuilder();
  for (const z of [0.7, -0.7]) for (const x of [-0.27, 0.27]) wheel(b, x, 0.09, z, 0.09, 0.07);
  b.box(0, 0.07, 0, 0.6, 0.55, 2.1, W);
  b.box(0, 0.33, 0, 0.61, 0.17, 1.9, '#33404a');
  b.box(0, 0.33, 1.04, 0.5, 0.2, 0.03, '#33404a');
  b.box(0, 0.62, 0, 0.56, 0.04, 1.9, '#e8e8e8');
  b.box(0, 0.5, 1.055, 0.35, 0.06, 0.01, '#ffcc33');
  g.bus = b.toGeometry();

  // ---- cyclo (xích lô)
  b = new MeshBuilder();
  wheel(b, -0.2, 0.08, 0.2, 0.08, 0.025);
  wheel(b, 0.2, 0.08, 0.2, 0.08, 0.025);
  wheel(b, 0, 0.09, -0.3, 0.09, 0.025);
  b.box(0, 0.12, 0.2, 0.36, 0.14, 0.24, W);
  b.box(0, 0.26, 0.1, 0.36, 0.18, 0.04, W);
  b.put(P.hemi(10), '#2f6b4f', { y: 0.36, z: 0.15, sx: 0.42, sy: 0.25, sz: 0.3 });
  b.beam(new THREE.Vector3(0, 0.12, 0.1), new THREE.Vector3(0, 0.25, -0.25), 0.015, DARK, 4);
  b.push(0, 0.15, -0.22);
  person(b, { seated: true, y0: 0.08 });
  b.pop();
  g.cyclo = b.toGeometry();

  // ---- pedestrian
  b = new MeshBuilder();
  person(b);
  g.ped = b.toGeometry();

  b = new MeshBuilder();
  b.put(P.cone(10), '#efe0b4', { y: 0.47, sx: 0.22, sy: 0.08, sz: 0.22 });
  g.hat = b.toGeometry();

  b = new MeshBuilder();
  b.cyl(0.07, 0.25, 0.04, 0.008, 0.38, '#333', 4);
  b.put(P.hemi(10), W, { x: 0.07, y: 0.58, z: 0.04, sx: 0.46, sy: 0.16, sz: 0.46 });
  g.umbrella = b.toGeometry();

  // ---- dog
  b = new MeshBuilder();
  for (const [x, z] of [[-0.04, 0.08], [0.04, 0.08], [-0.04, -0.08], [0.04, -0.08]]) b.box(x, 0, z, 0.03, 0.08, 0.03, W);
  b.box(0, 0.07, 0, 0.09, 0.08, 0.24, W);
  b.box(0, 0.12, 0.14, 0.08, 0.08, 0.1, W);
  b.box(0, 0.11, 0.2, 0.05, 0.04, 0.05, '#e3d3c3');
  b.box(-0.03, 0.17, 0.13, 0.02, 0.04, 0.02, W);
  b.box(0.03, 0.17, 0.13, 0.02, 0.04, 0.02, W);
  b.put(P.box(), W, { y: 0.14, z: -0.14, sx: 0.02, sy: 0.02, sz: 0.1, rx: 0.8 });
  g.dog = b.toGeometry();

  // ---- cat
  b = new MeshBuilder();
  for (const [x, z] of [[-0.025, 0.05], [0.025, 0.05], [-0.025, -0.05], [0.025, -0.05]]) b.box(x, 0, z, 0.02, 0.06, 0.02, W);
  b.box(0, 0.05, 0, 0.06, 0.06, 0.16, W);
  b.sphere(0, 0.11, 0.09, 0.04, W, 1, 6);
  b.cone(-0.02, 0.13, 0.09, 0.012, 0.03, W, 4);
  b.cone(0.02, 0.13, 0.09, 0.012, 0.03, W, 4);
  b.put(P.box(), W, { y: 0.13, z: -0.1, sx: 0.015, sy: 0.12, sz: 0.015, rx: -0.3 });
  g.cat = b.toGeometry();

  // ---- boat
  b = new MeshBuilder();
  b.box(0, -0.05, 0, 0.45, 0.17, 1.3, W);
  b.box(0, -0.05, 0.62, 0.32, 0.17, 0.32, W, Math.PI / 4);
  b.box(0, 0.12, -0.15, 0.36, 0.22, 0.6, '#f4f1e8');
  b.box(0, 0.25, -0.15, 0.3, 0.06, 0.55, '#33404a');
  b.box(0, 0.34, -0.15, 0.4, 0.03, 0.66, '#d84a3a');
  g.boat = b.toGeometry();

  // ---- basket boat (thúng chai)
  b = new MeshBuilder();
  b.put(P.hemi(12), '#5f4a32', { y: 0.12, sx: 0.55, sy: 0.3, sz: 0.55, rx: Math.PI });
  b.cyl(0, 0.11, 0, 0.28, 0.03, '#7a6040', 12);
  b.push(0, 0.02, 0);
  person(b, { seated: true, y0: 0.06 });
  b.pop();
  g.basket = b.toGeometry();

  // ---- jet ski with rider (hull tinted per instance)
  b = new MeshBuilder();
  b.box(0, -0.04, 0, 0.26, 0.1, 0.62, W);
  b.box(0, -0.04, 0.33, 0.18, 0.08, 0.12, W, Math.PI / 4);
  b.box(0, 0.06, -0.06, 0.16, 0.07, 0.3, DARK);
  b.box(0, 0.12, 0.16, 0.22, 0.03, 0.03, DARK);
  b.box(0, -0.06, -0.33, 0.2, 0.05, 0.06, '#f4f4f4'); // wake foam
  g.jetski = b.toGeometry().scale(1.35, 1.35, 1.35);
  b = new MeshBuilder();
  b.box(-0.04, 0.08, 0.0, 0.05, 0.08, 0.16, '#2b4a7a');
  b.box(0.04, 0.08, 0.0, 0.05, 0.08, 0.16, '#2b4a7a');
  b.box(0, 0.14, -0.04, 0.15, 0.16, 0.09, '#f2a33a'); // life vest
  b.beam(new THREE.Vector3(-0.07, 0.24, -0.02), new THREE.Vector3(-0.1, 0.14, 0.15), 0.02, SKIN, 4);
  b.beam(new THREE.Vector3(0.07, 0.24, -0.02), new THREE.Vector3(0.1, 0.14, 0.15), 0.02, SKIN, 4);
  b.sphere(0, 0.33, -0.03, 0.055, SKIN, 1, 8);
  b.sphere(0, 0.35, -0.04, 0.058, HAIR, 0.7, 8);
  g.jetRider = b.toGeometry().scale(1.35, 1.35, 1.35);

  // ---- surfer: board (tinted) + standing rider in a surfing stance
  b = new MeshBuilder();
  b.put(P.sphere(10, 6), W, { y: -0.01, sx: 0.16, sy: 0.03, sz: 0.62 });
  b.box(0, 0.0, 0, 0.02, 0.012, 0.5, '#ffffff');
  g.surfboard = b.toGeometry();
  b = new MeshBuilder();
  b.push(0, 0, 0, Math.PI / 2);
  b.put(P.box(), '#2c3e50', { x: -0.06, y: 0.08, sx: 0.05, sy: 0.17, sz: 0.06, rz: 0.25 });
  b.put(P.box(), '#2c3e50', { x: 0.06, y: 0.08, sx: 0.05, sy: 0.17, sz: 0.06, rz: -0.25 });
  b.box(0, 0.16, 0, 0.14, 0.16, 0.09, '#1f8fbf'); // rash guard
  b.put(P.box(), SKIN, { x: -0.13, y: 0.27, sx: 0.16, sy: 0.035, sz: 0.04, rz: 0.2 });
  b.put(P.box(), SKIN, { x: 0.13, y: 0.27, sx: 0.16, sy: 0.035, sz: 0.04, rz: -0.2 });
  b.sphere(0, 0.39, 0, 0.055, SKIN, 1, 8);
  b.sphere(0, 0.41, -0.01, 0.058, '#5a3b22', 0.7, 8);
  b.pop();
  g.surfer = b.toGeometry();

  // ---- kite (diamond sail tinted per instance, with tail ribbons)
  b = new MeshBuilder();
  const kite = new THREE.BufferGeometry();
  kite.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.32, 0, 0.22, 0.05, 0, 0, -0.32, 0, 0, 0.32, 0, 0, -0.32, 0, -0.22, 0.05, 0], 3));
  // Front and back faces: the sail must remain visible as wind turns it.
  const front = Array.from(kite.attributes.position.array);
  kite.setAttribute('position', new THREE.Float32BufferAttribute([
    ...front,
    ...front.slice(6, 9), ...front.slice(3, 6), ...front.slice(0, 3),
    ...front.slice(15, 18), ...front.slice(12, 15), ...front.slice(9, 12),
  ], 3));
  kite.computeVertexNormals();
  b.put(normalizeGeometry(kite), W, {}, true);
  b.put(P.box(), '#3a3a3a', { y: 0, z: 0.005, sx: 0.012, sy: 0.64, sz: 0.012 });
  b.put(P.box(), '#3a3a3a', { y: 0.05, z: 0.005, sx: 0.44, sy: 0.012, sz: 0.012 });
  for (let i = 0; i < 5; i++) b.put(P.box(), i % 2 ? '#ffffff' : '#ffd23f', { x: Math.sin(i * 1.2) * 0.03, y: -0.38 - i * 0.09, sx: 0.06, sy: 0.05, sz: 0.01, rz: i * 0.5 });
  g.kite = b.toGeometry().scale(1.6, 1.6, 1.6);

  // ---- bird (wings flap via y-scale)
  b = new MeshBuilder();
  b.box(0, -0.02, 0, 0.04, 0.04, 0.14, '#3a3a3a');
  b.put(P.box(), '#4a4a4a', { x: -0.1, y: 0.03, sx: 0.18, sy: 0.01, sz: 0.08, rz: 0.45 });
  b.put(P.box(), '#4a4a4a', { x: 0.1, y: 0.03, sx: 0.18, sy: 0.01, sz: 0.08, rz: -0.45 });
  g.bird = b.toGeometry();

  // ---- headlight beam (flat on road, in front)
  const beam = new THREE.PlaneGeometry(1, 1);
  beam.rotateX(-Math.PI / 2);
  beam.translate(0, 0.03, 0.5);
  g.beam = beam;

  // ---- debris (sheets/branches/leaves)
  b = new MeshBuilder();
  b.box(0, 0, 0, 0.2, 0.02, 0.14, W);
  g.debris = b.toGeometry();

  return g;
}
