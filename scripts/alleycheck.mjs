import assert from 'node:assert/strict';
import { Box3, Color, Scene, Vector3 } from 'three';
import { RNG, hashString } from '../src/core/rng.js';
import { MeshBuilder } from '../src/core/MeshBuilder.js';
import hanoi from '../src/cities/hanoi.js';
import { Field, Occupancy } from '../src/world/Field.js';
import { prepareRoads, buildRoads } from '../src/world/roads.js';
import { stJoseph } from '../src/world/landmarks.js';

const ctx = new Proxy({}, { get: (_, k) => k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {} };
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { generateCity } = await import('../src/world/CityGenerator.js');
const { AgentSystem } = await import('../src/agents/AgentSystem.js');
const layout = hanoi.layout(new RNG(hanoi.seed).fork('layout'));
const church = layout.landmarks.find(L => L.type === 'stJoseph');
assert.equal(church.scale, 1.5, 'cathedral reduced from 2.4');
const roads = prepareRoads(layout.roads, new Field(layout, hashString(hanoi.seed)));
const roadBuilders = Object.fromEntries(['main', 'glass', 'lit', 'lamp', 'neon', 'foliage'].map(k => [k, new MeshBuilder(k)]));
buildRoads(roads, new Field(layout, hashString(hanoi.seed)), roadBuilders, new Occupancy(), new RNG('alley-surfaces'), []);
const surfaces = roadBuilders.main.parts.at(-1);
const levels = { alley: [], asphalt: [] };
for (const [name, color] of [['alley', '#8a8379'], ['asphalt', '#5f6368']]) {
  const c = new Color(color), p = surfaces.attributes.position, n = surfaces.attributes.normal, col = surfaces.attributes.color;
  for (let i = 0; i < p.count; i++) {
    if (n.getY(i) > 0.99 && Math.abs(col.getX(i) - c.r) < 1e-6 && Math.abs(col.getY(i) - c.g) < 1e-6 && Math.abs(col.getZ(i) - c.b) < 1e-6) levels[name].push(p.getY(i));
  }
  assert.ok(levels[name].length > 0, `${name}: road top faces found`);
}
assert.ok(Math.min(...levels.asphalt) - Math.max(...levels.alley) > 0.014, 'stone alleys and main asphalt are not coplanar at junctions');
assert.ok(Math.min(...levels.alley) > 0.02, 'recessed alley surface still sits above terrain');
for (const b of Object.values(roadBuilders)) for (const g of b.parts) g.dispose();
const lanes = roads.filter(r => r.kind === 'alley');
assert.equal(lanes.length, 2, 'exactly two cathedral side alleys');
assert.ok(lanes[0].path.points[0].z < church.z && lanes[1].path.points[0].z > church.z);
const B = Object.fromEntries(['main', 'glass', 'lit', 'lamp', 'neon', 'foliage'].map(k => [k, new MeshBuilder(k)]));
stJoseph(B, church);
const churchBox = new Box3();
for (const b of Object.values(B)) for (const g of b.parts) {
  g.computeBoundingBox(); churchBox.union(g.boundingBox);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) for (const alley of lanes) assert.ok(alley.path.distance(p.getX(i), p.getZ(i)) > alley.hw + 0.10, 'church geometry clears both alleys');
  g.dispose();
}
assert.ok(churchBox.max.y < 5.1 && churchBox.max.y > 5, 'reduced cathedral silhouette');
const city = generateCity(hanoi);
const alleys = city.roads.filter(r => r.kind === 'alley');
const agents = new AgentSystem(new Scene());
agents.setCity(city);
for (const alley of alleys) {
  assert.ok(alley.hw * 2 < 0.7 && alley.sw === 0, 'genuinely narrow lane, no wide road/sidewalk');
  assert.ok(alley.junctions.some(j => j.to.path.closed), 'each alley joins the lake ring');
  assert.deepEqual(alley.def.vehicles, ['motorbike']);
  for (const name of ['car', 'bus', 'cyclo']) assert.equal(agents._roadAllowed(agents.types[name], alley), false, `${name}: no alley access`);
  assert.equal(agents._roadAllowed(agents.types.motorbike, alley), true);
}
agents.roads = alleys;
for (const name of ['car', 'bus', 'cyclo']) for (const prefill of [false, true]) assert.equal(agents._spawnRoad(agents.types[name], prefill), null, `${name}: no initial or subsequent spawning on alleys`);
const T = agents.types.motorbike;
for (let i = 0; i < 100; i++) {
  const a = agents._spawnRoad(T, true);
  assert.ok(a);
  assert.ok(a.lat + T.spec.width / 2 < a.road.hw, 'bike fits within alley edges');
  assert.ok(a.v <= 0.9, 'bikes spawn at the alley speed limit, not full avenue speed');
  a.s = a.road.path.length / 2; // measure lane speed away from its ring/edge exits
  a.v = 0; a.vmax = 2.4;
  agents._roadBuckets = new Map();
  for (let frame = 0; frame < 60; frame++) {
    agents._updRoad(T, a, 1 / 60, { rain: 0, wind: 0 });
    assert.ok(a.v <= 0.9 + 1e-6, 'bike respects slow alley speed');
    assert.ok(agents._roadPos(a, new Vector3()).toArray().every(Number.isFinite));
  }
  a.active = false;
}
// Force an endpoint choice so a car cannot accidentally plan a turn into an alley.
for (const name of ['car', 'bus', 'cyclo']) {
  const alley = alleys[0], ring = city.roads.find(r => r.path.closed);
  const from = { ...ring, path: alley.path, junctions: [{ s: alley.path.length, to: alley, toS: alley.path.length / 2 }] };
  const a = { road: from, path: from.path, s: from.path.length - 3, dir: 1, lat: 0.5, junctionMemory: new Set() };
  agents._planTurn(agents.types[name], a);
  assert.ok(!a.turnPlan, `${name}: turn planning also excludes alleys`);
}
city.dispose();
console.log('Cathedral/alley checks passed: 1.5 scale, two narrow flanking lanes with ring junctions, geometric clearance, motorcycle-only spawning/turning, finite bike paths and slow speed limits.');
