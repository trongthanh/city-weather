import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HALF } from '../world/Field.js';

// Clouds, rain, splashes, snow, mist, lightning, typhoon vortex and flying debris.

const rr = (a, b) => a + (b - a) * Math.random();
const smoothstepJS = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

function puffGeometry(seed) {
  const parts = [];
  const n = 5 + (seed % 4);
  let rnd = seed * 9301 + 49297;
  const r = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    const s = 0.6 + r() * 0.7;
    const g = new THREE.IcosahedronGeometry(s, 2);
    g.translate((i - n / 2) * 0.75 + r() * 0.3, r() * 0.35 + (i % 2) * 0.25, (r() - 0.5) * 0.9);
    parts.push(g);
  }
  const top = new THREE.IcosahedronGeometry(0.9, 2);
  top.translate(0, 0.55, 0);
  parts.push(top);
  const g = mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p; }));
  g.scale(1, 0.72, 1);
  // flatten bottom
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < -0.25) pos.setY(i, -0.25 + (pos.getY(i) + 0.25) * 0.25);
  g.computeVertexNormals();
  return g;
}

function ringTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 5;
  g.beginPath(); g.arc(32, 32, 24, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c);
  return t;
}

export class WeatherFX {
  constructor(scene, { quality = 1 } = {}) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'weatherFX';
    scene.add(this.group);
    this.quality = quality;
    this.time = 0;
    this.windDir = new THREE.Vector2(1, 0.3).normalize();
    this.flash = 0;
    this.nextStrike = 3;
    this.bolts = [];
    // single persistent light (adding lights at runtime would recompile every shader)
    this.boltLight = new THREE.PointLight('#cfe0ff', 0, 40, 1.5);
    scene.add(this.boltLight);

    this._initClouds();
    this._initRain();
    this._initSplashes();
    this._initSnow();
    this._initMist();
    this._initVortex();
    this._initDebris();
  }

  // ------------------------------------------------------------ clouds
  _initClouds() {
    this.cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0, transparent: true, opacity: 0.96, emissive: '#ffffff', emissiveIntensity: 0.12 });
    const geos = [1, 2, 3, 4, 5].map(puffGeometry);
    this.clouds = [];
    const N = 26;
    for (let i = 0; i < N; i++) {
      const m = new THREE.Mesh(geos[i % geos.length], this.cloudMat.clone());
      const a = Math.random() * Math.PI * 2;
      const r = rr(3, 24);
      m.position.set(Math.cos(a) * r, rr(14, 20), Math.sin(a) * r);
      const s = rr(1.3, 2.5);
      m.userData = { base: s, order: i / N, speed: rr(0.7, 1.3), low: false };
      m.scale.setScalar(0.001);
      m.rotation.y = Math.random() * Math.PI;
      m.castShadow = true;
      this.group.add(m);
      this.clouds.push(m);
    }
  }

  // ------------------------------------------------------------ rain (instanced camera-facing streaks)
  _initRain() {
    const max = Math.round(11000 * this.quality);
    this.rainMax = max;
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    const seeds = new Float32Array(max * 4);
    for (let i = 0; i < max * 4; i++) seeds[i] = Math.random();
    quad.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    quad.instanceCount = 0;
    this.rainUniforms = {
      uTime: { value: 0 }, uWind: { value: new THREE.Vector2() }, uSpeed: { value: 16 },
      uLen: { value: 0.7 }, uWidth: { value: 0.022 }, uOpacity: { value: 0.5 }, uColor: { value: new THREE.Color('#dfe9f3') },
      uArea: { value: 52 }, uHeight: { value: 26 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.rainUniforms,
      transparent: true, depthWrite: false,
      vertexShader: `
        attribute vec4 aSeed;
        uniform float uTime, uSpeed, uLen, uWidth, uArea, uHeight;
        uniform vec2 uWind;
        varying float vA;
        void main(){
          float fall = uSpeed * (0.8 + 0.4 * aSeed.w);
          float y = mod(aSeed.z * uHeight - uTime * fall, uHeight) - 1.0;
          vec3 vel = vec3(uWind.x, -fall, uWind.y);
          vec3 p = vec3(aSeed.x * uArea - uArea * 0.5, y, aSeed.y * uArea - uArea * 0.5);
          p.xz -= uWind * (y / fall);
          p.xz = mod(p.xz + uArea * 0.5, uArea) - uArea * 0.5;
          vec3 d = normalize(vel);
          vec3 tail = p - d * uLen;
          vec3 pos = mix(tail, p, position.y);
          vec3 toCam = normalize(cameraPosition - pos);
          vec3 side = normalize(cross(d, toCam));
          pos += side * position.x * uWidth;
          vA = position.y * smoothstep(-1.0, 0.5, y) * (1.0 - smoothstep(uArea*0.42, uArea*0.5, length(p.xz)));
          gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uOpacity; varying float vA;
        void main(){ gl_FragColor = vec4(uColor, uOpacity * vA); }`,
    });
    this.rain = new THREE.Mesh(quad, mat);
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 5;
    this.group.add(this.rain);
  }

  _initSplashes() {
    const max = Math.round(1600 * this.quality);
    this.splashMax = max;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    const seeds = new Float32Array(max * 4);
    for (let i = 0; i < max; i++) {
      seeds[i * 4] = (Math.random() - 0.5) * 43; seeds[i * 4 + 1] = (Math.random() - 0.5) * 43;
      seeds[i * 4 + 2] = Math.random(); seeds[i * 4 + 3] = 0.6 + Math.random() * 0.8;
    }
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    g.instanceCount = 0;
    this.splashUniforms = { uTime: { value: 0 }, uMap: { value: ringTexture() }, uOpacity: { value: 0.6 }, uY: { value: 0.1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.splashUniforms, transparent: true, depthWrite: false,
      vertexShader: `
        attribute vec4 aSeed; uniform float uTime, uY; varying vec2 vUv; varying float vA;
        void main(){
          float ph = fract(uTime * aSeed.w + aSeed.z);
          float s = 0.05 + ph * 0.22;
          vec3 p = vec3(aSeed.x, uY, aSeed.y) + position * s;
          vUv = uv; vA = 1.0 - ph;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D uMap; uniform float uOpacity; varying vec2 vUv; varying float vA;
        void main(){ vec4 t = texture2D(uMap, vUv); gl_FragColor = vec4(vec3(0.9,0.95,1.0), t.a * vA * uOpacity); }`,
    });
    this.splashes = new THREE.Mesh(g, mat);
    this.splashes.frustumCulled = false;
    this.group.add(this.splashes);
  }

  _initSnow() {
    const max = Math.round(5000 * this.quality);
    this.snowMax = max;
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(max * 4);
    for (let i = 0; i < max * 4; i++) seeds[i] = Math.random();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(max * 3), 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 4));
    g.setDrawRange(0, 0);
    this.snowUniforms = { uTime: { value: 0 }, uWind: { value: new THREE.Vector2() }, uSize: { value: 120 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.snowUniforms, transparent: true, depthWrite: false,
      vertexShader: `
        attribute vec4 aSeed; uniform float uTime, uSize; uniform vec2 uWind; varying float vA;
        void main(){
          float H = 24.0, A = 50.0;
          float fall = 1.2 + aSeed.w * 0.8;
          float y = mod(aSeed.z * H - uTime * fall, H) - 1.0;
          vec3 p = vec3(aSeed.x * A - A*0.5, y, aSeed.y * A - A*0.5);
          p.x += sin(uTime * 0.8 + aSeed.w * 20.0) * 0.4;
          p.xz -= uWind * (y / fall) * 0.3;
          p.xz = mod(p.xz + A*0.5, A) - A*0.5;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_PointSize = uSize * (0.5 + aSeed.w) / -mv.z;
          vA = smoothstep(-1.0, 0.5, y);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, (1.0 - d * 1.6) * vA); }`,
    });
    this.snow = new THREE.Points(g, mat);
    this.snow.frustumCulled = false;
    this.group.add(this.snow);
  }

  _initMist() {
    const geo = new THREE.SphereGeometry(1, 12, 8);
    this.mistMat = new THREE.MeshStandardMaterial({ color: '#eef2f4', roughness: 1, transparent: true, opacity: 0, depthWrite: false });
    const N = 30;
    this.mist = new THREE.InstancedMesh(geo, this.mistMat, N);
    this.mist.frustumCulled = false;
    this.mistData = Array.from({ length: N }, () => ({ x: rr(-24, 24), z: rr(-24, 24), y: rr(0.6, 3.5), s: rr(3, 6), sp: rr(0.2, 0.5) }));
    this.group.add(this.mist);
  }

  _initVortex() {
    const N = Math.round(200 * Math.max(0.6, this.quality));
    const geo = new THREE.IcosahedronGeometry(1, 2);
    this.vortexMat = new THREE.MeshStandardMaterial({ color: '#59616a', roughness: 1, transparent: true, opacity: 0.95, emissive: '#30363d', emissiveIntensity: 0.3 });
    this.vortexAlpha = new THREE.InstancedBufferAttribute(new Float32Array(N).fill(1), 1);
    this.vortexAlpha.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAlpha', this.vortexAlpha);
    this.vortexMat.depthWrite = false;
    this.vortexMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aAlpha; varying float vAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAlpha;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vAlpha;');
    };
    this.vortex = new THREE.InstancedMesh(geo, this.vortexMat, N);
    this.vortex.frustumCulled = false;
    this.vortexData = Array.from({ length: N }, (_, i) => {
      const arm = i % 4;
      const t = Math.pow(Math.random(), 0.8);
      return { arm, t, jitter: rr(-0.25, 0.25), y: rr(-1, 1.5), s: rr(0.8, 1.4) };
    });
    this.group.add(this.vortex);
  }

  _initDebris() {
    const N = Math.round(160 * Math.max(0.6, this.quality));
    const g = new THREE.BoxGeometry(0.45, 0.04, 0.3);
    this.debris = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.8 }), N);
    this.debris.frustumCulled = false;
    const cols = ['#6a8f3a', '#8a6a3c', '#a8aeb3', '#c94f3a', '#7b5a36', '#4f7a2e', '#d9c9a3'];
    const c = new THREE.Color();
    this.debrisData = Array.from({ length: N }, (_, i) => {
      this.debris.setColorAt(i, c.set(cols[i % cols.length]));
      return { r: rr(2, 24), a: rr(0, Math.PI * 2), y: rr(0.3, 9), w: rr(0.6, 1.6), spin: new THREE.Vector3(rr(-6, 6), rr(-6, 6), rr(-6, 6)), s: rr(0.6, 1.8) };
    });
    this.group.add(this.debris);
  }

  /** 0 when a puff would hide the diorama from the camera, 1 when clear. */
  _clear(pos, size, radius = 27) {
    const c = this.camPos, tg = this.camTarget;
    if (!c) return 1;
    const dx = tg.x - c.x, dy = tg.y - c.y, dz = tg.z - c.z;
    const L2 = dx * dx + dy * dy + dz * dz;
    const px = pos.x - c.x, py = pos.y - c.y, pz = pos.z - c.z;
    const t = (px * dx + py * dy + pz * dz) / L2;
    if (t <= 0 || t >= 1.1) return 1;
    const ex = px - dx * t, ey = py - dy * t, ez = pz - dz * t;
    const perp = Math.sqrt(ex * ex + ey * ey + ez * ez);
    const R = radius * Math.min(1, t) + size;
    const k = Math.min(1, Math.max(0, (perp - R * 0.8) / (R * 0.45)));
    return k * k * (3 - 2 * k);
  }

  // ------------------------------------------------------------ lightning
  _strike(env) {
    const x = rr(-HALF + 3, HALF - 3), z = rr(-HALF + 3, HALF - 3);
    const pts = [];
    let p = new THREE.Vector3(x + rr(-4, 4), 20, z + rr(-4, 4));
    const end = new THREE.Vector3(x, 0.5, z);
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const q = p.clone().lerp(end, t);
      if (i > 0 && i < steps) { q.x += rr(-0.9, 0.9); q.z += rr(-0.9, 0.9); }
      pts.push(q);
    }
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: '#eaf2ff', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const main = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 40, 0.07, 4);
    group.add(new THREE.Mesh(main, mat));
    // branches
    for (let b = 0; b < 3; b++) {
      const k = 3 + Math.floor(Math.random() * 8);
      const s = pts[k];
      const bp = [s.clone()];
      for (let i = 1; i < 5; i++) bp.push(bp[i - 1].clone().add(new THREE.Vector3(rr(-1, 1), -rr(0.6, 1.4), rr(-1, 1))));
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bp), 12, 0.035, 3), mat));
    }
    this.boltLight.position.copy(end).setY(6);
    group.userData = { life: 0.35, mat };
    this.group.add(group);
    this.bolts.push(group);
    this.flash = 1;
  }

  // ------------------------------------------------------------ update
  update(dt, p, env) {
    this.time += dt;
    const t = this.time;
    const wind = p.wind;
    this.camPos = env.camPos; this.camTarget = env.camTarget;
    // wind direction: rotate around for vortex
    if (env.windAngle != null) {
      const target = new THREE.Vector2(Math.sin(env.windAngle), -Math.cos(env.windAngle));
      this.windDir.lerp(target, Math.min(1, dt * 0.5)).normalize();
    }
    if (p.vortex > 0.3) {
      const a = t * 0.15;
      this.windDir.lerp(new THREE.Vector2(Math.cos(a), Math.sin(a)), dt * p.vortex).normalize();
    }

    // clouds
    const darkC = new THREE.Color('#ffffff').lerp(new THREE.Color('#5d6670'), p.cloudDark);
    this.cloudMat.color.copy(darkC);
    this.cloudMat.emissive.copy(darkC);
    this.cloudMat.emissiveIntensity = 0.1 + 0.25 * env.day * (1 - p.cloudDark);
    const drift = (0.3 + wind * 7) * dt;
    const emi = 0.1 + 0.25 * env.day * (1 - p.cloudDark);
    for (const c of this.clouds) {
      const u = c.userData;
      c.position.x += this.windDir.x * drift * u.speed;
      c.position.z += this.windDir.y * drift * u.speed;
      const r = Math.hypot(c.position.x, c.position.z);
      if (r > 27) { // wrap upwind
        const a = Math.atan2(-this.windDir.y, -this.windDir.x) + rr(-0.9, 0.9);
        const nr = rr(20, 26);
        c.position.x = Math.cos(a) * nr; c.position.z = Math.sin(a) * nr;
      }
      const visible = u.order < p.clouds ? 1 : 0;
      const big = 1 + p.cloudDark * 0.6;
      const tgt = visible ? u.base * big : 0.001;
      const s = c.scale.x + (tgt - c.scale.x) * Math.min(1, dt * 1.5);
      c.scale.set(s, s * (0.9 + p.cloudDark * 0.3), s);
      c.position.y += ((14 + (1 - p.cloudDark) * 4) + u.order * 3 - c.position.y) * Math.min(1, dt * 0.3);
      // clouds between camera and city become see-through instead of hiding it
      const clear = this._clear(c.position, s * 2);
      const m = c.material;
      m.color.copy(darkC); m.emissive.copy(darkC); m.emissiveIntensity = emi;
      m.opacity += ((0.22 + 0.74 * clear) - m.opacity) * Math.min(1, dt * 4);
      m.depthWrite = m.opacity > 0.85;
      c.castShadow = m.opacity > 0.5;
    }

    // rain
    const rainAmt = Math.max(p.rain, 0);
    this.rain.geometry.instanceCount = Math.floor(this.rainMax * Math.min(1, rainAmt));
    const wv = this.windDir.clone().multiplyScalar(wind * 12 + (p.vortex * 6));
    Object.assign(this.rainUniforms.uTime, { value: t });
    this.rainUniforms.uWind.value.copy(wv);
    this.rainUniforms.uSpeed.value = 14 + rainAmt * 6;
    this.rainUniforms.uLen.value = 0.45 + rainAmt * 0.45 + wind * 0.3;
    this.rainUniforms.uOpacity.value = 0.2 + rainAmt * 0.22;
    this.rainUniforms.uColor.value.set(env.night > 0.5 ? '#9fb0c4' : '#e3ecf5');
    this.splashes.geometry.instanceCount = Math.floor(this.splashMax * Math.min(1, rainAmt * 1.2));
    this.splashUniforms.uTime.value = t;
    this.splashUniforms.uY.value = Math.max(0.1, env.waterLevel + 0.02);

    // snow
    this.snow.geometry.setDrawRange(0, Math.floor(this.snowMax * p.snow));
    this.snowUniforms.uTime.value = t;
    this.snowUniforms.uWind.value.copy(wv);
    this.snowUniforms.uSize.value = 90 * env.pixelRatio;

    // mist
    this.mistMat.opacity = smoothstepJS(0.4, 1, p.fog) * 0.16;
    this.mist.visible = this.mistMat.opacity > 0.01;
    if (this.mist.visible) {
      const m = new THREE.Matrix4();
      this.mistData.forEach((d, i) => {
        d.x += this.windDir.x * d.sp * dt * (1 + wind * 4);
        d.z += this.windDir.y * d.sp * dt * (1 + wind * 4);
        if (d.x > 26) d.x = -26; if (d.x < -26) d.x = 26; if (d.z > 26) d.z = -26; if (d.z < -26) d.z = 26;
        m.makeScale(d.s * 1.6, d.s * 0.35, d.s);
        m.setPosition(d.x, d.y, d.z);
        this.mist.setMatrixAt(i, m);
      });
      this.mist.instanceMatrix.needsUpdate = true;
    }

    // vortex (typhoon spiral)
    const vx = p.vortex;
    this.vortex.visible = vx > 0.01;
    if (this.vortex.visible) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3();
      this.vortexMat.color.set('#4d555e').lerp(new THREE.Color('#2a3036'), env.night);
      this.vortexData.forEach((d, i) => {
        const r = 4 + d.t * 28;
        const ang = d.arm * (Math.PI / 2) + d.t * 5.2 + d.jitter + t * (0.5 - d.t * 0.35);
        pos.set(Math.cos(ang) * r, 15 + d.y + d.t * 2.5, Math.sin(ang) * r);
        const sc = d.s * (1.2 + d.t * 3.0) * vx;
        this.vortexAlpha.array[i] = 0.18 + 0.77 * this._clear(pos, sc * 1.4, 21);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang);
        m.compose(pos, q, s.set(sc * 1.8, sc * 0.55, sc));
        this.vortex.setMatrixAt(i, m);
      });
      this.vortex.instanceMatrix.needsUpdate = true;
      this.vortexAlpha.needsUpdate = true;
    }

    // debris
    const db = p.debris;
    this.debris.visible = db > 0.01;
    if (this.debris.visible) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), pos = new THREE.Vector3();
      this.debrisData.forEach((d, i) => {
        d.a += dt * d.w * (0.6 + wind * 1.6) * (3 / Math.max(2, d.r * 0.3));
        pos.set(Math.cos(d.a) * d.r, d.y + Math.sin(t * 2 + i) * 0.6, Math.sin(d.a) * d.r);
        e.set(t * d.spin.x, t * d.spin.y, t * d.spin.z);
        q.setFromEuler(e);
        const vis = i / this.debrisData.length < db ? d.s : 0;
        m.compose(pos, q, s.set(vis, vis, vis));
        this.debris.setMatrixAt(i, m);
      });
      this.debris.instanceMatrix.needsUpdate = true;
    }

    // lightning
    this.flash = Math.max(0, this.flash - dt * 4.5);
    if (p.lightning > 0.01) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this._strike(env);
        this.nextStrike = rr(0.4, 2.2) / Math.max(0.05, p.lightning) * 0.5 + (Math.random() < 0.3 ? 0.12 : 0);
      }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.userData.life -= dt;
      const l = b.userData.life;
      const flick = l > 0 ? (Math.sin(l * 90) > -0.2 ? 1 : 0.25) : 0;
      b.userData.mat.opacity = Math.max(0, l / 0.35) * flick;
      this.boltLight.intensity = Math.max(0, l / 0.35) * 260 * flick;
      if (l <= 0) {
        this.group.remove(b);
        b.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
        b.userData.mat.dispose();
        this.bolts.splice(i, 1);
      }
    }
    if (!this.bolts.length) this.boltLight.intensity = 0;
    return { windDir: this.windDir, flash: this.flash };
  }
}
