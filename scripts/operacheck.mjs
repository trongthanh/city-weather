import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBuilder } from '../src/core/MeshBuilder.js';
import { operaHouse } from '../src/world/landmarks.js';

for (const [ry, scale] of [[0, 1], [Math.PI, 1.2], [Math.PI / 2, 2]]) {
  const B = Object.fromEntries(['main', 'glass', 'lit', 'lamp', 'neon', 'foliage'].map(name => [name, new MeshBuilder(name)]));
  const x = 11.1, z = 16.2;
  operaHouse(B, { x, z, ry, scale });
  for (const builder of Object.values(B)) assert.equal(builder.stack.length, 1, 'balanced transforms for all materials');
  assert.ok(B.lit.vertexCount > 300, 'substantial glowing glazing');
  assert.ok(B.lamp.vertexCount > 0, 'porch lanterns present');
  const geometry = B.lit.toGeometry();
  const inverse = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(scale, scale, scale)).invert();
  geometry.applyMatrix4(inverse);
  const points = geometry.attributes.position, normals = geometry.attributes.normal;
  const faces = new Set();
  for (let i = 0; i < points.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(points, i);
    assert.ok(p.toArray().every(Number.isFinite));
    assert.ok(Math.abs(p.x) < 2.1 && p.y > 0.15 && p.y < 1.9 && p.z > -1.4 && p.z < 1.4, 'glazing stays on rotated/scaled facade');
    if (normals.getX(i) > 0.9) faces.add('right');
    if (normals.getX(i) < -0.9) faces.add('left');
    if (normals.getZ(i) > 0.9) faces.add('front');
    if (normals.getZ(i) < -0.9) faces.add('rear');
  }
  assert.deepEqual([...faces].sort(), ['front', 'left', 'rear', 'right'], 'glazing faces all four directions');
  geometry.dispose();
  for (const builder of Object.values(B)) for (const part of builder.parts) part.dispose();
}
console.log('Opera House regression checks passed: framed glowing windows on four facades, porch lamps, rotated/scaled geometry and balanced transforms.');
