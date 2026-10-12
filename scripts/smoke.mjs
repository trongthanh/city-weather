// Headless smoke test: generate every city and run agents for a few seconds.
const ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}) });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }), documentElement: {} };
globalThis.localStorage = { getItem: () => null, setItem() {} };
const THREE = await import('three');
const { CITIES } = await import('../src/cities/index.js');
const { generateCity } = await import('../src/world/CityGenerator.js');
const { AgentSystem } = await import('../src/agents/AgentSystem.js');
const { GaleFX } = await import('../src/weather/GaleFX.js');
const { CONDITIONS } = await import('../src/weather/conditions.js');
const gale = new GaleFX(new THREE.Scene(), {});
const scene = new THREE.Scene();
const agents = new AgentSystem(scene, {});
for (const def of CITIES) {
  const city = generateCity(def);
  console.log(def.id, JSON.stringify(city.stats), 'roads', city.roads.length, 'junctions', city.roads.reduce((a, r) => a + r.junctions.length, 0), 'walks', city.walkPaths.length, 'water', city.waterPaths.length);
  agents.setCity(city);
  for (const [label, minutes, night] of [['03:00', 180, 1], ['07:15', 435, 0], ['10:00', 600, 0], ['17:30', 1050, 0]]) {
    for (let i = 0; i < 900; i++) { agents.setDt(1 / 30); agents.update(1 / 30, { night, life: 1, rain: 0, wind: 0.1, waves: 0.05, minutes }); }
    const c = agents.types;
    const n = (k) => c[k].agents.filter((a) => a.active && !a.leaving).length;
    console.log(`  ${label} traffic=${agents.traffic.toFixed(2)} bikes=${n('motorbike')} cars=${n('car')} bus=${n('bus')} peds=${n('ped')} jetski=${n('jetski')} surfer=${n('surfer')} kite=${n('kite')} boat=${n('boat')}`);
  }
  let bad = 0;
  for (const T of Object.values(agents.types)) for (const p of T.parts) { const a = p.mesh.instanceMatrix.array; for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) { bad++; break; } }
  if (bad) console.log('  NaN matrices in', bad, 'parts');
  gale.setCity(city);
  const wd = new THREE.Vector2(1, 0.3).normalize();
  for (let i = 0; i < 400; i++) gale.update(1 / 30, CONDITIONS.cyclone, wd);
  const st = gale.roofs.reduce((m, r) => { m[r.state] = (m[r.state] || 0) + 1; return m; }, {});
  const act = (p) => p.items.filter((a) => a.active).length;
  console.log('  gale', JSON.stringify({ roofs: gale.roofs.length, states: st, leaves: act(gale.leaves), shards: act(gale.shards), trees: act(gale.trees) }));
  for (let i = 0; i < 200; i++) gale.update(1 / 30, CONDITIONS.clear, wd);
  console.log('  after calm', JSON.stringify(gale.roofs.reduce((m, r) => { m[r.state] = (m[r.state] || 0) + 1; return m; }, {})));
  city.dispose();
}
