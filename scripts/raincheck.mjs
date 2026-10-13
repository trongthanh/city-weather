import assert from 'node:assert/strict';

// Headless check of rain/splash tuning: drizzle must remain visible on mobile
// quality while staying clearly lighter than heavy rain.
const ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}) });
globalThis.document = { createElement: () => ({ width: 64, height: 64, getContext: () => ctx }), documentElement: {} };
globalThis.localStorage = { getItem: () => null, setItem() {} };
const THREE = await import('three');
const { WeatherFX } = await import('../src/weather/WeatherFX.js');
const { CONDITIONS } = await import('../src/weather/conditions.js');
const env = { night: 0, day: 1, waterLevel: 0.1, pixelRatio: 1.5, viewportWidth: 390, viewportHeight: 844 };

for (const mobile of [false, true]) {
  const fx = new WeatherFX(new THREE.Scene(), { quality: mobile ? 0.6 : 1, mobile });
  const update = (seconds, params, overrides = {}) => {
    for (let i = 0; i < seconds * 30; i++) fx.update(1 / 30, params, { ...env, ...overrides });
  };
  update(2, CONDITIONS.drizzle);
  const d = fx.rainUniforms;
  assert.ok(fx.rain.geometry.instanceCount > 0, `${mobile ? 'mobile' : 'desktop'}: drizzle renders streaks`);
  assert.ok(fx.mobile === mobile && (mobile ? d.uMinPixels.value >= 1.1 : d.uMinPixels.value >= 0.8), 'minimum on-screen width clamped');
  const heavy = fx.rainUniforms; // same object; snapshot the comparison values first
  const drizzleCount = fx.rain.geometry.instanceCount;
  const drizzleSpeed = d.uSpeed.value, drizzleLen = d.uLen.value, drizzleOpacity = d.uOpacity.value;
  update(1, CONDITIONS.heavyRain);
  assert.ok(fx.rain.geometry.instanceCount > drizzleCount, 'heavy rain is denser than drizzle');
  assert.ok(heavy.uSpeed.value > drizzleSpeed && heavy.uLen.value > drizzleLen, 'heavy rain falls faster with longer streaks');
  assert.ok(heavy.uOpacity.value > drizzleOpacity, 'heavy rain is more opaque than drizzle');
  assert.ok(fx.splashes.geometry.instanceCount > 0 && fx.splashUniforms.uRadius.value > 0.2, 'splash rings sized');
  // Falling phases continue across dt changes: no re-phase when speed ramps.
  const travel = fx.rainUniforms.uTravel.value;
  update(0.5, CONDITIONS.heavyRain);
  assert.ok(fx.rainUniforms.uTravel.value > travel, 'accumulated fall distance is monotonic');
  assert.ok(fx.rain.geometry.instanceCount <= fx.rainMax, 'instance budget respected');
  assert.equal(fx.rain.material.transparent, true);
  console.log(`rain ${mobile ? 'mobile' : 'desktop'}: drizzle ${drizzleCount}/${fx.rainMax} streaks, heavy denser/faster/longer, width clamp ok.`);
}
console.log('Rain visual checks passed.');
