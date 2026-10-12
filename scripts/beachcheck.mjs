import assert from 'node:assert/strict';

// Canvas textures are not rendered in this headless agent regression check.
const ctx = new Proxy({}, { get: (_, key) => key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {} };
globalThis.localStorage = { getItem: () => null, setItem() {} };
const THREE = await import('three');
const { cityById } = await import('../src/cities/index.js');
const { generateCity } = await import('../src/world/CityGenerator.js');
const { AgentSystem } = await import('../src/agents/AgentSystem.js');
const city = generateCity(cityById('danang'));
const agents = new AgentSystem(new THREE.Scene());
agents.setCity(city);
agents.setWind(new THREE.Vector2(1, 0.3).normalize());
const env = { minutes: 720, life: 1, night: 0, rain: 0, waves: 0.05, wind: 0.25 };
const count = name => agents.types[name].agents.filter(a => a.active && !a.leaving).length;
function step(seconds, overrides = {}) {
  for (let frame = 0; frame < seconds * 30; frame++) {
    agents.setDt(1 / 30);
    agents.update(1 / 30, { ...env, ...overrides });
    for (const name of ['jetski', 'surfer', 'kite']) {
      const type = agents.types[name];
      for (const part of type.parts) assert.ok(part.mesh.instanceMatrix.array.every(Number.isFinite), `${name}: finite transforms`);
      for (const a of type.agents.filter(a => a.active)) {
        if (type.spec.kind === 'sea') {
          const x = a.coastFn(a.z) + a.off;
          assert.ok(x < 22 && Math.abs(a.z) < 22, `${name}: inside tile`);
          assert.ok(city.field.waterSD(x, a.z) < 0, `${name}: on water`);
        }
      }
    }
    assert.ok(agents.strings.geometry.attributes.position.array.every(Number.isFinite), 'finite kite strings');
  }
}
step(60);
for (const name of ['jetski', 'surfer', 'kite']) assert.ok(count(name) > 0, `${name}: active in fair weather`);
assert.equal(count('basket'), 0, 'no basket boats');
assert.ok(city.waterPaths.every(w => w.kind === 'boat' && w.path.points.every(p => p.x < 4)), 'boats only on Han River');
const sail = agents.types.kite.parts[0].mesh.geometry;
const normals = sail.attributes.normal.array;
assert.ok(normals.includes(1) && normals.includes(-1), 'kite has front and back normals');
step(5, { night: 1 });
for (const name of ['jetski', 'surfer', 'kite']) assert.equal(count(name), 0, `${name}: retires at night`);
step(5, { rain: 1, wind: 1, waves: 1 });
for (const name of ['jetski', 'surfer', 'kite']) assert.equal(count(name), 0, `${name}: retires during storm`);
agents.setCity(generateCity(cityById('hcmc')));
step(5);
for (const name of ['jetski', 'surfer', 'kite']) assert.equal(count(name), 0, `${name}: absent outside beach city`);
console.log('Beach regression checks passed: fair-weather activity, water/tile bounds, two-sided kites, night/storm retirement, city switching.');
