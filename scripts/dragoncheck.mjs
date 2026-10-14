import assert from 'node:assert/strict';
import { Box3, Color, Vector3 } from 'three';
import danang from '../src/cities/danang.js';
import { RNG, hashString } from '../src/core/rng.js';
import { MeshBuilder } from '../src/core/MeshBuilder.js';
import { Field, HALF, BED } from '../src/world/Field.js';
import { prepareRoads, DECK_Y } from '../src/world/roads.js';
import { dragonBridge } from '../src/world/landmarks.js';

const layout = danang.layout(new RNG(danang.seed).fork('layout'));
const roads = prepareRoads(layout.roads, new Field(layout, hashString(danang.seed)));
const L = layout.landmarks.find(l => l.type === 'dragonBridge');
const road = roads.find(r => r.name === 'Cầu Rồng');
assert.equal(road.hw, 1.25, 'existing two-way road width retained');
assert.equal(road.path.points[0].z, L.z, 'dragon and crossing aligned');
assert.ok(road.def.noPiers && !road.def.noRail && road.def.lamps !== false,
  'custom aligned piers replace generic ones; road still owns rails/lamps');
assert.ok(road.junctions.length === 0, 'prepareRoads leaves junction construction to buildRoads');
assert.ok(L.x1 - L.x0 > 7 && L.x1 - L.x0 < 8, 'broader bridge-length silhouette');

const colorMatches = (g, hex) => {
  const c = new Color(hex), a = g.attributes.color;
  return Math.abs(a.getX(0) - c.r) < 1e-6 && Math.abs(a.getY(0) - c.g) < 1e-6 && Math.abs(a.getZ(0) - c.b) < 1e-6;
};
for (const [dx, dz, dy] of [[0, 0, 0], [4, -7, 1.3]]) {
  const B = Object.fromEntries(['main', 'glass', 'lit', 'lamp', 'neon', 'foliage'].map(k => [k, new MeshBuilder(k)]));
  const rng = new RNG('dragon-no-layout-draws'), seed = rng.s;
  const deckY = DECK_Y + 0.05 + dy, z = L.z + dz;
  dragonBridge(B, { ...L, x0: L.x0 + dx, x1: L.x1 + dx, z, deckY, roads, rng });
  assert.equal(rng.s, seed, 'landmark consumes no parent layout RNG draws');
  const chords = B.main.parts.filter(g => g.type === 'TubeGeometry');
  const ribs = B.main.parts.filter(g => g.type === 'TorusGeometry');
  assert.equal(chords.length, 6, 'six raised longitudinal steel chords over the filled body');
  assert.ok(chords.every(g => g.parameters.radius === 0.045), 'longitudinal tubes 80% thicker than original 0.025 radius');
  assert.equal(ribs.length, 39, 'closely spaced transverse ribs');
  assert.ok(ribs.every(g => g.parameters.tube === 0.16), 'transverse rib tubes also thickened');
  assert.equal(B.main.parts.filter(g => g.type === 'BufferGeometry' && colorMatches(g, '#ffcf48')).length,
    46, '35 dorsal fins plus unchanged ten mane plates and one beard plate');
  const skins = B.main.parts.filter(g => colorMatches(g, '#d6a126'));
  assert.equal(skins.length, 1, 'continuous opaque gold infill present');
  const skin = skins[0], skinPositions = skin.attributes.position;
  const span = L.x1 - L.x0;
  // Frozen original wave profile: infill must follow it exactly, not flatten,
  // move or change the heights/spacing of the user-approved arches.
  const originalCenter = t => {
    const smooth = u => u * u * (3 - 2 * u);
    const feet = [0.10, 0.33, 0.67, 0.92], rises = [0.82, 1.55, 0.98];
    let rise;
    if (t < feet[0]) rise = 0.48 * (1 - smooth(t / feet[0]));
    else if (t > feet[3]) rise = 0.84 * smooth((t - feet[3]) / (1 - feet[3]));
    else {
      const k = t < feet[1] ? 0 : t < feet[2] ? 1 : 2;
      rise = rises[k] * Math.sin(Math.PI * (t - feet[k]) / (feet[k + 1] - feet[k])) ** 2;
    }
    return new Vector3(L.x0 + dx + span * t, deckY + 0.28 + rise, z);
  };
  const ringCount = (skinPositions.count - 22) / 10;
  assert.ok(Number.isInteger(ringCount) && ringCount > 100, 'tight neck has additional sweep samples');
  for (let i = 0; i < ringCount; i++) {
    const c = new Vector3();
    for (let j = 0; j < 10; j++) c.add(new Vector3().fromBufferAttribute(skinPositions, i * 10 + j));
    c.multiplyScalar(0.1);
    const t = Math.max(0, Math.min(1, (c.x - L.x0 - dx) / span));
    assert.ok(c.distanceTo(originalCenter(t)) < 2e-6, 'infill keeps original centerline exactly');
    for (let j = 0; j < 10; j++) {
      const radial = new Vector3().fromBufferAttribute(skinPositions, i * 10 + j).sub(c);
      const n = new Vector3().fromBufferAttribute(skin.attributes.normal, i * 10 + j);
      assert.ok(n.dot(radial) > 0, `skin side normals face outwards at ring ${i}, side ${j}`);
    }
  }
  const edges = new Map();
  const key = i => new Vector3().fromBufferAttribute(skinPositions, i).toArray().join(',');
  const index = skin.index.array;
  for (let i = 0; i < index.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = key(index[i + j]), b = key(index[i + (j + 1) % 3]);
    const e = a < b ? `${a}|${b}` : `${b}|${a}`;
    edges.set(e, (edges.get(e) || 0) + 1);
  }
  assert.ok([...edges.values()].every(n => n === 2), 'filled body is closed including tail/neck caps');
  for (const [i, t, direction] of [[ringCount * 10, 0, -1], [ringCount * 10 + 11, 1, 1]]) {
    const n = new Vector3().fromBufferAttribute(skin.attributes.normal, i);
    const tangent = originalCenter(Math.min(1, t + 0.001)).sub(originalCenter(Math.max(0, t - 0.001))).normalize();
    assert.ok(n.dot(tangent) * direction > 0.99, 'flat cap normals point outward');
  }
  assert.equal(B.neon.parts.filter(g => g.type === 'TubeGeometry').length, 2, 'two thin night accent strips');
  assert.equal(B.main.parts.filter(g => colorMatches(g, '#c6c4bb')).length, 4, 'four aligned river piers');
  assert.ok(B.main.vertexCount + B.neon.vertexCount < 12000, 'bounded miniature geometry budget');
  // Sample the actual upper-chord tube, averaging each four-sided cross section.
  const p = chords[0].attributes.position, ridge = [];
  for (let i = 0; i < p.count; i += 5) {
    const c = new Vector3();
    for (let k = 0; k < 4; k++) c.add(new Vector3().fromBufferAttribute(p, i + k));
    ridge.push(c.multiplyScalar(0.25));
  }
  const peaks = ridge.filter((c, i) => i > 0 && i < ridge.length - 1 && c.y > ridge[i - 1].y && c.y > ridge[i + 1].y);
  assert.equal(peaks.length, 3, 'three actual arch crests');
  assert.ok(peaks[1].y > peaks[0].y + 0.5 && peaks[1].y > peaks[2].y + 0.4, 'central arch is dominant');
  assert.ok(ridge.at(-1).y - deckY < 1.4, 'short raised neck, not an oversized vertical serpent');
  const all = new Box3(), head = new Box3();
  for (const b of Object.values(B)) {
    assert.equal(b.stack.length, 1, 'balanced head and rib frames on every material');
    for (const g of b.parts) {
      assert.ok(g.index && g.attributes.normal, 'normalized merge-compatible geometry');
      assert.ok(g.attributes.normal.array.every(Number.isFinite), 'finite normals');
      const points = g.attributes.position;
      for (let i = 0; i < points.count; i++) {
        const x = points.getX(i), y = points.getY(i), zz = points.getZ(i);
        assert.ok([x, y, zz].every(Number.isFinite), 'finite geometry');
        assert.ok(Math.abs(x) < HALF && Math.abs(zz) < HALF, 'entire structure stays on tile');
        assert.ok(y >= BED - 1e-5, 'pier bottoms at river bed');
        // Narrowest straight-running motorbike: lateral 0.32, half-width 0.11.
        // Bus: lateral 0.56, half-width 0.31, top 0.66 above road.
        if (y >= deckY - 0.001 && y <= deckY + 0.67) {
          assert.ok(Math.abs(zz - z) < 0.21,
            `low steel stays inside narrowest inner-lane envelope: ${x}, ${y}, ${zz}`);
        }
      }
      g.computeBoundingBox(); all.union(g.boundingBox);
      if (g.boundingBox.max.x > L.x1 + dx + 0.1) head.union(g.boundingBox);
    }
  }
  assert.ok(!head.isEmpty() && head.max.x > L.x1 + dx + 0.55, 'muzzle projects toward east bank');
  assert.ok(head.min.z < z - 0.28 && head.max.z > z + 0.28, 'paired head decoration on both elevations');
  assert.ok(all.max.y < deckY + 2.4, 'denser taller fins keep a low bridge silhouette, not a tower');
  // Exercise the real merge path, including normalized custom closed fin plates.
  for (const b of Object.values(B)) if (b.parts.length) {
    const g = b.toGeometry();
    assert.ok(g.attributes.position.array.every(Number.isFinite), 'finite merged geometry');
    g.dispose();
  }
}
console.log('Dragon Bridge checks passed: unchanged three-arch wave, thicker chords/39 thicker ribs, closed opaque infill/outward normals, 35 dorsal fins, tapered tail/short neck, east-facing head, four aligned piers, thin night strips, straight-lane clearance, finite merged geometry, balanced translated frames and bounded vertex budget. Headless: not visual QA or intersection collision proof.');
