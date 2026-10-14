import assert from 'node:assert/strict';
const ctx = new Proxy({}, { get: (_, key) => key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {} };
globalThis.localStorage = { getItem: () => null, setItem() {} };
let seed = 0x51a7;
Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
const THREE = await import('three');
const { activityPolicy } = await import('../src/agents/activityPolicy.js');
const { CONDITIONS } = await import('../src/weather/conditions.js');
const { cityById } = await import('../src/cities/index.js');
const { generateCity } = await import('../src/world/CityGenerator.js');
const { AgentSystem } = await import('../src/agents/AgentSystem.js');
const clampEnv = (preset, minutes, night) => ({ ...preset, minutes, night });
for (let m = -60; m <= 1500; m += 15) {
  const v = activityPolicy({ minutes: m }).street;
  assert.ok(Number.isFinite(v) && v >= 0 && v <= 1, `finite policy at ${m}`);
}
for (const m of [-1, 0, 1, 1439, 1440, 1441]) assert.ok(Math.abs(activityPolicy({ minutes: m }).evening - activityPolicy({ minutes: m + 1440 }).evening) < 1e-12);
assert.ok(activityPolicy({ minutes: 1200, night: 1 }).promenade > activityPolicy({ minutes: 120, night: 1 }).promenade);
assert.equal(activityPolicy({ minutes: 720, night: 0 }).service, 1);
for (const preset of ['thunderstorm', 'heavyRain', 'cyclone', 'fog', 'snow']) assert.equal(activityPolicy(clampEnv(CONDITIONS[preset], 720, 0)).beachActivity, 0, `${preset}: no beach activity`);

const actualZones = agents => {
  const result = { street: 0, square: 0, promenade: 0, beach: 0 };
  for (const a of agents.types.ped.agents) if (a.active && !a.leaving) result[a.activity || 'street']++;
  return result;
};
for (const id of ['hanoi', 'danang', 'hcmc']) {
  const city = generateCity(cityById(id));
  const agents = new AgentSystem(new THREE.Scene()); agents.setCity(city); agents.setWind(new THREE.Vector2(1, 0.3).normalize());
  const step = (seconds, env) => { for (let i = 0; i < seconds * 30; i++) { agents.setDt(1 / 30); agents.update(1 / 30, env); } };
  const envAt = (minutes, night, weather = CONDITIONS.clear) => clampEnv(weather, minutes, night);
  const active = name => agents.types[name].agents.filter(a => a.active && !a.leaving);
  // Legacy/minimal callers omit fog and snow; fair daylight must still spawn flocks naturally.
  step(3, { minutes: 720, night: 0, life: 1, rain: 0, wind: 0, waves: 0 });
  assert.ok(active('bird').length > 0, `${id}: natural flock spawning with minimal clear-weather env`);
  step(36, envAt(720, 0));
  const noon = actualZones(agents);
  assert.ok(noon.street + noon.square + noon.promenade + noon.beach > 0, `${id}: daytime pedestrian activity`);
  assert.ok(active('cat').length > 0, `${id}: cats spawn independently after pedestrian zone quotas fill`);
  if (city.beach) { assert.ok(city.serviceFurniture?.visible, `${id}: daytime furniture visible`); assert.ok(noon.beach > 0, `${id}: daytime sand walkers`); }

  step(36, envAt(1200, 1));
  const evening = actualZones(agents);
  assert.ok(evening.square + evening.promenade > 0, `${id}: actual evening leisure count`);
  assert.ok(evening.square + evening.promenade > noon.square + noon.promenade, `${id}: leisure reallocates from noon to evening`);
  if (id === 'hcmc') assert.ok(evening.square > 0, 'HCMC evening walkers occupy civic square');
  if (id === 'danang') assert.ok(evening.promenade > 0, 'Da Nang evening walkers occupy river promenade');
  if (city.beach) { assert.equal(city.serviceFurniture.visible, false, `${id}: no service at night`); assert.equal(active('surfer').length + active('jetski').length, 0); }

  step(36, envAt(120, 1));
  const deep = actualZones(agents);
  assert.ok(evening.square + evening.promenade > deep.square + deep.promenade, `${id}: deep night quieter than evening`);

  // Verify each independently supplied hazard retires the relevant active populations.
  const hazards = [
    ['lightning-only', { ...CONDITIONS.clear, lightning: 1 }],
    ['flood-only', { ...CONDITIONS.clear, flood: 1 }],
    ['vortex-only', { ...CONDITIONS.clear, vortex: 1 }],
    ['wind-only', { ...CONDITIONS.clear, wind: 1 }],
    ['night-only', CONDITIONS.clear, 1],
    ...['thunderstorm', 'heavyRain', 'cyclone', 'fog', 'snow'].map(k => [k, CONDITIONS[k]]),
  ];
  for (const [label, preset, n = 0] of hazards) {
    // Start each hazard transition with a known active flock, then allow its fade to settle.
    agents._spawnBirds(agents.types.bird);
    assert.ok(agents.types.bird.agents.some(a => a.active && !a.leaving), `${id}/${label}: active flock before hazard`);
    step(24, envAt(720, n, preset));
    assert.ok(agents.types.bird.agents.every(a => !a.active), `${id}/${label}: all bird slots inactive after fade settles`);
    if (label === 'cyclone') assert.equal(active('cat').length, 0, `${id}: cats retire in settled cyclone`);
    if (activityPolicy(envAt(720, n, preset)).dangerous) {
      for (const name of ['dog', 'boat', 'basket', 'jetski', 'surfer', 'kite']) assert.equal(active(name).length, 0, `${id}/${label}: ${name} retired`);
    }
    if (city.beach) assert.equal(city.serviceFurniture.visible, false, `${id}/${label}: service closed`);
  }
  step(36, envAt(720, 0));
  assert.ok(active('cat').length > 0, `${id}: cats recover after cyclone/calm weather`);
  if (city.beach) assert.ok(city.serviceFurniture.visible, `${id}: furniture recovers after calm daylight`);
  if (id === 'danang') assert.ok(active('jetski').length + active('surfer').length > 0, 'sea activity recovers in safe day');

  const allDogs = agents.types.dog.agents.filter(a => a.active && !a.leaving);
  assert.ok(allDogs.every(d => d.owner?.active && !d.owner.leaving && d.owner.dog === d && d.owner.generation === d.ownerGeneration && d.owner.path === d.path), `${id}: dog bound to active matching owner generation/path`);
  assert.ok(active('ped').length <= agents.types.ped.max, `${id}: pedestrian max unchanged`);
  // Force owner path invalidation, dog retirement/link cleanup, then reuse that exact owner slot.
  const ownerSlot = agents.types.ped.agents[0];
  for (const p of agents.types.ped.agents) agents._deactivate(p);
  const routeA = city.walkPaths[0], routeB = city.walkPaths.find(w => w.path !== routeA.path);
  const owner = agents._spawnWalk(agents.types.ped, false, routeA);
  assert.equal(owner, ownerSlot, `${id}: deterministic pedestrian slot selected`);
  const dog = agents._spawnWalk(agents.types.dog, false, routeA);
  dog.owner = owner; dog.ownerGeneration = owner.generation; owner.dog = dog; owner.ownerDog = true;
  owner.path = routeB.path;
  step(2, { ...envAt(720, 0), life: 0 });
  assert.equal(dog.active, false, `${id}: dog retires when owner changes path`);
  assert.equal(owner.dog, null, `${id}: retiring dog clears owner link`);
  const generation = owner.generation;
  agents._deactivate(owner);
  const reused = agents._spawnWalk(agents.types.ped, false, routeB);
  assert.equal(reused, ownerSlot, `${id}: inactive pedestrian slot reused`);
  assert.ok(reused.generation > generation && !reused.dog && !reused.ownerDog, `${id}: reused owner has fresh generation and clean links`);
  for (const T of Object.values(agents.types)) for (const part of T.parts) assert.ok(part.mesh.instanceMatrix.array.every(Number.isFinite), `${id}/${T.name}: finite matrices`);

  // Switching cities retires both ends of every dog link before slots can be reused.
  agents.setCity(city);
  assert.ok(agents.types.dog.agents.every(d => !d.active), `${id}: city reset retires dogs`);
  assert.ok(agents.types.ped.agents.every(p => !p.dog && !p.ownerDog), `${id}: city reset clears owner links`);
  agents.group.parent?.remove(agents.group); city.dispose();
}
console.log('Activity checks passed: real per-zone allocations at noon/evening/deep night, condition/hazard retirement and recovery, dog links, furniture, budgets and finite matrices.');
