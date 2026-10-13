import * as THREE from 'three';

// Uniformly re-sampled 3D polyline used for roads, sidewalks, waterways and agent motion.

export class Path {
  /** points: Vector3[] already evenly spaced (last != first for closed). */
  constructor(points, closed = false) {
    this.points = points;
    this.closed = closed;
    this._recompute();
  }

  _recompute() {
    const pts = this.points;
    const n = pts.length;
    this.cum = new Float32Array(n + 1);
    let L = 0;
    for (let i = 1; i < n; i++) { L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); this.cum[i] = L; }
    if (this.closed) { L += Math.hypot(pts[0].x - pts[n - 1].x, pts[0].z - pts[n - 1].z); }
    this.cum[n] = L;
    this.length = L;
    // tangents (xz)
    this.tangents = pts.map((p, i) => {
      const a = pts[this.closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
      const b = pts[this.closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      const t = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
      return t.lengthSq() > 0 ? t.normalize() : new THREE.Vector3(1, 0, 0);
    });
    // bounding box (2D)
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    this.bbox = { minX, minZ, maxX, maxZ };
  }

  static fromControl(ctrl, { closed = false, smooth = true, spacing = 0.4, y = 0 } = {}) {
    const v = ctrl.map((p) => new THREE.Vector3(p[0], p.length > 2 ? p[2] : y, p[1]));
    let curve;
    if (smooth && v.length > 2) {
      curve = new THREE.CatmullRomCurve3(v, closed, 'centripetal');
    } else {
      curve = new THREE.CurvePath();
      for (let i = 0; i < v.length - 1; i++) curve.add(new THREE.LineCurve3(v[i], v[i + 1]));
      if (closed) curve.add(new THREE.LineCurve3(v[v.length - 1], v[0]));
    }
    const len = curve.getLength();
    const n = Math.max(2, Math.round(len / spacing));
    let pts = curve.getSpacedPoints(n);
    if (closed) pts = pts.slice(0, -1);
    return new Path(pts, closed);
  }

  static ellipse(cx, cz, rx, rz, { spacing = 0.4, y = 0, phase = 0 } = {}) {
    const approx = Math.PI * (3 * (rx + rz) - Math.sqrt((3 * rx + rz) * (rx + 3 * rz)));
    const n = Math.max(12, Math.round(approx / spacing));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = phase + (i / n) * Math.PI * 2;
      pts.push(new THREE.Vector3(cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz));
    }
    return new Path(pts, true);
  }

  /** Offset to the right (+d) or left (-d) of travel direction; keeps y. */
  offset(d) {
    const pts = this.points.map((p, i) => {
      const t = this.tangents[i];
      return new THREE.Vector3(p.x - t.z * d, p.y, p.z + t.x * d);
    });
    return new Path(pts, this.closed);
  }

  _wrap(s) {
    if (this.closed) { s %= this.length; if (s < 0) s += this.length; return s; }
    return Math.min(Math.max(s, 0), this.length);
  }

  _locate(s) {
    s = this._wrap(s);
    const cum = this.cum;
    let lo = 0, hi = this.points.length - (this.closed ? 0 : 1);
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
    const seg = cum[lo + 1] - cum[lo] || 1;
    return [lo, (s - cum[lo]) / seg];
  }

  pointAt(s, out = new THREE.Vector3()) {
    const [i, f] = this._locate(s);
    const n = this.points.length;
    const a = this.points[i], b = this.points[(i + 1) % n];
    return out.lerpVectors(a, b, f);
  }

  tangentAt(s, out = new THREE.Vector3()) {
    const [i, f] = this._locate(s);
    const n = this.points.length;
    const a = this.tangents[i], b = this.tangents[(i + 1) % n];
    return out.lerpVectors(a, b, f).normalize();
  }

  /** Nearest arc-length param & distance (2D) to point. */
  nearest(x, z) {
    let best = Infinity, bi = 0;
    const pts = this.points;
    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i].x - x, dz = pts[i].z - z;
      const d = dx * dx + dz * dz;
      if (d < best) { best = d; bi = i; }
    }
    return { s: this.cum[bi], dist: Math.sqrt(best), index: bi };
  }

  /** Accurate 2D distance to polyline segments. */
  distance(x, z) {
    const b = this.bbox;
    const pts = this.points;
    let best = Infinity;
    const n = pts.length;
    const segs = this.closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], c = pts[(i + 1) % n];
      const vx = c.x - a.x, vz = c.z - a.z;
      const wx = x - a.x, wz = z - a.z;
      const l2 = vx * vx + vz * vz || 1e-9;
      let t = (wx * vx + wz * vz) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = wx - vx * t, dz = wz - vz * t;
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
}

/** Clip a sampled route to an x/z square, preserving heights and separate runs.
 * Unlike point filtering, this retains exact edge intersections and never joins
 * disconnected sections through outside space. Fully inside loops stay closed.
 */
export function clipPathToBounds(path, limit) {
  if (path.points.every(p => Math.abs(p.x) <= limit && Math.abs(p.z) <= limit)) return [path];
  const runs = [];
  let run = [];
  const flush = () => { if (run.length > 1) runs.push(run); run = []; };
  const n = path.points.length, segments = path.closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const a = path.points[i], b = path.points[(i + 1) % n];
    let enter = 0, exit = 1, hit = true;
    for (const axis of ['x', 'z']) {
      const delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-12) {
        if (Math.abs(a[axis]) > limit) { hit = false; break; }
      } else {
        const t0 = (-limit - a[axis]) / delta, t1 = (limit - a[axis]) / delta;
        enter = Math.max(enter, Math.min(t0, t1));
        exit = Math.min(exit, Math.max(t0, t1));
        if (enter >= exit) { hit = false; break; }
      }
    }
    if (!hit) { flush(); continue; }
    const p = a.clone().lerp(b, enter), q = a.clone().lerp(b, exit);
    if (run.length && run.at(-1).distanceToSquared(p) > 1e-10) flush();
    if (!run.length) run.push(p);
    if (run.at(-1).distanceToSquared(q) > 1e-12) run.push(q);
    if (exit < 1 - 1e-10) flush();
  }
  flush();
  if (path.closed && runs.length > 1 && runs.at(-1).at(-1).distanceToSquared(runs[0][0]) < 1e-10) {
    const last = runs.pop();
    runs[0] = [...last, ...runs[0].slice(1)];
  }
  return runs.map(points => new Path(points, false)).filter(p => p.length > 1e-6);
}
