import * as THREE from 'three';
import { BASE_PALETTE } from './palettes.js';
import { Path } from '../core/Path.js';
import { pointInPoly } from '../world/Field.js';

// Hà Nội — Hồ Hoàn Kiếm, Tháp Rùa, Cầu Thê Húc, Đền Ngọc Sơn, Tháp Bút, phố cổ, Văn Miếu,
// Lăng Bác, Chùa Một Cột, Nhà Thờ Lớn, Nhà Hát Lớn.

const LX = 0.5; // lake centre x
const DYKE = 15.2; // Trần Quang Khải dyke road (x)
const RED_RIVER = [[20.6, -26], [21.0, -8], [21.6, 8], [22.6, 26]];

// Outline of Hồ Hoàn Kiếm in map pixels (x → east, y → south), clockwise from the north-west.
const LAKE_PX = [
  [345, 195], [385, 150], [470, 140], [560, 150], [630, 168], [663, 212], [660, 262], [645, 300],
  [700, 345], [700, 420], [703, 520], [722, 600], [742, 665], [732, 790], [716, 900], [700, 1000],
  [685, 1100], [668, 1180], [605, 1200], [545, 1198], [480, 1135], [432, 1020], [398, 900], [386, 780],
  [386, 640], [372, 520], [348, 400], [332, 270],
];

/** Laplacian smoothing of a closed path (removes kinks from offsetting concave parts). */
function smoothLoop(path, iters) {
  let pts = path.points.map((p) => p.clone());
  for (let k = 0; k < iters; k++) {
    pts = pts.map((p, i) => {
      const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
      return new THREE.Vector3((a.x + b.x) / 4 + p.x / 2, p.y, (a.z + b.z) / 4 + p.z / 2);
    });
  }
  return new Path(pts, true);
}

export default {
  id: 'hanoi',
  seed: 'ha-noi-1010',
  name: { vi: 'Hà Nội', en: 'Hanoi' },
  lat: 21.0285, lon: 105.8542,
  timezone: 'Asia/Ho_Chi_Minh',
  waterColor: '#5fae95',
  camera: { azimuth: 35, elevation: 42 },
  palette: { ...BASE_PALETTE, tileRoof: 0.95, colonial: ['#e9b949', '#f0c75c', '#e7b25a', '#f2c76a', '#dea24f', '#efc26b', '#e5ad44', '#d99a52'] },
  parkTreeDensity: 0.5,
  scatterTreeDensity: 0.65,
  scatterTrees: [['round', 3], ['big', 2], ['yellow', 1], ['flame', 0.5]],
  parkTrees: [['round', 3], ['big', 2], ['yellow', 2], ['flame', 0.6]],

  layout(rng) {
    // Hồ Hoàn Kiếm traced from the map (px → scene units; north = -z)
    const lake = Path.fromControl(LAKE_PX.map(([px, py]) => [LX + (px - 540) * 0.026, (py - 670) * 0.0205]), { closed: true, spacing: 0.35 });
    const outward = (d) => { const o = lake.offset(d); return pointInPoly(lake.points, o.points[0].x, o.points[0].z) ? lake.offset(-d) : o; };
    const ring = smoothLoop(outward(3.6), 10);
    const prom = smoothLoop(outward(1.25), 6);
    const treeRing = smoothLoop(outward(2.35), 8);
    const parkPoly = smoothLoop(outward(1.98), 8);
    // spoke start points on the ring
    const near = (fn) => ring.points.reduce((b, p) => (fn(p) < fn(b) ? p : b));
    const N = near((p) => (p.z < 0 ? Math.abs(p.x - LX) : 99));
    const S = near((p) => (p.z > 0 ? Math.abs(p.x - LX - 1.6) : 99));
    const E = near((p) => (p.x > LX ? Math.abs(p.z) : 99));
    // Two tiny east-west lanes flank the cathedral and join the west lake ring.
    const cathedralAlleys = [-3.7, 0.7].map((az, i) => {
      const end = near(p => p.x < LX ? Math.abs(p.z - az) : 99);
      return { name: i === 0 ? 'Ngõ Nhà Thờ — bắc' : 'Ngõ Nhà Thờ — nam', kind: 'alley',
        pts: [[-22, az], [-10.5, az], [end.x, end.z]], smooth: false,
        hw: 0.34, sw: 0, vehicles: ['motorbike'], speedLimit: 0.9,
        frontage: false, lamps: false, trees: 0, surfaceColor: '#8a8379' };
    });

    const trees = [];
    const avoid = [[LX + 2.8, -7.9, 1.6], [LX + 3.75, -9.35, 1.0], [LX - 4.8, -8.6, 1.8]];
    for (let s = 0; s < treeRing.length; s += 1.85) {
      const p = treeRing.pointAt(s);
      if (avoid.some(([x, z, r]) => Math.hypot(p.x - x, p.z - z) < r)) continue;
      trees.push({ x: p.x, z: p.z, kind: rng.weighted([['big', 2], ['round', 2], ['yellow', 1.5], ['flame', 0.5]]), s: rng.range(0.8, 1.0) });
    }
    return {
      water: [
        { type: 'poly', path: lake, wobble: 0.12, color: '#5fae95' },
        { type: 'river', points: RED_RIVER, width: 9, wobble: 0.25, color: '#a8613a' }, // sông Hồng — phù sa red-brown
      ],
      islands: [{ x: LX - 0.52, z: 3.7, r: 0.95 }, { x: LX, z: -7.75, r: 1.55 }],
      parks: [{ type: 'poly', path: parkPoly }],
      plazas: [{ x: -15.0, z: -1.5, w: 7.4, d: 3.8 }], // small churchyard between the alleys
      roads: [
        { name: 'ring', path: ring, trees: 0, lampSpacing: 5.5 },
        { pts: [[N.x, N.z], [N.x, -22]], smooth: false, trees: 2.6 },
        { pts: [[S.x, S.z], [S.x, 22]], smooth: false, trees: 2.6 },
        { name: 'Cầu Chương Dương', pts: [[E.x, E.z], [22, E.z]], smooth: false, hw: 1.1, noRail: false },
        { name: 'Trần Quang Khải (đê sông Hồng)', pts: [[DYKE, -22], [DYKE, 22]], smooth: false, hw: 1.05, trees: 2.6, frontageSide: 1 },
        { pts: [[-22, -19.6], [DYKE, -19.6]], smooth: false, hw: 1.0, trees: 2.8 },
        { pts: [[-22, 19.6], [DYKE, 19.6]], smooth: false, hw: 1.0, trees: 2.8 },
        ...cathedralAlleys,
      ],
      walkways: [{ path: prom, width: 0.6 }],
      landmarks: [
        { type: 'turtleTower', x: LX - 0.52, z: 3.7, ry: 0.25, footprint: { type: 'circle', r: 0.95 } },
        { type: 'ngocSonTemple', x: LX, z: -7.75, ry: 0, footprint: { type: 'circle', r: 1.6 } },
        { type: 'hucBridge', from: [LX + 1.35, -7.7], to: [LX + 4.1, -8.05], footprint: { type: 'circle', x: LX + 4.1, z: -8.05, r: 0.5 } },
        { type: 'penTower', x: LX + 3.6, z: -9.45, footprint: { type: 'circle', r: 0.42 } },
        { type: 'lakePavilion', x: LX - 4.75, z: -8.6, ry: 0.5, footprint: { type: 'rect', w: 2.4, d: 1.8 } },
        { type: 'vanMieu', x: -17.0, z: 10.3, ry: 0, footprint: { type: 'rect', w: 6.4, d: 15.4 } },
        { type: 'hcmMausoleum', x: -16.5, z: -11.6, ry: Math.PI / 2, footprint: { type: 'rect', w: 10.0, d: 9.4 } },
        { type: 'oneLegPagoda', x: -10.9, z: -15.4, scale: 2.2, footprint: { type: 'circle', r: 2.5 } },
        { type: 'stJoseph', x: -15.4, z: -1.5, ry: Math.PI / 2, scale: 1.5, footprint: { type: 'rect', w: 3.4, d: 6.8, x: -15.05 } },
        { type: 'operaHouse', x: 11.1, z: 16.2, ry: Math.PI, scale: 1.2, footprint: { type: 'rect', w: 5.1, d: 4.5, z: 15.75 } },
        { type: 'chuongDuongBridge', x0: DYKE + 1.4, x1: 22, z: E.z },
      ],
      trees,
      waterways: [
        // Both lanes use the visible western half of the Red River; the river
        // itself extends east of the tile, but boat hulls must remain inside it.
        { kind: 'boat', pts: RED_RIVER.map(([x, z]) => [x - 3.0, z]) },
        { kind: 'boat', pts: RED_RIVER.map(([x, z]) => [x - 1.8, z]) },
      ],
    };
  },

  style(rng, { phase, x, z }) {
    const tubeTile = (w0, w1, d0, d1) => ({ kind: 'tube', roof: 'tile', w: rng.range(w0, w1), d: rng.range(d0, d1), floors: rng.weighted([[2, 3], [3, 4], [4, 1.5]]), gap: 0.02 });
    if (phase === 'front') {
      if (rng.chance(0.12)) return { kind: 'villa', w: rng.range(2.4, 3.0), d: rng.range(2.3, 2.8), floors: rng.int(2, 3), gap: 0.4 };
      if (rng.chance(0.55)) return { kind: 'shop', w: rng.range(1.3, 2.3), d: rng.range(2.1, 2.9), floors: rng.weighted([[2, 3], [3, 3], [4, 0.8]]), gap: 0.02 };
      return tubeTile(1.1, 1.7, 2.1, 2.9);
    }
    if (rng.chance(0.4)) return null; // leave room for courtyards & trees
    return rng.chance(0.5)
      ? { kind: 'shop', w: rng.range(1.4, 2.2), d: rng.range(1.7, 2.4), floors: rng.int(2, 3) }
      : tubeTile(1.2, 1.8, 1.6, 2.3);
  },
};
