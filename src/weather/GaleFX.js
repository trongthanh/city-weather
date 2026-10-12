import * as THREE from 'three';
import { MeshBuilder, P } from '../core/MeshBuilder.js';

// Storm "gale" effects: leaves torn from real trees, roof-tile / tin shards flying off buildings,
// corrugated tin roofs (mái tôn) rattling, flapping and ripping off, and uprooted trees tumbling by.

const rr = (a, b) => a + (b - a) * Math.random();
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3();
const _s = new THREE.Vector3(), _w = new THREE.Vector3(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const LIMIT = 36;

function makePool(group, geo, mat, n) {
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  for (let i = 0; i < n; i++) { mesh.setMatrixAt(i, ZERO); mesh.setColorAt(i, _c.set('#ffffff')); }
  group.add(mesh);
  const items = Array.from({ length: n }, () => ({
    active: false, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(),
    axis: new THREE.Vector3(1, 0, 0), spin: 0, s: 1, life: 0, age: 0,
  }));
  return { mesh, items, n };
}

export class GaleFX {
  constructor(scene, { quality = 1 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'galeFX';
    scene.add(this.group);
    this.time = 0;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
    const metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.4, side: THREE.DoubleSide });

    let b = new MeshBuilder();
    b.put(P.plane(), '#ffffff', { sy: 0.6 });
    const leafGeo = b.toGeometry();
    this.leaves = makePool(this.group, leafGeo, mat, Math.round(700 * quality));
    this.leaves.mesh.castShadow = false;

    b = new MeshBuilder();
    b.box(0, -0.015, 0, 1, 0.03, 0.7, '#ffffff');
    this.shards = makePool(this.group, b.toGeometry(), mat, Math.round(220 * quality));

    // uprooted tree: trunk with roots + clumps of foliage
    b = new MeshBuilder();
    b.cyl(0, -0.7, 0, 0.07, 1.2, '#7a5536', 6);
    for (let i = 0; i < 4; i++) b.beam(new THREE.Vector3(0, -0.7, 0), new THREE.Vector3(Math.cos(i * 1.6) * 0.3, -0.85, Math.sin(i * 1.6) * 0.3), 0.025, '#6b4a30', 4);
    b.sphere(0, 0.65, 0, 0.42, '#6e9f3c', 0.9, 8);
    b.sphere(0.25, 0.45, 0.1, 0.3, '#7fae3f', 0.9, 7);
    b.sphere(-0.22, 0.5, -0.12, 0.3, '#5f9440', 0.9, 7);
    this.trees = makePool(this.group, b.toGeometry(), mat, 7);

    // corrugated tin sheet, unit size in xz
    b = new MeshBuilder();
    b.box(0, -0.0125, 0, 1, 0.025, 1, '#ffffff');
    for (let i = 0; i < 10; i++) b.box(-0.45 + i * 0.1, 0.012, 0, 0.035, 0.014, 1, '#dcdcdc');
    this.roofMesh = new THREE.InstancedMesh(b.toGeometry(), metal, 90);
    this.roofMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.roofMesh.frustumCulled = false;
    this.roofMesh.castShadow = true;
    this.roofMesh.receiveShadow = true;
    for (let i = 0; i < 90; i++) { this.roofMesh.setMatrixAt(i, ZERO); this.roofMesh.setColorAt(i, _c.set('#ffffff')); }
    this.group.add(this.roofMesh);
    this.roofs = [];
    this.treeSpots = [];
    this.tops = [];
  }

  setCity(city) {
    this.treeSpots = city.treeSpots || [];
    this.tops = city.tops || [];
    this.roofs = (city.roofs || []).slice(0, this.roofMesh.count).map((r, i) => {
      this.roofMesh.setColorAt(i, _c.set(r.color));
      return {
        ...r, state: 0, th: rr(0.5, 1.05), timer: 0, delay: rr(0, 3), fade: 1, seed: Math.random() * 100,
        p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), axis: new THREE.Vector3(), spin: 0, flapT: 0,
        baseQ: new THREE.Quaternion().setFromAxisAngle(UP, r.yaw),
      };
    });
    for (let i = this.roofs.length; i < this.roofMesh.count; i++) this.roofMesh.setMatrixAt(i, ZERO);
    if (this.roofMesh.instanceColor) this.roofMesh.instanceColor.needsUpdate = true;
    for (const pool of [this.leaves, this.shards, this.trees]) for (const it of pool.items) it.active = false;
  }

  /** Wind velocity field: prevailing wind + typhoon swirl + turbulence. */
  windAt(p, out) {
    const t = this.time, sp = this.speed, W = this.windDir, vx = this.vortex;
    out.set(W.x * sp, 0, W.y * sp);
    if (vx > 0.01) {
      const r = Math.hypot(p.x, p.z) + 4;
      out.x += (-p.z / r * 8 - p.x / r * 1.5) * vx;
      out.z += (p.x / r * 8 - p.z / r * 1.5) * vx;
    }
    out.x += Math.sin(p.z * 0.7 + t * 2.3) * sp * 0.3;
    out.z += Math.cos(p.x * 0.6 + t * 1.9) * sp * 0.3;
    out.y = Math.sin(p.x * 0.5 + p.z * 0.4 + t * 3.1) * sp * 0.3;
    return out;
  }

  _spawn(pool, init) {
    const it = pool.items.find((a) => !a.active);
    if (!it) return null;
    it.active = true; it.age = 0;
    it.axis.set(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize();
    it.q.setFromAxisAngle(it.axis, rr(0, 6.28));
    init(it);
    const idx = pool.items.indexOf(it);
    if (it.color) { pool.mesh.setColorAt(idx, _c.set(it.color)); pool.mesh.instanceColor.needsUpdate = true; }
    return it;
  }

  _step(pool, dt, { drag, gravity, lift = 0, floor = 0.12, bounce = 0.3 }) {
    const mesh = pool.mesh;
    for (let i = 0; i < pool.n; i++) {
      const a = pool.items[i];
      if (!a.active) { mesh.setMatrixAt(i, ZERO); continue; }
      a.age += dt; a.life -= dt;
      this.windAt(a.p, _w);
      _w.y += lift;
      a.v.lerp(_w, 1 - Math.exp(-drag * dt));
      a.v.y -= gravity * dt;
      a.p.addScaledVector(a.v, dt);
      if (a.p.y < floor) { a.p.y = floor; a.v.y = Math.abs(a.v.y) * bounce; a.v.x *= 0.75; a.v.z *= 0.75; }
      const speed = a.v.length();
      _q.setFromAxisAngle(a.axis, a.spin * dt * (0.4 + speed * 0.12));
      a.q.multiply(_q);
      if (a.life <= 0 || Math.abs(a.p.x) > LIMIT || Math.abs(a.p.z) > LIMIT || a.p.y > 24) { a.active = false; mesh.setMatrixAt(i, ZERO); continue; }
      const grow = Math.min(1, a.age * 4) * Math.min(1, a.life * 2);
      _m.compose(a.p, a.q, _s.setScalar(a.s * grow));
      mesh.setMatrixAt(i, _m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt, p, windDir) {
    this.time += dt;
    const t = this.time;
    this.windDir = windDir;
    this.vortex = p.vortex;
    this.speed = p.wind * 10 + p.vortex * 3;
    const force = p.wind * (0.55 + 0.45 * p.debris);

    // ---- leaves stripped from trees (start in strong rain storms already)
    const leafTarget = Math.round(this.leaves.n * smooth(0.4, 0.95, p.wind));
    let active = this.leaves.items.reduce((n, a) => n + (a.active ? 1 : 0), 0);
    for (let k = 0; k < 12 && active < leafTarget && this.treeSpots.length; k++, active++) {
      const sp = pick(this.treeSpots);
      this._spawn(this.leaves, (a) => {
        a.p.set(sp.x + rr(-0.4, 0.4), sp.y + rr(-0.3, 0.4), sp.z + rr(-0.4, 0.4));
        a.v.set(0, 0, 0); a.life = rr(4, 9); a.s = rr(0.07, 0.13); a.spin = rr(6, 14);
        a.color = pick(['#6e9f3c', '#86b443', '#5f9440', '#a9c24a', '#c2a03a', '#8a6a3c']);
      });
    }
    this._step(this.leaves, dt, { drag: 2.6, gravity: 1.4, lift: 0.6, floor: 0.08, bounce: 0.1 });

    // ---- roof tiles / tin shards blown off buildings
    const shardTarget = Math.round(this.shards.n * smooth(0.35, 1, p.debris));
    active = this.shards.items.reduce((n, a) => n + (a.active ? 1 : 0), 0);
    for (let k = 0; k < 4 && active < shardTarget && this.tops.length; k++, active++) {
      const top = pick(this.tops);
      this._spawn(this.shards, (a) => {
        a.p.set(top.x + rr(-0.5, 0.5), top.y + 0.1, top.z + rr(-0.5, 0.5));
        this.windAt(a.p, a.v).multiplyScalar(0.3); a.v.y = rr(1.5, 4);
        a.life = rr(4, 9); a.s = rr(0.12, 0.3); a.spin = rr(5, 12);
        a.color = pick(['#d9692f', '#e0763a', '#c95f2e', '#8a9399', '#7d8f9e', '#a35a3c', '#8b6a48', '#c0c6ca']);
      });
    }
    this._step(this.shards, dt, { drag: 1.3, gravity: 3.2, lift: 2.2, floor: 0.12, bounce: 0.25 });

    // ---- uprooted trees tumbling through (super typhoon)
    const treeTarget = Math.round(this.trees.n * smooth(0.65, 1, p.debris));
    active = this.trees.items.reduce((n, a) => n + (a.active ? 1 : 0), 0);
    if (active < treeTarget && Math.random() < dt * 0.6) {
      const W = this.windDir;
      this._spawn(this.trees, (a) => {
        const side = rr(-16, 16);
        a.p.set(-W.x * 30 - W.y * side, rr(1.5, 6), -W.y * 30 + W.x * side);
        a.v.set(W.x * this.speed * 0.5, 0, W.y * this.speed * 0.5);
        a.life = 18; a.s = rr(0.8, 1.3); a.spin = rr(1.5, 3);
      });
    }
    this._step(this.trees, dt, { drag: 0.7, gravity: 0.9, lift: 0.8, floor: 0.6, bounce: 0.4 });

    // ---- tin roofs: rattle -> flap -> torn off -> fly away; restored when the storm passes
    const R = this.roofMesh;
    this.roofs.forEach((r, i) => {
      const calm = force < r.th - 0.15;
      if (r.state === 0) {
        r.fade = Math.min(1, r.fade + dt);
        if (force > r.th) { r.timer += dt; if (r.timer > r.delay) { r.state = 1; r.flapT = rr(1, 2.8); } } else r.timer = 0;
        const rattle = force > r.th - 0.25 ? Math.sin(t * 28 + r.seed) * 0.05 * smooth(r.th - 0.25, r.th, force) : 0;
        this._roofMatrix(i, r, 0.05 + Math.max(0, rattle), r.fade);
      } else if (r.state === 1) {
        r.flapT -= dt;
        const ang = 0.25 + 0.3 * Math.abs(Math.sin(t * 9 + r.seed)) + (1 - Math.min(1, r.flapT)) * 0.4;
        this._roofMatrix(i, r, ang, 1);
        if (calm) { r.state = 0; r.timer = 0; }
        else if (r.flapT <= 0) {
          r.state = 2;
          r.p.set(r.x, r.y + 0.3, r.z);
          this.windAt(r.p, r.v).multiplyScalar(0.4); r.v.y = rr(3, 5);
          r.q.copy(r.baseQ);
          r.axis.set(rr(-1, 1), rr(-0.3, 0.3), rr(-1, 1)).normalize();
          r.spin = rr(2, 5);
        }
      } else if (r.state === 2) {
        this.windAt(r.p, _w); _w.y += 1.2;
        r.v.lerp(_w, 1 - Math.exp(-0.9 * dt));
        r.v.y -= 0.9 * dt;
        r.p.addScaledVector(r.v, dt);
        if (r.p.y < 0.2) { r.p.y = 0.2; r.v.y = Math.abs(r.v.y) * 0.4; }
        _q.setFromAxisAngle(r.axis, r.spin * dt);
        r.q.multiply(_q);
        _m.compose(r.p, r.q, _s.set(r.w, 1, r.d));
        R.setMatrixAt(i, _m);
        if (Math.abs(r.p.x) > LIMIT || Math.abs(r.p.z) > LIMIT || r.p.y > 24) { r.state = 3; R.setMatrixAt(i, ZERO); }
      } else {
        R.setMatrixAt(i, ZERO);
        if (calm) { r.state = 0; r.fade = 0; r.timer = 0; }
      }
    });
    R.instanceMatrix.needsUpdate = true;
  }

  /** Roof hinged on its back edge, front edge lifted by `ang`. */
  _roofMatrix(i, r, ang, scale) {
    _p.set(r.x, r.y, r.z);
    _m.compose(_p, r.baseQ, _s.set(1, 1, 1));
    _m2.makeTranslation(0, 0, -r.d / 2); _m.multiply(_m2);
    _m2.makeRotationX(-ang); _m.multiply(_m2);
    _m2.makeTranslation(0, 0, r.d / 2); _m.multiply(_m2);
    _m2.makeScale(r.w * scale, 1, r.d * scale); _m.multiply(_m2);
    this.roofMesh.setMatrixAt(i, _m);
  }
}
