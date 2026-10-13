import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { MeshBuilder } from '../src/core/MeshBuilder.js';
import { RNG } from '../src/core/rng.js';
import { landmark81, bitexco } from '../src/world/landmarks.js';
import { tower } from '../src/world/buildings.js';
import { officeWindowRow, curvedOfficeWindowRow } from '../src/world/officeWindows.js';

const builders = () => Object.fromEntries(['main', 'glass', 'lit', 'lamp', 'neon', 'foliage'].map(k => [k, new MeshBuilder(k)]));
const dispose = B => { for (const b of Object.values(B)) for (const p of b.parts) p.dispose(); };
const pattern = B => B.lit.parts.map(g => Array.from(g.attributes.position.array));
for (const [name, fn] of [['landmark81', landmark81], ['bitexco', bitexco]]) {
  const B = builders(), repeat = builders(), other = builders();
  const rng = new RNG('office-regression');
  fn(B, { x: 0, z: 0, rng });
  fn(repeat, { x: 0, z: 0, rng: new RNG('office-regression') });
  fn(other, { x: 0, z: 0, rng: new RNG('different-office-seed') });
  assert.deepEqual(pattern(B), pattern(repeat), `${name}: reproducible occupied windows`);
  assert.notDeepEqual(pattern(B), pattern(other), `${name}: occupancy varies by seed`);
  assert.ok(B.lit.parts.length > 80, `${name}: many individual window panes`);
  if (name === 'bitexco') {
    const pad = B.main.parts.find(g => {
      g.computeBoundingBox();
      const box = g.boundingBox;
      return box.max.x > 3.4 && box.min.y > 12.3 && box.max.y < 12.7;
    });
    assert.ok(pad, 'prominent cantilevered helipad exists');
    const size = pad.boundingBox.getSize(new Vector3());
    assert.ok(Math.abs(size.x - 3.4) < 0.01 && Math.abs(size.z - 3.4) < 0.01, 'enlarged 3.4-wide landing deck');
    assert.ok(pad.boundingBox.min.x < 1.3 && pad.boundingBox.max.x > 3.4, 'deck attaches to tower and projects outward');
  }
  for (const g of B.lit.parts) {
    g.computeBoundingBox();
    const size = g.boundingBox.getSize(new Vector3());
    assert.ok(Math.max(size.x, size.z) < 0.5, `${name}: no emissive full-floor strips/rings`);
    assert.ok(size.y <= 0.301, `${name}: one floor's pane height`);
    assert.ok(g.attributes.position.array.every(Number.isFinite) && g.attributes.normal.array.every(Number.isFinite));
  }
  // The original tower generators consumed only these floor occupancy draws. Keep
  // that sequence so adding panes doesn't alter trees/buildings elsewhere in the city.
  const original = new RNG('office-regression');
  if (name === 'landmark81') {
    for (const h of [17, 21, 18.5, 22, 26.5, 23, 19, 22.5, 16]) for (let f = 2; f < h - 0.5; f += 0.62) original.chance(0.22);
  } else {
    for (let h = 1.2; h < 17; h += 0.62) if (Math.round(h / 0.62) % 3 !== 0) original.chance(0.25);
  }
  assert.equal(rng.next(), original.next(), `${name}: preserve parent RNG stream`);
  for (const b of Object.values(B)) assert.equal(b.stack.length, 1, `${name}: balanced material transforms`);
  for (const b of [B, repeat, other]) dispose(b);
}
const office = builders();
tower(office, { w: 3.2, d: 2.8, floors: 18, crown: 'flat' }, new RNG('generic-office'), {});
assert.ok(office.lit.parts.length > 30);
for (const g of office.lit.parts) assert.equal(g.attributes.position.count, 4, 'generic office uses pane quads, not floor strips');
dispose(office);
// Every generated cell exists as either lit or dark glazing; rows have a mixture.
const row = builders();
for (const face of ['front', 'back', 'right', 'left']) officeWindowRow(row, new RNG(`row-${face}`), { face, w: 4, d: 4, y: 2, probability: 0.35 });
assert.equal(row.lit.parts.length + row.glass.parts.length, 40);
assert.ok(row.lit.parts.length > 0 && row.glass.parts.length > 0, 'lit and unlit offices coexist');
dispose(row);
// Pane spanning a profile kink must split to stay on the faceted tower surface.
const curved = builders();
curvedOfficeWindowRow(curved, new RNG(1), { x: 0, z: 0, y: 3, probability: 1,
  radiusAt: y => y <= 3 ? 1 + y * 0.1 : 1.3 - (y - 3) * 0.1, profileHeights: [3], zScale: 0.78 });
assert.equal(curved.lit.parts.length, 24);
for (const g of curved.lit.parts) assert.equal(g.attributes.position.count, 12, 'pane split at profile bend');
dispose(curved);
console.log('Office window checks passed: seeded random panes, lit/dark mix, no luminous floor bands, curve conformity and unchanged parent RNG.');
