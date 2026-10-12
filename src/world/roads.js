import * as THREE from 'three';
import { Path } from '../core/Path.js';
import { HALF, WATER_LEVEL, BED } from './Field.js';
import { smoothstep } from '../core/rng.js';

export const DECK_Y = 0.45;
const RAMP = 2.2;
const ROAD_Y = 0.05;
const WALK_Y = 0.09;

const C = {
  asphalt: '#5f6368',
  asphaltBridge: '#686c72',
  walk: '#cfc6b8',
  curb: '#b3ab9f',
  mark: '#f4f1e8',
  concrete: '#d5d0c6',
  rail: '#e9e6df',
};

function onEdge(p) { return Math.abs(p.x) > HALF - 0.6 || Math.abs(p.z) > HALF - 0.6; }

/** Prepare road paths (incl. bridge elevation). */
export function prepareRoads(defs, field) {
  return defs.map((def, id) => {
    const hw = def.hw ?? 1.1, sw = def.sw ?? 0.55;
    let path = def.path;
    if (!path) {
      if (def.ellipse) path = Path.ellipse(def.ellipse.x, def.ellipse.z, def.ellipse.rx, def.ellipse.rz, { spacing: 0.4 });
      else path = Path.fromControl(def.pts, { closed: !!def.closed, smooth: def.smooth !== false, spacing: 0.4 });
    }
    // clip open paths to the tile
    if (!path.closed) {
      const inside = path.points.filter((p) => Math.abs(p.x) <= HALF + 1e-3 && Math.abs(p.z) <= HALF + 1e-3);
      if (inside.length !== path.points.length) path = new Path(inside.map((p) => p.clone()), false);
    }
    // bridge elevation
    const pts = path.points;
    const wet = pts.map((p) => field.waterSD(p.x, p.z) < 0.45 || (field.beachWidth() && field.seaSD(p.x, p.z) < 0.2));
    const n = pts.length;
    const dist = new Float32Array(n).fill(1e9);
    const ds = path.length / (path.closed ? n : n - 1);
    for (let i = 0; i < n; i++) if (wet[i]) dist[i] = 0;
    for (let i = 1; i < n; i++) dist[i] = Math.min(dist[i], dist[i - 1] + ds);
    for (let i = n - 2; i >= 0; i--) dist[i] = Math.min(dist[i], dist[i + 1] + ds);
    let bridge = false;
    for (let i = 0; i < n; i++) {
      const y = DECK_Y * smoothstep(RAMP, 0, dist[i]);
      pts[i].y = y + ROAD_Y;
      if (wet[i]) bridge = true;
    }
    const startEdge = !path.closed && onEdge(pts[0]);
    const endEdge = !path.closed && onEdge(pts[n - 1]);
    return { id, def, hw, sw, path, wet, bridge, startEdge, endEdge, junctions: [], kind: def.kind || 'road', name: def.name };
  });
}

function ribbon(out, path, offA, offB, yOff, color, skip, depth = 0) {
  const pts = path.points, tans = path.tangents, n = pts.length;
  const segs = path.closed ? n : n - 1;
  const c = new THREE.Color(color);
  const cs = new THREE.Color(color).multiplyScalar(0.82);
  const v = (i, off, dy) => {
    const p = pts[i % n], t = tans[i % n];
    return [p.x - t.z * off, p.y + yOff + dy, p.z + t.x * off];
  };
  const push = (a, b, cc, d, col) => {
    for (const k of [0, 1, 2, 0, 2, 3]) { const q = [a, b, cc, d][k]; out.pos.push(q[0], q[1], q[2]); out.col.push(col.r, col.g, col.b); }
  };
  for (let i = 0; i < segs; i++) {
    if (skip && skip(i)) continue;
    const a0 = v(i, offA, 0), b0 = v(i, offB, 0), a1 = v(i + 1, offA, 0), b1 = v(i + 1, offB, 0);
    // top (counter-clockwise seen from above)
    push(a0, b0, b1, a1, c);
    if (depth > 0) {
      const a0d = v(i, offA, -depth), b0d = v(i, offB, -depth), a1d = v(i + 1, offA, -depth), b1d = v(i + 1, offB, -depth);
      push(a0d, a0, a1, a1d, cs);
      push(b0d, b1d, b1, b0, cs);
    }
  }
}

function orientTop(out) {
  // ensure top faces point up: flip triangles with downward normal and |ny| large
  const p = out.pos;
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2];
    const bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1;
    if (ny / len < -0.5) {
      for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
    }
  }
}

function geoFrom(out) {
  orientTop(out);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
  g.computeVertexNormals();
  const n = out.pos.length / 3;
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

/**
 * Build road surfaces, sidewalks, markings, bridges, lamps & avenue trees.
 * Returns walk paths and lamp positions.
 */
export function buildRoads(roads, field, B, occ, rng, trees) {
  const out = { pos: [], col: [] };
  const lamps = [];
  const walkPaths = [];

  // ---- intersections / junctions
  for (const A of roads) {
    const pts = A.path.points;
    A.inside = pts.map((p) => {
      const list = [];
      for (const Bd of roads) {
        if (Bd === A) continue;
        const d = Bd.path.distance(p.x, p.z);
        if (d < Bd.hw + Bd.sw + 0.05 && Math.abs(Bd.path.pointAt(Bd.path.nearest(p.x, p.z).s).y - p.y) < 0.3) list.push({ road: Bd, d });
      }
      return list;
    });
  }
  for (const A of roads) {
    const pts = A.path.points;
    for (const Bd of roads) {
      if (Bd.id <= A.id) continue;
      // find local minima of distance under threshold
      let best = null;
      const flush = () => {
        if (!best) return;
        const nb = Bd.path.nearest(pts[best.i].x, pts[best.i].z);
        const j = { a: A, sA: A.path.cum[best.i], b: Bd, sB: nb.s };
        A.junctions.push({ s: j.sA, to: Bd, toS: j.sB });
        Bd.junctions.push({ s: j.sB, to: A, toS: j.sA });
        best = null;
      };
      for (let i = 0; i < pts.length; i++) {
        const d = Bd.path.distance(pts[i].x, pts[i].z);
        if (d < 0.7) { if (!best || d < best.d) best = { i, d }; }
        else flush();
      }
      flush();
    }
  }
  for (const r of roads) r.junctions.sort((a, b) => a.s - b.s);

  // ---- surfaces
  for (const r of roads) {
    const { path, hw, sw } = r;
    const n = path.points.length;
    const plaza = r.kind === 'plaza';
    ribbon(out, path, -hw, hw, 0, plaza ? '#d9cfc0' : r.bridge ? C.asphalt : C.asphalt, null, 0.28);

    // sidewalks with gaps at crossings
    for (const side of [-1, 1]) {
      const off = side * (hw + sw / 2);
      const sp = path.offset(off);
      const skip = (i) => {
        const p = sp.points[i], q = sp.points[(i + 1) % n];
        for (const o of roads) {
          if (o === r) continue;
          const lim = o.hw + 0.02;
          if (o.path.distance(p.x, p.z) < lim || o.path.distance(q.x, q.z) < lim) {
            if (Math.abs(o.path.pointAt(o.path.nearest(p.x, p.z).s).y - p.y) < 0.3) return true;
          }
        }
        return false;
      };
      if (sw > 0.05) ribbon(out, path, side > 0 ? hw : -hw - sw, side > 0 ? hw + sw : -hw, WALK_Y - ROAD_Y, C.walk, skip, 0.3);
      if (sw > 0.05) walkPaths.push({ path: sp, road: r });
    }

    // centre dashes
    if (!plaza && hw >= 0.9) {
      const dash = 1.3, len = 0.55;
      for (let s = 0.6; s < path.length - 0.6; s += dash) {
        const i = Math.min(n - 1, Math.round((s / path.length) * (path.closed ? n : n - 1)));
        if (r.inside[i % n].some((o) => o.d < o.road.hw + 0.6)) continue;
        const p = path.pointAt(s), t = path.tangentAt(s);
        B.main.flat(p.x, p.y + 0.012, p.z, 0.07, len, C.mark, Math.atan2(t.x, t.z));
      }
    }
    // zebra crossings when entering another road
    if (!plaza) {
      for (let i = 1; i < n; i++) {
        const was = r.inside[i - 1].length > 0, is = r.inside[i].length > 0;
        if (was === is) continue;
        const k = is ? i - 2 : i + 1;
        if (k < 0 || k >= n) continue;
        const p = path.points[k], t = path.tangents[k];
        if (p.y > 0.2) continue;
        const ry = Math.atan2(t.x, t.z);
        for (let q = -hw + 0.2; q <= hw - 0.15; q += 0.32) {
          B.main.flat(p.x - t.z * q, p.y + 0.012, p.z + t.x * q, 0.16, 0.62, C.mark, ry);
        }
      }
    }

    // bridge furniture
    if (r.bridge) {
      const pts = path.points;
      let lastPier = -1e9;
      for (let i = 0; i < n - 1; i++) {
        const p = pts[i], q = pts[i + 1];
        if (p.y < 0.2 || q.y < 0.2) continue;
        const t = path.tangents[i];
        for (const side of [-1, 1]) {
          const off = side * (hw + sw - 0.05);
          const a = new THREE.Vector3(p.x - t.z * off, p.y + WALK_Y - ROAD_Y, p.z + t.x * off);
          const b2 = new THREE.Vector3(q.x - path.tangents[i + 1].z * off, q.y + WALK_Y - ROAD_Y, q.z + path.tangents[i + 1].x * off);
          if (!r.def.noRail) {
            B.main.beam(a.clone().setY(a.y + 0.28), b2.clone().setY(b2.y + 0.28), 0.03, r.def.railColor || C.rail, 4);
            if (i % 2 === 0) B.main.box(a.x, a.y, a.z, 0.06, 0.28, 0.06, r.def.railColor || C.rail);
          }
        }
        const s = path.cum[i];
        if (r.wet[i] && s - lastPier > 3.4 && !r.def.noPiers) {
          lastPier = s;
          const ry = Math.atan2(t.x, t.z);
          B.main.box(p.x, BED, p.z, (hw + sw) * 1.6, p.y - 0.25 - BED, 0.45, C.concrete, ry + Math.PI / 2);
        }
      }
    }

    // lamps & avenue trees
    const lampEvery = r.def.lamps === false ? 0 : r.def.lampSpacing || 6.5;
    const treeEvery = r.def.trees || 0;
    for (const side of [-1, 1]) {
      const off = side * (hw + sw - 0.16);
      const place = (every, phase, fn) => {
        if (!every) return;
        for (let s = phase; s < path.length - 0.5; s += every) {
          const p = path.pointAt(s), t = path.tangentAt(s);
          const x = p.x - t.z * off, z = p.z + t.x * off;
          if (Math.abs(x) > HALF - 0.4 || Math.abs(z) > HALF - 0.4) continue;
          let blocked = false;
          for (const o of roads) { if (o !== r && o.path.distance(x, z) < o.hw + o.sw + 0.5) { blocked = true; break; } }
          if (blocked) continue;
          fn(x, p.y + WALK_Y - ROAD_Y, z, t, side);
        }
      };
      place(lampEvery, side > 0 ? 2 : 2 + lampEvery / 2, (x, y, z, t, sd) => {
        const dx = t.z * sd, dz = -t.x * sd; // toward road centre
        addLamp(B, x, y, z, dx, dz);
        lamps.push(new THREE.Vector3(x + dx * 0.55, y, z + dz * 0.55));
      });
      if (treeEvery && !r.bridge) {
        place(treeEvery, side > 0 ? 1 : 1 + treeEvery / 2, (x, y, z) => {
          if (y > 0.2) return;
          trees.push({ x, z, y, kind: r.def.treeKind || 'round', s: rng.range(0.75, 1.0), avenue: true });
        });
      }
    }

    // occupancy
    for (const p of path.points) occ.markCircle(p.x, p.z, hw + sw - 0.1);
  }

  B.main.addColored(geoFrom(out));
  return { walkPaths, lamps };
}

export function addLamp(B, x, y, z, dx, dz) {
  const h = 1.25;
  B.main.cyl(x, y, z, 0.035, h, '#3d4248', 6);
  const ex = x + dx * 0.4, ez = z + dz * 0.4;
  B.main.beam(new THREE.Vector3(x, y + h - 0.02, z), new THREE.Vector3(ex, y + h + 0.06, ez), 0.025, '#3d4248', 4);
  B.lamp.box(ex, y + h - 0.02, ez, 0.16, 0.06, 0.16, '#fff3d6');
}
