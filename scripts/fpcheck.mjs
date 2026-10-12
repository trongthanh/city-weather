// Reports landmark footprints that overlap road asphalt/sidewalks or leave the tile.
const ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}) });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {} };
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { cityById } = await import('../src/cities/index.js');
const { RNG, hashString } = await import('../src/core/rng.js');
const { Field } = await import('../src/world/Field.js');
const { prepareRoads } = await import('../src/world/roads.js');
const def = cityById(process.argv[2] || 'hanoi');
const layout = def.layout(new RNG(def.seed).fork('layout'));
const field = new Field(layout, hashString(def.seed));
const roads = prepareRoads(layout.roads, field);
for (const L of layout.landmarks) {
  const fp = L.footprint; if (!fp) continue;
  const cx = fp.x ?? L.x, cz = fp.z ?? L.z, ry = L.ry || 0;
  let worst = 0, edge = false;
  const pts = [];
  if (fp.type === 'circle') for (let a = 0; a < 6.28; a += 0.2) pts.push([cx + Math.cos(a) * fp.r, cz + Math.sin(a) * fp.r]);
  else for (let u = -0.5; u <= 0.5; u += 0.1) for (let v = -0.5; v <= 0.5; v += 0.1) {
    const lx = u * fp.w, lz = v * fp.d; pts.push([cx + lx * Math.cos(ry) + lz * Math.sin(ry), cz - lx * Math.sin(ry) + lz * Math.cos(ry)]);
  }
  for (const [x, z] of pts) {
    if (Math.abs(x) > 21.8 || Math.abs(z) > 21.8) edge = true;
    for (const r of roads) { const o = r.hw + r.sw - r.path.distance(x, z); if (o > worst) worst = o; }
  }
  console.log(L.type.padEnd(16), worst > 0.05 ? `OVERLAP ${worst.toFixed(2)}` : 'ok', edge ? 'EDGE' : '');
}
