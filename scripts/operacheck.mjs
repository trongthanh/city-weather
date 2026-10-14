import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBuilder } from '../src/core/MeshBuilder.js';
import { operaHouse } from '../src/world/landmarks.js';

for (const [ry, scale] of [[0, 1], [Math.PI, 1.2], [Math.PI / 2, 2]]) {
  const B = Object.fromEntries(['main', 'glass', 'lit', 'lamp', 'neon', 'foliage'].map(name => [name, new MeshBuilder(name)]));
  const columns = [];
  const cylinder = B.main.cyl.bind(B.main);
  B.main.cyl = (...args) => {
    if (args[1] === 0.38 && args[4] === 1.68) columns.push(args);
    return cylinder(...args);
  };
  const x = 11.1, z = 16.2;
  operaHouse(B, { x, z, ry, scale });
  for (const builder of Object.values(B)) assert.equal(builder.stack.length, 1, 'balanced transforms for all materials');
  assert.ok(B.lit.vertexCount > 300, 'substantial glowing glazing');
  assert.ok(B.lamp.vertexCount > 0, 'porch lanterns present');
  const geometry = B.lit.toGeometry();
  const inverse = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(scale, scale, scale)).invert();
  assert.equal(columns.length, 6, 'six giant-order columns spanning both floors');
  assert.ok(columns.every(c => c[2] === 1.46 && c[3] > 0.07), 'columns sit in front of recessed entrance bays');
  const roofColor = new THREE.Color('#354b57'), roofs = [], silhouette = new THREE.Box3();
  for (const b of Object.values(B)) for (const part of b.parts) {
    assert.ok(part.index && part.attributes.normal && part.attributes.normal.array.every(Number.isFinite), 'normalized finite geometry');
    const local = part.clone().applyMatrix4(inverse);
    local.computeBoundingBox(); silhouette.union(local.boundingBox);
    const p = local.attributes.position;
    for (let i = 0; i < p.count; i++) {
      assert.ok(Math.abs(p.getX(i)) <= 2.125 + 1e-5 && p.getZ(i) >= -1.5 - 1e-5 && p.getZ(i) <= 2.25 + 1e-5,
        'full roofs, balconies, stairs and fixtures stay within reserved footprint');
      assert.ok(Number.isFinite(p.getY(i)) && p.getY(i) >= -1e-5, 'all details remain above ground');
    }
    const c = part.attributes.color;
    if (Math.abs(c.getX(0) - roofColor.r) < 1e-6 && Math.abs(c.getY(0) - roofColor.g) < 1e-6 && Math.abs(c.getZ(0) - roofColor.b) < 1e-6) roofs.push(local.boundingBox.clone());
    local.dispose();
  }
  assert.equal(roofs.filter(box => Math.abs(box.getCenter(new THREE.Vector3()).x) > 1.5).length, 4, 'four separate corner mansards');
  assert.ok(roofs.some(box => box.min.x < -1.45 && box.max.x > 1.45 && box.min.y > 2.7 && box.max.y > 3.5), 'broad raised auditorium roof, not a little central dome');
  assert.ok(silhouette.max.y > 4 && silhouette.max.y < 4.1, 'roof ridge finials preserved without excessive landmark height');
  geometry.applyMatrix4(inverse);
  const points = geometry.attributes.position, normals = geometry.attributes.normal;
  const faces = new Set();
  for (let i = 0; i < points.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(points, i);
    assert.ok(p.toArray().every(Number.isFinite));
    assert.ok(Math.abs(p.x) < 2.1 && p.y > 0.28 && p.y < 3 && p.z > -1.4 && p.z < 1.4, 'glazing stays on rotated/scaled facade and attached roof dormers');
    if (normals.getX(i) > 0.9) faces.add('right');
    if (normals.getX(i) < -0.9) faces.add('left');
    if (normals.getZ(i) > 0.9) faces.add('front');
    if (normals.getZ(i) < -0.9) faces.add('rear');
  }
  assert.deepEqual([...faces].sort(), ['front', 'left', 'rear', 'right'], 'glazing faces all four directions');
  geometry.dispose();
  for (const builder of Object.values(B)) for (const part of builder.parts) part.dispose();
}
console.log('Opera House checks passed: six tall columns, four corner mansards, broad raised slate roof, full geometry inside footprint, all-round glazing/dormers, porch lamps and balanced rotated/scaled frames.');
