import { Path } from '../core/Path.js';
import { makeNoise2D, smoothstep, clamp } from '../core/rng.js';

// Scalar fields describing the terrain of a city tile: water, islands, hills, parks.

import { Color } from 'three';
const _wc = new Color();

export const TILE = 44;
export const HALF = TILE / 2;
export const WATER_LEVEL = -0.3;
export const BED = -1.05;

export class Field {
  constructor(layout, seed) {
    this.noise = makeNoise2D(seed);
    this.water = (layout.water || []).map((w) => {
      if (w.type === 'river') return { ...w, path: w.path instanceof Path ? w.path : Path.fromControl(w.points, { spacing: 0.5, smooth: w.smooth !== false }) };
      if (w.type === 'poly') return { ...w, path: w.path instanceof Path ? w.path : Path.fromControl(w.points, { closed: true, spacing: 0.35 }) };
      return { ...w };
    });
    this.islands = layout.islands || [];
    this.hills = layout.hills || [];
    this.parks = layout.parks || [];
    this.plazas = layout.plazas || [];
  }

  /** Signed distance to water. Negative = in water. Also returns which shape. */
  /** Colour of the nearest water body (for multi-colour water, e.g. jade lake + red-brown river). */
  waterColorAt(x, z, fallback) {
    let best = 1e9, col = fallback;
    for (const w of this.water) { const d = this._shapeSD(w, x, z); if (d < best) { best = d; col = w.color || fallback; } }
    return col;
  }

  _shapeSD(w, x, z) {
    if (w.type === 'ellipse') {
      const dx = (x - w.x) / w.rx, dz = (z - w.z) / w.rz;
      return (Math.sqrt(dx * dx + dz * dz) - 1) * Math.min(w.rx, w.rz);
    }
    if (w.type === 'river') return w.path.distance(x, z) - w.width / 2;
    if (w.type === 'poly') return polySD(w.path, x, z);
    if (w.type === 'sea') return (w.coast(z) - x) * (w.side || 1);
    return 1e9;
  }

  waterSD(x, z) {
    let sd = 1e9;
    for (const w of this.water) {
      let d;
      if (w.type === 'ellipse') {
        const dx = (x - w.x) / w.rx, dz = (z - w.z) / w.rz;
        const k = Math.sqrt(dx * dx + dz * dz);
        const a = Math.atan2(dz, dx);
        d = (k - 1) * Math.min(w.rx, w.rz) + (w.wobble || 0) * this.noise(Math.cos(a) * 2 + 7, Math.sin(a) * 2 + 3);
      } else if (w.type === 'river') {
        d = w.path.distance(x, z) - w.width / 2 + (w.wobble || 0) * this.noise(x * 0.25, z * 0.25);
      } else if (w.type === 'poly') {
        d = polySD(w.path, x, z) + (w.wobble || 0) * this.noise(x * 0.35, z * 0.35);
      } else if (w.type === 'sea') {
        d = (w.coast(z) - x) * (w.side || 1);
      }
      if (d < sd) sd = d;
    }
    for (const isl of this.islands) {
      const d = Math.hypot(x - isl.x, z - isl.z) - isl.r;
      sd = Math.max(sd, -d);
    }
    return sd;
  }

  seaSD(x, z) {
    let sd = 1e9;
    for (const w of this.water) if (w.type === 'sea') sd = Math.min(sd, (w.coast(z) - x) * (w.side || 1));
    return sd;
  }

  beachWidth() {
    for (const w of this.water) if (w.type === 'sea') return w.beach || 3.5;
    return 0;
  }

  hillHeight(x, z) {
    let h = 0;
    for (const hl of this.hills) {
      const d2 = ((x - hl.x) ** 2 + (z - hl.z) ** 2) / (hl.r * hl.r);
      h += hl.h * Math.exp(-d2 * 2.2) * (1 + 0.18 * this.noise(x * 0.5 + hl.x, z * 0.5));
    }
    return h;
  }

  inPark(x, z) {
    for (const p of this.parks) {
      if (p.type === 'ellipse') { if (((x - p.x) / p.rx) ** 2 + ((z - p.z) / p.rz) ** 2 <= 1) return p; }
      else if (p.type === 'rect') { if (Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2) return p; }
      else if (p.type === 'circle') { if ((x - p.x) ** 2 + (z - p.z) ** 2 <= p.r * p.r) return p; }
      else if (p.type === 'poly') { if (pointInPoly(p.path.points, x, z)) return p; }
    }
    return null;
  }

  inPlaza(x, z) {
    for (const p of this.plazas) if (Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2) return p;
    return null;
  }

  /** Ground height (before roads). */
  height(x, z) {
    const sd = this.waterSD(x, z);
    let h = 0;
    const bw = this.beachWidth();
    const sea = bw ? this.seaSD(x, z) : 1e9;
    if (sea < bw) {
      if (sea >= 0) h = -0.42 * (1 - sea / bw) ** 1.4;
      else h = -0.42 - 0.9 * smoothstep(0, 5, -sea);
    }
    if (sd < 0 && sea >= 0) {
      h = Math.min(h, BED * smoothstep(0, 0.55, -sd));
    }
    const hill = this.hillHeight(x, z);
    if (hill > 0.01 && sd > 0) h = Math.max(h, hill);
    return h;
  }

  isFlatLand(x, z, margin = 0.25) {
    if (this.waterSD(x, z) < margin) return false;
    const bw = this.beachWidth();
    if (bw && this.seaSD(x, z) < bw + 0.3) return false;
    return this.hillHeight(x, z) < 0.06;
  }

  groundColor(x, z, h, out) {
    const n = this.noise(x * 0.8, z * 0.8) * 0.5 + this.noise(x * 3.1, z * 3.1) * 0.25;
    const sd = this.waterSD(x, z);
    const bw = this.beachWidth();
    const sea = bw ? this.seaSD(x, z) : 1e9;
    let c;
    if (h > 0.12) {
      const steep = clamp(h / 4);
      c = mix([0.45, 0.62, 0.3], [0.32, 0.48, 0.25], steep + n * 0.25);
    } else if (sea < bw) {
      const wet = smoothstep(bw * 0.45, 0, sea);
      c = mix([0.93, 0.85, 0.66], [0.78, 0.68, 0.5], wet);
      if (sea < -0.5) c = mix(c, [0.45, 0.55, 0.5], smoothstep(0, 3, -sea));
    } else if (sd < 0) {
      _wc.set(this.waterColorAt(x, z, '#5fae95')).convertLinearToSRGB();
      const bed = [_wc.r * 0.55, _wc.g * 0.55, _wc.b * 0.55];
      c = mix([0.72, 0.69, 0.62], bed, smoothstep(0.05, 0.5, -sd));
    } else if (sd < 0.35 && !this.islandAt(x, z)) {
      c = [0.74, 0.71, 0.64]; // stone embankment
    } else if (h > 0.08) {
      const steep = clamp(h / 3);
      c = mix([0.42, 0.6, 0.3], [0.3, 0.46, 0.24], steep + n * 0.2);
    } else if (this.inPlaza(x, z)) {
      c = [0.88, 0.84, 0.78];
      if ((Math.floor(x * 1.2) + Math.floor(z * 1.2)) % 2 === 0) c = [0.84, 0.8, 0.74];
    } else if (this.inPark(x, z) || this.islandAt(x, z)) {
      c = mix([0.5, 0.7, 0.32], [0.62, 0.76, 0.36], n * 0.5 + 0.5);
    } else {
      c = mix([0.86, 0.82, 0.75], [0.8, 0.76, 0.69], n * 0.5 + 0.5);
    }
    out.setRGB(c[0], c[1], c[2]);
    out.convertSRGBToLinear();
    return out;
  }

  islandAt(x, z) {
    for (const isl of this.islands) if (Math.hypot(x - isl.x, z - isl.z) < isl.r) return isl;
    return null;
  }
}

/** Point-in-polygon (even-odd) on Path points (x,z). */
export function pointInPoly(pts, x, z) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** Signed distance to a closed Path (negative inside). Cheap bbox early-out far away. */
function polySD(path, x, z) {
  const b = path.bbox;
  const bx = Math.max(b.minX - x, 0, x - b.maxX), bz = Math.max(b.minZ - z, 0, z - b.maxZ);
  const bd = Math.hypot(bx, bz);
  if (bd > 2) return bd;
  const d = path.distance(x, z);
  return pointInPoly(path.points, x, z) ? -d : d;
}

function mix(a, b, t) {
  t = clamp(t);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Boolean occupancy raster used to avoid overlapping placements. */
export class Occupancy {
  constructor(size = TILE, res = 0.25) {
    this.res = res;
    this.n = Math.ceil(size / res);
    this.half = size / 2;
    this.grid = new Uint8Array(this.n * this.n);
  }
  idx(x, z) {
    const i = Math.floor((x + this.half) / this.res), j = Math.floor((z + this.half) / this.res);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
    return j * this.n + i;
  }
  get(x, z) { const k = this.idx(x, z); return k < 0 ? 1 : this.grid[k]; }
  markCircle(x, z, r, v = 1) {
    const res = this.res;
    for (let zz = z - r; zz <= z + r; zz += res) for (let xx = x - r; xx <= x + r; xx += res) {
      if ((xx - x) ** 2 + (zz - z) ** 2 <= r * r) { const k = this.idx(xx, zz); if (k >= 0) this.grid[k] = v; }
    }
  }
  _obbIter(cx, cz, hw, hd, rot, fn) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const ext = Math.abs(hw * c) + Math.abs(hd * s), extz = Math.abs(hw * s) + Math.abs(hd * c);
    const res = this.res;
    for (let z = cz - extz; z <= cz + extz + 1e-6; z += res * 0.5) {
      for (let x = cx - ext; x <= cx + ext + 1e-6; x += res * 0.5) {
        const dx = x - cx, dz = z - cz;
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) <= hw && Math.abs(lz) <= hd) { if (fn(x, z) === false) return false; }
      }
    }
    return true;
  }
  isFreeOBB(cx, cz, hw, hd, rot) {
    return this._obbIter(cx, cz, hw, hd, rot, (x, z) => this.get(x, z) === 0);
  }
  markOBB(cx, cz, hw, hd, rot, v = 1) {
    this._obbIter(cx, cz, hw, hd, rot, (x, z) => { const k = this.idx(x, z); if (k >= 0) this.grid[k] = v; });
  }
}
