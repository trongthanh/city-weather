import assert from 'node:assert/strict';
import { Matrix4, Scene, Vector3 } from 'three';
import { Path, clipPathToBounds } from '../src/core/Path.js';
import { MeshBuilder } from '../src/core/MeshBuilder.js';
import { RNG, hashString } from '../src/core/rng.js';
import { Field, Occupancy, HALF } from '../src/world/Field.js';
import { prepareRoads, buildRoads } from '../src/world/roads.js';
import { CITIES } from '../src/cities/index.js';

const crossing = new Path([new Vector3(-2, 0, 0), new Vector3(2, 4, 0)]);
const [cut] = clipPathToBounds(crossing, 1);
assert.deepEqual(cut.points.map(p => p.toArray()), [[-1, 1, 0], [1, 3, 0]], 'exact crossings and interpolated heights');
const separate = clipPathToBounds(Path.fromControl([[-2, -0.5], [2, -0.5], [2, 0.5], [-2, 0.5]], { smooth: false }), 1);
assert.equal(separate.length, 2, 'disconnected crossings never joined through outside space');
const loop = Path.ellipse(0, 0, 0.5, 0.5);
assert.equal(clipPathToBounds(loop, 1)[0], loop, 'inside loops retain their closure and distance seam');
assert.equal(clipPathToBounds(Path.ellipse(5, 5, 0.5, 0.5), 1).length, 0, 'wholly outside routes omitted');

const ctx = new Proxy({}, { get: (_, k) => k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {} };
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { generateCity } = await import('../src/world/CityGenerator.js');
const { AgentSystem } = await import('../src/agents/AgentSystem.js');
const { waveUniforms } = await import('../src/world/terrain.js');
const inside = (x, z, limit = HALF) => Math.abs(x) <= limit + 1e-5 && Math.abs(z) <= limit + 1e-5;
const slab = MeshBuilder.prototype.slab;
let promenadeSlabs = 0;
try {
  MeshBuilder.prototype.slab = function(...args) {
    const g = slab.apply(this, args);
    if (args[4] === '#ddd3c2' || args[4] === '#d8cfbf') {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) assert.ok(inside(p.getX(i), p.getZ(i)), 'actual promenade width/corners stay on tile');
      promenadeSlabs++;
    }
    return g;
  };
  for (const def of CITIES) {
    const layout = def.layout(new RNG(def.seed).fork('layout'));
    const field = new Field(layout, hashString(def.seed));
    const B = Object.fromEntries(['main', 'glass', 'lit', 'lamp', 'neon', 'foliage'].map(k => [k, new MeshBuilder(k)]));
    const roads = prepareRoads(layout.roads, field);
    const { walkPaths } = buildRoads(roads, field, B, new Occupancy(), new RNG('surface-bounds'), []);
    const surface = B.main.parts.at(-1), p = surface.attributes.position;
    for (let i = 0; i < p.count; i++) assert.ok(inside(p.getX(i), p.getZ(i)), `${def.id}: road AND sidewalk ribbon vertices bounded`);
    assert.ok(surface.attributes.normal.array.every(Number.isFinite));
    for (const w of walkPaths) for (const q of w.path.points) assert.ok(inside(q.x, q.z, HALF - 0.4), 'sidewalk agent offsets have edge clearance');
    for (const b of Object.values(B)) for (const g of b.parts) g.dispose();

    const city = generateCity(def);
    assert.ok(city.waterPaths.length > 0, 'river activity retained');
    if (def.id === 'hanoi') assert.equal(city.waterPaths.length, 2, 'both Hanoi boat lanes remain in the visible river');
    for (const w of city.walkPaths.filter(w => w.walkway)) for (const q of w.path.points) assert.ok(inside(q.x, q.z, HALF - 0.4), 'extra walkway centreline inset for entire width');
    for (const w of city.waterPaths) for (const q of w.path.points) {
      assert.ok(inside(q.x, q.z, HALF - 1.2), 'boat route includes bow/drift/wave clearance');
      assert.ok(city.field.waterSD(q.x, q.z) < 0, `${def.id}: route stays on water`);
    }
    const agents = new AgentSystem(new Scene());
    agents.setCity(city);
    const T = agents.types.boat, matrix = new Matrix4(), v = new Vector3();
    let hullChecks = 0;
    for (const w of city.waterPaths.filter(w => w.kind === 'boat')) for (const dir of [-1, 1]) for (const lat of [-0.2, 0.2]) for (const waves of [0.05, 0.7]) {
      const a = agents._spawnWater(T, [w], true);
      assert.ok(a);
      a.dir = dir; a.lat = lat;
      waveUniforms.uWave.value = waves;
      for (const s of [0, 1.2, w.path.length - 1.2, w.path.length]) {
        a.s = s; a.vis = 1; a.yaw = null; // test full-size hull, not just its faded centre
        agents.setDt(1 / 60);
        agents._write(T, a, T.agents.indexOf(a), { rain: 0, night: 0 });
        for (const part of T.parts) {
          part.mesh.getMatrixAt(T.agents.indexOf(a), matrix);
          const p = part.mesh.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i).applyMatrix4(matrix);
            assert.ok(v.toArray().every(Number.isFinite) && inside(v.x, v.z), `${def.id}: complete boat hull stays within tile at both route ends/directions/waves`);
            hullChecks++;
          }
        }
      }
      a.active = false;
    }
    console.log(`${def.id}: bounded sidewalks/promenades, ${city.waterPaths.length} in-water routes, ${hullChecks} full-hull vertex checks.`);
    city.dispose();
  }
} finally {
  MeshBuilder.prototype.slab = slab;
}
assert.ok(promenadeSlabs > 100, 'checked actual generated promenade slabs');
console.log('Boundary checks passed: exact/disconnected path clipping, inset pedestrian/boat routes and complete ribbon/hull bounds.');
