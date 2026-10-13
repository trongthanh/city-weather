import assert from 'node:assert/strict';
import { Box3, Matrix4, Vector3 } from 'three';
import { MeshBuilder } from '../src/core/MeshBuilder.js';
import { RNG } from '../src/core/rng.js';
import { BUILDERS } from '../src/world/buildings.js';
import { BASE_PALETTE } from '../src/cities/palettes.js';
import { nhaRong, postOffice, cityHall, stJoseph, notreDame, danangCathedral, operaHouse } from '../src/world/landmarks.js';

const builders = () => Object.fromEntries(['main', 'glass', 'lit', 'lamp', 'neon', 'foliage'].map(k => [k, new MeshBuilder(k)]));
function checkFaces(B, label) {
  const panes = [...B.glass.parts, ...B.lit.parts].filter(g => {
    const normal = new Vector3().fromBufferAttribute(g.attributes.normal, 0);
    for (let i = 1; i < g.attributes.normal.count; i++) if (normal.dot(new Vector3().fromBufferAttribute(g.attributes.normal, i)) < 0.99) return false;
    return true; // rectangular panes, arched shapes and round rose windows
  });
  for (const [axis, sign, name] of [['z', 1, 'front'], ['z', -1, 'back'], ['x', 1, 'right'], ['x', -1, 'left']]) {
    assert.ok(panes.some(g => {
      const normal = new Vector3().fromBufferAttribute(g.attributes.normal, 0);
      return normal[axis] * sign > 0.99;
    }), `${label}: visible glazing on ${name}`);
  }
  for (const b of Object.values(B)) {
    assert.equal(b.stack.length, 1, `${label}: balanced ${b.name} frames`);
    for (const g of b.parts) {
      assert.ok(g.index && g.attributes.normal && g.attributes.position.array.every(Number.isFinite), `${label}: merge-compatible finite geometry`);
    }
  }
}
const dispose = B => { for (const b of Object.values(B)) for (const g of b.parts) g.dispose(); };
for (const [kind, fn] of Object.entries(BUILDERS)) {
  const B = builders();
  fn(B, { w: kind === 'tube' ? 1.6 : 2.8, d: 2.4, floors: kind === 'tower' ? 12 : 3 }, new RNG(`facades-${kind}`), BASE_PALETTE);
  checkFaces(B, kind);
  dispose(B);
}
for (const fn of [nhaRong, postOffice, cityHall, stJoseph, notreDame, danangCathedral, operaHouse]) {
  const B = builders(), moved = builders();
  fn(B, { x: 0, z: 0, ry: 0, scale: 1, rng: new RNG('landmark-facades') });
  fn(moved, { x: 5, z: -7, ry: Math.PI / 2, scale: 1, rng: new RNG('landmark-facades') });
  checkFaces(B, fn.name);
  const inverse = new Matrix4().makeRotationY(Math.PI / 2);
  inverse.setPosition(5, 0, -7).invert();
  for (const [k, b] of Object.entries(B)) {
    assert.equal(moved[k].parts.length, b.parts.length, `${fn.name}: moved ${k} details preserved`);
    for (let i = 0; i < b.parts.length; i++) {
      const g = moved[k].parts[i].clone().applyMatrix4(inverse);
      const a = b.parts[i].attributes.position.array, c = g.attributes.position.array;
      for (let j = 0; j < a.length; j++) assert.ok(Math.abs(a[j] - c[j]) < 3e-6, `${fn.name}/${k}: façade follows rotated landmark`);
      g.dispose();
    }
    assert.equal(moved[k].stack.length, 1);
  }
  if (fn === nhaRong) {
    const windows = B.lit.parts.filter(g => g.attributes.position.count === 4);
    assert.ok(windows.length >= 25, 'Nhà Rồng: substantial all-round arched glazing');
    for (const g of windows) {
      g.computeBoundingBox();
      assert.ok(g.boundingBox.min.y >= 0.1 && g.boundingBox.max.y <= 1.35, 'Nhà Rồng panes stay within two-storey wall');
    }
    const rearDoors = windows.filter(g => {
      const box = g.boundingBox, normal = new Vector3().fromBufferAttribute(g.attributes.normal, 0);
      return normal.z < -0.99 && Math.abs(box.getCenter(new Vector3()).x) < 0.1 && box.min.y < 0.5;
    });
    assert.equal(rearDoors.length, 1, 'Nhà Rồng rear doorway does not overlap a coplanar window');
    const silhouette = new Box3();
    for (const g of B.main.parts) { g.computeBoundingBox(); silhouette.union(g.boundingBox); }
    assert.ok(silhouette.max.y > 2.8, 'roof dragons and flag retained');
  }
  dispose(B); dispose(moved);
}
console.log('Façade checks passed: all seven building styles and seven architectural landmarks glazed on four elevations, finite/normalized geometry and rotated material frames, Nhà Rồng arches/dragons/flag retained.');
