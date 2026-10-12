import assert from 'node:assert/strict';
const ctx = new Proxy({}, { get: (_, key) => key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }), documentElement: {} };
globalThis.localStorage = { getItem: () => null, setItem() {} };
const THREE = await import('three');
const { CITIES } = await import('../src/cities/index.js');
const { generateCity } = await import('../src/world/CityGenerator.js');
const { updateLandmarkLights } = await import('../src/world/landmarkLighting.js');
const { Atmosphere } = await import('../src/weather/Atmosphere.js');
const { CONDITIONS } = await import('../src/weather/conditions.js');
const atmosphere = new Atmosphere(new THREE.Scene(), null);
const expected = { hanoi: ['hcmMausoleum', 'stJoseph', 'operaHouse'], danang: ['danangCathedral'], hcmc: ['notreDame', 'cityHall'] };
for (const def of CITIES) {
  const city = generateCity(def);
  const lights = city.landmarkLights.children.filter(o => o.isSpotLight);
  assert.ok(lights.length > 0 && lights.length <= 6, 'bounded light count');
  for (const type of expected[def.id]) assert.ok(lights.some(l => l.name.startsWith(type)), `${def.id}: ${type} has lighting`);
  for (const l of lights) {
    assert.equal(l.castShadow, false, 'no additional shadow passes');
    assert.ok(l.position.toArray().every(Number.isFinite) && l.target.position.toArray().every(Number.isFinite));
    assert.ok(l.position.distanceTo(l.target.position) > 0.1 && l.position.distanceTo(l.target.position) < l.distance);
    assert.ok(Math.abs(l.position.x) < 22 && Math.abs(l.position.z) < 22, 'fixture transforms inside city');
  }
  for (const [minutes, expectedLevel] of [[720, 0], [1380, 1]]) {
    const atm = atmosphere.update(1, { minutes, sunrise: 345, sunset: 1065, p: CONDITIONS.clear,
      skyDay: CONDITIONS.clear.sky, flash: 0, camDist: 100 });
    updateLandmarkLights(city.landmarkLights, atm.lit);
    for (const l of lights) assert.equal(l.intensity, l.userData.nightIntensity * expectedLevel, 'off at noon / on at night');
  }
  updateLandmarkLights(city.landmarkLights, 0.5);
  for (const l of lights) assert.equal(l.intensity, l.userData.nightIntensity * 0.5, 'continuous dusk transition');
  console.log(`${def.id}: ${lights.length} warm uplights; rotated/scaled positions, day/night/dusk levels passed.`);
  city.dispose();
}
console.log('Landmark lighting regression checks passed.');
