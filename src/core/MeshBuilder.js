import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Accumulates many small coloured primitives and merges them into ONE draw call.
// Everything static in a city goes through a handful of these builders.

const _color = new THREE.Color();
const _m = new THREE.Matrix4();
const _local = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _eul = new THREE.Euler();

/** Make a geometry indexed with only position + normal attributes. */
export function normalizeGeometry(g) {
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}

const cache = new Map();
function prim(key, make) {
  let g = cache.get(key);
  if (!g) { g = normalizeGeometry(make()); cache.set(key, g); }
  return g;
}

/** Unit primitives (1x1x1, centred) */
export const P = {
  box: () => prim('box', () => new THREE.BoxGeometry(1, 1, 1)),
  cyl: (n = 8) => prim('cyl' + n, () => new THREE.CylinderGeometry(0.5, 0.5, 1, n)),
  cone: (n = 8) => prim('cone' + n, () => new THREE.ConeGeometry(0.5, 1, n)),
  sphere: (w = 8, h = 6) => prim(`sph${w}_${h}`, () => new THREE.SphereGeometry(0.5, w, h)),
  hemi: (w = 10) => prim('hemi' + w, () => new THREE.SphereGeometry(0.5, w, 5, 0, Math.PI * 2, 0, Math.PI / 2)),
  ico: (d = 0) => prim('ico' + d, () => new THREE.IcosahedronGeometry(0.5, d)),
  plane: () => prim('plane', () => new THREE.PlaneGeometry(1, 1)),
  disc: (n = 16) => prim('disc' + n, () => new THREE.CircleGeometry(0.5, n)),
  torus: (n = 16) => prim('torus' + n, () => new THREE.TorusGeometry(0.5, 0.08, 6, n)),
  // square pyramid with 1x1 base, height 1, base at y=-0.5
  pyramid: () => prim('pyr', () => { const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); g.rotateY(Math.PI / 4); return g; }),
  // gable prism: base 1 wide (x) at y=-0.5, ridge at y=0.5, length 1 along z
  prism: () => prim('prism', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0, 0.5); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
    g.translate(0, 0, -0.5);
    g.computeVertexNormals();
    return g;
  }),
  // concave "Asian" roof: square base 1x1 at y=0, apex at y=1, flared eaves
  flaredRoof: () => prim('flared', () => {
    const pts = [];
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const r = Math.SQRT1_2 * Math.pow(1 - t, 1.7);
      pts.push(new THREE.Vector2(Math.max(r, 0.0001), t * 1.0));
    }
    const g = new THREE.LatheGeometry(pts, 4);
    g.rotateY(Math.PI / 4);
    const ng = g.index ? g.toNonIndexed() : g; ng.computeVertexNormals();
    return ng;
  }),
};

/** Build a mesh from raw triangle list, orienting each face away from `center`. */
export function geometryFromTris(tris, center = null) {
  const pos = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const n = new THREE.Vector3(), cen = new THREE.Vector3(), tmp = new THREE.Vector3();
  for (const [p0, p1, p2] of tris) {
    a.fromArray(p0); b.fromArray(p1); c.fromArray(p2);
    if (center) {
      n.subVectors(b, a).cross(tmp.subVectors(c, a));
      cen.copy(a).add(b).add(c).divideScalar(3).sub(center);
      if (n.dot(cen) < 0) { pos.push(...p0, ...p2, ...p1); continue; }
    }
    pos.push(...p0, ...p1, ...p2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return normalizeGeometry(g);
}

/** Hip roof: base w x d at y=0, height h. */
export function hipRoof(w, d, h) {
  const swap = w > d;
  const W = swap ? d : w, D = swap ? w : d;
  const r = (D - W) / 2;
  const A = [-W / 2, 0, -D / 2], B = [W / 2, 0, -D / 2], C = [W / 2, 0, D / 2], Dd = [-W / 2, 0, D / 2];
  const R1 = [0, h, -r], R2 = [0, h, r];
  const tris = [
    [B, C, R2], [B, R2, R1],
    [Dd, A, R1], [Dd, R1, R2],
    [C, Dd, R2], [A, B, R1],
    [A, C, B], [A, Dd, C],
  ];
  const g = geometryFromTris(tris, new THREE.Vector3(0, h * 0.3, 0));
  if (swap) g.rotateY(Math.PI / 2);
  return g;
}

export class MeshBuilder {
  constructor(name = '', { sway = false } = {}) {
    this.name = name;
    // per-vertex tree data for wind bending: (baseX, baseY, baseZ, height); height 0 = rigid
    this.useSway = sway;
    this.sway = null;
    this.parts = [];
    this.stack = [new THREE.Matrix4()];
    this.vertexCount = 0;
  }
  get frame() { return this.stack[this.stack.length - 1]; }
  push(x = 0, y = 0, z = 0, ry = 0, s = 1) {
    _local.compose(_pos.set(x, y, z), _quat.setFromEuler(_eul.set(0, ry, 0)), _scl.set(s, s, s));
    this.stack.push(this.frame.clone().multiply(_local));
    return this;
  }
  pushMatrix(m) { this.stack.push(this.frame.clone().multiply(m)); return this; }
  pop() { if (this.stack.length > 1) this.stack.pop(); return this; }

  /** Add geometry (cloned) with optional local matrix and flat colour. */
  add(geo, color, local = null, own = false) {
    const g = own ? geo : geo.clone();
    _m.copy(this.frame);
    if (local) _m.multiply(local);
    g.applyMatrix4(_m);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    _color.set(color);
    for (let i = 0; i < n; i++) { col[i * 3] = _color.r; col[i * 3 + 1] = _color.g; col[i * 3 + 2] = _color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (this.useSway) {
      const sw = new Float32Array(n * 4);
      if (this.sway) for (let i = 0; i < n; i++) sw.set(this.sway, i * 4);
      g.setAttribute('aSway', new THREE.BufferAttribute(sw, 4));
    }
    this.parts.push(g);
    this.vertexCount += n;
    return g;
  }
  /** Add a geometry that already carries its own colour attribute (in builder frame). */
  addColored(g) {
    g.applyMatrix4(this.frame);
    this.parts.push(g);
    this.vertexCount += g.attributes.position.count;
    return g;
  }
  put(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}, own = false) {
    _local.compose(_pos.set(x, y, z), _quat.setFromEuler(_eul.set(rx, ry, rz)), _scl.set(sx, sy, sz));
    return this.add(geo, color, _local, own);
  }
  /** Box with its bottom at y. */
  box(x, y, z, w, h, d, color, ry = 0) {
    return this.put(P.box(), color, { x, y: y + h / 2, z, sx: w, sy: h, sz: d, ry });
  }
  cyl(x, y, z, r, h, color, seg = 8, rTop = null) {
    if (rTop !== null) {
      const g = normalizeGeometry(new THREE.CylinderGeometry(rTop, r, h, seg));
      return this.put(g, color, { x, y: y + h / 2, z }, true);
    }
    return this.put(P.cyl(seg), color, { x, y: y + h / 2, z, sx: r * 2, sy: h, sz: r * 2 });
  }
  cone(x, y, z, r, h, color, seg = 8) {
    return this.put(P.cone(seg), color, { x, y: y + h / 2, z, sx: r * 2, sy: h, sz: r * 2 });
  }
  sphere(x, y, z, r, color, sy = 1, seg = 8) {
    return this.put(P.sphere(seg, Math.max(4, seg - 2)), color, { x, y, z, sx: r * 2, sy: r * 2 * sy, sz: r * 2 });
  }
  /** Vertical quad facing +z (before ry), centre (x,y,z). */
  quad(x, y, z, w, h, color, ry = 0) {
    return this.put(P.plane(), color, { x, y, z, sx: w, sy: h, ry });
  }
  /** Horizontal quad (facing up). */
  flat(x, y, z, w, d, color, ry = 0) {
    return this.put(P.plane(), color, { x, y, z, sx: w, sy: d, rx: -Math.PI / 2, rz: ry });
  }
  /** Cylinder between two points. */
  beam(a, b, r, color, seg = 6) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-5) return null;
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    _quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    _local.compose(mid, _quat, _scl.set(r * 2, len, r * 2));
    return this.add(P.cyl(seg), color, _local);
  }

  /** Flat box spanning a->b (length), w across horizontally, h thick. */
  slab(a, b, w, h, color) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-5) return null;
    dir.normalize();
    const up = Math.abs(dir.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(dir, up).normalize();
    const nrm = new THREE.Vector3().crossVectors(side, dir).normalize();
    _local.makeBasis(side, nrm, dir);
    _quat.setFromRotationMatrix(_local);
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    _local.compose(mid, _quat, _scl.set(w, h, len));
    return this.add(P.box(), color, _local);
  }

  build(material, { castShadow = true, receiveShadow = true, name } = {}) {
    if (!this.parts.length) return null;
    const g = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.name = name || this.name;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }

  /** Merge to a plain geometry (for instanced agent models). */
  toGeometry() {
    const g = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    g.computeBoundingSphere();
    return g;
  }
}
