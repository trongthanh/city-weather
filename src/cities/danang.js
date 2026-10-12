import { BASE_PALETTE } from './palettes.js';
import { Path } from '../core/Path.js';

// Đà Nẵng — Sông Hàn, Cầu Rồng, Cầu sông Hàn, Cầu Trần Thị Lý, Chùa Linh Ứng & tượng Phật Bà (bán đảo Sơn Trà),
// Nhà thờ Con Gà, biển Mỹ Khê với lướt sóng, mô tô nước và thả diều.

const RIVER = [[-3, -24], [-1.6, -10], [-3.4, 2], [-2.2, 12], [-3.2, 24]];
const coast = (z) => 15.4 + 0.5 * Math.sin(z * 0.22) + 0.3 * Math.sin(z * 0.6 + 1) + 6.5 * Math.exp(-(((z + 19) / 4.2) ** 2));
const BEACH = 4.0;

export default {
  id: 'danang',
  seed: 'da-nang-0329',
  name: { vi: 'Đà Nẵng', en: 'Da Nang' },
  lat: 16.0544, lon: 108.2022,
  timezone: 'Asia/Ho_Chi_Minh',
  waterColor: '#4d9fba',
  camera: { azimuth: 25, elevation: 40 },
  palette: { ...BASE_PALETTE, tileRoof: 0.3 },
  scatterTreeDensity: 0.3,
  scatterTrees: [['palm', 2], ['round', 2], ['bush', 1]],
  parkTrees: [['palm', 2], ['round', 2]],

  layout(rng) {
    const river = Path.fromControl(RIVER, { spacing: 0.4 });
    // river travels +z, so +offset = west bank, -offset = east bank
    const west = river.offset(5.0), east = river.offset(-5.0);
    const zAt = (p, z) => { const n = p.points.reduce((b, q) => (Math.abs(q.z - z) < Math.abs(b.z - z) ? q : b)); return n.x; };
    const rx = (z) => zAt(river, z);
    const ex = (z) => zAt(east, z), wx = (z) => zAt(west, z);
    return {
      water: [
        { type: 'river', path: river, width: 6.6, wobble: 0.2 },
        { type: 'sea', coast, side: 1, beach: BEACH },
      ],
      hills: [
        { x: 18.4, z: -19.0, r: 5.4, h: 2.9 },
      ],
      beach: { coast, width: BEACH },
      roads: [
        { name: 'Bạch Đằng', path: west, trees: 3.2, treeKind: 'palm', frontageSide: 1 },
        { name: 'Trần Hưng Đạo', path: east, trees: 3.2, treeKind: 'palm', frontageSide: -1 },
        { name: 'Võ Nguyên Giáp', pts: [[9.4, -22], [9.4, 22]], smooth: false, trees: 2.8, treeKind: 'palm', frontageSide: 1 },
        { name: 'Cầu Rồng', pts: [[-22, 1.5], [9.4, 1.5]], smooth: false, hw: 1.25 },
        { name: 'Cầu sông Hàn', pts: [[-22, -12], [9.4, -12]], smooth: false },
        { pts: [[-14, -22], [-14, 22]], smooth: false, hw: 1.0 },
        { name: 'Cầu Trần Thị Lý', pts: [[-22, 11.5], [9.4, 11.5]], smooth: false, hw: 1.15 },
        { pts: [[ex(-5), -5], [9.4, -5]], smooth: false, hw: 0.95 },
      ],
      walkways: [
        { pts: west.offset(-2.1).points.map((p) => [p.x, p.z]), width: 0.5, smooth: false },
        { pts: east.offset(2.1).points.map((p) => [p.x, p.z]), width: 0.5, smooth: false },
        { pts: Array.from({ length: 23 }, (_, i) => { const z = -14 + i * 1.6; return [coast(z) - BEACH * 0.3, z]; }), paved: false },
      ],
      landmarks: [
        { type: 'dragonBridge', x0: rx(1.5) - 3.0, x1: rx(1.5) + 2.8, z: 1.5 },
        { type: 'hanRiverBridge', x: rx(-12), z: -12 },
        { type: 'tranThiLyBridge', x: rx(11.5), z: 11.5 },
        { type: 'linhUng', x: 18.8, z: -19.4, ry: Math.PI / 2, footprint: { type: 'circle', r: 4.2, x: 17.4, z: -19.4 } },
        { type: 'danangCathedral', x: wx(-6) - 2.85, z: -5.5, ry: 0, footprint: { type: 'rect', w: 2.4, d: 5.0 } },
      ],
      waterways: [
        { kind: 'boat', pts: RIVER.map(([x, z]) => [x + 0.8, z]) },
        { kind: 'boat', pts: RIVER.map(([x, z]) => [x - 1.2, z]) },
        // sea: jet skis & surfers (agents 'sea'), kites over the beach (agents 'kite')
      ],
    };
  },

  style(rng, { phase, x, z }) {
    const east = x > 3.5;
    if (phase === 'front') {
      if (east && x > 7 && rng.chance(0.75)) return { kind: 'hotel', w: rng.range(2.8, 4.0), d: rng.range(2.4, 3.0), floors: rng.int(8, 17), gap: 0.4 };
      if (east && rng.chance(0.4)) return { kind: 'midrise', w: rng.range(2.4, 3.4), d: rng.range(2.4, 3.2), floors: rng.int(6, 12), gap: 0.3, pool: rng.chance(0.3) };
      if (rng.chance(0.12)) return { kind: 'midrise', w: rng.range(2.4, 3.2), d: rng.range(2.4, 3.0), floors: rng.int(5, 9), gap: 0.2 };
      return { kind: 'tube', w: rng.range(1.2, 1.9), d: rng.range(2.2, 3.0), floors: rng.weighted([[2, 2], [3, 4], [4, 3], [5, 1]]), gap: 0.03, roof: rng.chance(0.75) ? 'flat' : 'tile' };
    }
    if (rng.chance(0.12)) return null;
    if (east) return { kind: 'midrise', w: rng.range(2.2, 3.0), d: rng.range(2.2, 3.0), floors: rng.int(4, 9) };
    return { kind: 'tube', w: rng.range(1.3, 2.0), d: rng.range(1.7, 2.5), floors: rng.int(2, 4), roof: 'flat' };
  },
};
