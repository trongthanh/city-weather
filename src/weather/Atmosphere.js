import * as THREE from 'three';
import { M } from '../world/materials.js';
import { clamp, smoothstep, lerp } from '../core/rng.js';

// Sun/moon, sky gradient, fog and night-time emissives driven by time of day + weather params.

const C = (h) => new THREE.Color(h);
const NIGHT_SKY = [C('#0d1a36'), C('#22335a')];
const NIGHT_SKY_CLOUDY = [C('#1a2029'), C('#323a45')];
const DUSK_TOP = C('#6f7fb8'), DUSK_BOTTOM = C('#f5a66e');
const _a = new THREE.Color(), _b = new THREE.Color(), _c = new THREE.Color();

export class Atmosphere {
  constructor(scene, renderer, { shadowSize = 2048 } = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.hemi = new THREE.HemisphereLight('#cfe6ff', '#b39a7a', 1.0);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff2df', 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    const sc = this.sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 140;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun);
    scene.add(this.sun.target);
    scene.fog = new THREE.Fog('#cfe9f7', 80, 220);
    this.skyTop = new THREE.Color('#7cc3ee');
    this.skyBottom = new THREE.Color('#cfe9f7');
    this.night = 0;
    this.day = 1;
  }

  /** minutes: local time; sunrise/sunset minutes; p: weather params; skyDay: [top,bottom] colours */
  update(dt, { minutes, sunrise, sunset, p, skyDay, flash, camDist }) {
    // --- sun elevation
    const dayLen = sunset - sunrise;
    let frac = (minutes - sunrise) / dayLen;
    let sinEl;
    if (frac >= 0 && frac <= 1) sinEl = Math.sin(Math.PI * frac) * 0.94;
    else {
      const away = frac < 0 ? (sunrise - minutes) : (minutes - sunset);
      const a = ((away % 1440) + 1440) % 1440;
      sinEl = -clamp(Math.min(a, 1440 - dayLen - a) / 120, 0, 1);
    }
    const day = smoothstep(-0.12, 0.18, sinEl);
    const night = 1 - day;
    const dusk = clamp(1 - Math.abs(sinEl - 0.02) / 0.22) * (1 - p.clouds * 0.7);
    this.day = day; this.night = night;

    // --- light direction
    const phi = Math.PI * clamp(frac, -0.1, 1.1);
    const el = Math.asin(clamp(Math.max(sinEl, 0.08), -1, 1));
    const dir = new THREE.Vector3(Math.cos(phi) * Math.cos(el), Math.sin(el), 0.45 * Math.cos(el)).normalize();
    const moonDir = new THREE.Vector3(-0.35, 0.85, 0.4).normalize();
    const ld = day > 0.5 ? dir : moonDir;
    this.sun.position.copy(ld).multiplyScalar(70);
    this.sun.target.position.set(0, 0, 0);

    const sunCol = _a.set('#fff4e4').lerp(C('#ffb47a'), clamp(1 - sinEl / 0.35) * day);
    const moonCol = C('#9db4ff');
    this.sun.color.copy(sunCol).lerp(moonCol, night);
    const sunI = day * 3.0 * p.sun * smoothstep(0.0, 0.2, sinEl) + night * 0.55 * (1 - p.clouds * 0.6);
    this.sun.intensity = sunI;

    // --- sky
    const nightSky = NIGHT_SKY.map((c, i) => c.clone().lerp(NIGHT_SKY_CLOUDY[i], p.clouds));
    _b.set(skyDay[0]); _c.set(skyDay[1]);
    _b.lerp(DUSK_TOP, dusk * 0.6); _c.lerp(DUSK_BOTTOM, dusk * 0.75);
    _b.lerp(nightSky[0], night); _c.lerp(nightSky[1], night);
    if (flash > 0) { _b.lerp(C('#c9d4ea'), flash * 0.35); _c.lerp(C('#e6ecf7'), flash * 0.35); }
    const k = Math.min(1, dt * 2.5);
    this.skyTop.lerp(_b, k); this.skyBottom.lerp(_c, k);

    // --- hemisphere / ambient
    this.hemi.color.copy(this.skyTop).lerp(C('#ffffff'), 0.35);
    this.hemi.groundColor.set('#b49b7c').lerp(C('#1d2333'), night);
    this.hemi.intensity = lerp(0.45, 1.05 + (1 - p.sun) * 0.45, day) + flash * 1.8;
    this.scene.environmentIntensity = lerp(0.12, 0.55, day) * (0.7 + 0.3 * p.sun);

    // --- fog
    const fogAmt = Math.max(p.fog, p.haze * 0.6);
    const near = camDist * lerp(1.1, 0.55, fogAmt);
    const far = camDist * lerp(2.6, 1.55, fogAmt);
    this.scene.fog.near = near; this.scene.fog.far = far;
    this.scene.fog.color.copy(this.skyBottom);

    // --- night emissives
    const lit = smoothstep(0.15, 0.85, night + (1 - p.sun) * 0.35);
    M.lit.emissiveIntensity = lit * 1.35;
    M.lamp.emissiveIntensity = lit * 2.2;
    M.pool.opacity = lit * 0.55;
    M.neon.emissiveIntensity = lit * 0.9;
    this.lit = lit;
    return { night, day, sinEl, lit };
  }
}
