import assert from 'node:assert/strict';
import { Color, Scene, Vector3 } from 'three';
import hanoi from '../src/cities/hanoi.js';
import { RNG, hashString } from '../src/core/rng.js';
import { MeshBuilder } from '../src/core/MeshBuilder.js';
import { Field, Occupancy } from '../src/world/Field.js';
import { prepareRoads, buildRoads } from '../src/world/roads.js';

const ctx = new Proxy({}, { get: (_, k) => k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {} };
const { AgentSystem } = await import('../src/agents/AgentSystem.js');
const layout = hanoi.layout(new RNG(hanoi.seed).fork('layout'));
assert.ok(!layout.landmarks.some(l => l.type === 'lakePavilion'), 'no invented pavilion in Hoàn Kiếm');
for (const type of ['turtleTower', 'ngocSonTemple', 'hucBridge', 'penTower']) {
  assert.equal(layout.landmarks.filter(l => l.type === type).length, 1, `preserve the real lake landmark: ${type}`);
}
const field = new Field(layout, hashString(hanoi.seed));
const roads = prepareRoads(layout.roads, field);
const ring = roads.find(r => r.name === 'ring');
const crossings = path => {
  const p = path.points, n = p.length;
  let count = 0;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    const a = p[i], b = p[(i + 1) % n], c = p[j], d = p[(j + 1) % n];
    const dx = b.x - a.x, dz = b.z - a.z, ex = d.x - c.x, ez = d.z - c.z, det = dx * ez - dz * ex;
    if (Math.abs(det) < 1e-9) continue;
    const wx = c.x - a.x, wz = c.z - a.z, t = (wx * ez - wz * ex) / det, u = (wx * dz - wz * dx) / det;
    if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6) count++;
  }
  return count;
};
for (const offset of [0, -ring.hw, ring.hw, -ring.hw - ring.sw, ring.hw + ring.sw]) {
  assert.equal(crossings(ring.path.offset(offset)), 0, `ring/sidewalk contour at offset ${offset} has no self-crossing`);
}
for (let i = 0; i < ring.path.points.length; i++) {
  const p = ring.path.points, a = p[(i - 1 + p.length) % p.length], b = p[i], c = p[(i + 1) % p.length];
  const area2 = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
  const radius = a.distanceTo(b) * b.distanceTo(c) * c.distanceTo(a) / (2 * area2 || 1e-9);
  assert.ok(radius > ring.hw + ring.sw, 'bend radius clears the entire road/sidewalk width');
}
const B = { main: new MeshBuilder('main'), lamp: new MeshBuilder('lamp') };
buildRoads(roads, field, B, new Occupancy(), new RNG('ring-surfaces'), []);
const g = B.main.parts.at(-1), p = g.attributes.position, col = g.attributes.color, n = g.attributes.normal;
const sidewalk = new Color('#cfc6b8');
let sidewalkChecks = 0;
for (let i = 0; i < p.count; i += 3) {
  if (n.getY(i) < 0.99 || Math.abs(col.getX(i) - sidewalk.r) > 1e-6 || Math.abs(col.getY(i) - sidewalk.g) > 1e-6 || Math.abs(col.getZ(i) - sidewalk.b) > 1e-6) continue;
  const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
  const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
  if (x < 5 || x > 9 || z < -11 || z > -6) continue;
  assert.ok(ring.path.distance(x, z) > ring.hw - 0.04, 'actual sidewalk triangles do not fold across the local asphalt');
  sidewalkChecks++;
}
assert.ok(sidewalkChecks > 10, 'inspected the actual repaired sidewalk surface');
for (const b of Object.values(B)) for (const part of b.parts) part.dispose();

// Drive the actual ring in both directions at several frame rates. This is a
// geometric hairpin regression, not a full multi-vehicle intersection simulation.
const agents = new AgentSystem(new Scene());
agents._roadBuckets = new Map();
agents._planTurn = () => {}; // stay on this road; junction connectors have separate tests
const centre = ring.path.nearest(6.83, -8.70).s;
let runs = 0;
for (const name of ['motorbike', 'car', 'bus', 'cyclo']) for (const dir of [-1, 1]) for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
  const T = agents.types[name], a = { active: true, leaving: false, road: ring, path: ring.path, dir,
    s: centre - dir * 3, lat: name === 'motorbike' ? 0.9 : name === 'cyclo' ? 1.0 : 0.55,
    vmax: 2, v: 2, turnPlan: null, turn: null, junctionMemory: new Set(), fade: 1, vis: 1,
    off: new Vector3(), yaw: null, phase: 0, ponchoT: 0.5 };
  let before = agents._roadPos(a, new Vector3()), yaw = null;
  for (let frame = 0; frame < 3 / dt; frame++) {
    agents.setDt(dt);
    agents._updRoad(T, a, dt, { rain: 0, wind: 0, night: 0 });
    agents._write(T, a, 0, { rain: 0, wind: 0, night: 0 });
    const next = agents._roadPos(a, new Vector3());
    assert.ok((next.z - before.z) * dir > 0, `${name}: no reversal/spiral through the northeast bend`);
    assert.ok(next.distanceTo(before) < 3 * dt, `${name}: continuous bounded motion`);
    if (yaw !== null) assert.ok(Math.abs(Math.atan2(Math.sin(a.yaw - yaw), Math.cos(a.yaw - yaw))) < 0.12, `${name}: no vortex-like heading spin`);
    assert.ok(T.parts[0].mesh.instanceMatrix.array.every(Number.isFinite));
    before = next; yaw = a.yaw;
  }
  assert.ok((a.s - centre) * dir > 2.9, 'traversed the entire affected bend');
  runs++;
}
console.log(`Lake-ring checks passed: no road/sidewalk self-crossings, safe bend radius, ${sidewalkChecks} actual sidewalk triangles and ${runs} smooth bidirectional vehicle runs at 30/60/120 FPS.`);
