import * as THREE from 'three';
import { Path } from '../core/Path.js';

/** Signed distance ahead along the agent's direction, including closed roads. */
export function distanceAhead(path, fromS, toS, dir) {
  let d = (toS - fromS) * dir;
  if (path.closed) d = ((d % path.length) + path.length) % path.length;
  return d;
}

export function lanePoint(road, s, dir, lat, out = new THREE.Vector3()) {
  road.path.pointAt(s, out);
  const t = road.path.tangentAt(s).multiplyScalar(dir);
  out.x -= t.z * lat;
  out.z += t.x * lat;
  return out;
}

/** A short, arc-length sampled connector with tangents matching both traffic lanes. */
export function createRoadTurn({ from, fromS, fromDir, fromLat, to, toS, toDir, toLat, vehicleLength = 0.5 }) {
  const incoming = from.path.tangentAt(fromS).multiplyScalar(fromDir);
  const outgoing = to.path.tangentAt(toS).multiplyScalar(toDir);
  // No instantaneous U-turns. Dead-end roads use the branch leading away from the junction.
  if (incoming.dot(outgoing) < -0.7) return null;
  const approach = Math.min(3.0, Math.max(1.2, to.hw + vehicleLength * 0.3));
  const departure = Math.min(3.0, Math.max(1.2, from.hw + vehicleLength * 0.3));
  const entryS = fromS - fromDir * approach;
  const exitS = toS + toDir * departure;
  if (!from.path.closed && (entryS < 0 || entryS > from.path.length)) return null;
  if (!to.path.closed && (exitS < 0 || exitS > to.path.length)) return null;
  const p0 = lanePoint(from, entryS, fromDir, fromLat);
  const p3 = lanePoint(to, exitS, toDir, toLat);
  const t0 = from.path.tangentAt(entryS).multiplyScalar(fromDir);
  const t1 = to.path.tangentAt(exitS).multiplyScalar(toDir);
  const delta = p3.clone().sub(p0);
  const cross = (a, b) => a.x * b.z - a.z * b.x;
  const det = cross(t0, t1);
  const span = Math.hypot(delta.x, delta.z);
  let h0 = span / 3, h1 = span / 3;
  if (Math.abs(det) > 0.15) {
    // The tangent rays meet at the corner; 0.552 gives a near-circular quarter turn.
    const u = cross(delta, t1) / det, v = cross(t0, delta) / det;
    if (u > 0 && v > 0) { h0 = u * 0.55228475; h1 = v * 0.55228475; }
  }
  h0 = Math.min(span * 0.8, Math.max(0.15, h0));
  h1 = Math.min(span * 0.8, Math.max(0.15, h1));
  const p1 = p0.clone().addScaledVector(t0, h0);
  const p2 = p3.clone().addScaledVector(t1, -h1);
  p1.y = THREE.MathUtils.lerp(p0.y, p3.y, 1 / 3);
  p2.y = THREE.MathUtils.lerp(p0.y, p3.y, 2 / 3);
  const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
  const path = new Path(curve.getSpacedPoints(32));
  // Preserve the exact entry/exit headings, not the chord approximation at the ends.
  path.tangents[0].copy(t0);
  path.tangents[path.tangents.length - 1].copy(t1);
  return { from, to, entryS, exitS, dir: toDir, lat: toLat, path, s: 0 };
}
