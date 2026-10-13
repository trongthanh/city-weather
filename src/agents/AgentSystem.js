import * as THREE from 'three';
import { buildModels } from './models.js';
import { radialTex } from '../world/materials.js';
import { waveHeight, waveUniforms } from '../world/terrain.js';
import { HALF } from '../world/Field.js';
import { createRoadTurn, distanceAhead } from './RoadTurn.js';

// Moving life: motorbikes, cars, buses, cyclos, pedestrians (with umbrellas & nón lá),
// dogs, cats, boats, basket boats and birds. All instanced — one draw call per part.

const R = Math.random;
const rr = (a, b) => a + (b - a) * R();
const pick = (a) => a[Math.floor(R() * a.length)];
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

const COLORS = {
  bike: ['#d33a2c', '#1f5fa8', '#202020', '#e8e8e8', '#b0b4b8', '#2f8f5a', '#7b2d8b', '#e3a21a', '#f06292'],
  shirt: ['#ffffff', '#4a90d9', '#e95d4f', '#f3c623', '#5cb85c', '#9b59b6', '#f08a5d', '#2c3e50', '#ff9ec7', '#7fd1d8'],
  poncho: ['#2f80ed', '#eb5757', '#f2c94c', '#27ae60', '#bb6bd9', '#56ccf2', '#ff7aa8'],
  car: ['#ffffff', '#e8e8e8', '#1e1e1e', '#c0392b', '#2c3e50', '#95a5a6', '#2e86de', '#16a085', '#f5f0e1'],
  taxi: ['#00a651', '#f9f9f9', '#2a9d8f'],
  bus: ['#2e9e5b', '#1f78c8', '#d94a38', '#f3b229'],
  umbrella: ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#ff8fb1', '#1abc9c', '#34495e'],
  dog: ['#c08a52', '#f2e6d0', '#3a3027', '#d9a066', '#8b5a2b'],
  cat: ['#f0a04b', '#2b2b2b', '#e8e2d8', '#8a8a8a', '#c87f3a'],
  boat: ['#2d6fb0', '#c0392b', '#f4f1e8', '#1f8a70', '#e1a32e'],
  jetski: ['#e63946', '#ffb703', '#1d9bf0', '#ffffff', '#06d6a0', '#ff5fa2'],
  board: ['#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#ffffff', '#f78c6b', '#c77dff'],
  kite: ['#e63946', '#ffb703', '#1d9bf0', '#06d6a0', '#ff5fa2', '#9b5de5', '#f15bb5', '#00bbf9'],
  cyclo: ['#ffffff', '#f7d54a', '#e86a4a'],
};

const gauss = (x, mu, sd) => Math.exp(-0.5 * ((x - mu) / sd) ** 2);
const win = (x, a, b, f = 0.6) => Math.min(1, Math.max(0, (x - a) / f)) * Math.min(1, Math.max(0, (b - x) / f));

/** Traffic intensity 0..1 for a local time (minutes since midnight):
 *  peaks at school/work start (~7:15), school lunch (~11:45) and home time (~17:30). */
export function trafficLevel(minutes) {
  const h = (((minutes / 60) % 24) + 24) % 24;
  const day = win(h, 5.2, 22.5, 1.2);
  const rush = Math.max(gauss(h, 7.2, 0.7), 0.55 * gauss(h, 11.8, 0.55), gauss(h, 17.5, 0.85), 0.5 * gauss(h, 13.4, 0.4));
  return Math.max(0.06, day * 0.28 + rush * 0.72);
}

/** Pedestrian activity: follows traffic, plus evening street life (19–21h). */
export function streetLife(minutes) {
  const h = (((minutes / 60) % 24) + 24) % 24;
  return Math.min(1, Math.max(trafficLevel(minutes), 0.55 * gauss(h, 20, 1.3), 0.4 * win(h, 6, 21.5, 1)));
}

const TYPES = {
  motorbike: { max: 150, kind: 'road', speed: [1.7, 2.5], lat: [0.32, 0.95], width: 0.22, len: 0.5, parts: ['bike', 'rider', 'poncho', 'beamS'] },
  car: { max: 32, kind: 'road', speed: [1.5, 2.2], lat: [0.5, 0.58], width: 0.5, len: 1.05, parts: ['car', 'beamL'] },
  bus: { max: 6, kind: 'road', speed: [1.2, 1.6], lat: [0.56, 0.6], width: 0.62, len: 2.2, minHW: 1.0, parts: ['bus', 'beamL'] },
  cyclo: { max: 4, kind: 'road', speed: [0.5, 0.75], lat: [0.92, 1.0], width: 0.4, len: 0.8, parts: ['cyclo'], cities: ['hanoi', 'hcmc'] },
  ped: { max: 90, kind: 'walk', speed: [0.28, 0.5], lat: [-0.22, 0.22], parts: ['ped', 'hat', 'umbrella'] },
  dog: { max: 12, kind: 'walk', speed: [0.3, 0.5], lat: [-0.2, 0.2], parts: ['dog'] },
  cat: { max: 8, kind: 'walk', speed: [0.18, 0.32], lat: [-0.25, 0.25], parts: ['cat'] },
  boat: { max: 5, kind: 'water', speed: [0.45, 0.8], lat: [-0.2, 0.2], parts: ['boat'] },
  basket: { max: 6, kind: 'basket', speed: [0.12, 0.2], lat: [0, 0], parts: ['basket'] },
  jetski: { max: 5, kind: 'sea', speed: [1.6, 2.6], parts: ['jetski', 'jetRider'] },
  surfer: { max: 7, kind: 'sea', speed: [0.5, 0.9], parts: ['surfboard', 'surfer'] },
  kite: { max: 8, kind: 'kite', parts: ['kite', 'flyer'] },
  bird: { max: 18, kind: 'air', parts: ['bird'] },
};

const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _e = new THREE.Euler(), _c = new THREE.Color();

export class AgentSystem {
  constructor(scene, { scale = 1, shadows = true } = {}) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'agents';
    scene.add(this.group);
    const geos = buildModels();
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05 });
    this.beamMat = new THREE.MeshBasicMaterial({ map: radialTex, color: '#ffe0a0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const beamGeoS = geos.beam.clone().scale(0.5, 1, 1.2);
    const beamGeoL = geos.beam.clone().scale(0.9, 1, 2.0).translate(0, 0, 0.3);
    const partGeo = { ...geos, beamS: beamGeoS, beamL: beamGeoL, flyer: geos.ped };
    this.types = {};
    for (const [name, spec] of Object.entries(TYPES)) {
      const max = Math.max(1, Math.round(spec.max * (name === 'ped' || name === 'motorbike' ? scale : Math.min(1, scale + 0.2))));
      const parts = spec.parts.map((pn) => {
        const isBeam = pn.startsWith('beam');
        const mesh = new THREE.InstancedMesh(partGeo[pn], isBeam ? this.beamMat : this.mat, max);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.castShadow = shadows && !isBeam && name !== 'bird';
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
        if (isBeam) mesh.renderOrder = 3;
        for (let i = 0; i < max; i++) { mesh.setMatrixAt(i, ZERO); if (!isBeam) mesh.setColorAt(i, _c.set('#ffffff')); }
        this.group.add(mesh);
        return { name: pn, mesh, isBeam };
      });
      this.types[name] = { name, spec, max, parts, agents: Array.from({ length: max }, () => ({ active: false })), spawnTimer: 0 };
    }
    this.time = 0;
    this.birdTimer = 2;
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TYPES.kite.max * 2 * 3), 3));
    this.strings = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: '#f5f5f5', transparent: true, opacity: 0.75 }));
    this.strings.frustumCulled = false;
    this.group.add(this.strings);
  }

  setCity(city) {
    this.city = city;
    this.roads = city.roads;
    this.walks = city.walkPaths.filter((w) => w.path.length > 2);
    this.waters = city.waterPaths.filter((w) => w.kind === 'boat');
    this.baskets = city.waterPaths.filter((w) => w.kind === 'basket');
    this.beach = city.beach || null; // { coast(z), width }
    for (const T of Object.values(this.types)) for (const a of T.agents) a.active = false;
    this._prefill = true;
  }

  // ------------------------------------------------------------ spawning
  _free(T) { return T.agents.find((a) => !a.active); }
  _count(T) { let n = 0; for (const a of T.agents) if (a.active && !a.leaving) n++; return n; }

  _roadAllowed(T, road) {
    return road.kind !== 'plaza' && (!T.spec.minHW || road.hw >= T.spec.minHW) &&
      (!road.def?.vehicles || road.def.vehicles.includes(T.name));
  }

  _spawnRoad(T, prefill) {
    const spec = T.spec;
    if (spec.cities && !spec.cities.includes(this.city.def.id)) return null;
    const roads = this.roads.filter(r => this._roadAllowed(T, r));
    if (!roads.length) return null;
    let road, s, dir;
    if (prefill) {
      road = pick(roads); s = rr(0, road.path.length); dir = R() < 0.5 ? 1 : -1;
    } else {
      const entries = [];
      for (const r of roads) {
        if (r.path.closed) entries.push([r, rr(0, r.path.length), R() < 0.5 ? 1 : -1, true]);
        if (r.startEdge) entries.push([r, 0, 1, false], [r, 0, 1, false]);
        if (r.endEdge) entries.push([r, r.path.length, -1, false], [r, r.path.length, -1, false]);
      }
      if (!entries.length) return null;
      const e = pick(entries);
      [road, s, dir] = e;
    }
    let lat = rr(spec.lat[0], spec.lat[1]) * Math.min(1, road.hw / 1.1);
    if (road.kind === 'alley') lat = Math.min(lat, Math.max(0, road.hw - spec.width / 2 - 0.04));
    // keep clear of others
    for (const O of Object.values(this.types)) {
      if (O.spec.kind !== 'road') continue;
      for (const o of O.agents) if (o.active && o.road === road && o.dir === dir && Math.abs(o.s - s) < 1.6 && Math.abs(o.lat - lat) < 0.45) return null;
    }
    const a = this._free(T);
    if (!a) return null;
    Object.assign(a, {
      active: true, leaving: false, road, path: road.path, s, dir, lat, vmax: rr(spec.speed[0], spec.speed[1]), v: 0,
      fade: prefill || road.path.closed ? 0 : 1, yaw: null, off: new THREE.Vector3(), phase: R() * 10, ponchoT: rr(0.05, 0.9),
      turn: null, turnPlan: null, junctionMemory: new Set(),
    });
    a.v = Math.min(a.vmax, road.speedLimit ?? Infinity);
    this._tint(T, a);
    return a;
  }

  _spawnWalk(T, prefill, onPath = null) {
    if (!this.walks.length) return null;
    const a = this._free(T);
    if (!a) return null;
    const w = onPath || pick(this.walks);
    const spec = T.spec;
    Object.assign(a, {
      active: true, leaving: false, road: null, path: w.path, s: rr(0, w.path.length), dir: R() < 0.5 ? 1 : -1,
      lat: rr(spec.lat[0], spec.lat[1]), vmax: rr(spec.speed[0], spec.speed[1]), fade: 0, yaw: null, off: new THREE.Vector3(),
      ttl: rr(6, 28), phase: R() * 10, hat: R() < 0.22, umbT: rr(0.04, 0.7), stop: 0, owner: null,
    });
    a.v = a.vmax;
    this._tint(T, a);
    return a;
  }

  _spawnWater(T, list, prefill) {
    if (!list.length) return null;
    const a = this._free(T);
    if (!a) return null;
    const w = pick(list);
    const closed = w.path.closed;
    const dir = R() < 0.5 ? 1 : -1;
    Object.assign(a, {
      active: true, leaving: false, road: null, path: w.path, dir, lat: rr(T.spec.lat[0], T.spec.lat[1]),
      s: prefill || closed ? rr(0, w.path.length) : dir > 0 ? 0 : w.path.length,
      vmax: rr(T.spec.speed[0], T.spec.speed[1]), fade: prefill || closed ? 0 : 1, yaw: null, off: new THREE.Vector3(), phase: R() * 10,
    });
    a.v = a.vmax;
    this._tint(T, a);
    return a;
  }

  _spawnSea(T) {
    if (!this.beach) return null;
    const a = this._free(T);
    if (!a) return null;
    const { coast } = this.beach;
    const jet = T.name === 'jetski';
    const z0 = rr(-12, 16);
    Object.assign(a, {
      active: true, leaving: false, fade: 0, phase: R() * 10, kind: T.name, yaw: null,
      z: z0, off: jet ? rr(2.0, 5.5) : rr(0.9, 2.0), // distance offshore
      dirZ: R() < 0.5 ? 1 : -1, v: rr(T.spec.speed[0], T.spec.speed[1]), t: 0,
      ride: rr(0, 6), coastFn: coast, life: rr(14, 30),
    });
    this._tint(T, a);
    return a;
  }

  _spawnKite(T) {
    if (!this.beach) return null;
    const a = this._free(T);
    if (!a) return null;
    const { coast, width } = this.beach;
    const z = rr(-12, 17);
    const ax = coast(z) - width * rr(0.35, 0.7);
    Object.assign(a, {
      active: true, leaving: false, fade: 0, phase: R() * 10, yaw: null,
      anchor: new THREE.Vector3(ax, 0.1, z), h: rr(3.2, 5.6), reach: rr(1.6, 3.0), life: rr(25, 60),
    });
    this._tint(T, a);
    return a;
  }

  _spawnBirds(T) {
    const n = 3 + Math.floor(R() * 5);
    const ang = R() * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const start = dir.clone().multiplyScalar(-30).add(new THREE.Vector3(rr(-8, 8), rr(5, 10), rr(-8, 8)));
    const speed = rr(2.2, 3.2);
    for (let i = 0; i < n; i++) {
      const a = this._free(T);
      if (!a) return;
      Object.assign(a, {
        active: true, leaving: false, fade: 1, phase: R() * 6,
        pos: start.clone().add(new THREE.Vector3(rr(-1.2, 1.2), rr(-0.5, 0.5), rr(-1.2, 1.2)).addScaledVector(dir, -i * 0.5)),
        vel: dir.clone().multiplyScalar(speed), life: 25,
      });
    }
  }

  _tint(T, a) {
    const set = (part, hex) => { const p = T.parts.find((q) => q.name === part); if (p) { p.mesh.setColorAt(this._idx(T, a), _c.set(hex)); p.mesh.instanceColor.needsUpdate = true; } };
    switch (T.name) {
      case 'motorbike': set('bike', pick(COLORS.bike)); set('rider', pick(COLORS.shirt)); set('poncho', pick(COLORS.poncho)); break;
      case 'car': set('car', R() < 0.25 ? pick(COLORS.taxi) : pick(COLORS.car)); break;
      case 'bus': set('bus', pick(COLORS.bus)); break;
      case 'cyclo': set('cyclo', pick(COLORS.cyclo)); break;
      case 'ped': set('ped', pick(COLORS.shirt)); set('umbrella', pick(COLORS.umbrella)); break;
      case 'dog': set('dog', pick(COLORS.dog)); break;
      case 'cat': set('cat', pick(COLORS.cat)); break;
      case 'boat': set('boat', pick(COLORS.boat)); break;
      case 'jetski': set('jetski', pick(COLORS.jetski)); break;
      case 'surfer': set('surfboard', pick(COLORS.board)); break;
      case 'kite': set('kite', pick(COLORS.kite)); set('flyer', pick(COLORS.shirt)); break;
      default: break;
    }
  }

  _idx(T, a) { return T.agents.indexOf(a); }

  // ------------------------------------------------------------ update
  update(dt, env) {
    if (!this.city) return;
    this.time += dt;
    const night = env.night;
    const life = env.life;
    const rain = env.rain;
    const tf = trafficLevel(env.minutes ?? 720);
    const sl = streetLife(env.minutes ?? 720);
    this.traffic = tf;
    const targets = {
      motorbike: life * tf * (1 - rain * 0.25),
      car: life * (0.12 + 0.88 * tf),
      bus: life * Math.min(1, 0.3 + tf) * (1 - night * 0.6),
      cyclo: life * (1 - night) * (1 - rain) * (0.6 + 0.4 * (1 - tf)),
      ped: life * sl * (1 - rain * 0.35),
      dog: life * sl * (1 - rain * 0.7),
      cat: Math.max(0.3, life) * (1 - rain * 0.8),
      boat: life * (1 - env.waves * 0.8),
      basket: life * (1 - env.waves),
      jetski: this.beach ? life * (1 - night) * (1 - rain) * (1 - env.waves * 1.3) : 0,
      surfer: this.beach ? life * (1 - night) * (1 - rain * 0.6) * (1 - env.waves * 1.1) : 0,
      kite: this.beach ? (1 - night) * (1 - rain) * Math.max(0, 1 - Math.abs(env.wind - 0.25) * 2.2) : 0,
      bird: 0,
    };
    const prefill = this._prefill;
    this._prefill = false;

    for (const T of Object.values(this.types)) {
      const target = Math.round(T.max * Math.max(0, Math.min(1, targets[T.name])));
      let count = this._count(T);
      // retire extras
      if (count > target) {
        for (const a of T.agents) { if (count <= target) break; if (a.active && !a.leaving && T.name !== 'bird') { a.leaving = true; count--; } }
      }
      if (T.name === 'bird') continue;
      T.spawnTimer -= dt;
      const want = target - count;
      if (want > 0 && (prefill || T.spawnTimer <= 0)) {
        const n = prefill ? want : 1;
        for (let i = 0; i < n; i++) {
          let a = null;
          if (T.spec.kind === 'road') a = this._spawnRoad(T, prefill);
          else if (T.spec.kind === 'walk') {
            if (T.name === 'dog') {
              // dogs come with an owner
              const owner = this._spawnWalk(this.types.ped, false);
              if (owner) { a = this._spawnWalk(T, false, { path: owner.path }); if (a) { a.owner = owner; a.dir = owner.dir; a.s = owner.s - owner.dir * 0.4; a.vmax = owner.vmax; a.lat = owner.lat + 0.16; a.ttl = owner.ttl; } }
            } else a = this._spawnWalk(T, prefill);
          } else if (T.spec.kind === 'water') a = this._spawnWater(T, this.waters, prefill);
          else if (T.spec.kind === 'basket') a = this._spawnWater(T, this.baskets, true);
          else if (T.spec.kind === 'sea') a = this._spawnSea(T);
          else if (T.spec.kind === 'kite') a = this._spawnKite(T);
          if (prefill && a) a.fade = 1;
        }
        // spawn faster when far below the target (rush hour fills up quickly)
        const urgency = Math.min(1, want / (T.max * 0.25));
        T.spawnTimer = (T.spec.kind === 'road' ? rr(0.15, 0.5) : rr(0.3, 1.2)) * (1 - 0.8 * urgency);
      }
    }
    // birds
    const birdOK = (1 - night) * (1 - rain) * (1 - env.wind) > 0.35;
    this.birdTimer -= dt;
    if (birdOK && this.birdTimer <= 0) { this._spawnBirds(this.types.bird); this.birdTimer = rr(8, 18); }

    // follow logic per road/dir
    this._roadBuckets = new Map();
    for (const tn of ['motorbike', 'car', 'bus', 'cyclo']) {
      const T = this.types[tn];
      for (const a of T.agents) {
        if (!a.active || a.turn) continue;
        const key = a.road.id * 2 + (a.dir > 0 ? 1 : 0);
        let arr = this._roadBuckets.get(key);
        if (!arr) this._roadBuckets.set(key, (arr = []));
        arr.push({ a, w: T.spec.width, len: T.spec.len });
      }
    }

    for (const T of Object.values(this.types)) {
      for (let i = 0; i < T.max; i++) {
        const a = T.agents[i];
        if (!a.active) { for (const p of T.parts) p.mesh.setMatrixAt(i, ZERO); continue; }
        switch (T.spec.kind) {
          case 'road': this._updRoad(T, a, dt, env); break;
          case 'walk': this._updWalk(T, a, dt, env); break;
          case 'water': case 'basket': this._updWater(T, a, dt, env); break;
          case 'air': this._updBird(T, a, dt, env); break;
          case 'sea': this._updSea(T, a, dt, env); break;
          case 'kite': a.life -= dt; if (a.life < 0) a.leaving = true; this._fadeStep(a, dt); break;
        }
        if (!a.active) { for (const p of T.parts) p.mesh.setMatrixAt(i, ZERO); continue; }
        this._write(T, a, i, env);
      }
      for (const p of T.parts) p.mesh.instanceMatrix.needsUpdate = true;
    }
    this.beamMat.opacity = night * 0.55;
    // kite strings from the flyer on the sand to the kite
    const K = this.types.kite, sp = this.strings.geometry.attributes.position;
    let n = 0;
    for (const a of K.agents) {
      if (!a.active || (a.vis ?? 1) < 0.05) continue;
      K.parts[0].mesh.getMatrixAt(K.agents.indexOf(a), _m2);
      _p.setFromMatrixPosition(_m2);
      sp.setXYZ(n * 2, a.anchor.x, a.anchor.y + 0.3, a.anchor.z);
      sp.setXYZ(n * 2 + 1, _p.x, _p.y, _p.z);
      n++;
    }
    this.strings.geometry.setDrawRange(0, n * 2);
    sp.needsUpdate = true;
  }

  _fadeStep(a, dt, edgeFade = 1) {
    const target = a.leaving ? 0 : 1;
    a.fade += Math.sign(target - a.fade) * Math.min(Math.abs(target - a.fade), dt * 1.8);
    a.vis = Math.min(a.fade, edgeFade);
    if (a.leaving && a.fade <= 0.001) a.active = false;
  }

  _updRoad(T, a, dt, env) {
    const path = a.path;
    if (!a.turn && !a.turnPlan) this._planTurn(T, a);
    // Follow the current lane, or check the destination lane while rounding the corner.
    const followRoad = a.turn ? a.turn.to : a.road;
    const followDir = a.turn ? a.turn.dir : a.dir;
    const followLat = a.turn ? a.turn.lat : a.lat;
    const followS = a.turn ? a.turn.exitS : a.s;
    const followPath = followRoad.path;
    const bucket = this._roadBuckets.get(followRoad.id * 2 + (followDir > 0 ? 1 : 0)) || [];
    let gap = Infinity;
    for (const o of bucket) {
      if (o.a === a) continue;
      if (Math.abs(o.a.lat - followLat) > (o.w + T.spec.width) / 2 + 0.04) continue;
      let d = distanceAhead(followPath, followS, o.a.s, followDir);
      if (a.turn) d += a.turn.path.length - a.turn.s;
      if (d <= 0 || d > 4) continue;
      const g = d - (o.len + T.spec.len) / 2;
      if (g < gap) gap = g;
    }
    const weather = 1 - env.rain * 0.25 - env.wind * 0.3;
    const nearTurn = a.turn || (a.turnPlan && distanceAhead(path, a.s, a.turnPlan.entryS, a.dir) < 2.2);
    const vmax = Math.min(a.vmax, a.road.speedLimit ?? Infinity, followRoad.speedLimit ?? Infinity,
      a.turnPlan?.to.speedLimit ?? Infinity);
    const turnSpeed = Math.min(vmax * weather, T.name === 'bus' ? 0.8 : T.name === 'motorbike' ? 1.1 : 0.95);
    const want = nearTurn ? turnSpeed : vmax * weather * (a.leaving ? 0.7 : 1);
    const vGap = gap === Infinity ? want : Math.max(0, (gap - 0.25) * 2.2);
    const v = Math.min(want, vGap);
    a.v += (v - a.v) * Math.min(1, dt * 3);
    let travel = a.v * dt;
    if (!a.turn && a.turnPlan) {
      const d = distanceAhead(path, a.s, a.turnPlan.entryS, a.dir);
      if (d <= travel) {
        a.s = a.turnPlan.entryS;
        travel -= Math.max(0, d);
        a.turn = a.turnPlan;
        a.turnPlan = null;
      }
    }
    if (a.turn) {
      a.turn.s += travel;
      if (a.turn.s < a.turn.path.length) {
        this._fadeStep(a, dt);
        return;
      }
      const turn = a.turn, remaining = turn.s - turn.path.length;
      a.road = turn.to; a.path = turn.to.path; a.dir = turn.dir; a.lat = turn.lat;
      a.s = turn.exitS + a.dir * remaining;
      a.turn = null;
      a.junctionMemory.clear();
      // Don't immediately reselect the crossing we've just left.
      for (const j of a.road.junctions) if (Math.abs((j.s - turn.exitS) * a.dir) < 3.5) a.junctionMemory.add(j);
    } else a.s += a.dir * travel;
    const P = a.path, PL = P.length;
    if (P.closed) a.s = ((a.s % PL) + PL) % PL;
    else if (a.s > PL || a.s < 0) {
      const atEdge = a.s > PL ? a.road.endEdge : a.road.startEdge;
      if (atEdge) { a.active = false; return; }
      a.leaving = true; a.s = Math.max(0, Math.min(PL, a.s));
    }
    let edgeFade = 1;
    if (!P.closed) {
      if (a.road.startEdge) edgeFade = Math.min(edgeFade, a.s / 0.9);
      if (a.road.endEdge) edgeFade = Math.min(edgeFade, (PL - a.s) / 0.9);
    }
    this._fadeStep(a, dt, Math.max(0, Math.min(1, edgeFade)));
  }

  _planTurn(T, a) {
    const lookahead = 5;
    const path = a.path;
    for (const j of a.junctionMemory) {
      const d = distanceAhead(path, a.s, j.s, a.dir);
      if (d > lookahead + 1 || d < -1) a.junctionMemory.delete(j);
    }
    const upcoming = a.road.junctions
      .map(j => ({ j, d: distanceAhead(path, a.s, j.s, a.dir) }))
      .filter(({ j, d }) => d >= 0 && d <= lookahead && !a.junctionMemory.has(j))
      .sort((l, r) => l.d - r.d);
    if (!upcoming.length) return;
    const first = upcoming[0];
    const crossing = upcoming.filter(({ d }) => Math.abs(d - first.d) < 0.7);
    for (const { j } of crossing) a.junctionMemory.add(j);
    const forced = !path.closed && (a.dir > 0 ? first.j.s > path.length - 1.2 : first.j.s < 1.2);
    if (!forced && R() > 0.3) return;
    const choices = [];
    for (const { j } of crossing) {
      const to = j.to;
      if (!this._roadAllowed(T, to)) continue;
      for (const dir of [-1, 1]) {
        const turn = createRoadTurn({
          from: a.road, fromS: j.s, fromDir: a.dir, fromLat: a.lat,
          to, toS: j.toS, toDir: dir,
          toLat: Math.min(a.lat, Math.max(0.1, to.hw - T.spec.width / 2 - 0.08)),
          vehicleLength: T.spec.len,
        });
        // Vehicles spawned inside an intersection go straight rather than jump backwards.
        if (turn && distanceAhead(path, a.s, turn.entryS, a.dir) >= 0 &&
          distanceAhead(path, a.s, turn.entryS, a.dir) <= first.d) choices.push(turn);
      }
    }
    if (choices.length) a.turnPlan = pick(choices);
  }

  _roadPos(a, out) {
    if (a.turn) return a.turn.path.pointAt(a.turn.s, out);
    a.path.pointAt(a.s, out);
    a.path.tangentAt(a.s, _t).multiplyScalar(a.dir);
    out.x += -_t.z * a.lat; out.z += _t.x * a.lat;
    return out;
  }

  _updWalk(T, a, dt, env) {
    const P = a.path, L = P.length;
    let speed = a.vmax * (1 + env.rain * 0.5);
    if (T.name === 'cat') {
      a.stop -= dt;
      if (a.stop > 0) speed = 0;
      else if (R() < dt * 0.15) a.stop = rr(2, 6);
    }
    if (T.name === 'dog' && a.owner && a.owner.active && a.owner.path === P) {
      const target = a.owner.s - a.owner.dir * 0.4;
      a.dir = a.owner.dir;
      a.s += (target - a.s) * Math.min(1, dt * 4);
      if (a.owner.leaving) a.leaving = true;
      a.v = a.owner.v;
    } else {
      a.v = speed;
      a.s += a.dir * speed * dt;
      a.ttl -= speed * dt;
      if (a.ttl < 0) a.leaving = true;
    }
    a.phase += a.v * dt * 16;
    let edgeFade = 1;
    if (P.closed) a.s = ((a.s % L) + L) % L;
    else {
      if (a.s < 0 || a.s > L) {
        a.s = Math.max(0, Math.min(L, a.s));
        const end = P.pointAt(a.s);
        if (Math.abs(end.x) > HALF - 0.8 || Math.abs(end.z) > HALF - 0.8) { a.active = false; return; }
        a.leaving = true;
      }
      const e0 = P.points[0], e1 = P.points[P.points.length - 1];
      if (Math.abs(e0.x) > HALF - 0.8 || Math.abs(e0.z) > HALF - 0.8) edgeFade = Math.min(edgeFade, a.s / 0.6);
      if (Math.abs(e1.x) > HALF - 0.8 || Math.abs(e1.z) > HALF - 0.8) edgeFade = Math.min(edgeFade, (L - a.s) / 0.6);
    }
    this._fadeStep(a, dt, Math.max(0, Math.min(1, edgeFade)));
  }

  _updWater(T, a, dt, env) {
    const P = a.path, L = P.length;
    a.v = a.vmax * (1 - env.waves * 0.5);
    a.s += a.dir * a.v * dt;
    if (P.closed) a.s = ((a.s % L) + L) % L;
    else if (a.s < 0 || a.s > L) { a.active = false; return; }
    let edgeFade = 1;
    if (!P.closed) edgeFade = Math.min(a.s / 1.2, (L - a.s) / 1.2);
    this._fadeStep(a, dt, Math.max(0, Math.min(1, edgeFade)));
  }

  _updSea(T, a, dt, env) {
    a.t += dt;
    a.life -= dt;
    if (a.life < 0) a.leaving = true;
    if (T.name === 'jetski') {
      // zig-zag runs parallel to the shore
      a.z += a.dirZ * a.v * dt;
      a.off += Math.sin(a.t * 0.9 + a.phase) * dt * 0.9;
      // Leave room for the enlarged hull inside the eastern tile edge.
      a.off = Math.min(6, HALF - 0.6 - a.coastFn(a.z), Math.max(1.6, a.off));
      if (a.z > 19 || a.z < -13) a.dirZ *= -1;
    } else {
      // surfer: paddle out, then ride a wave toward the beach, repeat
      const cyc = (a.t + a.ride) % 9;
      if (cyc < 5) { a.off = Math.max(0.8, a.off - dt * 0.05); a.z += a.dirZ * dt * 0.08; a.surfing = false; a.off += dt * 0.25; }
      else { a.off -= dt * a.v; a.z += a.dirZ * dt * 0.35; a.surfing = true; }
      a.off = Math.min(3.2, Math.max(0.6, a.off));
    }
    this._fadeStep(a, dt);
  }

  _updBird(T, a, dt) {
    a.pos.addScaledVector(a.vel, dt);
    a.phase += dt * 14;
    a.life -= dt;
    if (a.life < 0) a.active = false;
    const edge = Math.max(Math.abs(a.pos.x), Math.abs(a.pos.z));
    a.vis = Math.max(0, Math.min(1, (34 - edge) / 4));
  }

  _write(T, a, i, env) {
    let yaw, y = 0, roll = 0, pitch = 0, sy = 1;
    if (T.spec.kind === 'air') {
      _p.copy(a.pos);
      yaw = Math.atan2(a.vel.x, a.vel.z);
      sy = Math.sin(a.phase) * 1.4;
    } else if (T.spec.kind === 'sea') {
      const x = a.coastFn(a.z) + a.off;
      const amp = waveUniforms.uWave.value, tt = waveUniforms.uTime.value;
      _p.set(x, waveUniforms.uLevel.value + waveHeight(x, a.z, tt, amp) + 0.03, a.z);
      if (T.name === 'jetski') {
        const dx = Math.cos(this.time * 0.9 + a.phase) * 0.9;
        yaw = Math.atan2(dx, a.dirZ * a.v);
        roll = -dx * 0.25; pitch = -0.08 + Math.sin(this.time * 7 + a.phase) * 0.03;
        y = Math.abs(Math.sin(this.time * 5 + a.phase)) * 0.03;
      } else {
        yaw = a.surfing ? Math.atan2(-1, a.dirZ * 0.35) : Math.atan2(1, a.dirZ * 0.1);
        roll = a.surfing ? Math.sin(this.time * 2 + a.phase) * 0.12 : 0;
        y = a.surfing ? 0.05 : 0;
      }
    } else if (T.spec.kind === 'kite') {
      const w = this.windVec || new THREE.Vector2(1, 0.3);
      const t = this.time + a.phase;
      _p.copy(a.anchor);
      _p.x += w.x * a.reach + Math.sin(t * 0.7) * 0.6;
      _p.z += w.y * a.reach + Math.cos(t * 0.5) * 0.5;
      _p.y = a.h + Math.sin(t * 1.3) * 0.35;
      yaw = Math.atan2(w.x, w.y) + Math.PI;
      roll = Math.sin(t * 1.1) * 0.35;
      pitch = -0.35;
    } else {
      if (a.turn) {
        a.turn.path.pointAt(a.turn.s, _p);
        a.turn.path.tangentAt(a.turn.s, _t);
      } else {
        a.path.pointAt(a.s, _p);
        a.path.tangentAt(a.s, _t).multiplyScalar(a.dir);
        _p.x += -_t.z * a.lat; _p.z += _t.x * a.lat;
      }
      a.off.multiplyScalar(Math.exp(-this._dt * 5 || 0.92));
      _p.add(a.off);
      yaw = Math.atan2(_t.x, _t.z);
      if (T.spec.kind === 'walk') {
        y = Math.abs(Math.sin(a.phase)) * (T.name === 'ped' ? 0.025 : 0.012);
        roll = Math.sin(a.phase) * 0.05;
      } else if (T.spec.kind === 'water' || T.spec.kind === 'basket') {
        const amp = waveUniforms.uWave.value, tt = waveUniforms.uTime.value;
        y = waveUniforms.uLevel.value - _p.y + waveHeight(_p.x, _p.z, tt, amp) + 0.04;
        pitch = (waveHeight(_p.x + _t.x * 0.4, _p.z + _t.z * 0.4, tt, amp) - waveHeight(_p.x - _t.x * 0.4, _p.z - _t.z * 0.4, tt, amp)) * -1.2;
        roll = Math.sin(this.time * 1.7 + a.phase) * 0.05 * (1 + amp * 10);
        if (T.spec.kind === 'basket') yaw = this.time * 0.3 + a.phase;
      } else if (T.name === 'motorbike') {
        y = Math.sin(a.phase + this.time * 9) * 0.004;
        if (a.turn) {
          const before = a.turn.path.tangentAt(Math.max(0, a.turn.s - 0.12));
          const after = a.turn.path.tangentAt(Math.min(a.turn.path.length, a.turn.s + 0.12));
          const bend = Math.atan2(after.x * before.z - after.z * before.x, after.dot(before));
          roll = -THREE.MathUtils.clamp(bend * a.v * 2, -0.16, 0.16);
        }
      }
    }
    // Road headings follow the lane/turn tangent: no delayed pivot after changing roads.
    if (a.yaw === null || a.yaw === undefined || T.spec.kind === 'air' || T.spec.kind === 'road') a.yaw = yaw;
    else {
      let d = yaw - a.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      a.yaw += d * Math.min(1, 0.12 + 8 * (this._dt || 0.016));
    }
    _p.y += y;
    const vis = a.vis ?? 1;
    _q.setFromEuler(_e.set(pitch, a.yaw, roll, 'YXZ'));
    _m.compose(_p, _q, _s.set(vis, vis * sy, vis));
    const raining = env.rain > 0.02;
    for (const part of T.parts) {
      let show = vis > 0.01;
      switch (part.name) {
        case 'poncho': show = show && env.rain > a.ponchoT; break;
        case 'umbrella': show = show && env.rain > a.umbT && env.wind < 0.75; break;
        case 'hat': show = show && a.hat && !(raining && env.rain > a.umbT); break;
        case 'beamS': case 'beamL': show = show && env.night > 0.05; break;
        default: break;
      }
      if (show && part.name === 'surfer' && !a.surfing) {
        // Keep the paddler on the board instead of disappearing between rides.
        _q.setFromEuler(_e.set(Math.PI / 2, a.yaw, 0, 'YXZ'));
        _t.copy(_p); _t.y += 0.06;
        _m2.compose(_t, _q, _s.set(vis, vis, vis));
        part.mesh.setMatrixAt(i, _m2);
        continue;
      }
      if (show && part.name === 'flyer') {
        _q.setFromEuler(_e.set(0, a.yaw + Math.PI, 0, 'YXZ'));
        _m2.compose(a.anchor, _q, _s.set(vis, vis, vis));
        part.mesh.setMatrixAt(i, _m2);
        continue;
      }
      part.mesh.setMatrixAt(i, show ? _m : ZERO);
    }
  }

  setDt(dt) { this._dt = dt; }
  setWind(v) { this.windVec = v; }
}
