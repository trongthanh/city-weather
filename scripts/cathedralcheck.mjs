import assert from 'node:assert/strict';
import { Box3, Matrix4, Vector3 } from 'three';
import hanoi from '../src/cities/hanoi.js';
import { RNG } from '../src/core/rng.js';
import { MeshBuilder } from '../src/core/MeshBuilder.js';
import { BUILDERS } from '../src/world/buildings.js';
import { reginaPacis } from '../src/world/landmarks.js';

const ctx = new Proxy({}, { get: (_, k) => k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {} };
const { generateCity } = await import('../src/world/CityGenerator.js');
const layout = hanoi.layout(new RNG(hanoi.seed).fork('layout'));
const limit = layout.buildingFloorLimits[0];
let records = new Map();
for (const [kind, fn] of Object.entries(BUILDERS)) {
  BUILDERS[kind] = (B, spec, rng, pal) => {
    const pos = new Vector3().setFromMatrixPosition(B.main.frame);
    const starts = Object.values(B).map(b => b.parts.length);
    const info = fn(B, spec, rng, pal);
    const box = new Box3();
    Object.values(B).forEach((b, i) => {
      for (const g of b.parts.slice(starts[i])) {
        g.computeBoundingBox(); box.union(g.boundingBox);
      }
    });
    records.set(`${pos.x},${pos.z}`, { kind, spec, box: [box.min.toArray(), box.max.toArray()] });
    return info;
  };
}
const baseline = generateCity({ ...hanoi, layout: rng => ({ ...hanoi.layout(rng), buildingFloorLimits: [] }) });
const original = records;
records = new Map();
const city = generateCity(hanoi);
assert.equal(records.size, original.size, 'all original houses retain their lots');
let lowered = 0;
for (const [key, actual] of records) {
  const before = original.get(key);
  assert.ok(before, `no relocated house: ${key}`);
  if (actual.spec.floors !== before.spec.floors) {
    lowered++;
    const [x, z] = key.split(',').map(Number);
    assert.ok(Math.abs(x - limit.x) < limit.w / 2 && Math.abs(z - limit.z) < limit.d / 2);
    assert.ok(before.spec.floors > 1, 'unlimited foreground house would obscure the forecourt');
    assert.equal(actual.spec.floors, 1, 'entrance-blocking house becomes one storey');
    assert.ok(actual.box[1][1] < 1.3, 'actual tiled roof is lowered, not just metadata');
    assert.ok(before.box[1][1] > 1.3, 'unlimited roof would exceed the one-storey height');
  } else assert.deepEqual(actual, before, `unrelated building unchanged: ${key}`);
}
assert.equal(lowered, 1, 'exactly one house lowered');
assert.deepEqual(city.treeSpots, baseline.treeSpots, 'tree placement preserved');
assert.deepEqual(city.roofs, baseline.roofs, 'dynamic roofs preserved');

const church = layout.landmarks.find(l => l.type === 'stJoseph');
const B = { main: new MeshBuilder('main') };
B.main.push(church.x, 0, church.z, church.ry, church.scale);
reginaPacis(B, { x: 0, y: 0.04, z: 2.07, scale: 0.85 });
assert.equal(B.main.stack.length, 2, 'statue balances its nested transform');
B.main.pop();
const inverse = new Matrix4().makeRotationY(church.ry);
inverse.setPosition(church.x, 0, church.z).scale(new Vector3(church.scale, church.scale, church.scale)).invert();
const statueBox = new Box3(), local = new Vector3();
for (const g of B.main.parts) {
  g.computeBoundingBox(); statueBox.union(g.boundingBox);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    local.fromBufferAttribute(p, i).applyMatrix4(inverse);
    assert.ok(local.toArray().every(Number.isFinite));
    assert.ok(Math.abs(local.x) < 0.95 && local.z > 1.4 && local.z < 2.4, 'whole statue stays on the forecourt');
    assert.ok(local.y >= 0.04 - 1e-6, 'pedestal rests on paving');
  }
  g.dispose();
}
assert.ok(statueBox.min.x > -12.7 && statueBox.max.x < -11.8, 'statue in front of east-facing entrance');
assert.ok(statueBox.max.y > 1.6 && statueBox.max.y < 1.8, 'readable miniature statue height');
city.dispose(); baseline.dispose();
console.log('Cathedral foreground checks passed: exactly one real one-storey house, unchanged other lots/trees/roofs, finite Regina Pacis statue on the forecourt with balanced transforms.');
