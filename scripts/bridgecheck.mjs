import assert from 'node:assert/strict';
import { Box3 } from 'three';
import hanoi from '../src/cities/hanoi.js';
import { RNG, hashString } from '../src/core/rng.js';
import { MeshBuilder } from '../src/core/MeshBuilder.js';
import { Field, Occupancy, HALF } from '../src/world/Field.js';
import { prepareRoads, buildRoads } from '../src/world/roads.js';
import { chuongDuongBridge } from '../src/world/landmarks.js';

const layout = hanoi.layout(new RNG(hanoi.seed).fork('layout'));
const field = new Field(layout, hashString(hanoi.seed));
const roads = prepareRoads(layout.roads, field);
const B = Object.fromEntries(['main', 'glass', 'lit', 'lamp', 'neon', 'foliage'].map(k => [k, new MeshBuilder(k)]));
buildRoads(roads, field, B, new Occupancy(), new RNG('bridge-surfaces'), []);
const r = roads.find(q => q.name === 'Cầu Chương Dương');
const L = layout.landmarks.find(l => l.type === 'chuongDuongBridge');
assert.equal(L.z, -4.5, 'crossing moved north of the lake middle');
assert.equal(r.path.points.at(-1).z, L.z, 'road and steel structure share the crossing');
assert.equal(r.path.points.at(-1).x, HALF, 'road continues to the eastern tile edge');
assert.ok(r.junctions.some(j => j.to.path.closed), 'approach remains joined to the lake ring');
assert.ok(r.junctions.some(j => j.to.name?.startsWith('Trần Quang Khải')), 'dyke road connection retained');
assert.ok(r.def.noRail && r.def.noPiers && r.def.lamps === false, 'no duplicate generic bridge furniture');

// Inspect actual model primitives, not just the landmark parameters.
for (const b of Object.values(B)) { for (const g of b.parts) g.dispose(); b.parts = []; }
const members = [];
const beam = B.main.beam.bind(B.main);
B.main.beam = (a, b, radius, color, segments) => {
  members.push({ a: a.clone(), b: b.clone(), color });
  return beam(a, b, radius, color, segments);
};
chuongDuongBridge(B, { ...L, roads });
const bottom = 0.5 + 0.1, top = 0.5 + 1.65;
const close = (a, b) => Math.abs(a - b) < 1e-5;
const webs = members.filter(s => Math.abs(s.a.y - s.b.y) > 1 && Math.abs(s.a.x - s.b.x) > 0.5);
assert.equal(webs.length, 8, 'four triangular side-web panels on each truss');
assert.equal(members.filter(s => close(s.a.y, top) && close(s.b.y, top) && Math.abs(s.a.z - s.b.z) > 2 && Math.abs(s.a.x - s.b.x) > 0.5).length,
  8, 'four overhead X-braced bays');
assert.equal(members.filter(s => close(s.a.y, top) && close(s.b.y, top) && close(s.a.z, s.b.z)).length, 2, 'flat parallel upper chords');
assert.equal(members.filter(s => close(s.a.y, bottom) && close(s.b.y, bottom) && close(s.a.z, s.b.z)).length, 2, 'parallel lower chords');
assert.equal(members.filter(s => Math.abs(s.a.y - s.b.y) > 1 && close(Math.abs(s.a.x - s.b.x), 0.4)).length, 2, 'sloping entrance portal posts');
assert.ok(r.hw - 1.30 >= 0.3, 'outer asphalt strips lie outside the trusses');
assert.ok(1.30 - 0.06 > 1.0 + 0.4 / 2, 'steel clears the widest outer-lane cyclo envelope');
assert.ok(top - 0.06 - 0.5 > 1.5, 'overhead steel leaves vehicle clearance');

const box = new Box3();
for (const b of Object.values(B)) {
  assert.equal(b.stack.length, 1, 'material frames balanced');
  for (const g of b.parts) {
    g.computeBoundingBox(); box.union(g.boundingBox);
    assert.ok(g.index && g.attributes.normal, 'all geometry normalized for merging');
    assert.ok(g.attributes.normal.array.every(Number.isFinite), 'finite normals');
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      assert.ok([p.getX(i), p.getY(i), p.getZ(i)].every(Number.isFinite), 'finite bridge vertices');
      assert.ok(Math.abs(p.getX(i)) <= HALF + 1e-5 && Math.abs(p.getZ(i)) <= HALF + 1e-5,
        `full steelwork/piers stay inside tile: ${p.getX(i)}, ${p.getY(i)}, ${p.getZ(i)}`);
    }
    g.dispose();
  }
}
assert.ok(box.max.y > 2.1 && box.max.y < 2.3, 'low rectangular silhouette, not an arch or pylon');
assert.ok(B.lamp.parts.length >= 6, 'paired outer-lane lamp rows');
console.log('Chương Dương checks passed: northward crossing, lake/dyke connections, triangular side webs, flat chords, overhead X braces, sloping portals, lane/head clearance, normalized bounded geometry and lamps.');
