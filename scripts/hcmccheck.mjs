import assert from 'node:assert/strict';
import { Box3, Matrix4, Vector3 } from 'three';
import { MeshBuilder } from '../src/core/MeshBuilder.js';
import { RNG } from '../src/core/rng.js';
import hcmc from '../src/cities/hcmc.js';
import { landmark81, officeTower, cityHall, canalRow } from '../src/world/landmarks.js';
import { BUILDERS, tower } from '../src/world/buildings.js';

const builders = () => Object.fromEntries(['main', 'glass', 'lit', 'lamp', 'neon', 'foliage'].map(k => [k, new MeshBuilder(k)]));
const dispose = B => { for (const b of Object.values(B)) for (const p of b.parts) p.dispose(); };
const bounds = g => { g.computeBoundingBox(); return g.boundingBox; };
const B = builders();
landmark81(B, { x: 0, z: 0, rng: new RNG('landmark81-shape') });
const shafts = B.glass.parts.filter(g => g.attributes.position.count === 24 && Math.abs(bounds(g).min.y - 1.1) < 1e-5 && bounds(g).max.y > 8);
assert.equal(shafts.length, 9, 'nine bundled shafts, no surrounding apartment towers');
const spanAt = y => {
  const box = new Box3();
  for (const g of shafts) if (g.boundingBox.max.y > y) box.union(g.boundingBox);
  return box.getSize(new Vector3());
};
assert.ok(spanAt(2).x > 3.2 && spanAt(2).z > 3.2, 'broad lower bundle');
assert.ok(spanAt(22).x < 1.1 && spanAt(22).z < 1.1, 'upper core stands well above shoulders');
assert.equal(shafts.filter(g => g.boundingBox.max.y > 22).length, 1);
assert.equal(B.neon.parts.length, 0, 'no pyramidal neon-ring crown');
const podium = bounds(B.main.parts[0]).getSize(new Vector3());
assert.ok(Math.abs(podium.x - 5.4) < 1e-5 && Math.abs(podium.z - 5.4) < 1e-5, 'original podium preserved');
const mast = B.main.parts.find(g => {
  const box = bounds(g), size = box.getSize(new Vector3());
  return box.min.y > 27 && size.y > 2 && size.x < 0.25 && size.z < 0.25;
});
assert.ok(mast, 'long rectangular mast above stepped crown');
for (const b of Object.values(B)) assert.equal(b.stack.length, 1);
dispose(B);

const layout = hcmc.layout(new RNG(hcmc.seed).fork('layout'));
const hall = layout.landmarks.find(L => L.type === 'cityHall');
const H = builders();
cityHall(H, hall);
const hallBounds = new Box3();
// The final three main parts are the preserved statue, independent of the façade.
for (const b of Object.values(H)) for (const g of b === H.main ? b.parts.slice(0, -3) : b.parts) hallBounds.union(bounds(g));
const civicPlaza = layout.plazas.find(p => p.x === 3 && p.z === -5.7);
assert.ok(hallBounds.getSize(new Vector3()).x >= civicPlaza.w * 0.98, 'City Hall spans the square frontage');
assert.ok(hallBounds.min.x >= civicPlaza.x - civicPlaza.w / 2 && hallBounds.max.x <= civicPlaza.x + civicPlaza.w / 2, 'façade stays within civic square');
assert.ok(hallBounds.max.y > 4.7 && hallBounds.max.y < 4.9, 'smaller clock tower and flag, not an oversized monument');
assert.ok(hallBounds.getSize(new Vector3()).x / hallBounds.max.y > 2.35, 'long, low reference proportions');
const wingWindows = H.lit.parts.filter(g => {
  const box = bounds(g), cx = box.getCenter(new Vector3()).x;
  return Math.abs(cx - hall.x) > 2.45 && box.getSize(new Vector3()).y > 0.45;
});
assert.equal(wingWindows.length, 28, 'seven window bays per wing on each of two storeys');
const fp = hall.footprint;
assert.ok(hallBounds.min.x >= hall.x - fp.w / 2 && hallBounds.max.x <= hall.x + fp.w / 2);
assert.ok(hallBounds.min.z >= fp.z - fp.d / 2 && hallBounds.max.z <= fp.z + fp.d / 2, 'footprint contains roofs and steps');
const statueBounds = new Box3();
for (const g of H.main.parts.slice(-3)) statueBounds.union(bounds(g));
assert.ok(Math.abs(statueBounds.getCenter(new Vector3()).z + 7.4) < 1e-5, 'statue stays at original location');
const statueSize = statueBounds.getSize(new Vector3());
assert.ok(Math.abs(statueSize.x - 0.6) < 2e-6 && Math.abs(statueSize.y - 1.02) < 2e-6 && Math.abs(statueSize.z - 0.45) < 2e-6, 'architectural scale does not shrink the statue');
assert.ok(hallBounds.max.z < statueBounds.min.z - 0.3, 'front steps leave a clear gap to the statue');
assert.ok(H.lit.parts.length >= 40, 'individual arched windows and recessed loggia glazing');
for (const b of Object.values(H)) assert.equal(b.stack.length, 1, 'City Hall material transforms balanced');
const turnedHall = builders();
cityHall(turnedHall, { ...hall, ry: Math.PI / 2 });
const undoHall = new Matrix4().makeRotationY(Math.PI / 2);
undoHall.setPosition(hall.x, 0, hall.z).invert();
for (const [k, b] of Object.entries(H)) {
  assert.equal(turnedHall[k].parts.length, b.parts.length);
  for (let i = 0; i < b.parts.length; i++) {
    const a = b.parts[i].clone().translate(-hall.x, 0, -hall.z);
    const c = turnedHall[k].parts[i].clone().applyMatrix4(undoHall);
    const ap = a.attributes.position.array, cp = c.attributes.position.array;
    for (let j = 0; j < ap.length; j++) assert.ok(Math.abs(ap[j] - cp[j]) < 2e-6, `${k}: rotated City Hall details follow landmark frame`);
    a.dispose(); c.dispose();
  }
  assert.equal(turnedHall[k].stack.length, 1);
}
dispose(turnedHall);

// Canal-row glazing used to remain in local space, floating at (0, +0.806)
// on the south edge of the civic square instead of on the canal-front houses.
const row = layout.landmarks.find(L => L.type === 'canalRow');
const C = builders();
canalRow(C, { ...row, rng: new RNG('canal-window-frames') });
const walls = C.main.parts.filter(g => {
  const box = bounds(g), size = box.getSize(new Vector3());
  return Math.abs(box.min.y) < 1e-5 && size.y > 1 && Math.abs(size.z - 1.6) < 1e-5;
}).map(g => g.boundingBox);
assert.ok(walls.length > 5, 'canal-front row retained');
for (const k of ['glass', 'lit']) {
  assert.ok(C[k].parts.length > 0, `${k}: canal row has glazing`);
  for (const g of C[k].parts) {
    const box = bounds(g);
    const normal = new Vector3().fromBufferAttribute(g.attributes.normal, 0);
    assert.ok(walls.some(wall => {
      if (box.min.y < wall.min.y || box.max.y > wall.max.y) return false;
      if (Math.abs(normal.z) > 0.9) {
        const face = normal.z > 0 ? wall.max.z : wall.min.z;
        return box.min.x >= wall.min.x && box.max.x <= wall.max.x && Math.abs(box.min.z - face) < 0.02;
      }
      const face = normal.x > 0 ? wall.max.x : wall.min.x;
      return box.min.z >= wall.min.z && box.max.z <= wall.max.z && Math.abs(box.min.x - face) < 0.02;
    }), `${k}: every pane attached to a canal-house elevation`);
    assert.ok(box.max.x < row.x1 && box.min.z > 19, 'no orphan glazing at civic-square origin');
  }
}
for (const b of Object.values(C)) assert.equal(b.stack.length, 1, 'canal row material frames balanced');
dispose(C);
const moved = layout.landmarks.find(L => L.type === 'officeTower');
assert.ok(moved.x < -16 && moved.z < -13.5, 'relocated tower in far northwest lot');
assert.equal(moved.floors, 19);
const original = builders(), relocated = builders();
// Snapshot of the civic-block tower before relocation: preserve its actual model,
// not just an arbitrary replacement with the same floor count.
tower(original, { w: 2.8792218208312987, d: 3.1312400457449256, floors: 19 }, new RNG(377477148), hcmc.palette);
officeTower(relocated, { ...moved, palette: hcmc.palette });
const inverse = new Matrix4().makeRotationY(moved.ry);
inverse.setPosition(moved.x, 0, moved.z).invert();
const relocatedBounds = new Box3();
for (const k of Object.keys(original)) {
  assert.equal(relocated[k].parts.length, original[k].parts.length, `${k}: preserve tower details`);
  for (let i = 0; i < original[k].parts.length; i++) {
    relocatedBounds.union(bounds(relocated[k].parts[i]));
    assert.deepEqual(relocated[k].parts[i].attributes.color.array, original[k].parts[i].attributes.color.array, `${k}: unchanged tower colours`);
    const a = original[k].parts[i].attributes.position.array;
    const g = relocated[k].parts[i].clone().applyMatrix4(inverse), b = g.attributes.position.array;
    assert.equal(a.length, b.length);
    for (let j = 0; j < a.length; j++) assert.ok(Math.abs(a[j] - b[j]) < 4e-6, `${k}: unchanged tower geometry`);
    g.dispose();
  }
  assert.equal(relocated[k].stack.length, 1);
}
dispose(original); dispose(relocated);

const ctx = new Proxy({}, { get: (t, k) => k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {} };
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { generateCity } = await import('../src/world/CityGenerator.js');
// Inspect actual procedural geometry, including overhanging balconies/podiums.
const civic = new Box3(new Vector3(-2.75, 0.2, -11.6), new Vector3(8.75, 50, 0.15));
const originals = { ...BUILDERS };
let checked = 0;
try {
  for (const [kind, fn] of Object.entries(originals)) BUILDERS[kind] = (B, spec, rng, pal) => {
    const starts = Object.fromEntries(Object.entries(B).map(([k, b]) => [k, b.parts.length]));
    const info = fn(B, spec, rng, pal);
    for (const [k, b] of Object.entries(B)) for (const g of b.parts.slice(starts[k])) {
      assert.ok(!bounds(g).intersectsBox(civic), `${kind}: no generated building intrudes into civic square`);
    }
    checked++;
    return info;
  };
  const city = generateCity(hcmc);
  const orphanZone = new Box3(new Vector3(-0.7, 0.5, 0.6), new Vector3(0.7, 3, 1.0));
  for (const k of ['glass', 'lit']) {
    const mesh = city.group.children.find(m => m.name === k);
    assert.ok(mesh, `${k}: merged city geometry present`);
    const p = mesh.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) assert.ok(!orphanZone.containsPoint(new Vector3(p.getX(i), p.getY(i), p.getZ(i))), `${k}: south edge of civic square has no floating window panel`);
  }
  for (const b of Object.values(H)) for (const g of b.parts) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) for (const road of city.roads) {
      assert.ok(road.path.distance(p.getX(i), p.getZ(i)) > road.hw + road.sw, 'actual City Hall geometry clears road/sidewalks');
    }
  }
  dispose(H);
  assert.ok(relocatedBounds.min.x > -21.8 && relocatedBounds.min.z > -21.8 && relocatedBounds.max.x < 21.8 && relocatedBounds.max.z < 21.8, 'relocated tower stays within tile');
  for (const x of [relocatedBounds.min.x, relocatedBounds.max.x]) for (const z of [relocatedBounds.min.z, relocatedBounds.max.z]) {
    for (const road of city.roads) assert.ok(road.path.distance(x, z) > road.hw + road.sw, 'relocated podium clears sidewalks');
  }
  assert.ok(city.field.inPlaza(3, -7.4), 'statue remains in public square');
  for (const [x, z] of [[-2.5, -11.3], [8.5, -11.3], [-2.5, -0.1], [8.5, -0.1]]) assert.ok(city.field.inPlaza(x, z), 'whole civic block reserved');
  assert.ok(layout.landmarks.some(L => L.type === 'cityHall' && L.x === 3 && L.z === -9.6));
  city.dispose();
} finally {
  Object.assign(BUILDERS, originals);
}
assert.ok(checked > 0);
console.log(`HCMC checks passed: long/low City Hall with seven-bay wings, preserved statue and sidewalk clearance, canal glazing attached/no floating square panel, stepped Landmark 81/core/mast, unchanged podium, exact relocated office tower, ${checked} procedural buildings clear of civic square.`);
