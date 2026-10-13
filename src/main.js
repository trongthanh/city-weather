import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { CITIES, cityById } from './cities/index.js';
import { generateCity } from './world/CityGenerator.js';
import { M, swayUniforms } from './world/materials.js';
import { updateLandmarkLights } from './world/landmarkLighting.js';
import { waveUniforms } from './world/terrain.js';
import { WATER_LEVEL } from './world/Field.js';
import { AgentSystem, trafficLevel } from './agents/AgentSystem.js';
import { Atmosphere } from './weather/Atmosphere.js';
import { WeatherFX } from './weather/WeatherFX.js';
import { GaleFX } from './weather/GaleFX.js';
import { CONDITIONS, CONDITION_ORDER, PARAM_KEYS, beaufort, aqiLevel } from './weather/conditions.js';
import { fetchWeather, cityMinutesNow, cityDate } from './weather/service.js';
import { t, getLang, setLang, formatDate, formatClock } from './ui/i18n.js';
import { weatherIcon } from './ui/icons.js';

// ------------------------------------------------------------------ setup
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const isMobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
const quality = isMobile ? 0.6 : 1;

const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(devicePixelRatio, isMobile ? 1.75 : 2);
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 1, 800);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = 1.32;
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 0.8;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.25;
controls.target.set(0, 2.5, 0);

const atmosphere = new Atmosphere(scene, renderer, { shadowSize: isMobile ? 1024 : 2048 });
const fx = new WeatherFX(scene, { quality, mobile: isMobile });
const gale = new GaleFX(scene, { quality });
const agents = new AgentSystem(scene, { scale: isMobile ? 0.65 : 1, shadows: !isMobile });

// ------------------------------------------------------------------ state
const state = {
  city: null,
  cityDef: cityById(params.get('city') || location.hash.slice(1) || 'hanoi'),
  data: {},
  error: {},
  mode: params.get('w') && CONDITIONS[params.get('w')] ? 'sim' : 'live',
  simCondition: params.get('w') || 'clear',
  timeMode: params.get('t') || 'live',
  minutes: null,
  fit: 100,
  zoom: 1,
  qaFocus: false,
};
const cur = {};
for (const k of PARAM_KEYS) cur[k] = CONDITIONS.partly[k];
const skyCur = [new THREE.Color(CONDITIONS.partly.sky[0]), new THREE.Color(CONDITIONS.partly.sky[1])];

function activeCondition() {
  if (state.mode === 'sim') return state.simCondition;
  return state.data[state.cityDef.id]?.condition || 'partly';
}

function targetParams() {
  const id = activeCondition();
  const p = { ...CONDITIONS[id] };
  const d = state.data[state.cityDef.id];
  if (state.mode === 'live' && d) {
    p.wind = Math.max(p.wind, Math.min(1, (d.wind || 0) / 110));
    if (d.cloud != null && ['clear', 'partly', 'overcast'].includes(id)) p.clouds = p.clouds * 0.5 + (d.cloud / 100) * 0.5;
    if (p.rain > 0 && d.precip > 0) p.rain = Math.max(p.rain * 0.7, Math.min(1, d.precip / 8));
  }
  return p;
}

// ------------------------------------------------------------------ city loading
let loadToken = 0;
async function loadCity(def) {
  const token = ++loadToken;
  state.cityDef = def;
  history.replaceState(null, '', `${location.pathname}${location.search}#${def.id}`);
  $('loader').classList.remove('hide');
  renderCityTabs();
  renderHUD(true);
  await new Promise((r) => setTimeout(r, 40));
  if (token !== loadToken) return;
  if (state.city) {
    scene.remove(state.city.group);
    state.city.dispose();
  }
  const city = generateCity(def, { lowDetail: isMobile });
  console.info(`[city] ${def.id}`, city.stats);
  state.city = city;
  scene.add(city.group);
  agents.setCity(city);
  gale.setCity(city);
  resetCamera();
  $('loader').classList.add('hide');
  refreshWeather(def);
}

async function refreshWeather(def = state.cityDef, force = false) {
  try {
    const d = await fetchWeather(def, { force });
    state.data[def.id] = d;
    state.error[def.id] = false;
  } catch (e) {
    console.warn('weather fetch failed', e);
    state.error[def.id] = true;
    if (!state.data[def.id]) {
      state.data[def.id] = { condition: 'partly', temp: 30, feels: 33, tMin: 25, tMax: 33, humidity: 70, wind: 8, gust: 15, precip: 0, aqi: null, utcOffset: 25200, sunrise: 345, sunset: 1065, fetchedAt: Date.now(), synthetic: true };
    }
    if (def === state.cityDef) toast(t().offline);
  }
  if (def === state.cityDef) renderHUD(true);
}

setInterval(() => refreshWeather(state.cityDef, true), 10 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshWeather(state.cityDef); });

// ------------------------------------------------------------------ camera framing
function availableRegion() {
  const w = innerWidth, h = innerHeight;
  const landscape = w / h >= 1.1;
  const hero = $('hero').getBoundingClientRect();
  const dock = $('cities').getBoundingClientRect();
  if (landscape) {
    const x0 = Math.min(hero.right + 10, w * 0.45);
    return { x0, x1: w, y0: 50, y1: dock.top - 6, w, h };
  }
  const y0 = Math.min(hero.bottom - 6, h * 0.48);
  return { x0: 0, x1: w, y0, y1: Math.max(y0 + 120, dock.top - 6), w, h };
}

function layout() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // QA close-ups use the whole canvas and retain their explicit camera distance.
  // Adaptive-resolution layout calls must not pull them back to the full-city view.
  if (state.qaFocus) {
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    return;
  }
  const r = availableRegion();
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
  camera.updateProjectionMatrix();
  const rw = (r.x1 - r.x0) / w, rh = (r.y1 - r.y0) / h;
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const span = state.cityDef.camera?.span || [58, 44];
  const dh = span[1] / rh / (2 * tanH);
  const dw = span[0] / rw / (2 * tanH * camera.aspect);
  // Mobile deliberately crops the tile edges instead of shrinking every landmark to fit.
  // Keep this in the framing distance so resize/city switches preserve relative pinch zoom.
  const framingScale = isMobile ? 0.82 : 1;
  state.fit = Math.max(dh, dw) * framingScale;
  controls.minDistance = state.fit * 0.28;
  controls.maxDistance = state.fit * 1.6;
  const dir = camera.position.clone().sub(controls.target);
  if (dir.lengthSq() > 0) camera.position.copy(controls.target).add(dir.setLength(state.fit * state.zoom));
}

function resetCamera() {
  state.qaFocus = false;
  state.zoom = 1;
  const { azimuth = 35, elevation = 40, targetY = 2.5 } = state.cityDef.camera || {};
  controls.target.set(0, targetY, 0);
  const az = THREE.MathUtils.degToRad(azimuth), el = THREE.MathUtils.degToRad(elevation);
  camera.position.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).add(controls.target);
  layout();
  controls.update();
}

controls.addEventListener('end', () => { state.zoom = camera.position.distanceTo(controls.target) / state.fit; });
let idleTimer = null;
controls.addEventListener('start', () => {
  controls.autoRotate = false;
  $('hint').classList.add('hide');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { controls.autoRotate = true; }, 15000);
});
addEventListener('resize', () => requestAnimationFrame(layout));
setTimeout(() => $('hint').classList.add('hide'), 7000);

// ------------------------------------------------------------------ UI
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 4200);
}

function renderCityTabs() {
  const L = getLang();
  $('cities').innerHTML = CITIES.map((c) => `<button role="tab" data-city="${c.id}" class="${c.id === state.cityDef.id ? 'on' : ''}">${c.name[L]}</button>`).join('');
}
$('cities').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-city]');
  if (!b || b.dataset.city === state.cityDef.id) return;
  loadCity(cityById(b.dataset.city));
});

let lastIconKey = '';
function renderHUD(force = false) {
  const S = t();
  const L = getLang();
  const def = state.cityDef;
  const d = state.data[def.id];
  const cond = activeCondition();
  const night = atmosphere.night > 0.5;
  const title = def.title?.[L] || def.name[L];
  const titleEl = $('city-title');
  if (titleEl.textContent !== title) titleEl.textContent = title;
  titleEl.classList.toggle('long', title.length > 12);

  const iconKey = `${CONDITIONS[cond].icon}-${night}`;
  if (force || iconKey !== lastIconKey) {
    $('wx-icon').innerHTML = weatherIcon(CONDITIONS[cond].icon, night);
    lastIconKey = iconKey;
  }
  let label = S.cond[cond];
  if (night && (cond === 'clear' || cond === 'partly')) label = S.cond[cond + 'Night'];
  $('wx-label').innerHTML = label + (state.mode === 'sim' ? `<span class="badge">${S.simulating}</span>` : '');

  if (d) {
    $('temp-range').textContent = `${Math.round(d.tMin)}°C - ${Math.round(d.tMax)}°C`;
    $('temp-now').textContent = `${S.now} ${Math.round(d.temp)}°C · ${S.feels} ${Math.round(d.feels)}°C`;
    const lvl = aqiLevel(d.aqi);
    $('aqi').innerHTML = lvl ? `<span class="pill" style="background:${lvl.color}"></span>${S.aqiLabel}: ${Math.round(d.aqi)} (${S.aqi[lvl.key]})` : '';
    const now = cityDate(d.utcOffset);
    const timeLabel = state.timeMode === 'live' ? formatClock(now) : S[state.timeMode];
    $('date').textContent = `${formatDate(now)} · ${timeLabel}`;
    const bf = beaufort(d.wind);
    $('chips').innerHTML = [
      `<span class="chip">💨 ${S.wind} <b>${Math.round(d.wind)} km/h</b> · ${S.windLevel(bf)}</span>`,
      `<span class="chip">💧 ${S.humidity} <b>${Math.round(d.humidity)}%</b></span>`,
      `<span class="chip">🌧 ${S.precip} <b>${(d.precip ?? 0).toFixed(1)} mm</b></span>`,
      d.uv != null ? `<span class="chip">☀️ ${S.uv} <b>${Math.round(d.uv)}</b></span>` : '',
      (() => { const tl = trafficLevel(state.minutes ?? 720); const k = tl > 0.62 ? 'high' : tl > 0.3 ? 'mid' : 'low'; return `<span class="chip">🛵 ${S.traffic} <b>${S.trafficLv[k]}</b></span>`; })(),
    ].join('');
    const live = $('live');
    live.classList.toggle('sim', state.mode === 'sim');
    live.classList.toggle('err', !!state.error[def.id] && state.mode !== 'sim');
    $('updated').textContent = state.mode === 'sim' ? S.simulating : state.error[def.id] ? S.offline.split('—')[0].trim() : S.updated(formatClock(new Date(d.fetchedAt + (d.utcOffset ?? 25200) * 1000)));
  } else {
    $('temp-range').textContent = '— °C';
    $('temp-now').textContent = ''; $('aqi').textContent = ''; $('chips').innerHTML = '';
    $('date').textContent = formatDate(cityDate(25200));
    $('updated').textContent = '…';
  }
  const simBtn = $('sim-btn');
  simBtn.innerHTML = state.mode === 'sim' ? `⛈️ ${S.simulating}: ${S.cond[state.simCondition]}` : `🌀 ${S.simulate}`;
  simBtn.classList.toggle('active', state.mode === 'sim');
  document.querySelectorAll('.lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === L));
  $('loader-text').textContent = S.loading;
  $('hint').textContent = S.hint;
}

function renderSimPanel() {
  const S = t();
  $('sim-title').textContent = S.simulate;
  $('time-title').textContent = S.time;
  $('cond-grid').innerHTML = CONDITION_ORDER.map((c) => `<button data-c="${c}" class="${state.mode === 'sim' && state.simCondition === c ? 'on' : ''}">${weatherIcon(CONDITIONS[c].icon)}<span>${S.cond[c]}</span></button>`).join('');
  $('time-seg').innerHTML = ['live', 'morning', 'noon', 'sunset', 'night'].map((k) => `<button data-t="${k}" class="${state.timeMode === k ? 'on' : ''}">${k === 'live' ? S.timeLive : S[k]}</button>`).join('');
  $('live-btn').textContent = `📡 ${S.backToLive}`;
}
function openSim(open) {
  $('sim-panel').classList.toggle('open', open);
  $('sim-panel').setAttribute('aria-hidden', String(!open));
  $('sim-btn').setAttribute('aria-expanded', String(open));
  if (open) renderSimPanel();
}
$('sim-btn').addEventListener('click', () => openSim(true));
$('sim-close').addEventListener('click', () => openSim(false));
$('sim-panel').addEventListener('click', (e) => { if (e.target.id === 'sim-panel') openSim(false); });
$('cond-grid').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-c]');
  if (!b) return;
  state.mode = 'sim';
  state.simCondition = b.dataset.c;
  renderSimPanel(); renderHUD(true);
});
$('time-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-t]');
  if (!b) return;
  state.timeMode = b.dataset.t;
  renderSimPanel(); renderHUD(true);
});
$('live-btn').addEventListener('click', () => {
  state.mode = 'live'; state.timeMode = 'live';
  openSim(false); renderHUD(true);
});
document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => {
  setLang(b.dataset.lang);
  renderCityTabs(); renderHUD(true);
  if ($('sim-panel').classList.contains('open')) renderSimPanel();
  requestAnimationFrame(layout);
}));
addEventListener('keydown', (e) => { if (e.key === 'Escape') openSim(false); });

// stars
{
  const s = $('stars');
  let html = '';
  for (let i = 0; i < 110; i++) html += `<i style="left:${Math.random() * 100}%;top:${Math.random() * 65}%;animation-delay:${Math.random() * 3}s;opacity:${0.4 + Math.random() * 0.6}"></i>`;
  s.innerHTML = html;
}

// ------------------------------------------------------------------ loop
const timer = new THREE.Timer();
timer.connect(document);
let elapsed = 0, perfAcc = 0, perfFrames = 0, hudTimer = 0, cssTimer = 0;
const waterBase = new THREE.Color(), mud = new THREE.Color('#8a7a5c'), shake = new THREE.Vector3();
let inkDark = false;

function timeTarget(d) {
  const sr = d?.sunrise ?? 345, ss = d?.sunset ?? 1065;
  switch (state.timeMode) {
    case 'morning': return 8 * 60;
    case 'noon': return 12 * 60 + 30;
    case 'sunset': return ss - 10;
    case 'night': return 22 * 60;
    default: return cityMinutesNow(d?.utcOffset ?? 25200);
  }
}

function frame() {
  requestAnimationFrame(frame);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  elapsed += dt;
  const def = state.cityDef;
  const d = state.data[def.id];

  // weather params
  const tgt = targetParams();
  const k = Math.min(1, dt * 0.7);
  for (const key of PARAM_KEYS) cur[key] += (tgt[key] - cur[key]) * k;
  skyCur[0].lerp(new THREE.Color(tgt.sky[0]), k);
  skyCur[1].lerp(new THREE.Color(tgt.sky[1]), k);

  // time of day
  const tm = timeTarget(d);
  if (state.minutes == null) state.minutes = tm;
  state.minutes += (tm - state.minutes) * Math.min(1, dt * 1.2);

  const camDist = camera.position.distanceTo(controls.target);
  const fxOut = fx.update(dt, cur, {
    night: atmosphere.night, day: atmosphere.day, waterLevel: waveUniforms.uLevel.value, pixelRatio,
    camPos: camera.position, camTarget: controls.target,
    viewportWidth: innerWidth, viewportHeight: innerHeight,
    windAngle: d && state.mode === 'live' && d.windDir != null ? THREE.MathUtils.degToRad(d.windDir + 180) : null,
  });
  const atm = atmosphere.update(dt, {
    minutes: state.minutes, sunrise: d?.sunrise ?? 345, sunset: d?.sunset ?? 1065,
    p: cur, skyDay: [skyCur[0], skyCur[1]], flash: fxOut.flash, camDist,
  });

  updateLandmarkLights(state.city?.landmarkLights, atm.lit);

  // world uniforms
  waveUniforms.uTime.value = elapsed;
  waveUniforms.uWave.value = 0.03 + cur.waves * 0.2;
  waveUniforms.uLevel.value = WATER_LEVEL + cur.flood * 0.42;
  swayUniforms.uTime.value = elapsed;
  swayUniforms.uWind.value = cur.wind;
  swayUniforms.uWindDir.value.copy(fxOut.windDir);
  if (state.city) {
    waveUniforms.uFlood.value = cur.flood * 0.75;
  }
  M.neon.emissive.setHSL((0.1 + Math.sin(elapsed * 0.25) * 0.08 + 1) % 1, 0.9, 0.55);

  gale.update(dt, cur, fxOut.windDir);
  agents.setDt(dt);
  agents.setWind(fxOut.windDir);
  agents.update(dt, { night: atm.night, life: cur.life, rain: cur.rain, wind: cur.wind, waves: cur.waves, minutes: state.minutes });

  // CSS sky (throttled)
  cssTimer -= dt;
  if (cssTimer <= 0) {
    cssTimer = 0.08;
    const root = document.documentElement.style;
    root.setProperty('--sky-top', `#${atmosphere.skyTop.getHexString()}`);
    root.setProperty('--sky-bottom', `#${atmosphere.skyBottom.getHexString()}`);
    $('stars').style.opacity = String(Math.max(0, atm.night - 0.3) * (1 - cur.clouds * 0.8) * 1.4);
    $('flash').style.opacity = String(fxOut.flash * 0.3);
    const c = atmosphere.skyTop;
    const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; // linear
    const want = inkDark ? lum > 0.5 : lum > 0.55;
    if (want !== inkDark) { inkDark = want; document.body.classList.toggle('ink-dark', inkDark); }
    document.querySelector('meta[name=theme-color]').setAttribute('content', `#${atmosphere.skyTop.getHexString()}`);
  }
  hudTimer -= dt;
  if (hudTimer <= 0) { hudTimer = 1; renderHUD(); }

  controls.update();
  // storm camera shake
  const sh = cur.vortex * 0.06 + cur.wind * 0.01;
  shake.set((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
  camera.position.add(shake);
  renderer.render(scene, camera);
  camera.position.sub(shake);

  // adaptive resolution
  perfAcc += dt; perfFrames++;
  if (perfAcc > 2.5) {
    const avg = perfAcc / perfFrames;
    if (avg > 1 / 40 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); layout(); }
    perfAcc = 0; perfFrames = 0;
  }
}

// ------------------------------------------------------------------ boot
renderCityTabs();
renderHUD(true);
layout();
loadCity(state.cityDef).then(async () => {
  frame();
  // reveal only after the first frame is drawn and web fonts are ready (no unstyled flash)
  await Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  renderHUD(true);
  layout();
  document.body.classList.remove('booting');
  $('splash').classList.add('gone');
  setTimeout(() => $('splash').remove(), 800);
});

// debug handle
window.__cw = {
  state, scene, camera, renderer, agents, fx, gale, cur, loadCity, cityById,
  /** QA helper: reproducible full-canvas close-up, independent of HUD framing. */
  focus(x, z, dist = 14, y = 0.5, azimuth = 25, elevation = 40) {
    state.qaFocus = true;
    controls.autoRotate = false;
    clearTimeout(idleTimer);
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    controls.minDistance = 1;
    controls.maxDistance = Math.max(state.fit * 1.6, dist * 2);
    const az = THREE.MathUtils.degToRad(azimuth), el = THREE.MathUtils.degToRad(elevation);
    // fixed south-east viewpoint (not the auto-rotated one) so QA shots are reproducible
    const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    controls.target.set(x, y, z);
    camera.position.copy(controls.target).addScaledVector(dir, dist);
    controls.update();
    return 'ok';
  },
};
